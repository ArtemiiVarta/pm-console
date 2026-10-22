import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
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

afterEach(() => {
  cleanup()
  // In-memory stores outlive a render; reset them so tests stay independent.
  usePendingAllocation.getState().discard()
  useUiPrefs.setState({ showFinancials: true })
})
