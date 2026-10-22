import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, Star, X } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { ColorPicker } from '@/components/ColorPicker'
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
import { milestoneSchema, type MilestoneValues } from '@/features/settings/schedule/phaseSchema'
import { todayISO } from '@/lib/dates'
import { fieldAria } from '@/lib/fieldAria'
import { MILESTONE_COLOR } from '@/lib/palette'
import { getPhaseEndDate, sortPhases } from '@/lib/schedule'
import { useAppStore } from '@/store/useAppStore'
import type { Milestone } from '@/store/types'

/** add: new milestone · edit: change `milestone`. */
export type MilestoneDialogMode = { kind: 'add' } | { kind: 'edit'; milestone: Milestone }

interface MilestoneDialogProps {
  mode: MilestoneDialogMode | null
  onClose: () => void
}

export function MilestoneDialog({ mode, onClose }: MilestoneDialogProps) {
  // Keep the last content while the dialog animates closed.
  const [shown, setShown] = useState(mode)
  if (mode && mode !== shown) setShown(mode)

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shown?.kind === 'edit' ? 'Edit milestone' : 'Add milestone'}</DialogTitle>
          <DialogDescription>
            A key date, shown as a star on the Timeline. Milestones do not change the project dates.
          </DialogDescription>
        </DialogHeader>
        {shown && (
          <MilestoneForm
            key={shown.kind === 'edit' ? shown.milestone.id : 'add'}
            mode={shown}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MilestoneForm({ mode, onDone }: { mode: MilestoneDialogMode; onDone: () => void }) {
  const phases = useAppStore((state) => state.phases)
  const durationMode = useAppStore((state) => state.project.durationMode)
  const addMilestone = useAppStore((state) => state.addMilestone)
  const updateMilestone = useAppStore((state) => state.updateMilestone)

  // New milestones default to the end of the last phase (a common sign-off point), or today.
  const lastPhase = sortPhases(phases).at(-1)
  const defaultValues: MilestoneValues =
    mode.kind === 'edit'
      ? { name: mode.milestone.name, date: mode.milestone.date, color: mode.milestone.color }
      : {
          name: '',
          date: lastPhase ? getPhaseEndDate(lastPhase, durationMode) : todayISO(),
          color: MILESTONE_COLOR,
        }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MilestoneValues>({ resolver: zodResolver(milestoneSchema), defaultValues })

  const onSubmit = (values: MilestoneValues) => {
    if (mode.kind === 'edit') {
      updateMilestone(mode.milestone.id, values)
      toast.success(`Milestone “${values.name}” saved`)
    } else {
      addMilestone(values)
      toast.success(`Milestone “${values.name}” added`)
    }
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField id="milestone-name" label="Milestone name" required error={errors.name?.message}>
        <Input
          id="milestone-name"
          autoFocus
          autoComplete="off"
          placeholder="e.g. Go-live"
          {...fieldAria('milestone-name', errors.name?.message)}
          {...register('name')}
        />
      </FormField>

      <FormField id="milestone-date" label="Date" required error={errors.date?.message}>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DatePicker
              id="milestone-date"
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              tooltip="Pick the milestone date"
              {...fieldAria('milestone-date', errors.date?.message)}
            />
          )}
        />
      </FormField>

      <FormField id="milestone-color" label="Star color" helper="The color of the star on the Timeline.">
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorPicker
              id="milestone-color"
              label="Star color"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </FormField>

      <DialogFooter className="pt-2">
        <ActionButton variant="outline" icon={X} tooltip="Close without saving" onClick={onDone}>
          Cancel
        </ActionButton>
        {mode.kind === 'edit' ? (
          <ActionButton type="submit" icon={Save} tooltip="Save changes to this milestone">
            Save
          </ActionButton>
        ) : (
          <ActionButton type="submit" icon={Star} tooltip="Add this milestone to the timeline">
            Add milestone
          </ActionButton>
        )}
      </DialogFooter>
    </form>
  )
}
