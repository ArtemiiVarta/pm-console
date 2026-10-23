import { create } from 'zustand'
import { useAuth } from '@/features/auth/useAuth'
import { ApiError, readData, writeData } from '@/lib/api'
import { createBackup, type Backup } from '@/lib/backupFile'
import { storageKey } from '@/lib/env'
import { STORE_KEY, STORE_VERSION, useAppStore, type AppData } from '@/store/useAppStore'

// Always-on sync of every project to GitHub, through the PM Console API, while signed in.
// This browser's copy is a cache: it loads on sign-in, saves shortly after each change and when
// the tab is hidden or closed, and checks for changes from other computers every few seconds.

export type SyncStatus = 'off' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict'

export interface SyncConflict {
  remote: Backup
  remoteSha: string
}

interface SyncState {
  status: SyncStatus
  message: string
  lastSyncedAt: string | null
  conflict: SyncConflict | null
}

/** What this device last synced, kept across reloads. */
interface SyncMemory {
  /** sha of this site's data file that this device last read or wrote. */
  sha: string | null
  /** Local changes not yet saved to GitHub. */
  dirty: boolean
  lastSyncedAt: string | null
}

// Per site: Staging and Production sync different files.
const MEMORY_KEY = storageKey('github-sync')
const SAVE_DELAY_MS = 1500
const POLL_MS = 15_000

const signedIn = () => useAuth.getState().session !== null

export const useSync = create<SyncState>(() => ({
  status: signedIn() ? 'loading' : 'off',
  message: '',
  lastSyncedAt: readMemory().lastSyncedAt,
  conflict: null,
}))

function readMemory(): SyncMemory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY)
    return raw
      ? { sha: null, dirty: false, lastSyncedAt: null, ...(JSON.parse(raw) as Partial<SyncMemory>) }
      : { sha: null, dirty: false, lastSyncedAt: null }
  } catch {
    return { sha: null, dirty: false, lastSyncedAt: null }
  }
}

function writeMemory(patch: Partial<SyncMemory>) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...readMemory(), ...patch }))
  } catch {
    // Storage blocked: sync still works for this page load.
  }
}

export function forgetSyncMemory() {
  try {
    localStorage.removeItem(MEMORY_KEY)
  } catch {
    // Nothing stored.
  }
}

let applyingRemote = false
let busy = false
let saveTimer: number | undefined
/** Bumped on every local change, so a save that raced with an edit knows to save again. */
let changeCounter = 0

/** True when this device holds nothing worth keeping (only an empty, untitled project). */
export function isWorkspaceEmpty(library: Record<string, AppData>): boolean {
  return Object.values(library).every(
    (data) =>
      !data.project.name.trim() &&
      data.phases.length === 0 &&
      data.items.length === 0 &&
      data.milestones.length === 0 &&
      data.members.length === 0 &&
      data.baselines.length === 0,
  )
}

async function parseRemote(text: string): Promise<Backup> {
  // zod loads on demand to keep the first bundle small.
  const { parseBackup } = await import('@/lib/backup')
  const parsed = parseBackup(text, STORE_VERSION)
  if (!parsed.ok) throw new Error(`The GitHub data file could not be read: ${parsed.error}`)
  return parsed.backup
}

function applyRemote(remote: Backup, sha: string) {
  const state = useAppStore.getState()
  const { library } = remote.workspace
  // Keep the project open on this device when it still exists.
  const activeProjectId = library[state.activeProjectId]
    ? state.activeProjectId
    : remote.workspace.activeProjectId
  applyingRemote = true
  try {
    state.replaceWorkspace({ library, activeProjectId })
  } finally {
    applyingRemote = false
  }
  const now = new Date().toISOString()
  writeMemory({ sha, dirty: false, lastSyncedAt: now })
  useSync.setState({ status: 'saved', message: '', lastSyncedAt: now, conflict: null })
}

function fail(error: unknown) {
  useSync.setState({
    status: 'error',
    message: error instanceof Error ? error.message : 'Sync failed.',
  })
}

/** Reads GitHub and reconciles: take remote changes, push local ones, or ask on a conflict. */
export async function pullNow(): Promise<void> {
  if (!signedIn() || busy) return
  busy = true
  if (useSync.getState().status !== 'conflict') useSync.setState({ status: 'loading', message: '' })
  try {
    const memory = readMemory()
    const remote = await readData()
    if (!remote) {
      // No data file yet: this device creates it.
      busy = false
      await pushNow()
      return
    }
    if (remote.sha === memory.sha) {
      busy = false
      if (memory.dirty) await pushNow()
      else useSync.setState({ status: 'saved', message: '' })
      return
    }
    const parsed = await parseRemote(remote.text)
    const local = useAppStore.getState().library
    // Changed elsewhere. Safe to take when nothing here is unsaved (or there is nothing here yet).
    const unsavedHere = memory.dirty || (memory.sha === null && !isWorkspaceEmpty(local))
    if (!unsavedHere) applyRemote(parsed, remote.sha)
    else
      useSync.setState({
        status: 'conflict',
        conflict: { remote: parsed, remoteSha: remote.sha },
        message: '',
      })
  } catch (error) {
    fail(error)
  } finally {
    busy = false
  }
}

