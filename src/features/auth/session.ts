import { useEffect } from 'react'
import { disableGoogleAutoSelect } from '@/features/auth/googleIdentity'
import { useAuth } from '@/features/auth/useAuth'
import { usePendingAllocation } from '@/features/settings/team/assignment/usePendingAllocation'
import { forgetSyncMemory, hasUnsavedChanges, pushNow } from '@/features/sync/sync'
import { fetchMe, type Session } from '@/lib/api'
import { storageKey } from '@/lib/env'
import { createInitialWorkspace, useAppStore } from '@/store/useAppStore'

// setTimeout cannot wait longer than ~24.8 days.
const MAX_TIMER_MS = 2 ** 31 - 1
/** Whose projects this browser holds for this site. */
const LAST_USER_KEY = storageKey('last-user')

function clearLocalProjects() {
  usePendingAllocation.getState().discard()
  useAppStore.setState(createInitialWorkspace())
  forgetSyncMemory()
}

/** Signs in; if someone else's cached projects are on this browser, they are cleared first. */
export function startSession(session: Session) {
  try {
    const previous = localStorage.getItem(LAST_USER_KEY)
    if (previous && previous !== session.user.email) clearLocalProjects()
    localStorage.setItem(LAST_USER_KEY, session.user.email)
  } catch {
    // Storage blocked: nothing cached to protect.
  }
  useAuth.getState().signIn(session)
}

/** Saves anything unsaved before logging out. False when GitHub still lacks some changes. */
export async function saveBeforeLogOut(): Promise<boolean> {
  if (hasUnsavedChanges()) await pushNow()
  return !hasUnsavedChanges()
}

/**
 * Ends the session and clears this browser's copy of the projects (they live in GitHub), so the
 * next person on this computer starts clean.
 */
export function finishLogOut() {
  disableGoogleAutoSelect()
  useAuth.getState().signOut()
  clearLocalProjects()
}

/** Refreshes the signed-in person (role changes, removal) and signs out when the session ends. */
export function SessionCheck() {
  const expiresAt = useAuth((state) => state.session?.expiresAt ?? null)
  const updateUser = useAuth((state) => state.updateUser)

  useEffect(() => {
    // 401 / 403 sign out through the API client; network problems are retried by sync.
    fetchMe().then(updateUser, () => {})
  }, [updateUser])

  useEffect(() => {
    if (expiresAt === null) return
    let timer: number
    const check = () => {
      const left = expiresAt - Date.now()
      if (left <= 0) useAuth.getState().signOut('Your 30-day session ended. Sign in again.')
      else timer = window.setTimeout(check, Math.min(left, MAX_TIMER_MS))
    }
    check()
    return () => window.clearTimeout(timer)
  }, [expiresAt])

  return null
}
