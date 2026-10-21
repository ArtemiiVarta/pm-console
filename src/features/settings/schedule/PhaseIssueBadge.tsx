import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { describePhaseIssues } from '@/features/settings/schedule/phaseSchema'
import type { PhaseIssues } from '@/lib/schedule'
import type { DurationMode } from '@/store/types'

/** Non-blocking warning: icon + tooltip (and screen-reader text), never color alone. */
export function PhaseIssueBadge({ issues, mode }: { issues: PhaseIssues | undefined; mode: DurationMode }) {
  const description = describePhaseIssues(issues, mode)
  if (!description) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={`Warning: ${description}`}
          className="inline-flex shrink-0 rounded text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{description}</TooltipContent>
    </Tooltip>
  )
}
