import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowRightToLine, Copy, GripVertical, Pencil, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DatePicker } from '@/components/DatePicker'
import { IconButton } from '@/components/IconButton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { PhaseIssueBadge } from '@/features/settings/schedule/PhaseIssueBadge'
import { getDayCountHint, phaseSchema, type PhaseValues } from '@/features/settings/schedule/phaseSchema'
import { formatDate } from '@/lib/format'
import { getDayAfter, getPhaseEndDate, type PhaseIssues } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { DurationMode, Phase } from '@/store/types'

export type PhaseField = 'name' | 'startDate' | 'duration' | 'durationUnit'

interface PhaseRowProps {
  phase: Phase
  previous: Phase | undefined
  durationMode: DurationMode
  issues: PhaseIssues | undefined
  isEditing: boolean
  focusField: PhaseField
  onStartEdit: (field: PhaseField) => void
  onStopEdit: () => void
}

type FieldErrors = Partial<Record<PhaseField, string>>

const unitLabel = (phase: Pick<Phase, 'duration' | 'durationUnit'>) =>
  phase.durationUnit === 'weeks' ? 'Weeks' : 'Days'

export function PhaseRow(props: PhaseRowProps) {
  const { phase, isEditing } = props
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: phase.id, disabled: isEditing })

  const handle = (
    <IconButton
      ref={setActivatorNodeRef}
      icon={GripVertical}
      label={`Reorder ${phase.name}`}
      tooltip="Drag to reorder. With the keyboard: Space to pick up, arrow keys to move, Space to drop"
      size="icon-sm"
      className="cursor-grab touch-none text-muted active:cursor-grabbing"
      {...attributes}
      {...listeners}
    />
  )

  return (
    <TableRow
      ref={setNodeRef}
      // dnd-kit positions rows with a computed transform; this cannot be a static class.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'hover:bg-subtle/50',
        isDragging && 'relative z-10 bg-surface shadow-md',
        isEditing && 'bg-subtle',
      )}
      data-testid={`phase-row-${phase.id}`}
    >
      {isEditing ? <EditCells {...props} /> : <DisplayCells {...props} handle={handle} />}
    </TableRow>
  )
}

function ColorDot({ color }: { color: string }) {
  // Phase colors come from data, so the fill is set inline.
  return <span className="block h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
}

function EndDateCell({ endDate, hint }: { endDate: string; hint: string }) {
  return (
    <div className="flex flex-col">
      <span className="rounded-md bg-subtle px-2 py-1 tabular-nums">{formatDate(endDate)}</span>
      {hint && <span className="px-2 text-xs text-muted">{hint}</span>}
    </div>
  )
}

function DisplayCells({
  phase,
  previous,
  durationMode,
  issues,
  onStartEdit,
  handle,
}: PhaseRowProps & { handle: ReactNode }) {
  const updatePhase = useAppStore((state) => state.updatePhase)
  const duplicatePhase = useAppStore((state) => state.duplicatePhase)
  const deletePhase = useAppStore((state) => state.deletePhase)
  const endDate = getPhaseEndDate(phase, durationMode)

  const startAfterPrevious = () => {
    if (!previous) return
    const startDate = getDayAfter(getPhaseEndDate(previous, durationMode))
    updatePhase(phase.id, { startDate })
    toast.success(`“${phase.name}” now starts ${formatDate(startDate)}`)
  }

  return (
    <>
      <TableCell className="w-8 pr-0">{handle}</TableCell>
      <TableCell className="w-6 pr-0">
        <ColorDot color={phase.color} />
      </TableCell>
      <TableCell onDoubleClick={() => onStartEdit('name')} className="font-medium">
        <div className="flex items-center gap-2">
          <span className="truncate">{phase.name}</span>
          <PhaseIssueBadge issues={issues} mode={durationMode} />
        </div>
      </TableCell>
      <TableCell onDoubleClick={() => onStartEdit('startDate')} className="tabular-nums">
        {formatDate(phase.startDate)}
      </TableCell>
      <TableCell onDoubleClick={() => onStartEdit('duration')} className="text-right tabular-nums">
        {phase.duration}
      </TableCell>
      <TableCell onDoubleClick={() => onStartEdit('durationUnit')}>{unitLabel(phase)}</TableCell>
      <TableCell>
        <EndDateCell endDate={endDate} hint={getDayCountHint(phase.durationUnit, durationMode)} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            icon={Pencil}
            label={`Edit ${phase.name}`}
            tooltip="Edit this phase"
            onClick={() => onStartEdit('name')}
          />
          <IconButton
            icon={Copy}
            label={`Duplicate ${phase.name}`}
            tooltip="Duplicate this phase"
            onClick={() => {
              duplicatePhase(phase.id)
              toast.success(`“${phase.name}” duplicated`)
            }}
          />
          <IconButton
            icon={ArrowRightToLine}
            label={`Start ${phase.name} after the previous phase`}
            tooltip={
              previous
                ? 'Set start date to the day after the previous phase ends'
                : 'The first phase has no previous phase'
            }
            // aria-disabled (not disabled) keeps the tooltip reachable.
            aria-disabled={!previous}
            className={cn(!previous && 'cursor-not-allowed opacity-50')}
            onClick={startAfterPrevious}
          />
          <ConfirmDialog
            title={`Delete “${phase.name}”?`}
            description="The phase and its dates will be removed from the schedule. This cannot be undone."
            onConfirm={() => {
              deletePhase(phase.id)
              toast.success(`“${phase.name}” deleted`)
            }}
            trigger={<IconButton icon={Trash2} label={`Delete ${phase.name}`} tooltip="Delete this phase" />}
          />
        </div>
      </TableCell>
    </>
  )
}

