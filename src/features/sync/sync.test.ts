import { waitFor } from '@testing-library/react'
import { pullNow, pushNow, resolveConflict, useSync } from '@/features/sync/sync'
import { createBackup } from '@/lib/backupFile'
import { fromBase64, saveGitHubSettings, toBase64 } from '@/lib/githubSync'
import { createInitialWorkspace, STORE_VERSION, useAppStore } from '@/store/useAppStore'

/** A fake GitHub "contents" endpoint holding one file. */
function fakeGitHub(initial: string | null) {
  let file = initial === null ? null : { text: initial, sha: 'sha-1' }
  let version = 1
  const puts: { sha?: string; text: string }[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { content: string; sha?: string }
      if ((file?.sha ?? undefined) !== body.sha) return new Response('{}', { status: 409 })
      version += 1
      file = { text: fromBase64(body.content), sha: `sha-${version}` }
      puts.push({ sha: body.sha, text: file.text })
      return Response.json({ content: { sha: file.sha } })
    }
    if (!file) return new Response('{}', { status: 404 })
    expect(url).toContain('/repos/ArtemiiVarta/pm-console-data/contents/projects.json')
    return Response.json({ sha: file.sha, encoding: 'base64', content: toBase64(file.text) })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    puts,
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

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialWorkspace())
  useSync.setState({ status: 'off', message: '', lastSyncedAt: null, conflict: null })
  saveGitHubSettings({
    token: 'test-token',
    owner: 'ArtemiiVarta',
    repo: 'pm-console-data',
    branch: 'main',
    path: 'projects.json',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GitHub sync', () => {
  it('creates the data file when GitHub has none', async () => {
    const github = fakeGitHub(null)
    useAppStore.getState().updateProject({ name: 'Local project' })
    await pullNow()
    expect(github.puts).toHaveLength(1)
    expect(github.puts[0]?.text).toContain('Local project')
    expect(useSync.getState().status).toBe('saved')
  })

  it('loads projects from GitHub on a computer with nothing yet', async () => {
    fakeGitHub(workspaceText('From the other laptop'))
    await pullNow()
    expect(names()).toEqual(['From the other laptop'])
    expect(useSync.getState().status).toBe('saved')
  })

  it('saves local changes with the last seen version, then picks up remote changes', async () => {
    const github = fakeGitHub(workspaceText('Shared'))
    await pullNow()
    useAppStore.getState().updateProject({ name: 'Shared, renamed here' })
    await pushNow()
    expect(github.puts.at(-1)).toMatchObject({ sha: 'sha-1' })

    github.remoteSave(workspaceText('Renamed on laptop'))
    await pullNow()
    expect(names()).toEqual(['Renamed on laptop'])
  })

  it('asks when both sides changed, and can keep either version', async () => {
    const github = fakeGitHub(workspaceText('Original'))
    await pullNow()
    github.remoteSave(workspaceText('Laptop version'))
    useAppStore.getState().updateProject({ name: 'Desktop version' })
    localStorage.setItem(
      'pm-console-github-state',
      JSON.stringify({ ...JSON.parse(localStorage.getItem('pm-console-github-state') ?? '{}'), dirty: true }),
    )

    await pullNow()
    expect(useSync.getState().status).toBe('conflict')
    expect(names()).toEqual(['Desktop version'])

    await resolveConflict('local')
    await waitFor(() => expect(useSync.getState().status).toBe('saved'))
    expect(github.puts.at(-1)?.text).toContain('Desktop version')

    github.remoteSave(workspaceText('Newest laptop'))
    localStorage.setItem(
      'pm-console-github-state',
      JSON.stringify({ ...JSON.parse(localStorage.getItem('pm-console-github-state') ?? '{}'), dirty: true }),
    )
    await pullNow()
    await resolveConflict('remote')
    expect(names()).toEqual(['Newest laptop'])
  })

  it('does not overwrite real local data on first connect', async () => {
    fakeGitHub(workspaceText('Remote'))
    useAppStore.getState().updateProject({ name: 'Unsynced local work' })
    await pullNow()
    expect(useSync.getState().status).toBe('conflict')
    expect(names()).toEqual(['Unsynced local work'])
  })

  it('reports a bad token clearly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: 'Bad credentials' }, { status: 401 })),
    )
    await pullNow()
    expect(useSync.getState()).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/invalid or expired/),
    })
  })
})

describe('base64', () => {
  it('round-trips non-Latin text', () => {
    const text = 'Projet été — 東京 ✓'
    expect(fromBase64(toBase64(text))).toBe(text)
  })
})
