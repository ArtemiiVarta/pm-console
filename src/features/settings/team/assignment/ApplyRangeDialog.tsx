import { useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { FormField } from '@/components/FormField'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MAX_LOAD_PCT } from '@/lib/assignment'
import { fieldAria } from '@/lib/fieldAria'
import { formatDate } from '@/lib/format'
import { getFullName } from '@/lib/roster'
import { useAppStore } from '@/store/useAppStore'
import type { ISODate, TeamMember } from '@/store/types'

interface ApplyRangeDialogProps {
  member: TeamMember | null
  weeks: ISODate[]
  onClose: () => void
}

export function ApplyRangeDialog({ member, weeks, onClose }: ApplyRangeDialogProps) {
  // Keep the last member while the dialog animates closed.
  const [shown, setShown] = useState(member)
  if (member && member !== shown) setShown(member)

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply load to a date range</DialogTitle>
          <DialogDescription>
            {shown
              ? `Sets the same load for ${getFullName(shown)} in every week from the first to the last.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        {shown && <ApplyRangeForm key={shown.id} member={shown} weeks={weeks} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ApplyRangeForm({
  member,
  weeks,
  onDone,
}: {
  member: TeamMember
  weeks: ISODate[]
  onDone: () => void
}) {
  const applyLoadToRange = useAppStore((state) => state.applyLoadToRange)
  const [from, setFrom] = useState(weeks[0] ?? '')
  const [to, setTo] = useState(weeks.at(-1) ?? '')
  const [pct, setPct] = useState(String(member.defaultLoadPct))
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = Number(pct.replace(',', '.'))
    if (pct.trim() === '' || !Number.isFinite(value) || value < 0 || value > MAX_LOAD_PCT) {
      setError(`Enter a load between 0 and ${MAX_LOAD_PCT}%`)
      return
    }
    applyLoadToRange(member.id, from, to, value)
    toast.success(`${getFullName(member)}: ${value}% applied`)
    onDone()
  }

  const weekSelect = (id: string, label: string, value: string, onChange: (value: string) => void) => (
    <FormField id={id} label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {weeks.map((week) => (
            <SelectItem key={week} value={week}>
              Week of {formatDate(week)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {weekSelect('range-from', 'From week', from, setFrom)}
        {weekSelect('range-to', 'To week', to, setTo)}
      </div>
      <FormField
        id="range-pct"
        label="Load %"
        helper="0–200%. Weeks outside the range keep their values."
        error={error ?? undefined}
      >
        <Input
          id="range-pct"
          inputMode="decimal"
          value={pct}
          onChange={(event) => {
            setPct(event.target.value)
            setError(null)
          }}
          className="text-right tabular-nums"
          {...fieldAria('range-pct', error ?? undefined, true)}
        />
      </FormField>
      <DialogFooter className="pt-2">
        <ActionButton
          type="button"
          variant="outline"
          icon={X}
          tooltip="Close without changing anything"
          onClick={onDone}
        >
          Cancel
        </ActionButton>
        <ActionButton type="submit" icon={Check} tooltip="Set this load for every week in the range">
          Apply
        </ActionButton>
      </DialogFooter>
    </form>
  )
}