function EditCells({ phase, durationMode, focusField, onStopEdit }: PhaseRowProps) {
  const updatePhase = useAppStore((state) => state.updatePhase)
  const [draft, setDraft] = useState<PhaseValues>({
    name: phase.name,
    startDate: phase.startDate,
    duration: phase.duration,
    durationUnit: phase.durationUnit,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const fieldRefs = useRef<Partial<Record<PhaseField, HTMLElement | null>>>({})

  useEffect(() => {
    fieldRefs.current[focusField]?.focus()
  }, [focusField])

  const set = <K extends PhaseField>(field: K, value: PhaseValues[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const durationValid = phaseSchema.shape.duration.safeParse(draft.duration).success
  const endDate = durationValid ? getPhaseEndDate(draft, durationMode) : null

  const save = () => {
    const result = phaseSchema.safeParse(draft)
    if (!result.success) {
      const next: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as PhaseField
        next[field] ??= issue.message
      }
      setErrors(next)
      const first = (['name', 'startDate', 'duration', 'durationUnit'] as const).find((f) => next[f])
      if (first) fieldRefs.current[first]?.focus()
      return
    }
    updatePhase(phase.id, result.data)
    toast.success(`“${result.data.name}” saved`)
    onStopEdit()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Ignore keys from portaled popovers (date picker, select), which bubble through React.
    if (!event.currentTarget.contains(event.target as Node)) return
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onStopEdit()
    }
  }

  const errorText = (field: PhaseField) =>
    errors[field] && (
      <p id={`phase-${phase.id}-${field}-error`} className="mt-1 text-xs text-danger">
        {errors[field]}
      </p>
    )
  const aria = (field: PhaseField) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `phase-${phase.id}-${field}-error` : undefined,
  })

  return (
    <>
      <TableCell className="w-8 pr-0" />
      <TableCell className="w-6 pr-0">
        <ColorDot color={phase.color} />
      </TableCell>
      <TableCell onKeyDown={onKeyDown} className="min-w-44 align-top">
        <Input
          ref={(el) => {
            fieldRefs.current.name = el
          }}
          aria-label="Phase name"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          {...aria('name')}
        />
        {errorText('name')}
      </TableCell>
      <TableCell onKeyDown={onKeyDown} className="min-w-40 align-top">
        <DatePicker
          ref={(el) => {
            fieldRefs.current.startDate = el
          }}
          aria-label="Start date"
          value={draft.startDate}
          onChange={(value) => set('startDate', value)}
          tooltip="Pick the first day of the phase"
          {...aria('startDate')}
        />
        {errorText('startDate')}
      </TableCell>
      <TableCell onKeyDown={onKeyDown} className="w-24 align-top">
        <Input
          ref={(el) => {
            fieldRefs.current.duration = el
          }}
          aria-label="Duration"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="text-right tabular-nums"
          value={Number.isNaN(draft.duration) ? '' : draft.duration}
          onChange={(e) => set('duration', e.target.valueAsNumber)}
          {...aria('duration')}
        />
        {errorText('duration')}
      </TableCell>
      <TableCell onKeyDown={onKeyDown} className="w-28 align-top">
        <Select
          value={draft.durationUnit}
          onValueChange={(value) => set('durationUnit', value as PhaseValues['durationUnit'])}
        >
          <SelectTrigger
            ref={(el) => {
              fieldRefs.current.durationUnit = el
            }}
            aria-label="Unit"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">Days</SelectItem>
            <SelectItem value="weeks">Weeks</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="align-top">
        {endDate ? (
          <EndDateCell endDate={endDate} hint={getDayCountHint(draft.durationUnit, durationMode)} />
        ) : (
          <span className="text-muted">—</span>
        )}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            icon={Save}
            label="Save phase"
            tooltip="Save changes to this phase"
            shortcut="Enter"
            onClick={save}
          />
          <IconButton
            icon={X}
            label="Cancel editing"
            tooltip="Discard changes to this phase"
            shortcut="Esc"
            onClick={onStopEdit}
          />
        </div>
      </TableCell>
    </>
  )
}