/** Saves every project to GitHub. With `overwriteSha`, replaces a version saved elsewhere. */
export async function pushNow(overwriteSha?: string): Promise<void> {
  if (!signedIn() || busy) return
  if (useSync.getState().status === 'conflict' && !overwriteSha) return
  busy = true
  window.clearTimeout(saveTimer)
  const startedAt = changeCounter
  useSync.setState({ status: 'saving', message: '' })
  try {
    const now = new Date()
    const sha = await writeData(snapshot(now), overwriteSha ?? readMemory().sha)
    const stillDirty = changeCounter !== startedAt
    writeMemory({ sha, dirty: stillDirty, lastSyncedAt: now.toISOString() })
    useSync.setState({ status: 'saved', message: '', lastSyncedAt: now.toISOString(), conflict: null })
    busy = false
    if (stillDirty) scheduleSave()
  } catch (error) {
    busy = false
    if (error instanceof ApiError && error.status === 409) {
      // Someone else saved first: compare with their version.
      writeMemory({ dirty: true })
      await pullNow()
    } else {
      fail(error)
    }
  } finally {
    busy = false
  }
}

function scheduleSave() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void pushNow(), SAVE_DELAY_MS)
}

function snapshot(now: Date): string {
  const { library, activeProjectId } = useAppStore.getState()
  return JSON.stringify(createBackup({ library, activeProjectId }, STORE_VERSION, now), null, 2)
}

/** True while this browser has changes GitHub does not have yet. */
export function hasUnsavedChanges(): boolean {
  return readMemory().dirty
}

/** Last-chance save when the tab is hidden or closing; the request outlives the page. */
function flush() {
  if (!signedIn() || busy || !readMemory().dirty || useSync.getState().status === 'conflict') return
  window.clearTimeout(saveTimer)
  const now = new Date()
  const startedAt = changeCounter
  busy = true
  writeData(snapshot(now), readMemory().sha, true)
    .then((sha) => {
      writeMemory({ sha, dirty: changeCounter !== startedAt, lastSyncedAt: now.toISOString() })
      useSync.setState({ status: 'saved', message: '', lastSyncedAt: now.toISOString() })
    })
    .catch(() => {
      // Still marked unsaved; the next pull or save sorts it out.
    })
    .finally(() => {
      busy = false
    })
}

/** Another tab of this site saved projects to this browser: show them here too. */
async function adoptOtherTab() {
  const { activeProjectId } = useAppStore.getState()
  applyingRemote = true
  try {
    await useAppStore.persist.rehydrate()
    // Keep this tab on the project it had open.
    if (useAppStore.getState().library[activeProjectId]) useAppStore.getState().openProject(activeProjectId)
  } finally {
    applyingRemote = false
  }
}

/** Resolves a conflict by keeping this device's projects or GitHub's. */
export async function resolveConflict(keep: 'local' | 'remote'): Promise<void> {
  const conflict = useSync.getState().conflict
  if (!conflict) return
  if (keep === 'remote') {
    applyRemote(conflict.remote, conflict.remoteSha)
    return
  }
  useSync.setState({ conflict: null, status: 'saving' })
  await pushNow(conflict.remoteSha)
}

/**
 * Starts syncing for the signed-in page: load now, save after local changes and when the tab is
 * hidden, and check GitHub when the tab is shown and every 15 seconds. Returns a cleanup function.
 */
export function startSync(): () => void {
  if (!signedIn()) {
    useSync.setState({ status: 'off', message: '', conflict: null })
    return () => {}
  }
  void pullNow()
  const unsubscribe = useAppStore.subscribe((state, previous) => {
    if (state.library === previous.library || applyingRemote) return
    changeCounter += 1
    writeMemory({ dirty: true })
    if (useSync.getState().status !== 'conflict') scheduleSave()
  })
  const refresh = () => {
    if (!readMemory().dirty && !busy && document.visibilityState === 'visible') void pullNow()
  }
  const onVisibility = () => (document.visibilityState === 'hidden' ? flush() : refresh())
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORE_KEY && event.newValue) void adoptOtherTab()
  }
  const interval = window.setInterval(refresh, POLL_MS)
  window.addEventListener('focus', refresh)
  window.addEventListener('pagehide', flush)
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    unsubscribe()
    window.clearInterval(interval)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('pagehide', flush)
    window.removeEventListener('storage', onStorage)
    document.removeEventListener('visibilitychange', onVisibility)
    window.clearTimeout(saveTimer)
  }
}
