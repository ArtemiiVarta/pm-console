import { useId, type KeyboardEvent } from 'react'
import { Check, Pipette } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { COLOR_CHOICES, getColorName } from '@/lib/palette'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  /** Accessible name of the group, e.g. "Bar color". */
  label: string
  id?: string
}

/**
 * Swatch radio group (arrow keys move between swatches) plus a custom color input.
 * Swatch fills come from data, so they are set inline.
 */
export function ColorPicker({ value, onChange, label, id }: ColorPickerProps) {
  const customId = useId()
  const current = value.toUpperCase()
  const isCustom = !COLOR_CHOICES.some((choice) => choice === current)
  const selectedIndex = COLOR_CHOICES.findIndex((choice) => choice === current)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!delta) return
    event.preventDefault()
    const from = selectedIndex === -1 ? 0 : selectedIndex
    const next = COLOR_CHOICES[(from + delta + COLOR_CHOICES.length) % COLOR_CHOICES.length]
    if (next) {
      onChange(next)
      // Move focus with the selection, as in a native radio group.
      const group = event.currentTarget
      requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        id={id}
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1.5"
        onKeyDown={onKeyDown}
      >
        {COLOR_CHOICES.map((color, index) => {
          const selected = color === current
          const tabbable = selected || (selectedIndex === -1 && index === 0)
          return (
            <Tooltip key={color}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={getColorName(color)}
                  tabIndex={tabbable ? 0 : -1}
                  onClick={() => onChange(color)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 text-white transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                    selected ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105',
                  )}
                  style={{ backgroundColor: color }}
                >
                  {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{getColorName(color)}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <label
            htmlFor={customId}
            className={cn(
              'relative flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs text-muted focus-within:ring-2 focus-within:ring-primary',
              isCustom && 'border-foreground text-foreground',
            )}
          >
            <Pipette className="h-3.5 w-3.5" aria-hidden />
            {isCustom ? getColorName(current) : 'Custom'}
            <input
              id={customId}
              type="color"
              aria-label={`${label}: custom color`}
              value={value}
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </TooltipTrigger>
        <TooltipContent>Pick any color</TooltipContent>
      </Tooltip>
    </div>
  )
}
