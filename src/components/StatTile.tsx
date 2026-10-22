import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatTone = 'default' | 'success' | 'warning' | 'danger'

interface StatTileProps {
  icon: LucideIcon
  label: string
  value: ReactNode
  hint?: string
  tone?: StatTone
}

const toneClasses: Record<StatTone, { icon: string; value: string }> = {
  default: { icon: 'bg-subtle text-muted', value: 'text-foreground' },
  success: { icon: 'bg-success/10 text-success', value: 'text-success' },
  warning: { icon: 'bg-warning/10 text-warning', value: 'text-warning' },
  danger: { icon: 'bg-danger/10 text-danger', value: 'text-danger' },
}

/** Small read-only KPI tile. Tone colors are paired with the label and hint, never the only signal. */
export function StatTile({ icon: Icon, label, value, hint, tone = 'default' }: StatTileProps) {
  const classes = toneClasses[tone]
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', classes.icon)}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <span className="text-xs text-muted">{label}</span>
      </div>
      {/* Full width under the label, and wraps instead of truncating large amounts. */}
      <span className={cn('break-words text-lg font-semibold tabular-nums', classes.value)}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}
