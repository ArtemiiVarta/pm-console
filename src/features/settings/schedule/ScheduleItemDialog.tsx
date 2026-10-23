import { forwardRef, useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pin, Plus, Save, Star, X } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ActionButton } from '@/components/ActionButton'
import { CalculatedField } from '@/components/CalculatedField'
import { ColorPicker } from '@/components/ColorPicker'
import { DatePicker } from '@/components/DatePicker'
import { FormField } from '@/components/FormField'
import { IconButton } from '@/components/IconButton'
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
import { getDayCountHint, getEndDateFormula } from '@/features/settings/schedule/phaseSchema'
import { todayISO } from '@/lib/dates'
import { fieldAria } from '@/lib/fieldAria'
import { formatDate } from '@/lib/format'
import { getPhaseColor, MILESTONE_COLOR } from '@/lib/palette'
import { getNextPhaseStart, getPhaseEndDate, sortPhases } from '@/lib/schedule'
import { getChildren } from '@/lib/scheduleTree'
import { useAppStore } from '@/store/useAppStore'
import type { DurationUnit, Milestone, Phase, ScheduleItem, ScheduleItemKind } from '@/store/types'

/** What the dialog adds or edits. A `parentId` makes it a child (task/milestone under a phase or task). */
export type ScheduleDialogMode =
  | { kind: 'add'; type: 'phase' | 'project-milestone' }
  | { kind: 'add'; type: ScheduleItemKind; parentId: string }
  | { kind: 'edit-phase'; phase: Phase }
  | { kind: 'edit-item'; item: ScheduleItem }
  | { kind: 'edit-milestone'; milestone: Milestone }
  /** From the top Add menu: the dialog asks where to put it ("Under"). */
  | { kind: 'add-under'; type: 'task' | 'sub-task' | 'milestone' }

/** Concrete modes the form works with (an "add-under" resolves to one of these). */
type FormMode = Exclude<ScheduleDialogMode, { kind: 'add-under' }>

const PROJECT_LEVEL = ''

interface UnderOption {
  value: string
  label: string
}

/** Where a new item can go: phases for tasks, tasks for sub-tasks, any of them (or the project) for milestones. */
function getUnderOptions(
  type: 'task' | 'sub-task' | 'milestone',
  phases: Phase[],
  items: ScheduleItem[],
): UnderOption[] {
  const ordered = sortPhases(phases)
  const phaseOptions = ordered.map((phase) => ({ value: phase.id, label: `Phase: ${phase.name}` }))
  const taskOptions = ordered.flatMap((phase) =>
    getChildren(items, phase.id)
      .filter((item) => item.kind === 'task')
      .map((task) => ({ value: task.id, label: `Task: ${phase.name} › ${task.name}` })),
  )
  if (type === 'task') return phaseOptions
  if (type === 'sub-task') return taskOptions
  return [{ value: PROJECT_LEVEL, label: 'Project (not under a phase)' }, ...phaseOptions, ...taskOptions]
}

function resolveMode(mode: ScheduleDialogMode, under: string): FormMode {
  if (mode.kind !== 'add-under') return mode
  if (mode.type === 'milestone' && under === PROJECT_LEVEL) return { kind: 'add', type: 'project-milestone' }
  return { kind: 'add', type: mode.type === 'milestone' ? 'milestone' : 'task', parentId: under }
}

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Use 80 characters or fewer'),
  startDate: z.iso.date('Pick a date'),
  duration: z
    .number({ error: 'Enter a duration' })
    .int('Use a whole number')
    .positive('Use a duration above 0')
    .max(999, 'Use 999 or fewer'),
  durationUnit: z.enum(['days', 'weeks']),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a color'),
  /** This node follows its own children (parents only). */
  fitStart: z.boolean(),
  fitEnd: z.boolean(),
  /** The parent follows its children (children only). */
  adjustParentStart: z.boolean(),
  adjustParentEnd: z.boolean(),
})

type Values = z.infer<typeof schema>

interface Props {
  mode: ScheduleDialogMode | null
  onClose: () => void
}

