import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, Percent, RotateCcw, X } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import { IconButton } from '@/components/IconButton'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getRangeSize, MAX_LOAD_PCT, type CellRange } from '@/lib/assignment'
import { cn } from '@/lib/utils'

interface SelectionToolbarProps {
  range: CellRange | null
  onSetLoad: (pct: number) => void
  onReset: () => void
  onFillRight: () => void
  onClear: () => void
}

/** Bulk actions for a selection of more than one cell. */
export function SelectionToolbar({ range, onSetLoad, onReset, onFillRight, onClear }: SelectionToolbarProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('100')
  const [error, setError] = useState<string | null>(null)

  // Always rendered (with a hint when idle) so the grid below does not jump while selecting.
  if (!range || getRangeSize(range) < 2) {
    return (
      <div className="flex min-h-12 items-center rounded-lg border border-dashed px-3 py-2 text-xs text-muted">
        Select several cells (Shift+click, drag or Shift+arrows) to set, reset or fill them together.
      </div>
    )
  }
  const rows = range.bottom - range.top + 1
  const cols = range.right - range.left + 1
  const canFill = cols > 1

  const apply = (event: FormEvent) => {
    event.preventDefault()
    const pct = Number(value.replace(',', '.'))
    if (value.trim() === '' || !Number.isFinite(pct) || pct < 0 || pct > MAX_LOAD_PCT) {
      setError(`Enter 0–${MAX_LOAD_PCT}`)
      return
    }
    onSetLoad(pct)
    setOpen(false)
  }

  return (
    <div
      role="toolbar"
      aria-label="Selected cells"
      className="flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5"
    >
      <span className="text-sm font-medium">
        {getRangeSize(range)} cells selected
        <span className="ml-1 text-xs font-normal text-muted">
          ({rows} {rows === 1 ? 'person' : 'people'} × {cols} {cols === 1 ? 'week' : 'weeks'})
        </span>
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            setError(null)
          }}
        >
          <PopoverTrigger asChild>
            <ActionButton
              size="sm"
              variant="outline"
              icon={Percent}
              tooltip="Set the same load % for every selected week"
            >
              Set load %…
            </ActionButton>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60">
            <form onSubmit={apply} className="flex flex-col gap-2" noValidate>
              <label htmlFor="selection-load" className="text-sm font-medium">
                Load % for selection
              </label>
              <div className="flex gap-2">
                <Input
                  id="selection-load"
                  autoFocus
                  inputMode="decimal"
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value)
                    setError(null)
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'selection-load-error' : undefined}
                  className="text-right tabular-nums"
                />
                <ActionButton
                  type="submit"
                  size="sm"
                  icon={Check}
                  tooltip="Apply to the selected weeks"
                  className="h-9"
                >
                  Apply
                </ActionButton>
              </div>
              {error && (
                <p id="selection-load-error" className="text-xs text-danger">
                  {error}
                </p>
              )}
            </form>
          </PopoverContent>
        </Popover>
        <ActionButton
          size="sm"
          variant="outline"
          icon={RotateCcw}
          tooltip="Remove weekly overrides and use the default load"
          shortcut="Del"
          onClick={onReset}
        >
          Reset to default
        </ActionButton>
        <ActionButton
          size="sm"
          variant="outline"
          icon={ArrowRight}
          tooltip={
            canFill
              ? 'Copy the first selected value across the selection'
              : 'Select two or more weeks to fill right'
          }
          aria-disabled={!canFill}
          className={cn(!canFill && 'cursor-not-allowed opacity-50')}
          onClick={() => canFill && onFillRight()}
        >
          Fill right
        </ActionButton>
        <IconButton
          icon={X}
          size="icon-sm"
          label="Clear selection"
          tooltip="Clear the selection"
          shortcut="Esc"
          onClick={onClear}
        />
      </div>
    </div>
  )
}
