// NOTE: This is a convenience lock, not real security. The check runs in the browser of a
// static site, so anyone can read this hash, and a 4-digit PIN can be brute-forced from it
// instantly. It only keeps casual visitors out. Real access control (e.g. Google sign-in
// through an auth provider) is planned to replace it.

/** SHA-256 hex digest of the console PIN. The PIN itself is never stored. */
export const PIN_HASH = '0ee95e1b4aa2f4842c6255969ad07ea6b21abd86528bfdf488c728960e3f63ef'

export const PIN_LENGTH = 4

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** `expectedHash` is only overridden by tests, so the real PIN never appears in the codebase. */
export async function verifyPin(pin: string, expectedHash: string = PIN_HASH): Promise<boolean> {
  return (await sha256Hex(pin)) === expectedHash
}
