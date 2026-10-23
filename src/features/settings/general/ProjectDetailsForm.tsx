import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { FileText, Info, RotateCcw, Save } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { FormField } from '@/components/FormField'
import { IconButton } from '@/components/IconButton'
import { SectionCard } from '@/components/SectionCard'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  projectDetailsSchema,
  toProjectDetailsValues,
  type ProjectDetailsValues,
} from '@/features/settings/general/projectSchema'
import { fieldAria } from '@/lib/fieldAria'
import { CURRENCIES } from '@/lib/format'
import { PROJECT_STATUSES, STATUS_CLASSES } from '@/lib/projectStatus'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

const DURATION_MODE_HELP =
  'Working days skip Saturdays and Sundays, so a 5-day phase starting Monday ends Friday. Calendar days count every day.'

export function ProjectDetailsForm() {
  const project = useAppStore((state) => state.project)
  const updateProject = useAppStore((state) => state.updateProject)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProjectDetailsValues>({
    resolver: zodResolver(projectDetailsSchema),
    defaultValues: toProjectDetailsValues(project),
  })

  // Pick up changes made elsewhere (e.g. a data import) unless the user is mid-edit.
  useEffect(() => {
    if (!isDirty) reset(toProjectDetailsValues(project))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  const onSubmit = (values: ProjectDetailsValues) => {
    updateProject(values)
    reset(values)
    toast.success('Project details saved')
  }

  const hours = useWatch({ control, name: 'standardHoursPerWeek' })

  return (
    <SectionCard
      icon={FileText}
      title="Project details"
      description="Name, client and how the schedule and forecast are calculated."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="project-name" label="Project name" required error={errors.name?.message}>
            <Input
              id="project-name"
              autoComplete="off"
              placeholder="e.g. S/4HANA rollout – Wave 2"
              {...fieldAria('project-name', errors.name?.message)}
              {...register('name')}
            />
          </FormField>

          <FormField id="project-client" label="Client" error={errors.client?.message}>
            <Input
              id="project-client"
              autoComplete="organization"
              placeholder="e.g. Northwind Foods"
              {...fieldAria('project-client', errors.client?.message)}
              {...register('client')}
            />
          </FormField>

          <FormField
            id="project-currency"
            label="Currency"
            helper="Used for all rates, costs and revenue."
            error={errors.currency?.message}
          >
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="project-currency"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    {...fieldAria('project-currency', undefined, true)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            id="project-hours"
            label="Standard hours per week"
            helper={`100% load = ${Number.isFinite(hours) ? hours : '—'} h/week. Between 1 and 80.`}
            error={errors.standardHoursPerWeek?.message}
          >
            <Input
              id="project-hours"
              type="number"
              inputMode="decimal"
              min={1}
              max={80}
              step={0.5}
              className="text-right tabular-nums"
              {...fieldAria('project-hours', errors.standardHoursPerWeek?.message, true)}
              {...register('standardHoursPerWeek', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            id="project-duration-mode"
            label="Count phase days as"
            helper="Applies to phases measured in days. Week-based phases are unaffected."
            labelAction={
              <IconButton
                icon={Info}
                size="icon-sm"
                label="About counting phase days"
                tooltip={DURATION_MODE_HELP}
              />
            }
          >
            <Controller
              control={control}
              name="durationMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="project-duration-mode"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    {...fieldAria('project-duration-mode', undefined, true)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="working">Working days (Mon–Fri)</SelectItem>
                    <SelectItem value="calendar">Calendar days</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            id="project-status"
            label="Project status"
            helper="Shown as the tile color on the Projects page."
          >
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="project-status"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    {...fieldAria('project-status', undefined, true)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={cn('h-2.5 w-2.5 rounded-full', STATUS_CLASSES[option.value].dot)}
                          />
                          {option.label}
                          <span className="text-xs text-muted">· {option.hint}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            id="project-rationale"
            label="Rationale"
            helper="Optional. Why the project has this status."
            error={errors.statusRationale?.message}
          >
            <textarea
              id="project-rationale"
              rows={3}
              placeholder="e.g. Data migration is two weeks late; recovery plan agreed with the client."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...fieldAria('project-rationale', errors.statusRationale?.message, true)}
              {...register('statusRationale')}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          {isDirty && <span className="mr-auto text-xs text-muted">You have unsaved changes.</span>}
          <ActionButton
            type="button"
            variant="outline"
            icon={RotateCcw}
            tooltip="Discard unsaved changes"
            onClick={() => reset(toProjectDetailsValues(project))}
          >
            Reset
          </ActionButton>
          <ActionButton type="submit" icon={Save} tooltip="Save project details">
            Save
          </ActionButton>
        </div>
      </form>
    </SectionCard>
  )
}
