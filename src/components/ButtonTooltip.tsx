import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ButtonTooltipProps {
  tooltip: string
  shortcut?: string
  children: ReactElement
}

/** Tooltip wrapper used by IconButton and ActionButton. Shows the optional keyboard shortcut. */
export function ButtonTooltip({ tooltip, shortcut, children }: ButtonTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <span>{tooltip}</span>
        {shortcut && (
          <kbd className="ml-2 rounded border border-background/30 px-1 font-sans text-[10px]">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