export function ScheduleItemDialog({ mode, onClose }: Props) {
  // Keep the last content while the dialog animates closed.
  const [shown, setShown] = useState(mode)
  if (mode && mode !== shown) setShown(mode)
  const phases = useAppStore((state) => state.phases)
  const items = useAppStore((state) => state.items)

  // "Under" choice for add-under; reset to the first option each time the dialog opens.
  const [under, setUnder] = useState(PROJECT_LEVEL)
  const [underFor, setUnderFor] = useState<ScheduleDialogMode | null>(null)
  const options = shown?.kind === 'add-under' ? getUnderOptions(shown.type, phases, items) : []
  if (shown && shown !== underFor) {
    setUnderFor(shown)
    setUnder(options[0]?.value ?? PROJECT_LEVEL)
  }
  const formMode = shown ? resolveMode(shown, under) : null
  const info = formMode ? describe(formMode, phases, items) : null

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {shown && info && (
          <>
            <DialogHeader>
              <DialogTitle>{info.title}</DialogTitle>
              <DialogDescription>{info.description}</DialogDescription>
            </DialogHeader>
            {shown.kind === 'add-under' && (
              <FormField id="item-under" label="Under" helper="Where it goes in the schedule.">
                <Select
                  value={under === PROJECT_LEVEL ? '__project__' : under}
                  onValueChange={(value) => setUnder(value === '__project__' ? PROJECT_LEVEL : value)}
                >
                  <SelectTrigger id="item-under">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value || '__project__'} value={option.value || '__project__'}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            {formMode && (
              <ScheduleItemForm
                // Typed values survive changing "Under" (same key); other modes remount per item.
                key={shown.kind === 'add-under' ? `under-${shown.type}` : formKey(formMode)}
                mode={formMode}
                info={info}
                onDone={onClose}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface Described {
  title: string
  description: string
  /** Phase or task (has a duration) vs milestone (single date). */
  isSpan: boolean
  noun: 'phase' | 'task' | 'sub-task' | 'milestone'
  parent: { id: string; name: string; noun: 'phase' | 'task'; fitStart: boolean; fitEnd: boolean } | null
  /** Children of the node being edited (phases and tasks only). */
  childCount: number
}

function formKey(mode: FormMode) {
  if (mode.kind === 'add') return `add-${mode.type}-${'parentId' in mode ? mode.parentId : ''}`
  if (mode.kind === 'edit-phase') return mode.phase.id
  if (mode.kind === 'edit-item') return mode.item.id
  return mode.milestone.id
}

function describe(mode: FormMode, phases: Phase[], items: ScheduleItem[]): Described | null {
  const parentOf = (parentId: string): Described['parent'] => {
    const phase = phases.find((p) => p.id === parentId)
    if (phase) {
      return {
        id: phase.id,
        name: phase.name,
        noun: 'phase',
        fitStart: !!phase.fitStart,
        fitEnd: !!phase.fitEnd,
      }
    }
    const task = items.find((i) => i.id === parentId)
    return task
      ? { id: task.id, name: task.name, noun: 'task', fitStart: !!task.fitStart, fitEnd: !!task.fitEnd }
      : null
  }

  if (mode.kind === 'add' && (mode.type === 'phase' || mode.type === 'project-milestone')) {
    return mode.type === 'phase'
      ? {
          title: 'Add phase',
          description: 'Phases set the project timeline. Add tasks and milestones under them later.',
          isSpan: true,
          noun: 'phase',
          parent: null,
          childCount: 0,
        }
      : {
          title: 'Add milestone',
          description: 'A project-level key date, shown as a star on the Gantt chart.',
          isSpan: false,
          noun: 'milestone',
          parent: null,
          childCount: 0,
        }
  }
  if (mode.kind === 'add' && 'parentId' in mode) {
    const parent = parentOf(mode.parentId)
    if (!parent) return null
    const isTask = mode.type === 'task'
    const noun = isTask ? (parent.noun === 'task' ? 'sub-task' : 'task') : 'milestone'
    return {
      title: `Add ${noun === 'milestone' && parent.noun === 'task' ? 'sub-milestone' : noun}`,
      description: `Under ${parent.noun} “${parent.name}”.`,
      isSpan: isTask,
      noun,
      parent,
      childCount: 0,
    }
  }
  if (mode.kind === 'edit-phase') {
    return {
      title: 'Edit phase',
      description: 'Change the phase, or let it follow its tasks and milestones.',
      isSpan: true,
      noun: 'phase',
      parent: null,
      childCount: getChildren(items, mode.phase.id).length,
    }
  }
  if (mode.kind === 'edit-item') {
    const parent = parentOf(mode.item.parentId)
    const isTask = mode.item.kind === 'task'
    return {
      title: isTask ? (parent?.noun === 'task' ? 'Edit sub-task' : 'Edit task') : 'Edit milestone',
      description: parent ? `Under ${parent.noun} “${parent.name}”.` : '',
      isSpan: isTask,
      noun: isTask ? (parent?.noun === 'task' ? 'sub-task' : 'task') : 'milestone',
      parent,
      childCount: isTask ? getChildren(items, mode.item.id).length : 0,
    }
  }
  return {
    title: 'Edit milestone',
    description: 'A project-level key date, shown as a star on the Gantt chart.',
    isSpan: false,
    noun: 'milestone',
    parent: null,
    childCount: 0,
  }
}

function ScheduleItemForm({ mode, info, onDone }: { mode: FormMode; info: Described; onDone: () => void }) {
  const store = useAppStore()
  const durationMode = store.project.durationMode

  // The node being edited keeps its pinned end until the user changes the duration.
  const editing: Phase | ScheduleItem | null =
    mode.kind === 'edit-phase' ? mode.phase : mode.kind === 'edit-item' ? mode.item : null
  const [pinnedEnd, setPinnedEnd] = useState<string | undefined>(editing?.endDate)

  const defaults = useMemo<Values>(() => {
    const base = {
      fitStart: false,
      fitEnd: false,
      adjustParentStart: info.parent?.fitStart ?? false,
      adjustParentEnd: info.parent?.fitEnd ?? false,
    }
    if (editing) {
      return {
        ...base,
        name: editing.name,
        startDate: editing.startDate,
        duration: editing.duration,
        durationUnit: editing.durationUnit,
        color: editing.color,
        fitStart: !!editing.fitStart,
        fitEnd: !!editing.fitEnd,
      }
    }
    if (mode.kind === 'edit-milestone') {
      const { name, date, color } = mode.milestone
      return { ...base, name, startDate: date, duration: 1, durationUnit: 'days', color }
    }
    // New node: phases start after the last phase; children start with their parent and share its color.
    const parentNode =
      info.parent &&
      (store.phases.find((p) => p.id === info.parent?.id) ??
        store.items.find((i) => i.id === info.parent?.id))
    const parentStart = parentNode?.startDate
    const startDate =
      parentStart ??
      (info.noun === 'phase' ? getNextPhaseStart(store.phases, durationMode) : null) ??
      todayISO()
    return {
      ...base,
      name: '',
      startDate,
      duration: info.noun === 'phase' ? 4 : info.isSpan ? 5 : 1,
      durationUnit: info.noun === 'phase' ? 'weeks' : 'days',
      color: !info.isSpan ? MILESTONE_COLOR : (parentNode?.color ?? getPhaseColor(store.phases.length)),
    }
    // Defaults are computed once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })

  // "Under" changed (add from the top menu): take the new parent's adjust options and start date.
  const parentId = info.parent?.id ?? null
  const [seenParent, setSeenParent] = useState(parentId)
  if (parentId !== seenParent) {
    setSeenParent(parentId)
    setValue('adjustParentStart', info.parent?.fitStart ?? false)
    setValue('adjustParentEnd', info.parent?.fitEnd ?? false)
    const parentStart =
      store.phases.find((p) => p.id === parentId)?.startDate ??
      store.items.find((i) => i.id === parentId)?.startDate
    if (parentStart && !getFieldState('startDate').isDirty) setValue('startDate', parentStart)
  }

  const [startDate, duration, durationUnit, fitStart, fitEnd] = useWatch({
    control,
    name: ['startDate', 'duration', 'durationUnit', 'fitStart', 'fitEnd'],
  })
  const hasChildren = info.childCount > 0
  const followsStart = hasChildren && fitStart
  const followsEnd = hasChildren && fitEnd
  const durationValid = Number.isInteger(duration) && duration > 0
  const endDate =
    info.isSpan && startDate && durationValid
      ? getPhaseEndDate({ startDate, duration, durationUnit, endDate: pinnedEnd }, durationMode)
      : null

  const onSubmit = (values: Values) => {
    const { name, startDate: start, duration: dur, durationUnit: unit, color } = values
    const parentFit = { fitStart: values.adjustParentStart, fitEnd: values.adjustParentEnd }
    const span = { startDate: start, duration: dur, durationUnit: unit as DurationUnit, endDate: pinnedEnd }

    if (mode.kind === 'add') {
      if (mode.type === 'phase') store.addPhase({ name, color, ...span })
      else if (mode.type === 'project-milestone') store.addMilestone({ name, date: start, color })
      else if ('parentId' in mode)
        store.addItem(
          {
            parentId: mode.parentId,
            kind: mode.type,
            name,
            color,
            ...span,
            duration: mode.type === 'milestone' ? 1 : dur,
          },
          parentFit,
        )
      toast.success(`${capitalize(info.noun)} “${name}” added`)
    } else if (mode.kind === 'edit-phase') {
      store.updatePhase(mode.phase.id, {
        name,
        color,
        ...span,
        fitStart: values.fitStart,
        fitEnd: values.fitEnd,
      })
      toast.success(`Phase “${name}” saved`)
    } else if (mode.kind === 'edit-item') {
      store.updateItem(
        mode.item.id,
        { name, color, ...span, fitStart: values.fitStart, fitEnd: values.fitEnd },
        info.parent ? parentFit : undefined,
      )
      toast.success(`${capitalize(info.noun)} “${name}” saved`)
    } else {
      store.updateMilestone(mode.milestone.id, { name, date: start, color })
      toast.success(`Milestone “${name}” saved`)
    }
    onDone()
  }

  const hint = getDayCountHint(durationUnit, durationMode)
  const durationChanged = () => setPinnedEnd(undefined)

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField id="item-name" label={`${capitalize(info.noun)} name`} required error={errors.name?.message}>
        <Input
          id="item-name"
          autoFocus
          autoComplete="off"
          placeholder={
            info.noun === 'phase' ? 'e.g. Explore' : info.isSpan ? 'e.g. Fit-gap workshops' : 'e.g. Go-live'
          }
          {...fieldAria('item-name', errors.name?.message)}
          {...register('name')}
        />
      </FormField>

      <FormField
        id="item-start"
        label={info.isSpan ? 'Start date' : 'Date'}
        required
        helper={followsStart ? 'Follows the earliest child item.' : undefined}
        error={errors.startDate?.message}
      >
        <Controller
          control={control}
          name="startDate"
          render={({ field }) => (
            <DatePicker
              id="item-start"
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              tooltip={info.isSpan ? 'Pick the first day' : 'Pick the date'}
              {...fieldAria('item-start', errors.startDate?.message, followsStart)}
            />
          )}
        />
      </FormField>

      {info.isSpan && !followsEnd && (
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="item-duration"
            label="Duration"
            required
            helper={hint || undefined}
            error={errors.duration?.message}
          >
            <Input
              id="item-duration"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="text-right tabular-nums"
              {...fieldAria('item-duration', errors.duration?.message, Boolean(hint))}
              {...register('duration', { valueAsNumber: true, onChange: durationChanged })}
            />
          </FormField>
          <FormField id="item-unit" label="Unit">
            <Controller
              control={control}
              name="durationUnit"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value)
                    durationChanged()
                  }}
                >
                  <SelectTrigger id="item-unit" ref={field.ref} onBlur={field.onBlur}>
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
      )}

      {info.isSpan && pinnedEnd && !followsEnd && (
        <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted">
          <Pin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            End pinned to {formatDate(pinnedEnd)} on the Gantt chart. Changing the duration releases it.
          </span>
          <IconButton
            icon={X}
            size="icon-sm"
            label="Release pinned end"
            tooltip="Use the duration for the end date again"
            onClick={() => setPinnedEnd(undefined)}
          />
        </p>
      )}

      {info.isSpan && (
        <CalculatedField
          label="End date"
          value={followsEnd ? 'Follows the latest child item' : endDate ? formatDate(endDate) : '—'}
          formula={
            followsEnd ? 'Latest end of the tasks and milestones under it' : getEndDateFormula(durationMode)
          }
        />
      )}

      {hasChildren && (
        <Fieldset
          legend={`Follow the ${info.childCount} item${info.childCount === 1 ? '' : 's'} under this ${info.noun}`}
        >
          <Check label="Start date = earliest child start" {...register('fitStart')} />
          <Check label="End date = latest child end" {...register('fitEnd')} />
        </Fieldset>
      )}

      {info.parent && (
        <Fieldset legend={`Adjust ${info.parent.noun} “${info.parent.name}” to its children`}>
          <Check
            label={`Adjust ${info.parent.noun} start date (earliest child start)`}
            {...register('adjustParentStart')}
          />
          <Check
            label={`Adjust ${info.parent.noun} end date (latest child end)`}
            {...register('adjustParentEnd')}
          />
          <p className="text-xs text-muted">Stays in sync when its children move, change or are removed.</p>
        </Fieldset>
      )}

      <FormField id="item-color" label={info.isSpan ? 'Bar color' : 'Star color'}>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorPicker
              id="item-color"
              label={info.isSpan ? `${capitalize(info.noun)} color` : 'Star color'}
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
        {mode.kind === 'add' ? (
          <ActionButton
            type="submit"
            icon={info.isSpan ? Plus : Star}
            tooltip={`Add this ${info.noun} to the schedule`}
          >
            {info.title}
          </ActionButton>
        ) : (
          <ActionButton type="submit" icon={Save} tooltip="Save changes">
            Save
          </ActionButton>
        )}
      </DialogFooter>
    </form>
  )
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      {children}
    </fieldset>
  )
}

const Check = forwardRef<HTMLInputElement, { label: string } & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, ...props }, ref) => (
    <label className="flex items-center gap-2 text-sm">
      <input ref={ref} type="checkbox" className="h-4 w-4 accent-primary" {...props} />
      {label}
    </label>
  ),
)
Check.displayName = 'Check'
