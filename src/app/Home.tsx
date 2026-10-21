import { LayoutDashboard, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Temporary landing page until the app shell is built (Prompt 1).
export function Home() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const ThemeIcon = isDark ? Sun : Moon

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <LayoutDashboard className="mt-1 h-6 w-6 text-primary" aria-hidden />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">PM Console</h1>
            <p className="text-xs text-muted">Project management, planning and monitoring console.</p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
              <ThemeIcon className="h-4 w-4" />
              {isDark ? 'Light theme' : 'Dark theme'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Switch to the {isDark ? 'light' : 'dark'} theme</TooltipContent>
        </Tooltip>
      </div>
      <section className="rounded-xl border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Scaffold ready</h2>
        <p className="text-sm text-muted">The app shell and Project Settings tab are coming next.</p>
      </section>
    </main>
  )
}
