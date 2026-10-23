import { useState } from 'react'
import { FlaskConical, LayoutDashboard, LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useNavigate } from 'react-router-dom'
import { DataBackupButtons } from '@/app/DataBackupButtons'
import { SyncButton } from '@/features/sync/SyncControls'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconButton } from '@/components/IconButton'
import { finishLogOut, saveBeforeLogOut } from '@/features/auth/session'
import { useAuth } from '@/features/auth/useAuth'
import { IS_PRODUCTION } from '@/lib/env'
import { useAppStore } from '@/store/useAppStore'

export function TopBar() {
  const projectName = useAppStore((state) => state.project.name)
  const user = useAuth((state) => state.session?.user ?? null)
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [unsavedWarning, setUnsavedWarning] = useState(false)

  const logOut = () => {
    finishLogOut()
    navigate('/login', { replace: true })
  }

  const requestLogOut = async () => {
    setLoggingOut(true)
    const saved = await saveBeforeLogOut()
    setLoggingOut(false)
    if (saved) logOut()
    else setUnsavedWarning(true)
  }
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="border-b bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" aria-hidden />
          </div>
          <span className="text-base font-semibold">PM Console</span>
          {!IS_PRODUCTION && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
              title="Staging site for testing new features. Its projects are separate from Production."
            >
              <FlaskConical className="h-3 w-3" aria-hidden />
              Staging
            </span>
          )}
        </div>
        <span className="text-border" aria-hidden>
          /
        </span>
        <span className="min-w-0 truncate text-sm text-muted" title="Current project">
          {projectName.trim() || 'Untitled project'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <SyncButton />
          <DataBackupButtons />
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <IconButton
            icon={isDark ? Sun : Moon}
            label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            tooltip={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          />
          {user && <UserBadge name={user.name} email={user.email} picture={user.picture} role={user.role} />}
          <IconButton
            icon={LogOut}
            label="Log out"
            tooltip="Save, sign out and clear this browser's copy of the projects"
            disabled={loggingOut}
            onClick={() => void requestLogOut()}
          />
          <ConfirmDialog
            open={unsavedWarning}
            onOpenChange={setUnsavedWarning}
            title="Log out without saving?"
            description="Some changes could not be saved to GitHub (no connection, or a version conflict to resolve). Logging out now loses them."
            confirmLabel="Log out anyway"
            confirmIcon={LogOut}
            onConfirm={logOut}
          />
        </div>
      </div>
    </div>
  )
}

function UserBadge({
  name,
  email,
  picture,
  role,
}: {
  name: string
  email: string
  picture: string
  role: string
}) {
  const initials = (name || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return (
    <span
      className="ml-1 flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 text-sm"
      title={`Signed in as ${email} (${role})`}
    >
      {picture ? (
        <img src={picture} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {initials}
        </span>
      )}
      <span className="hidden max-w-40 truncate md:inline">{name || email}</span>
    </span>
  )
}
