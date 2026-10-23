import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useAuth } from '@/features/auth/useAuth'
import { usePendingAllocation } from '@/features/settings/team/assignment/usePendingAllocation'
import { useUiPrefs } from '@/store/useUiPrefs'

// jsdom lacks matchMedia (used by next-themes and sonner)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// jsdom lacks pointer capture and scrollIntoView, which Radix Select uses when opening.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

// No test talks to the real API: unless a test stubs fetch itself, the server is "unavailable".
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'Offline in tests' }, { status: 503 })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuth.setState({ session: null, isAuthenticated: false, notice: null })
  // In-memory stores outlive a render; reset them so tests stay independent.
  usePendingAllocation.getState().discard()
  useUiPrefs.setState({ showFinancials: true })
})
