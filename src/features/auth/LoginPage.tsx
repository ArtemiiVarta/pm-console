import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Info, LayoutDashboard, Loader2 } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { loadGoogleIdentity, type GoogleCredentialResponse } from '@/features/auth/googleIdentity'
import type { LoginRedirectState } from '@/features/auth/RequireAuth'
import { startSession } from '@/features/auth/session'
import { useAuth } from '@/features/auth/useAuth'
import { ApiError, signInWithGoogle } from '@/lib/api'
import { API_URL, GOOGLE_CLIENT_ID, IS_PRODUCTION } from '@/lib/env'

const DEFAULT_ROUTE = '/'

export function LoginPage() {
  const isAuthenticated = useAuth((state) => state.isAuthenticated)
  const notice = useAuth((state) => state.notice)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LoginRedirectState | null)?.from
  const { resolvedTheme } = useTheme()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const configured = Boolean(API_URL && GOOGLE_CLIENT_ID)

  useEffect(() => {
    if (!configured || isAuthenticated) return
    let cancelled = false
    const handleCredential = async ({ credential }: GoogleCredentialResponse) => {
      setChecking(true)
      setError(null)
      try {
        const session = await signInWithGoogle(credential)
        startSession(session)
        navigate(from ?? DEFAULT_ROUTE, { replace: true })
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Sign-in failed. Try again.')
      } finally {
        setChecking(false)
      }
    }
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => void handleCredential(response),
          auto_select: true,
          use_fedcm_for_prompt: true,
        })
        google.renderButton(buttonRef.current, {
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: 280,
        })
        // One Tap: signs a returning person in without a click when Google remembers them.
        google.prompt()
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Google sign-in could not load.')
      })
    return () => {
      cancelled = true
    }
  }, [configured, isAuthenticated, resolvedTheme, navigate, from])

  if (isAuthenticated) {
    return <Navigate to={from ?? DEFAULT_ROUTE} replace />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section
        aria-labelledby="login-title"
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border bg-surface p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayoutDashboard className="h-6 w-6" aria-hidden />
          </div>
          <h1 id="login-title" className="text-xl font-semibold">
            PM Console{IS_PRODUCTION ? '' : ' · Staging'}
          </h1>
          <p className="text-sm text-muted">Sign in with the Google account an admin added.</p>
        </div>

        {notice && (
          <p role="status" className="flex items-start gap-2 text-sm text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {notice}
          </p>
        )}

        {configured ? (
          <div className="flex min-h-11 items-center justify-center">
            {checking ? (
              <span role="status" className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Signing in…
              </span>
            ) : null}
            <div ref={buttonRef} hidden={checking} data-testid="google-button" />
          </div>
        ) : (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Sign-in is not configured yet (missing Google client ID or API address).
          </p>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
