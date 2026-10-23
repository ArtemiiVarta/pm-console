// Google ID token verification and the console's own session tokens.
// Uses only Web Crypto, so it runs the same in Cloudflare Workers and in tests.

export interface GoogleProfile {
  email: string
  name: string
  picture: string
}

export interface SessionClaims extends GoogleProfile {
  /** Expiry, seconds since epoch. */
  exp: number
}

export interface Jwk extends JsonWebKey {
  kid?: string
}

export type JwksLoader = () => Promise<Jwk[]>

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
export const SESSION_DAYS = 30

export class AuthError extends Error {}

export function base64UrlEncode(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input as ArrayBuffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function decodeJson<T>(part: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as T
  } catch {
    throw new AuthError('Malformed token.')
  }
}

let cachedCerts: { keys: Jwk[]; until: number } | null = null

/** Google's signing keys, cached for an hour per Worker instance. */
export const loadGoogleCerts: JwksLoader = async () => {
  if (cachedCerts && cachedCerts.until > Date.now()) return cachedCerts.keys
  const response = await fetch(GOOGLE_CERTS_URL)
  if (!response.ok) throw new Error(`Google certificates unavailable (${response.status}).`)
  const { keys } = (await response.json()) as { keys: Jwk[] }
  cachedCerts = { keys, until: Date.now() + 60 * 60 * 1000 }
  return keys
}

/** Checks a Google Sign-In credential and returns the verified profile. */
export async function verifyGoogleIdToken(
  token: string,
  clientId: string,
  loadKeys: JwksLoader = loadGoogleCerts,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<GoogleProfile> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new AuthError('Malformed token.')
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string]
  const header = decodeJson<{ alg?: string; kid?: string }>(headerPart)
  if (header.alg !== 'RS256') throw new AuthError('Unexpected token algorithm.')
  const jwk = (await loadKeys()).find((key) => key.kid === header.kid)
  if (!jwk) throw new AuthError('Unknown signing key.')
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  )
  if (!valid) throw new AuthError('Invalid token signature.')

  const claims = decodeJson<{
    iss?: string
    aud?: string
    exp?: number
    email?: string
    email_verified?: boolean
    name?: string
    picture?: string
  }>(payloadPart)
  if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) throw new AuthError('Wrong issuer.')
  if (claims.aud !== clientId) throw new AuthError('Token is for another app.')
  if (!claims.exp || claims.exp < nowSeconds) throw new AuthError('Token expired.')
  if (!claims.email || claims.email_verified !== true) throw new AuthError('Email not verified.')
  return {
    email: claims.email.toLowerCase(),
    name: claims.name ?? claims.email,
    picture: claims.picture ?? '',
  }
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Session token: base64url(claims).base64url(HMAC-SHA256). Valid for SESSION_DAYS. */
export async function createSessionToken(
  profile: GoogleProfile,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ token: string; claims: SessionClaims }> {
  const claims: SessionClaims = { ...profile, exp: nowSeconds + SESSION_DAYS * 24 * 60 * 60 }
  const body = base64UrlEncode(JSON.stringify(claims))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(body))
  return { token: `${body}.${base64UrlEncode(signature)}`, claims }
}

export async function verifySessionToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<SessionClaims> {
  const [body, signature, extra] = token.split('.')
  if (!body || !signature || extra !== undefined) throw new AuthError('Malformed session.')
  // crypto.subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    base64UrlDecode(signature),
    new TextEncoder().encode(body),
  )
  if (!valid) throw new AuthError('Invalid session.')
  const claims = decodeJson<SessionClaims>(body)
  if (!claims.email || claims.exp < nowSeconds) throw new AuthError('Session expired.')
  return claims
}
