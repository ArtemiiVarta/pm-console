import { createPortal } from 'react-dom'
import type { CellPosition } from '@/lib/assignment'

export interface GridTooltipTarget extends CellPosition {
  rect: DOMRect
}

/**
 * One shared tooltip for the whole grid, instead of a Radix tooltip per cell (thousands of cells).
 * Styled like the shadcn TooltipContent. Cells carry the same text in their aria-label.
 */
export function GridTooltip({ target, text }: { target: GridTooltipTarget | null; text: string | null }) {
  if (!target || !text) return null
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md animate-in fade-in-0"
      // Position follows the hovered cell, so it is computed at runtime.
      style={{ left: target.rect.left + target.rect.width / 2, top: target.rect.top - 6 }}
    >
      {text}
    </div>,
    document.body,
  )
}
