import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { CalculatedField } from '@/components/CalculatedField'
import { DatePicker } from '@/components/DatePicker'
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
import {
  getDayCountHint,
  getEndDateFormula,
  phaseSchema,
  type PhaseValues,
} from '@/features/settings/schedule/phaseSchema'
import { todayISO } from '@/lib/dates'
import { fieldAria } from '@/lib/fieldAria'
import { formatDate } from '@/lib/format'
import { getNextPhaseStart, getPhaseEndDate } from '@/lib/schedule'
import { useAppStore } from '@/store/useAppStore'

interface AddPhaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPhaseDialog({ open, onOpenChange }: AddPhaseDialogProps) {
  // A new form per opening, so defaults are recalculated; it stays mounted while closing.
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add phase</DialogTitle>
          <DialogDescription>Phases set the project timeline. You can reorder them later.</DialogDescription>
        </DialogHeader>
        <AddPhaseForm key={session} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function AddPhaseForm({ onDone }: { onDone: () => void }) {
  const phases = useAppStore((state) => state.phases)
  const durationMode = useAppStore((state) => state.project.durationMode)
  const addPhase = useAppStore((state) => state.addPhase)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PhaseValues>({
    resolver: zodResolver(phaseSchema),
    defaultValues: {
      name: '',
      startDate: getNextPhaseStart(phases, durationMode) ?? todayISO(),
      duration: 4,
      durationUnit: 'weeks',
    },
  })

  const [startDate, duration, durationUnit] = useWatch({
    control,
    name: ['startDate', 'duration', 'durationUnit'],
  })
  const previewValid = phaseSchema.shape.duration.safeParse(duration).success && Boolean(startDate)
  const endDate = previewValid ? getPhaseEndDate({ startDate, duration, durationUnit }, durationMode) : null
  const hint = getDayCountHint(durationUnit, durationMode)

  const onSubmit = (values: PhaseValues) => {
    addPhase(values)
    toast.success(`Phase “${values.name}” added`)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField id="phase-name" label="Phase name" required error={errors.name?.message}>
        <Input
          id="phase-name"
          autoFocus
          autoComplete="off"
          placeholder="e.g. Explore"
          {...fieldAria('phase-name', errors.name?.message)}
          {...register('name')}
        />
      </FormField>

      <FormField id="phase-start" label="Start date" required error={errors.startDate?.message}>
        <Controller
          control={control}
          name="startDate"
          render={({ field }) => (
            <DatePicker
              id="phase-start"
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              tooltip="Pick the first day of the phase"
              {...fieldAria('phase-start', errors.startDate?.message)}
            />
          )}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          id="phase-duration"
          label="Duration"
          required
          helper={hint || undefined}
          error={errors.duration?.message}
        >
          <Input
            id="phase-duration"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className="text-right tabular-nums"
            {...fieldAria('phase-duration', errors.duration?.message, Boolean(hint))}
            {...register('duration', { valueAsNumber: true })}
          />
        </FormField>
        <FormField id="phase-unit" label="Unit">
          <Controller
            control={control}
            name="durationUnit"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="phase-unit" ref={field.ref} onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      <CalculatedField
        label="End date"
        value={endDate ? formatDate(endDate) : '—'}
        formula={getEndDateFormula(durationMode)}
      />

      <DialogFooter className="pt-2">
        <ActionButton
          type="button"
          variant="outline"
          icon={X}
          tooltip="Close without adding"
          onClick={onDone}
        >
          Cancel
        </ActionButton>
        <ActionButton type="submit" icon={Plus} tooltip="Add this phase to the schedule">
          Add phase
        </ActionButton>
      </DialogFooter>
    </form>
  )
}
