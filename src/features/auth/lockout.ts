export const MAX_ATTEMPTS = 5
export const LOCKOUT_MS = 30_000

export interface LockoutState {
  failedAttempts: number
  /** Epoch ms until which input is locked, or null. */
  lockedUntil: number | null
}

export const initialLockout: LockoutState = { failedAttempts: 0, lockedUntil: null }

/** Records a wrong PIN. The fifth failure starts a lockout and resets the counter. */
export function registerFailure(state: LockoutState, now: number): LockoutState {
  const failedAttempts = state.failedAttempts + 1
  if (failedAttempts >= MAX_ATTEMPTS) {
    return { failedAttempts: 0, lockedUntil: now + LOCKOUT_MS }
  }
  return { failedAttempts, lockedUntil: null }
}

/** Whole seconds left in the lockout (0 when not locked). */
export function lockoutSecondsLeft(state: LockoutState, now: number): number {
  if (state.lockedUntil === null) return 0
  return Math.max(0, Math.ceil((state.lockedUntil - now) / 1000))
}
