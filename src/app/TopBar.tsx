import { FlaskConical, LayoutDashboard, LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useNavigate } from 'react-router-dom'
import { DataBackupButtons } from '@/app/DataBackupButtons'
import { SyncButton } from '@/features/sync/SyncControls'
import { IconButton } from '@/components/IconButton'
import { useAuth } from '@/features/auth/useAuth'
import { IS_PRODUCTION } from '@/lib/env'
import { useAppStore } from '@/store/useAppStore'

export function TopBar() {
  const projectName = useAppStore((state) => state.project.name)
  const signOut = useAuth((state) => state.signOut)
  const navigate = useNavigate()
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
          <IconButton
            icon={LogOut}
            label="Log out"
            tooltip="Lock the console and return to the PIN screen"
            onClick={() => {
              signOut()
              navigate('/login', { replace: true })
            }}
          />
        </div>
      </div>
    </div>
  )
}
