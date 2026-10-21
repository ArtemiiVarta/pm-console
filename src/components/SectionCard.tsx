import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

/** Card container for every page section (CLAUDE.md). */
export function SectionCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
}: SectionCardProps) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-xl border bg-surface p-5 shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          {Icon && <Icon className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />}
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
