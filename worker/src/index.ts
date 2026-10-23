// PM Console API (Cloudflare Worker): Google sign-in, roles, and project data in GitHub.
//
//   POST   /auth/google        { credential }      → { token, expiresAt, user }
//   GET    /me                                     → { user }
//   GET    /data/:env                              → { sha, text } | 404
//   PUT    /data/:env          { text, sha }       → { sha } | 409 when changed elsewhere
//   GET    /users              (admin)             → { owner, users }
//   PUT    /users/:email       { role } (admin)    → { users }
//   DELETE /users/:email       (admin)             → { users }
//
// :env is "staging" or "production". Every route except /auth/google needs
// "Authorization: Bearer <session token>".

import { GitHubError, readFile, writeFile, type Repo } from './github'
import {
  AuthError,
  createSessionToken,
  loadGoogleCerts,
  verifyGoogleIdToken,
  verifySessionToken,
  type JwksLoader,
  type SessionClaims,
} from './tokens'
import { getRole, listUsers, updateUsers, type Role, type UserEntry } from './users'

export interface Env {
  /** Secret: fine-grained token, Contents read & write on the data repository only. */
  GITHUB_TOKEN: string
  /** Secret: random string that signs session tokens. */
  SESSION_SECRET: string
  GOOGLE_CLIENT_ID: string
  OWNER_EMAIL: string
  DATA_OWNER: string
  DATA_REPO: string
  DATA_BRANCH: string
  /** Comma-separated origins allowed to call the API. */
  ALLOWED_ORIGINS: string
}

const DATA_PATHS: Record<string, string> = {
  staging: 'staging/projects.json',
  production: 'projects.json',
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_BODY_BYTES = 10 * 1024 * 1024

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function repoFrom(env: Env): Repo {
  return { token: env.GITHUB_TOKEN, owner: env.DATA_OWNER, repo: env.DATA_REPO, branch: env.DATA_BRANCH }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  if (!allowed.includes(origin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function readJson<T>(request: Request): Promise<T> {
  const length = Number(request.headers.get('Content-Length') ?? 0)
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large.')
  try {
    return (await request.json()) as T
  } catch {
    throw new HttpError(400, 'Invalid JSON body.')
  }
}

interface Caller extends SessionClaims {
  role: Role
}

async function authenticate(request: Request, env: Env): Promise<Caller> {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new HttpError(401, 'Sign in required.')
  let claims: SessionClaims
  try {
    claims = await verifySessionToken(token, env.SESSION_SECRET)
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.')
  }
  // Checked on every request, so removing someone takes effect within the cache window.
  const role = await getRole(repoFrom(env), env.OWNER_EMAIL, claims.email)
  if (!role) throw new HttpError(403, `${claims.email} no longer has access.`)
  return { ...claims, role }
}

function publicUser(caller: Omit<Caller, 'exp'>) {
  return { email: caller.email, name: caller.name, picture: caller.picture, role: caller.role }
}

export async function handle(request: Request, env: Env, loadKeys: JwksLoader = loadGoogleCerts) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')
  const method = request.method

  if (method === 'POST' && path === '/auth/google') {
    const { credential } = await readJson<{ credential?: string }>(request)
    if (!credential) throw new HttpError(400, 'Missing Google credential.')
    let profile
    try {
      profile = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID, loadKeys)
    } catch (error) {
      if (error instanceof AuthError) throw new HttpError(401, `Google sign-in failed: ${error.message}`)
      throw error
    }
    const role = await getRole(repoFrom(env), env.OWNER_EMAIL, profile.email)
    if (!role)
      return json(
        { error: `${profile.email} doesn’t have access. Ask an admin to add you.`, email: profile.email },
        403,
      )
    const { token, claims } = await createSessionToken(profile, env.SESSION_SECRET)
    return json({ token, expiresAt: claims.exp * 1000, user: publicUser({ ...profile, role }) })
  }

  const caller = await authenticate(request, env)
  const repo = repoFrom(env)

  if (method === 'GET' && path === '/me') return json({ user: publicUser(caller) })

  const dataMatch = /^\/data\/([a-z]+)$/.exec(path)
  if (dataMatch) {
    const dataPath = DATA_PATHS[dataMatch[1] ?? '']
    if (!dataPath) throw new HttpError(404, 'Unknown environment.')
    if (method === 'GET') {
      const file = await readFile(repo, dataPath)
      return file ? json(file) : json({ error: 'No data yet.' }, 404)
    }
    if (method === 'PUT') {
      const body = await readJson<{ text?: unknown; sha?: unknown }>(request)
      if (typeof body.text !== 'string') throw new HttpError(400, 'Missing text.')
      const sha = typeof body.sha === 'string' ? body.sha : null
      const saved = await writeFile(
        repo,
        dataPath,
        body.text,
        sha,
        `Update projects (${dataMatch[1]}) — ${caller.email}`,
      )
      return json({ sha: saved })
    }
  }

  if (path === '/users' || path.startsWith('/users/')) {
    if (caller.role !== 'admin') throw new HttpError(403, 'Only admins can manage people.')
    if (method === 'GET' && path === '/users')
      return json({ owner: env.OWNER_EMAIL.toLowerCase(), users: await listUsers(repo) })
    const email = decodeURIComponent(path.slice('/users/'.length)).trim().toLowerCase()
    if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.')
    if (email === env.OWNER_EMAIL.toLowerCase()) throw new HttpError(400, 'The owner is always an admin.')
    if (method === 'PUT') {
      const { role } = await readJson<{ role?: unknown }>(request)
      if (role !== 'admin' && role !== 'user') throw new HttpError(400, 'Role must be admin or user.')
      const users = await updateUsers(
        repo,
        (list) => {
          const existing = list.find((user) => user.email === email)
          const entry: UserEntry = existing
            ? { ...existing, role }
            : { email, role, addedAt: new Date().toISOString(), addedBy: caller.email }
          return [...list.filter((user) => user.email !== email), entry]
        },
        `Set ${email} as ${role} — ${caller.email}`,
      )
      return json({ users })
    }
    if (method === 'DELETE') {
      const users = await updateUsers(
        repo,
        (list) => list.filter((user) => user.email !== email),
        `Remove ${email} — ${caller.email}`,
      )
      return json({ users })
    }
  }

  throw new HttpError(404, 'Not found.')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    let response: Response
    try {
      response = await handle(request, env)
    } catch (error) {
      if (error instanceof HttpError) response = json({ error: error.message }, error.status)
      else if (error instanceof GitHubError) response = json({ error: error.message }, error.status)
      else {
        console.error(error)
        response = json({ error: 'Server error.' }, 500)
      }
    }
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value)
    return response
  },
}
