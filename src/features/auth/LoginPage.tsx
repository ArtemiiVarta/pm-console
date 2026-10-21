import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { AlertCircle, Eye, EyeOff, LockKeyhole, LogIn, Timer } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ActionButton } from '@/components/ActionButton'
import { IconButton } from '@/components/IconButton'
import {
  initialLockout,
  lockoutSecondsLeft,
  MAX_ATTEMPTS,
  registerFailure,
  type LockoutState,
} from '@/features/auth/lockout'
import { PIN_LENGTH, verifyPin } from '@/features/auth/pin'
import type { LoginRedirectState } from '@/features/auth/RequireAuth'
import { useAuth } from '@/features/auth/useAuth'
import { cn } from '@/lib/utils'

// Lockout survives a page reload within the tab.
const LOCKOUT_KEY = 'pm-console-lockout'
const DEFAULT_ROUTE = '/settings'

// Wall clock for lockout timing, read in event handlers and timers only.
const clock = () => Date.now()

const emptyDigits = (): string[] => Array.from({ length: PIN_LENGTH }, () => '')

function loadLockout(): LockoutState {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_KEY)
    return raw ? { ...initialLockout, ...(JSON.parse(raw) as Partial<LockoutState>) } : initialLockout
  } catch {
    return initialLockout
  }
}

function saveLockout(state: LockoutState) {
  try {
    sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(state))
  } catch {
    // Storage blocked: lockout still applies for this page load.
  }
}

export function LoginPage() {
  const isAuthenticated = useAuth((state) => state.isAuthenticated)
  const signIn = useAuth((state) => state.signIn)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LoginRedirectState | null)?.from

  const [digits, setDigits] = useState<string[]>(emptyDigits)
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [checking, setChecking] = useState(false)
  const [lockout, setLockout] = useState<LockoutState>(loadLockout)
  const [now, setNow] = useState(clock)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const secondsLeft = lockoutSecondsLeft(lockout, now)
  const locked = secondsLeft > 0

  // Tick the countdown while locked; clear the lockout when it expires.
  useEffect(() => {
    if (lockout.lockedUntil === null) return
    const id = window.setInterval(() => {
      const current = clock()
      setNow(current)
      if (lockoutSecondsLeft(lockout, current) === 0) {
        const cleared = { ...lockout, lockedUntil: null }
        setLockout(cleared)
        saveLockout(cleared)
        setError(null)
        window.setTimeout(() => inputs.current[0]?.focus())
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [lockout])

  useEffect(() => {
    if (!locked) inputs.current[0]?.focus()
    // Only on mount: later focus moves are handled by the input handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isAuthenticated) {
    return <Navigate to={from ?? DEFAULT_ROUTE} replace />
  }

  const focusBox = (index: number) => {
    const box = inputs.current[Math.max(0, Math.min(PIN_LENGTH - 1, index))]
    box?.focus()
    box?.select()
  }

  const submit = async (pin: string[]) => {
    if (locked || checking) return
    if (pin.some((d) => d === '')) {
      setError(`Enter all ${PIN_LENGTH} digits`)
      focusBox(pin.findIndex((d) => d === ''))
      return
    }
    setChecking(true)
    const ok = await verifyPin(pin.join(''))
    setChecking(false)

    if (ok) {
      saveLockout(initialLockout)
      signIn()
      navigate(from ?? DEFAULT_ROUTE, { replace: true })
      return
    }

    const failedAt = clock()
    const next = registerFailure(lockout, failedAt)
    setLockout(next)
    saveLockout(next)
    setNow(failedAt)
    setDigits(emptyDigits())
    setShaking(true)
    if (next.lockedUntil !== null) {
      setError(null)
    } else {
      const left = MAX_ATTEMPTS - next.failedAttempts
      setError(`Incorrect PIN. ${left} ${left === 1 ? 'attempt' : 'attempts'} left before a 30-second lock.`)
      focusBox(0)
    }
  }

  /** Writes digits starting at `start`; auto-submits once every box is filled. */
  const fillFrom = (start: number, incoming: string) => {
    const next = [...digits]
    let index = start
    for (const char of incoming) {
      if (index >= PIN_LENGTH) break
      next[index] = char
      index += 1
    }
    setDigits(next)
    setError(null)
    if (next.every((d) => d !== '')) {
      void submit(next)
    } else {
      focusBox(index)
    }
  }

  const handleChange = (index: number, value: string) => {
    const onlyDigits = value.replace(/\D/g, '')
    if (onlyDigits === '') return
    // A single box can receive several digits from autofill; spread them across the boxes.
    const incoming = onlyDigits.length > 1 && digits[index] ? onlyDigits.slice(-1) : onlyDigits
    fillFrom(index, incoming)
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const next = [...digits]
      if (next[index]) {
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        next[index - 1] = ''
        setDigits(next)
        focusBox(index - 1)
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusBox(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusBox(index + 1)
    }
  }

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    // A full PIN always fills from the first box; a partial one fills from the focused box.
    if (pasted) fillFrom(pasted.length === PIN_LENGTH ? 0 : index, pasted)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(digits)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border bg-surface p-8 shadow-sm"
        aria-labelledby="login-title"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LockKeyhole className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 id="login-title" className="text-2xl font-semibold tracking-tight">
              PM Console
            </h1>
            <p className="text-xs text-muted">Enter your 4-digit PIN</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="PIN"
            className={cn('flex gap-2', shaking && 'motion-safe:animate-shake')}
            onAnimationEnd={() => setShaking(false)}
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputs.current[index] = el
                }}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={PIN_LENGTH}
                aria-label={`Digit ${index + 1} of ${PIN_LENGTH}`}
                aria-invalid={error !== null}
                value={digit}
                disabled={locked}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={(e) => handlePaste(index, e)}
                onFocus={(e) => e.target.select()}
                className={cn(
                  'h-14 w-12 rounded-lg border bg-surface text-center text-2xl font-semibold tabular-nums shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
                  error ? 'border-danger' : 'border-input',
                )}
              />
            ))}
          </div>
          <IconButton
            icon={showPin ? EyeOff : Eye}
            label={showPin ? 'Hide PIN' : 'Show PIN'}
            tooltip={showPin ? 'Hide the digits' : 'Show the digits as you type'}
            aria-pressed={showPin}
            onClick={() => setShowPin((v) => !v)}
          />
        </div>

        <div className="min-h-4 text-center" aria-live="polite">
          {locked ? (
            <p className="flex items-center gap-1 text-xs text-warning">
              <Timer className="h-3.5 w-3.5" aria-hidden />
              Too many attempts. Try again in {secondsLeft}s.
            </p>
          ) : (
            error && (
              <p className="flex items-center gap-1 text-xs text-danger">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                {error}
              </p>
            )
          )}
        </div>

        <ActionButton
          type="submit"
          icon={LogIn}
          tooltip="Unlock the console"
          shortcut="Enter"
          className="w-full"
          disabled={locked || checking}
        >
          Unlock
        </ActionButton>
      </form>
    </main>
  )
}
