import { waitFor } from '@testing-library/react'
import { useAuth } from '@/features/auth/useAuth'
import { pullNow, pushNow, resolveConflict, startSync, useSync } from '@/features/sync/sync'
import { createBackup } from '@/lib/backupFile'
import { dataPath, storageKey } from '@/lib/env'
import { createInitialWorkspace, STORE_VERSION, useAppStore } from '@/store/useAppStore'
import { signInForTest } from '@/test/auth'

const DATA_URL = 'https://api.test/data/staging'
const MEMORY_KEY = 'pm-console-github-sync'

/** Fake PM Console API holding this site's data file. */
function fakeApi(initial: string | null) {
  let file = initial === null ? null : { text: initial, sha: 'sha-1' }
  let version = 1
  const puts: { sha: string | null; text: string; keepalive?: boolean }[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toBe(DATA_URL)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-session')
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { text: string; sha: string | null }
      if ((file?.sha ?? null) !== body.sha) return Response.json({ error: 'changed' }, { status: 409 })
      version += 1
      file = { text: body.text, sha: `sha-${version}` }
      puts.push({ ...body, keepalive: init.keepalive })
      return Response.json({ sha: file.sha })
    }
    if (!file) return Response.json({ error: 'No data yet.' }, { status: 404 })
    return Response.json(file)
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    puts,
    fetchMock,
    /** Simulates another computer saving. */
    remoteSave(text: string) {
      version += 1
      file = { text, sha: `sha-${version}` }
    },
  }
}

function workspaceText(name: string) {
  const workspace = createInitialWorkspace()
  const id = workspace.activeProjectId
  const data = workspace.library[id]!
  const library = { [id]: { ...data, project: { ...data.project, name } } }
  return JSON.stringify(createBackup({ library, activeProjectId: id }, STORE_VERSION, new Date()))
}

const names = () => Object.values(useAppStore.getState().library).map((d) => d.project.name)
const markDirty = () =>
  localStorage.setItem(
    MEMORY_KEY,
    JSON.stringify({ ...JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '{}'), dirty: true }),
  )

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialWorkspace())
  useSync.setState({ status: 'off', message: '', lastSyncedAt: null, conflict: null })
  signInForTest()
})

describe('sync through the API', () => {
  it('does nothing while signed out', async () => {
    const api = fakeApi(null)
    useAuth.getState().signOut()
    await pullNow()
    expect(api.fetchMock).not.toHaveBeenCalled()
  })

  it('creates the data file when there is none', async () => {
    const api = fakeApi(null)
    useAppStore.getState().updateProject({ name: 'Local project' })
    await pullNow()
    expect(api.puts).toHaveLength(1)
    expect(api.puts[0]?.text).toContain('Local project')
    expect(useSync.getState().status).toBe('saved')
  })

  it('loads projects on a computer with nothing yet', async () => {
    fakeApi(workspaceText('From the other laptop'))
    await pullNow()
    expect(names()).toEqual(['From the other laptop'])
    expect(useSync.getState().status).toBe('saved')
  })

  it('saves local changes with the last seen version, then picks up remote changes', async () => {
    const api = fakeApi(workspaceText('Shared'))
    await pullNow()
    useAppStore.getState().updateProject({ name: 'Shared, renamed here' })
    await pushNow()
    expect(api.puts.at(-1)).toMatchObject({ sha: 'sha-1' })

    api.remoteSave(workspaceText('Renamed on laptop'))
    await pullNow()
    expect(names()).toEqual(['Renamed on laptop'])
  })

  it('asks when both sides changed, and can keep either version', async () => {
    const api = fakeApi(workspaceText('Original'))
    await pullNow()
    api.remoteSave(workspaceText('Laptop version'))
    useAppStore.getState().updateProject({ name: 'Desktop version' })
    markDirty()

    await pullNow()
    expect(useSync.getState().status).toBe('conflict')
    expect(names()).toEqual(['Desktop version'])

    await resolveConflict('local')
    await waitFor(() => expect(useSync.getState().status).toBe('saved'))
    expect(api.puts.at(-1)?.text).toContain('Desktop version')

    api.remoteSave(workspaceText('Newest laptop'))
    markDirty()
    await pullNow()
    await resolveConflict('remote')
    expect(names()).toEqual(['Newest laptop'])
  })

  it('does not overwrite unsynced local data on first load', async () => {
    fakeApi(workspaceText('Remote'))
    useAppStore.getState().updateProject({ name: 'Unsynced local work' })
    await pullNow()
    expect(useSync.getState().status).toBe('conflict')
    expect(names()).toEqual(['Unsynced local work'])
  })

  it('saves right away when the tab is hidden', async () => {
    const api = fakeApi(workspaceText('Shared'))
    const stop = startSync()
    await waitFor(() => expect(useSync.getState().status).toBe('saved'))
    useAppStore.getState().updateProject({ name: 'Edited just before closing' })

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(api.puts).toHaveLength(1))
    expect(api.puts[0]).toMatchObject({ keepalive: true })
    expect(api.puts[0]?.text).toContain('Edited just before closing')

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    stop()
  })

  it('reports server problems clearly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'The server’s GitHub token is invalid or expired.' }, { status: 502 }),
      ),
    )
    await pullNow()
    expect(useSync.getState()).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/invalid or expired/),
    })
  })
})

describe('environments', () => {
  it('keeps Staging and Production apart', () => {
    expect(dataPath('staging')).toBe('staging/projects.json')
    expect(dataPath('production')).toBe('projects.json')
    expect(storageKey('v1', 'staging')).toBe('pm-console-v1')
    expect(storageKey('v1', 'production')).toBe('pm-console-prod-v1')
  })
})
