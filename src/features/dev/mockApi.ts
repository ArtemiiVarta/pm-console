// Local testing only (`npm run dev`): a stand-in for the PM Console API that keeps its "GitHub"
// data in this browser, so every page — including Admin and sync — can be tested without Google
// or real data. Only imported behind import.meta.env.DEV, so it never ships to Staging or Production.

import { API_URL } from '@/lib/env'
import type { PersonEntry, Role, Session, SessionUser } from '@/lib/api'

const FLAG_KEY = 'pm-console-dev-mock'
const REMOTE_KEY = 'pm-console-dev-remote'
const PEOPLE_KEY = 'pm-console-dev-people'
const AUTH_KEY = 'pm-console-auth'

export const TEST_OWNER = 'test.admin@localhost'
export const TEST_USER = 'test.user@localhost'

interface RemoteFile {
  sha: string
  text: string
}

let installed = false

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function people(): PersonEntry[] {
  return read<PersonEntry[]>(PEOPLE_KEY, [
    { email: TEST_USER, role: 'user', addedAt: new Date().toISOString(), addedBy: TEST_OWNER },
  ])
}

function signedInUser(request: Headers): SessionUser | null {
  if (request.get('Authorization') !== 'Bearer dev-session') return null
  return read<Session | null>(AUTH_KEY, null)?.user ?? null
}

function reply(body: unknown, status = 200) {
  return Promise.resolve(Response.json(body, { status }))
}

function handle(url: URL, init: RequestInit = {}): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '')
  const method = init.method ?? 'GET'
  const user = signedInUser(new Headers(init.headers))
  if (!user) return reply({ error: 'Sign in required.' }, 401)
  if (method === 'GET' && path === '/me') return reply({ user })

  const data = /^\/data\/([a-z]+)$/.exec(path)
  if (data) {
    const files = read<Record<string, RemoteFile>>(REMOTE_KEY, {})
    const env = data[1] ?? ''
    if (method === 'GET') return files[env] ? reply(files[env]) : reply({ error: 'No data yet.' }, 404)
    const body = JSON.parse(String(init.body)) as { text: string; sha: string | null }
    if ((files[env]?.sha ?? null) !== body.sha) return reply({ error: 'Changed elsewhere.' }, 409)
    const sha = `dev-${Date.now().toString(36)}`
    write(REMOTE_KEY, { ...files, [env]: { sha, text: body.text } })
    return reply({ sha })
  }

  if (path.startsWith('/users')) {
    if (user.role !== 'admin') return reply({ error: 'Only admins can manage people.' }, 403)
    if (method === 'GET') return reply({ owner: TEST_OWNER, users: people() })
    const email = decodeURIComponent(path.slice('/users/'.length)).toLowerCase()
    if (email === TEST_OWNER) return reply({ error: 'The owner is always an admin.' }, 400)
    let list = people().filter((person) => person.email !== email)
    if (method === 'PUT') {
      const { role } = JSON.parse(String(init.body)) as { role: Role }
      const existing = people().find((person) => person.email === email)
      list = [
        ...list,
        existing
          ? { ...existing, role }
          : { email, role, addedAt: new Date().toISOString(), addedBy: user.email },
      ].sort((a, b) => a.email.localeCompare(b.email))
    }
    write(PEOPLE_KEY, list)
    return reply({ users: list })
  }
  return reply({ error: 'Not found.' }, 404)
}

/** Routes calls to the API through the stand-in; everything else still reaches the network. */
export function installMockApi() {
  if (installed) return
  installed = true
  const realFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (API_URL && url.startsWith(API_URL)) return handle(new URL(url), init)
    return realFetch(input, init)
  }
}

/** Re-installs the stand-in after a reload of a tab that is in local test mode. */
export function restoreMockApi() {
  if (sessionStorage.getItem(FLAG_KEY) === '1') installMockApi()
}

/** Signs in as a test person (no Google); the API stand-in answers from now on in this tab. */
export function createTestSession(role: Role): Session {
  sessionStorage.setItem(FLAG_KEY, '1')
  installMockApi()
  const email = role === 'admin' ? TEST_OWNER : TEST_USER
  return {
    token: 'dev-session',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    user: { email, name: role === 'admin' ? 'Test Admin' : 'Test User', picture: '', role },
  }
}
