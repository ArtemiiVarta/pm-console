import { useId, useMemo, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Save, UserPlus, X } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { CalculatedField } from '@/components/CalculatedField'
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
import {
  emptyMemberValues,
  makeMemberSchema,
  ROLE_SUGGESTIONS,
  toMemberData,
  toMemberValues,
  type MemberValues,
} from '@/features/settings/team/memberSchema'
import { fieldAria } from '@/lib/fieldAria'
import { getRateMargin } from '@/lib/forecast'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { getFullName } from '@/lib/roster'
import { getProjectRange } from '@/lib/schedule'
import { useAppStore } from '@/store/useAppStore'
import type { TeamMember } from '@/store/types'

/** add: blank form · edit: update `member` · duplicate: new member prefilled from `member` (email left blank). */
export type MemberDialogMode =
  { kind: 'add' } | { kind: 'edit'; member: TeamMember } | { kind: 'duplicate'; member: TeamMember }

interface MemberDialogProps {
  mode: MemberDialogMode | null
  onClose: () => void
}

const TITLES = { add: 'Add team member', edit: 'Edit team member', duplicate: 'Duplicate team member' }

export function MemberDialog({ mode, onClose }: MemberDialogProps) {
  // Keep showing the last content while the dialog animates closed.
  const [lastMode, setLastMode] = useState(mode)
  if (mode && mode !== lastMode) setLastMode(mode)
  const shown = mode ?? lastMode

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {shown && (
          <>
            <DialogHeader>
              <DialogTitle>{TITLES[shown.kind]}</DialogTitle>
              <DialogDescription>
                {shown.kind === 'duplicate'
                  ? `A copy of ${getFullName(shown.member)}, with the same role, start date, allocation, rates and planned weeks. Enter a new name and email.`
                  : 'Allocation, start date and rates drive the planned hours, cost and margin.'}
              </DialogDescription>
            </DialogHeader>
            {/* Keyed by mode so the form resets each time it opens. */}
            <MemberForm
              key={shown.kind === 'add' ? 'add' : `${shown.kind}-${shown.member.id}`}
              mode={shown}
              onDone={onClose}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({ mode, onDone }: { mode: MemberDialogMode; onDone: () => void }) {
  const members = useAppStore((state) => state.members)
  const project = useAppStore((state) => state.project)
  const phases = useAppStore((state) => state.phases)
  const projectStart = useMemo(
    () => getProjectRange(phases, project.durationMode)?.start ?? null,
    [phases, project.durationMode],
  )
  const addMember = useAppStore((state) => state.addMember)
  const updateMember = useAppStore((state) => state.updateMember)
  const rolesListId = useId()

  const editingId = mode.kind === 'edit' ? mode.member.id : undefined
  const schema = useMemo(() => makeMemberSchema(members, editingId), [members, editingId])
  const defaultValues: MemberValues =
    mode.kind === 'add'
      ? emptyMemberValues
      : mode.kind === 'edit'
        ? toMemberValues(mode.member)
        : { ...toMemberValues(mode.member), email: '' }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MemberValues>({ resolver: zodResolver(schema), defaultValues })

  const [costRate, priceRate, defaultLoadPct] = useWatch({
    control,
    name: ['costRate', 'priceRate', 'defaultLoadPct'],
  })
  const ratesValid = Number.isFinite(costRate) && Number.isFinite(priceRate)
  const margin = ratesValid ? getRateMargin(costRate, priceRate) : null
  const negative = margin !== null && margin.marginPerHour < 0
  const money = (value: number) => formatCurrency(value, project.currency, 2)
  const loadHours = Number.isFinite(defaultLoadPct)
    ? formatNumber((defaultLoadPct / 100) * project.standardHoursPerWeek, 1)
    : '—'

  const onSubmit = (values: MemberValues) => {
    const name = getFullName(values)
    const data = toMemberData(values)
    if (mode.kind === 'edit') {
      updateMember(mode.member.id, data)
      toast.success(`${name} saved`)
    } else {
      addMember({
        ...data,
        weeklyOverrides: mode.kind === 'duplicate' ? { ...mode.member.weeklyOverrides } : {},
      })
      toast.success(`${name} added to the forecast`)
    }
    onDone()
  }

  const text = (
    id: string,
    name: 'firstName' | 'lastName' | 'email',
    label: string,
    autoComplete: string,
  ) => (
    <FormField id={id} label={label} required error={errors[name]?.message}>
      <Input
        id={id}
        type={name === 'email' ? 'email' : 'text'}
        autoComplete={autoComplete}
        {...fieldAria(id, errors[name]?.message)}
        {...register(name)}
      />
    </FormField>
  )

  const number = (
    id: string,
    name: 'defaultLoadPct' | 'capacityPct' | 'costRate' | 'priceRate',
    label: string,
    options: { helper?: string; suffix: string; step: number; labelAction?: ReactNode },
  ) => (
    <FormField
      id={id}
      label={label}
      required
      helper={options.helper}
      error={errors[name]?.message}
      labelAction={options.labelAction}
    >
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={options.step}
          className="pr-14 text-right tabular-nums"
          {...fieldAria(id, errors[name]?.message, Boolean(options.helper))}
          {...register(name, { valueAsNumber: true })}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">
          {options.suffix}
        </span>
      </div>
    </FormField>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {text('member-first-name', 'firstName', 'First name', 'given-name')}
        {text('member-last-name', 'lastName', 'Last name', 'family-name')}
        {text('member-email', 'email', 'Email', 'email')}
        <FormField
          id="member-role"
          label="Role"
          required
          helper="Pick a suggestion or type your own."
          error={errors.role?.message}
        >
          <Input
            id="member-role"
            list={rolesListId}
            autoComplete="off"
            {...fieldAria('member-role', errors.role?.message, true)}
            {...register('role')}
          />
          <datalist id={rolesListId}>
            {ROLE_SUGGESTIONS.map((role) => (
              <option key={role} value={role} />
            ))}
          </datalist>
        </FormField>
        <FormField
          id="member-start"
          label="Start date"
          helper="Weeks before this date count as 0%. Leave empty if they start with the project."
          error={errors.startDate?.message}
        >
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                id="member-start"
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                onClear={() => field.onChange('')}
                clearLabel="Clear start date"
                placeholder="From project start"
                emptyMonth={projectStart ?? undefined}
                tooltip="Pick the first day this person works on the project"
                {...fieldAria('member-start', errors.startDate?.message, true)}
              />
            )}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
        {number('member-load', 'defaultLoadPct', 'Allocation', {
          helper: `100% = ${formatNumber(project.standardHoursPerWeek, 1)} h/week · now ${loadHours} h/week. 0–200%.`,
          suffix: '%',
          step: 5,
        })}
        {number('member-capacity', 'capacityPct', 'Developer capacity', {
          helper: '0–100%.',
          suffix: '%',
          step: 5,
          labelAction: (
            <IconButton
              icon={Info}
              size="icon-sm"
              label="About developer capacity"
              tooltip="Share of allocated hours counted as developer capacity (e.g. 80% if 20% goes to meetings/admin)"
            />
          ),
        })}
        {number('member-cost', 'costRate', 'Cost rate', { suffix: `${project.currency}/h`, step: 1 })}
        {number('member-price', 'priceRate', 'Price rate', { suffix: `${project.currency}/h`, step: 1 })}
        <CalculatedField
          label="Margin/h"
          value={margin ? money(margin.marginPerHour) : '—'}
          formula="Price rate − Cost rate"
          tone={negative ? 'danger' : 'default'}
        />
        <CalculatedField
          label="Margin %"
          value={margin ? formatPercent(margin.marginPct) : '—'}
          formula="Margin/h ÷ Price rate (0% when the price rate is 0)"
          tone={negative ? 'danger' : 'default'}
        />
      </div>

      <DialogFooter className="pt-2">
        <ActionButton
          type="button"
          variant="outline"
          icon={X}
          tooltip="Close without saving"
          onClick={onDone}
        >
          Cancel
        </ActionButton>
        {mode.kind === 'edit' ? (
          <ActionButton type="submit" icon={Save} tooltip="Save changes to this team member">
            Save
          </ActionButton>
        ) : (
          <ActionButton type="submit" icon={UserPlus} tooltip="Add this person to the forecast">
            Add team member
          </ActionButton>
        )}
      </DialogFooter>
    </form>
  )
}
