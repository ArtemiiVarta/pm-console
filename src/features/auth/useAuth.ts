import { create } from 'zustand'

// Session flag lives in sessionStorage, so closing the tab logs out.
// Keep all sign-in state behind this hook so the PIN can later be swapped for Google sign-in.
const SESSION_KEY = 'pm-console-session'

function readSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

interface AuthState {
  isAuthenticated: boolean
  signIn: () => void
  signOut: () => void
}

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: readSession(),
  signIn: () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // Storage blocked: stay signed in for this page load only.
    }
    set({ isAuthenticated: true })
  },
  signOut: () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // Nothing stored to clear.
    }
    set({ isAuthenticated: false })
  },
}))
