import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ButtonTooltip } from '@/components/ButtonTooltip'
import { Button, type ButtonProps } from '@/components/ui/button'

export interface ActionButtonProps extends Omit<ButtonProps, 'asChild'> {
  icon: LucideIcon
  tooltip: string
  shortcut?: string
}

/** Standard text button with a leading icon and a tooltip (CLAUDE.md). */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon: Icon, tooltip, shortcut, children, type = 'button', ...props }, ref) => (
    <ButtonTooltip tooltip={tooltip} shortcut={shortcut}>
      {/* Submits only when asked to (type="submit"). */}
      <Button ref={ref} type={type} {...props}>
        <Icon className="h-4 w-4" aria-hidden />
        {children}
      </Button>
    </ButtonTooltip>
  ),
)
ActionButton.displayName = 'ActionButton'
