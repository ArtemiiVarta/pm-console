// GitHub storage for all projects: one JSON file in a private repository, read and written
// with the GitHub REST "contents" API straight from the browser. Each device keeps its own
// fine-grained token (Contents: read & write on that one repository) in localStorage.
// Staging and Production share the token but each site reads and writes its own file.

import { dataPath } from '@/lib/env'

export interface GitHubSettings {
  token: string
  owner: string
  repo: string
  branch: string
  path: string
}

export const DEFAULT_GITHUB_SETTINGS: Omit<GitHubSettings, 'token'> = {
  owner: 'ArtemiiVarta',
  repo: 'pm-console-data',
  branch: 'main',
  path: dataPath(),
}

// Shared by both sites (same origin, same repository), so Production needs no second setup.
const SETTINGS_KEY = 'pm-console-github'

export function loadGitHubSettings(): GitHubSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GitHubSettings>
    // The file always follows the site, whatever an older version saved.
    return parsed.token
      ? { ...DEFAULT_GITHUB_SETTINGS, ...parsed, path: DEFAULT_GITHUB_SETTINGS.path, token: parsed.token }
      : null
  } catch {
    return null
  }
}

export function saveGitHubSettings(settings: GitHubSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function clearGitHubSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY)
  } catch {
    // Nothing stored.
  }
}

export class GitHubError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** UTF-8 safe base64 (btoa alone only handles Latin-1). */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function fromBase64(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

function headers(settings: GitHubSettings, accept = 'application/vnd.github+json') {
  return {
    Accept: accept,
    Authorization: `Bearer ${settings.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function contentsUrl(settings: GitHubSettings) {
  const path = settings.path.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}`
}

async function fail(response: Response, action: string): Promise<never> {
  const detail = await response
    .json()
    .then((body: { message?: string }) => body.message ?? '')
    .catch(() => '')
  const hint =
    response.status === 401
      ? 'The token is invalid or expired.'
      : response.status === 403
        ? 'The token is not allowed to do this (it needs Contents: read and write on the repository).'
        : response.status === 404
          ? 'Repository not found, or the token has no access to it.'
          : detail || `GitHub answered ${response.status}.`
  throw new GitHubError(response.status, `Could not ${action}. ${hint}`)
}

/** Checks the token can see the repository; returns whether it is private. */
export async function checkRepository(settings: GitHubSettings): Promise<{ private: boolean }> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`,
    { headers: headers(settings), cache: 'no-store' },
  )
  if (!response.ok) await fail(response, 'reach the repository')
  const body = (await response.json()) as { private?: boolean }
  return { private: Boolean(body.private) }
}

export interface RemoteFile {
  sha: string
  text: string
}

/** The data file, or null when it does not exist yet. */
export async function readRemote(settings: GitHubSettings): Promise<RemoteFile | null> {
  const url = `${contentsUrl(settings)}?ref=${encodeURIComponent(settings.branch)}`
  const response = await fetch(url, { headers: headers(settings), cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) await fail(response, 'load projects from GitHub')
  const body = (await response.json()) as { sha: string; content?: string; encoding?: string }
  if (body.encoding === 'base64' && body.content !== undefined)
    return { sha: body.sha, text: fromBase64(body.content) }
  // Files over 1 MB come without inline content: fetch the raw file.
  const raw = await fetch(url, {
    headers: headers(settings, 'application/vnd.github.raw+json'),
    cache: 'no-store',
  })
  if (!raw.ok) await fail(raw, 'load projects from GitHub')
  return { sha: body.sha, text: await raw.text() }
}

/**
 * Writes the data file. `sha` is the version this device last saw: GitHub refuses the write
 * (409 conflict) when someone else saved in between. Returns the new sha.
 */
export async function writeRemote(
  settings: GitHubSettings,
  text: string,
  sha: string | null,
  message: string,
): Promise<string> {
  const response = await fetch(contentsUrl(settings), {
    method: 'PUT',
    headers: { ...headers(settings), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64(text),
      branch: settings.branch,
      ...(sha ? { sha } : {}),
    }),
  })
  if (response.status === 409 || response.status === 422) {
    throw new GitHubError(409, 'Another device saved in the meantime.')
  }
  if (!response.ok) await fail(response, 'save projects to GitHub')
  const body = (await response.json()) as { content?: { sha?: string } }
  return body.content?.sha ?? ''
}
