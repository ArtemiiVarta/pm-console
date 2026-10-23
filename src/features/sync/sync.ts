import { create } from 'zustand'
import { createBackup, type Backup } from '@/lib/backupFile'
import { storageKey } from '@/lib/env'
import {
  GitHubError,
  loadGitHubSettings,
  readRemote,
  writeRemote,
  type GitHubSettings,
} from '@/lib/githubSync'
import { STORE_VERSION, useAppStore, type AppData } from '@/store/useAppStore'

export type SyncStatus = 'off' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict'

export interface SyncConflict {
  remote: Backup
  remoteSha: string
}

interface SyncState {
  /** Bumped when this device connects or disconnects, to restart syncing. */
  session: number
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
const SAVE_DELAY_MS = 2500

export const useSync = create<SyncState>(() => ({
  session: 0,
  status: loadGitHubSettings() ? 'loading' : 'off',
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
  const settings = loadGitHubSettings()
  if (!settings || busy) return
  busy = true
  if (useSync.getState().status !== 'conflict') useSync.setState({ status: 'loading', message: '' })
  try {
    const memory = readMemory()
    const remote = await readRemote(settings)
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
  const settings = loadGitHubSettings()
  if (!settings || busy) return
  if (useSync.getState().status === 'conflict' && !overwriteSha) return
  busy = true
  window.clearTimeout(saveTimer)
  const startedAt = changeCounter
  useSync.setState({ status: 'saving', message: '' })
  try {
    const { library, activeProjectId } = useAppStore.getState()
    const now = new Date()
    const text = JSON.stringify(createBackup({ library, activeProjectId }, STORE_VERSION, now), null, 2)
    const count = Object.keys(library).length
    const sha = await writeRemote(
      settings,
      text,
      overwriteSha ?? readMemory().sha,
      `Update ${count} project${count === 1 ? '' : 's'} from PM Console`,
    )
    const stillDirty = changeCounter !== startedAt
    writeMemory({ sha, dirty: stillDirty, lastSyncedAt: now.toISOString() })
    useSync.setState({ status: 'saved', message: '', lastSyncedAt: now.toISOString(), conflict: null })
    busy = false
    if (stillDirty) scheduleSave()
  } catch (error) {
    busy = false
    if (error instanceof GitHubError && error.status === 409) {
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

/** Restarts syncing after connecting or disconnecting this device. */
export function restartSync() {
  useSync.setState((state) => ({ session: state.session + 1, conflict: null }))
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
 * Starts syncing for this page: load now, save after local changes, and check GitHub again when
 * the tab regains focus and once a minute. Returns a cleanup function.
 */
export function startSync(): () => void {
  if (!loadGitHubSettings()) {
    useSync.setState({ status: 'off', message: '' })
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
  const interval = window.setInterval(refresh, 60_000)
  window.addEventListener('focus', refresh)
  return () => {
    unsubscribe()
    window.clearInterval(interval)
    window.removeEventListener('focus', refresh)
    window.clearTimeout(saveTimer)
  }
}

export type { GitHubSettings }
