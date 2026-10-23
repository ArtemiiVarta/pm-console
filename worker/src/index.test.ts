import worker, { type Env } from './index'
import { fromBase64, toBase64 } from './github'
import { base64UrlEncode, createSessionToken, verifyGoogleIdToken, type Jwk } from './tokens'
import { resetUsersCache } from './users'

const CLIENT_ID = 'client-123.apps.googleusercontent.com'
const ORIGIN = 'https://artemiivarta.github.io'

const env: Env = {
  GITHUB_TOKEN: 'server-token',
  SESSION_SECRET: 'test-secret-that-is-long-enough',
  GOOGLE_CLIENT_ID: CLIENT_ID,
  OWNER_EMAIL: 'owner@example.com',
  DATA_OWNER: 'ArtemiiVarta',
  DATA_REPO: 'pm-console-data',
  DATA_BRANCH: 'main',
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
}

let keyPair: CryptoKeyPair
let publicJwk: Jwk

beforeAll(async () => {
  keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  publicJwk = { ...(await crypto.subtle.exportKey('jwk', keyPair.publicKey)), kid: 'k1' }
})

async function googleToken(claims: Record<string, unknown>, kid = 'k1') {
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', kid }))
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 3600,
      email_verified: true,
      name: 'Someone',
      ...claims,
    }),
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${base64UrlEncode(signature)}`
}

/** In-memory GitHub contents API, plus Google's certificate endpoint. */
function fakeGitHub(files: Record<string, string> = {}) {
  const store = new Map(Object.entries(files).map(([path, text], i) => [path, { text, sha: `s${i}` }]))
  let version = 100
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'www.googleapis.com') return Response.json({ keys: [publicJwk] })
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer server-token')
    if (!url.pathname.includes('/contents/')) return Response.json({ private: true })
    const path = decodeURIComponent(url.pathname.split('/contents/')[1] ?? '')
    const file = store.get(path)
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { content: string; sha?: string }
      if (file && body.sha !== file.sha) return new Response('{}', { status: 409 })
      if (!file && body.sha) return new Response('{}', { status: 409 })
      version += 1
      store.set(path, { text: fromBase64(body.content), sha: `s${version}` })
      return Response.json({ content: { sha: `s${version}` } })
    }
    if (!file) return new Response('{}', { status: 404 })
    return Response.json({ sha: file.sha, encoding: 'base64', content: toBase64(file.text) })
  })
  vi.stubGlobal('fetch', fetchMock)
  return store
}

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; origin?: string } = {},
) {
  const headers: Record<string, string> = { Origin: options.origin ?? ORIGIN }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await worker.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    env,
  )
  return {
    status: response.status,
    headers: response.headers,
    body: (await response.json().catch(() => null)) as Record<string, unknown>,
  }
}

async function sessionFor(email: string) {
  return (await createSessionToken({ email, name: email, picture: '' }, env.SESSION_SECRET)).token
}

const usersFile = (users: { email: string; role: string }[]) =>
  JSON.stringify({ users: users.map((u) => ({ ...u, addedAt: 'x', addedBy: 'owner@example.com' })) })

beforeEach(() => resetUsersCache())
afterEach(() => vi.unstubAllGlobals())

describe('Google sign-in', () => {
  it('signs in the owner and returns a 30-day session', async () => {
    fakeGitHub()
    const credential = await googleToken({ email: 'Owner@Example.com' })
    const { status, body } = await call('POST', '/auth/google', { body: { credential } })
    expect(status).toBe(200)
    expect(body.user).toMatchObject({ email: 'owner@example.com', role: 'admin' })
    const days = ((body.expiresAt as number) - Date.now()) / 86_400_000
    expect(Math.round(days)).toBe(30)
  })

  it('signs in listed people with their role, and refuses everyone else', async () => {
    fakeGitHub({ 'users.json': usersFile([{ email: 'pm@example.com', role: 'user' }]) })
    const ok = await call('POST', '/auth/google', {
      body: { credential: await googleToken({ email: 'pm@example.com' }) },
    })
    expect(ok.body.user).toMatchObject({ role: 'user' })
    const refused = await call('POST', '/auth/google', {
      body: { credential: await googleToken({ email: 'stranger@example.com' }) },
    })
    expect(refused.status).toBe(403)
    expect(refused.body.error).toMatch(/stranger@example.com doesn’t have access/)
  })

  it('rejects forged, foreign, expired and unverified Google tokens', async () => {
    fakeGitHub()
    const keys = async () => [publicJwk]
    const good = await googleToken({ email: 'owner@example.com' })
    const [h, p] = good.split('.')
    await expect(verifyGoogleIdToken(`${h}.${p}.AAAA`, CLIENT_ID, keys)).rejects.toThrow(/signature/)
    await expect(
      verifyGoogleIdToken(await googleToken({ email: 'o@x.com', aud: 'other' }), CLIENT_ID, keys),
    ).rejects.toThrow(/another app/)
    await expect(
      verifyGoogleIdToken(await googleToken({ email: 'o@x.com', exp: 1 }), CLIENT_ID, keys),
    ).rejects.toThrow(/expired/)
    await expect(
      verifyGoogleIdToken(await googleToken({ email: 'o@x.com', email_verified: false }), CLIENT_ID, keys),
    ).rejects.toThrow(/not verified/)
    await expect(
      verifyGoogleIdToken(await googleToken({ email: 'o@x.com' }, 'k9'), CLIENT_ID, keys),
    ).rejects.toThrow(/Unknown/)
    const { status } = await call('POST', '/auth/google', { body: { credential: `${h}.${p}.AAAA` } })
    expect(status).toBe(401)
  })
})

describe('sessions', () => {
  it('needs a valid, unexpired session that still has access', async () => {
    fakeGitHub({ 'users.json': usersFile([]) })
    expect((await call('GET', '/me')).status).toBe(401)
    expect((await call('GET', '/me', { token: 'forged.token' })).status).toBe(401)
    const expired = (
      await createSessionToken({ email: 'owner@example.com', name: '', picture: '' }, env.SESSION_SECRET, 0)
    ).token
    expect((await call('GET', '/me', { token: expired })).status).toBe(401)
    const removed = await call('GET', '/me', { token: await sessionFor('gone@example.com') })
    expect(removed.status).toBe(403)
    const me = await call('GET', '/me', { token: await sessionFor('owner@example.com') })
    expect(me.body.user).toMatchObject({ email: 'owner@example.com', role: 'admin' })
  })

  it('allows only the console’s own origins in CORS', async () => {
    fakeGitHub()
    const token = await sessionFor('owner@example.com')
    const allowed = await call('GET', '/me', { token })
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    const other = await call('GET', '/me', { token, origin: 'https://evil.example' })
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('project data', () => {
  it('keeps Staging and Production in separate files and detects conflicts', async () => {
    const store = fakeGitHub({ 'projects.json': '{"prod":true}' })
    const token = await sessionFor('owner@example.com')
    expect((await call('GET', '/data/staging', { token })).status).toBe(404)
    expect((await call('GET', '/data/production', { token })).body).toMatchObject({ text: '{"prod":true}' })

    const created = await call('PUT', '/data/staging', { token, body: { text: '{"a":1}', sha: null } })
    expect(created.status).toBe(200)
    expect(store.get('staging/projects.json')?.text).toBe('{"a":1}')
    expect(store.get('projects.json')?.text).toBe('{"prod":true}')

    const stale = await call('PUT', '/data/staging', { token, body: { text: '{"a":2}', sha: 'old' } })
    expect(stale.status).toBe(409)
    expect((await call('GET', '/data/other', { token })).status).toBe(404)
  })
})

describe('people (admin)', () => {
  it('lets admins add, change and remove people, but never the owner', async () => {
    const store = fakeGitHub()
    const owner = await sessionFor('owner@example.com')
    expect(
      (await call('PUT', '/users/Ana@Example.com', { token: owner, body: { role: 'user' } })).status,
    ).toBe(200)
    await call('PUT', '/users/ben@example.com', { token: owner, body: { role: 'admin' } })
    expect(JSON.parse(store.get('users.json')?.text ?? '').users).toEqual([
      expect.objectContaining({ email: 'ana@example.com', role: 'user', addedBy: 'owner@example.com' }),
      expect.objectContaining({ email: 'ben@example.com', role: 'admin' }),
    ])

    const ben = await sessionFor('ben@example.com')
    await call('PUT', '/users/ana@example.com', { token: ben, body: { role: 'admin' } })
    const list = await call('GET', '/users', { token: ben })
    expect(list.body).toMatchObject({
      owner: 'owner@example.com',
      users: [{ role: 'admin' }, { role: 'admin' }],
    })

    expect(
      (await call('PUT', '/users/owner@example.com', { token: ben, body: { role: 'user' } })).status,
    ).toBe(400)
    expect((await call('PUT', '/users/not-an-email', { token: ben, body: { role: 'user' } })).status).toBe(
      400,
    )
    await call('DELETE', '/users/ana@example.com', { token: ben })
    expect(JSON.parse(store.get('users.json')?.text ?? '').users).toHaveLength(1)
  })

  it('refuses people management to users', async () => {
    fakeGitHub({ 'users.json': usersFile([{ email: 'pm@example.com', role: 'user' }]) })
    const pm = await sessionFor('pm@example.com')
    expect((await call('GET', '/users', { token: pm })).status).toBe(403)
    expect((await call('PUT', '/users/x@example.com', { token: pm, body: { role: 'admin' } })).status).toBe(
      403,
    )
    expect((await call('GET', '/data/production', { token: pm })).status).toBe(404)
  })
})
