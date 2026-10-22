import { forwardRef, useState } from 'react'
import { CalendarRange, X } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import { IconButton } from '@/components/IconButton'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseISODate, toISODate, WEEK_STARTS_ON } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ISODate } from '@/store/types'

interface DatePickerProps {
  id?: string
  /** Empty string = no date. */
  value: ISODate
  onChange: (value: ISODate) => void
  tooltip?: string
  placeholder?: string
  /** Month to show when no date is picked. */
  emptyMonth?: ISODate
  /** When set, a clear button appears next to a picked date. */
  onClear?: () => void
  clearLabel?: string
  className?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** Button showing the date; opens a calendar in a popover (weeks start Monday). */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      tooltip = 'Pick a date',
      placeholder = 'Pick a date',
      emptyMonth,
      onClear,
      clearLabel = 'Clear date',
      className,
      ...buttonProps
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false)
    const selected = value ? parseISODate(value) : undefined

    const picker = (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <ActionButton
            ref={ref}
            type="button"
            variant="outline"
            icon={CalendarRange}
            tooltip={tooltip}
            className={cn('w-full justify-start font-normal tabular-nums', className)}
            {...buttonProps}
          >
            {value ? formatDate(value) : <span className="text-muted">{placeholder}</span>}
          </ActionButton>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? (emptyMonth ? parseISODate(emptyMonth) : undefined)}
            weekStartsOn={WEEK_STARTS_ON}
            onSelect={(date) => {
              if (date) onChange(toISODate(date))
              setOpen(false)
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    )

    if (!onClear) return picker
    return (
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">{picker}</div>
        {value && <IconButton icon={X} label={clearLabel} tooltip={clearLabel} onClick={onClear} />}
      </div>
    )
  },
)
DatePicker.displayName = 'DatePicker'
