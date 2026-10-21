import {
  initialLockout,
  LOCKOUT_MS,
  lockoutSecondsLeft,
  MAX_ATTEMPTS,
  registerFailure,
} from '@/features/auth/lockout'
import { PIN_HASH, sha256Hex, verifyPin } from '@/features/auth/pin'

describe('pin', () => {
  it('stores a SHA-256 hex digest, not the PIN', () => {
    expect(PIN_HASH).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes with SHA-256', async () => {
    // Known vector: SHA-256("abc")
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('accepts only the PIN matching the expected hash', async () => {
    // Test PIN 4321; the real PIN is deliberately not written anywhere in the code.
    const testHash = 'fe2592b42a727e977f055947385b709cc82b16b9a87f88c6abf3900d65d0cdc3'
    expect(await verifyPin('4321', testHash)).toBe(true)
    expect(await verifyPin('4322', testHash)).toBe(false)
    expect(await verifyPin('', testHash)).toBe(false)
  })

  it('checks against the stored PIN hash by default', async () => {
    expect(await verifyPin('0000')).toBe((await sha256Hex('0000')) === PIN_HASH)
  })
})

describe('lockout', () => {
  it('counts failures until the limit, then locks and resets the counter', () => {
    let state = initialLockout
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      state = registerFailure(state, 0)
      expect(state).toEqual({ failedAttempts: i, lockedUntil: null })
    }
    state = registerFailure(state, 1_000)
    expect(state).toEqual({ failedAttempts: 0, lockedUntil: 1_000 + LOCKOUT_MS })
  })

  it('reports whole seconds left, rounding up, and 0 once expired', () => {
    const state = { failedAttempts: 0, lockedUntil: 30_000 }
    expect(lockoutSecondsLeft(state, 0)).toBe(30)
    expect(lockoutSecondsLeft(state, 29_001)).toBe(1)
    expect(lockoutSecondsLeft(state, 30_000)).toBe(0)
    expect(lockoutSecondsLeft(initialLockout, 0)).toBe(0)
  })
})
