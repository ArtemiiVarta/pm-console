import { create } from 'zustand'
import { configureApi, type Session, type SessionUser } from '@/lib/api'

// Google sign-in session (30 days), issued by the API. Shared by Staging and Production: both
// sites use the same API and the same people list. Keep all sign-in state behind this hook.
const SESSION_KEY = 'pm-console-auth'

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    return session.token && session.expiresAt > Date.now() ? session : null
  } catch {
    return null
  }
}

function writeSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage blocked: stay signed in for this page load only.
  }
}

interface AuthState {
  session: Session | null
  isAuthenticated: boolean
  /** Why the last session ended without the user logging out (shown on the sign-in page). */
  notice: string | null
  signIn: (session: Session) => void
  /** Updates name, picture or role after the server reports a change. */
  updateUser: (user: SessionUser) => void
  signOut: (notice?: string) => void
}

const initial = readSession()

export const useAuth = create<AuthState>((set, get) => ({
  session: initial,
  isAuthenticated: initial !== null,
  notice: null,
  signIn: (session) => {
    writeSession(session)
    set({ session, isAuthenticated: true, notice: null })
  },
  updateUser: (user) => {
    const session = get().session
    if (!session) return
    const next = { ...session, user }
    writeSession(next)
    set({ session: next })
  },
  signOut: (notice) => {
    writeSession(null)
    set({ session: null, isAuthenticated: false, notice: notice ?? null })
  },
}))

/** True when the signed-in person may open the Admin tab. */
export const selectIsAdmin = (state: AuthState) => state.session?.user.role === 'admin'

configureApi({
  getToken: () => {
    const session = useAuth.getState().session
    return session && session.expiresAt > Date.now() ? session.token : null
  },
  onRejected: (error) => useAuth.getState().signOut(error.message),
})

// Logging in or out in one tab does the same in this browser's other tabs.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_KEY) return
    const session = readSession()
    if (session) useAuth.setState({ session, isAuthenticated: true, notice: null })
    else useAuth.setState({ session: null, isAuthenticated: false })
  })
}
