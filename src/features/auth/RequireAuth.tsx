import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'

export interface LoginRedirectState {
  from?: string
}

/** Redirects to /login when signed out, remembering the requested page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuth((state) => state.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    const state: LoginRedirectState = { from: location.pathname + location.search }
    return <Navigate to="/login" replace state={state} />
  }
  return <>{children}</>
}
