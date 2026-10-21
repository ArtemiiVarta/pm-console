import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
}

/** Placeholder for empty lists and unbuilt pages: icon + one-line hint + primary action. */
export function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}
