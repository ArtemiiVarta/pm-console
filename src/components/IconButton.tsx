import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ButtonTooltip } from '@/components/ButtonTooltip'
import { Button, type ButtonProps } from '@/components/ui/button'

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size' | 'asChild'> {
  icon: LucideIcon
  /** Accessible name, set as aria-label. */
  label: string
  /** Sentence-case description of the result, e.g. "Add a new project phase". */
  tooltip: string
  shortcut?: string
  size?: 'icon' | 'icon-sm'
}

/** Icon-only button. Always has an aria-label and a tooltip (CLAUDE.md). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { icon: Icon, label, tooltip, shortcut, variant = 'ghost', size = 'icon', type = 'button', ...props },
    ref,
  ) => (
    <ButtonTooltip tooltip={tooltip} shortcut={shortcut}>
      {/* type="button" by default: an icon button inside a form must never submit it. */}
      <Button ref={ref} type={type} variant={variant} size={size} aria-label={label} {...props}>
        <Icon className="h-4 w-4" aria-hidden />
      </Button>
    </ButtonTooltip>
  ),
)
IconButton.displayName = 'IconButton'
