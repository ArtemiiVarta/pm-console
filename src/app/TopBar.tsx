import { LayoutDashboard, LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { IconButton } from '@/components/IconButton'
import { useAppStore } from '@/store/useAppStore'

export function TopBar() {
  const projectName = useAppStore((state) => state.project.name)
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
        </div>
        <span className="text-border" aria-hidden>
          /
        </span>
        <span className="min-w-0 truncate text-sm text-muted" title="Current project">
          {projectName.trim() || 'Untitled project'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <IconButton
            icon={isDark ? Sun : Moon}
            label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            tooltip={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          />
          {/* PIN login arrives with Prompt 2; logout is wired up then. */}
          <IconButton
            icon={LogOut}
            label="Log out"
            tooltip="Lock the console and return to the PIN screen"
            onClick={() => toast.info('PIN login is not set up yet')}
          />
        </div>
      </div>
    </div>
  )
}
