// One-file reads and writes in the private data repository (GitHub REST "contents" API).
// The token lives only in the Worker's secrets; browsers never see it.

export interface Repo {
  token: string
  owner: string
  repo: string
  branch: string
}

export interface RemoteFile {
  sha: string
  text: string
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

function headers(repo: Repo, accept = 'application/vnd.github+json') {
  return {
    Accept: accept,
    Authorization: `Bearer ${repo.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pm-console-api',
  }
}

function contentsUrl(repo: Repo, path: string) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/contents/${encoded}`
}

async function failure(response: Response): Promise<GitHubError> {
  if (response.status === 401) return new GitHubError(502, 'The server’s GitHub token is invalid or expired.')
  if (response.status === 403 || response.status === 404)
    return new GitHubError(502, 'The server’s GitHub token cannot reach the data repository.')
  const body = (await response.json().catch(() => ({}))) as { message?: string }
  return new GitHubError(502, `GitHub error ${response.status}: ${body.message ?? response.statusText}`)
}

/** Reads a file, or null when it does not exist yet. */
export async function readFile(repo: Repo, path: string): Promise<RemoteFile | null> {
  const url = `${contentsUrl(repo, path)}?ref=${encodeURIComponent(repo.branch)}`
  const response = await fetch(url, { headers: headers(repo), cache: 'no-store' })
  if (response.status === 404) {
    // 404 also means "no access"; tell them apart by checking the repository itself.
    const repoCheck = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`,
      { headers: headers(repo) },
    )
    if (repoCheck.ok) return null
    throw await failure(repoCheck)
  }
  if (!response.ok) throw await failure(response)
  const file = (await response.json()) as { sha: string; content?: string; encoding?: string }
  if (file.encoding === 'base64' && file.content) return { sha: file.sha, text: fromBase64(file.content) }
  // Files over 1 MB come back without content; fetch the raw text instead.
  const raw = await fetch(url, { headers: headers(repo, 'application/vnd.github.raw+json') })
  if (!raw.ok) throw await failure(raw)
  return { sha: file.sha, text: await raw.text() }
}

/** Writes a file. `sha` is the version being replaced (null to create). 409 when it changed. */
export async function writeFile(
  repo: Repo,
  path: string,
  text: string,
  sha: string | null,
  message: string,
): Promise<string> {
  const response = await fetch(contentsUrl(repo, path), {
    method: 'PUT',
    headers: { ...headers(repo), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64(text),
      branch: repo.branch,
      ...(sha ? { sha } : {}),
    }),
  })
  // 409: sha is stale. 422: file exists but no sha was sent. Either way someone else saved first.
  if (response.status === 409 || response.status === 422)
    throw new GitHubError(409, 'The data changed since it was last loaded.')
  if (!response.ok) throw await failure(response)
  const result = (await response.json()) as { content: { sha: string } }
  return result.content.sha
}
