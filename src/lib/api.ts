// Client for the PM Console API (/worker). Every call except sign-in carries the session token.

import { API_URL, APP_ENV } from '@/lib/env'

export type Role = 'admin' | 'user'

export interface SessionUser {
  email: string
  name: string
  picture: string
  role: Role
}

export interface Session {
  token: string
  /** Milliseconds since epoch. */
  expiresAt: number
  user: SessionUser
}

export interface PersonEntry {
  email: string
  role: Role
  addedAt: string
  addedBy: string
}

export interface PeopleList {
  owner: string
  users: PersonEntry[]
}

export interface RemoteFile {
  sha: string
  text: string
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Returns the current session token; set by the auth store so this module stays independent. */
let tokenSource: () => string | null = () => null
/** Called when the server says the session is no longer valid (401 / 403). */
let onRejected: (error: ApiError) => void = () => {}

export function configureApi(options: {
  getToken: () => string | null
  onRejected: (error: ApiError) => void
}) {
  tokenSource = options.getToken
  onRejected = options.onRejected
}

async function request<T>(
  path: string,
  init: RequestInit & { body?: string } = {},
  authenticated = true,
): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'The sign-in server is not configured yet.')
  const headers: Record<string, string> = {}
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (authenticated) {
    const token = tokenSource()
    if (!token) throw new ApiError(401, 'Sign in required.')
    headers.Authorization = `Bearer ${token}`
  }
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.')
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    const error = new ApiError(response.status, body.error ?? `Server error ${response.status}.`)
    if (authenticated && (response.status === 401 || response.status === 403) && !path.startsWith('/users'))
      onRejected(error)
    throw error
  }
  return body as T
}

export function signInWithGoogle(credential: string): Promise<Session> {
  return request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }, false)
}

export async function fetchMe(): Promise<SessionUser> {
  return (await request<{ user: SessionUser }>('/me')).user
}

/** This site's projects file, or null when none has been saved yet. */
export async function readData(): Promise<RemoteFile | null> {
  try {
    return await request<RemoteFile>(`/data/${APP_ENV}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Saves this site's projects. `sha` is the version being replaced; 409 if it changed. */
export async function writeData(text: string, sha: string | null, keepalive = false): Promise<string> {
  const result = await request<{ sha: string }>(`/data/${APP_ENV}`, {
    method: 'PUT',
    body: JSON.stringify({ text, sha }),
    keepalive,
  })
  return result.sha
}

export function listPeople(): Promise<PeopleList> {
  return request('/users')
}

export async function setPersonRole(email: string, role: Role): Promise<PersonEntry[]> {
  const result = await request<{ users: PersonEntry[] }>(`/users/${encodeURIComponent(email)}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
  return result.users
}

export async function removePerson(email: string): Promise<PersonEntry[]> {
  const result = await request<{ users: PersonEntry[] }>(`/users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  })
  return result.users
}
