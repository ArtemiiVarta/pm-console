import { forwardRef, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseISODate, toISODate, WEEK_STARTS_ON } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ISODate } from '@/store/types'

interface DatePickerProps {
  id?: string
  value: ISODate
  onChange: (value: ISODate) => void
  tooltip?: string
  className?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** Button showing the date; opens a calendar in a popover (weeks start Monday). */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(
  ({ value, onChange, tooltip = 'Pick a date', className, ...buttonProps }, ref) => {
    const [open, setOpen] = useState(false)
    const selected = value ? parseISODate(value) : undefined

    return (
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
            {value ? formatDate(value) : <span className="text-muted">Pick a date</span>}
          </ActionButton>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
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
  },
)
DatePicker.displayName = 'DatePicker'
