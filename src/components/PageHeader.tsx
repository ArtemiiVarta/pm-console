import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
}

/** The header every page starts with (CLAUDE.md). */
export function PageHeader({ icon: Icon, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
