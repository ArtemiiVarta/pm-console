import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { CalendarDays, Clock, Percent, RotateCcw, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { EmptyState } from '@/components/EmptyState'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
import { ApplyRangeDialog } from '@/features/settings/team/assignment/ApplyRangeDialog'
import { AssignmentGrid } from '@/features/settings/team/assignment/AssignmentGrid'
import { usePendingAllocation } from '@/features/settings/team/assignment/usePendingAllocation'
import { useForecastSource } from '@/features/settings/team/forecastSource'
import {
  countPendingChanges,
  getPreviewMember,
  getResetAllChanges,
  toStoreOperations,
  type DisplayUnit,
  type PendingChange,
} from '@/lib/assignment'
import { isBeforeStart } from '@/lib/forecast'
import { getFullName } from '@/lib/roster'
import { getProjectRange, getProjectWeeks } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { useUiPrefs } from '@/store/useUiPrefs'
import type { ISODate, TeamMember } from '@/store/types'

export function AssignmentSection() {
  const { project, phases, members: allMembers, readOnly } = useForecastSource()
  const durationMode = project.durationMode
  const setWeeklyOverrides = useAppStore((state) => state.setWeeklyOverrides)
  const clearWeeklyOverrides = useAppStore((state) => state.clearWeeklyOverrides)
  const showFinancials = useUiPrefs((state) => state.showFinancials)
  const pending = usePendingAllocation((state) => state.pending)
  const addPending = usePendingAllocation((state) => state.add)
  const discardPending = usePendingAllocation((state) => state.discard)

  const [unit, setUnit] = useState<DisplayUnit>('pct')
  const [rangeMember, setRangeMember] = useState<TeamMember | null>(null)

  const weeks = useMemo(() => getProjectWeeks(getProjectRange(phases, durationMode)), [phases, durationMode])
  const saved = useMemo(() => allMembers.filter((member) => member.active), [allMembers])
  // A baseline view never shows working-forecast edits.
  const visiblePending = useMemo(() => (readOnly ? {} : pending), [readOnly, pending])
  /** Members as they will be after saving: the grid and its totals preview unsaved edits. */
  const members = useMemo(
    () => saved.map((member) => getPreviewMember(member, visiblePending[member.id])),
    [saved, visiblePending],
  )
  const changeCount = countPendingChanges(visiblePending, saved)
  const hasChanges = changeCount > 0

  const onChange = useCallback(
    (changes: PendingChange[]) => {
      if (changes.length > 0) addPending(changes, saved)
    },
    [addPending, saved],
  )

  const save = () => {
    if (!hasChanges) return
    const { updates, clears } = toStoreOperations(pending, saved)
    if (clears.length > 0) clearWeeklyOverrides(clears)
    if (updates.length > 0) setWeeklyOverrides(updates)
    discardPending()
    toast.success(`${changeCount} ${changeCount === 1 ? 'change' : 'changes'} saved`)
  }

  const discard = () => {
    if (!hasChanges) return
    discardPending()
    toast.success('Unsaved changes discarded')
  }

  // Warn before closing or reloading the tab with unsaved edits.
  useEffect(() => {
    if (!hasChanges) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasChanges])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      save()
    }
  }

  const applyRange = (member: TeamMember, fromWeek: ISODate, toWeek: ISODate, pct: number) => {
    const [first, last] = fromWeek <= toWeek ? [fromWeek, toWeek] : [toWeek, fromWeek]
    onChange(
      weeks
        .filter((week) => week >= first && week <= last && !isBeforeStart(member, week))
        .map((weekStart) => ({ memberId: member.id, weekStart, pct })),
    )
  }

  const resetAll = (member: TeamMember) => {
    const original = saved.find((m) => m.id === member.id) ?? member
    onChange(getResetAllChanges(original, pending))
    toast.info(`${getFullName(member)}: all weeks set back to the allocation. Save changes to apply.`)
  }

  const unitToggle = (
    <div role="group" aria-label="Show cells as" className="inline-flex rounded-lg bg-subtle p-1">
      {(
        [
          {
            value: 'pct',
            label: 'Load %',
            icon: Percent,
            tooltip: 'Show and edit each week as % of standard hours',
          },
          { value: 'hours', label: 'Hours', icon: Clock, tooltip: 'Show and edit each week in hours' },
        ] as const
      ).map((option) => (
        <ActionButton
          key={option.value}
          size="sm"
          variant="ghost"
          icon={option.icon}
          tooltip={option.tooltip}
          aria-pressed={unit === option.value}
          onClick={() => setUnit(option.value)}
          className={cn(
            'h-7 rounded-md px-3',
            unit === option.value ? 'bg-surface text-foreground shadow-sm hover:bg-surface' : 'text-muted',
          )}
        >
          {option.label}
        </ActionButton>
      ))}
    </div>
  )

  // Always rendered while editing is possible, so the layout does not jump when changes appear.
  const saveBar = !readOnly && (
    <div className="flex flex-wrap items-center gap-2">
      {hasChanges ? (
        <Badge
          variant="outline"
          className="border-warning/40 bg-warning/10 py-1 text-warning"
          aria-live="polite"
        >
          {changeCount} unsaved {changeCount === 1 ? 'change' : 'changes'}
        </Badge>
      ) : (
        <span className="text-xs text-muted" aria-live="polite">
          All changes saved
        </span>
      )}
      <ActionButton
        size="sm"
        variant="outline"
        icon={RotateCcw}
        tooltip={hasChanges ? 'Discard unsaved changes in this grid' : 'Nothing to discard'}
        aria-disabled={!hasChanges}
        className={cn(!hasChanges && 'cursor-not-allowed opacity-50')}
        onClick={discard}
      >
        Discard
      </ActionButton>
      <ActionButton
        size="sm"
        icon={Save}
        tooltip={hasChanges ? 'Save the changed weeks' : 'Nothing to save'}
        shortcut="Ctrl+S"
        aria-disabled={!hasChanges}
        className={cn(!hasChanges && 'cursor-not-allowed opacity-50')}
        onClick={save}
      >
        Save changes
      </ActionButton>
    </div>
  )

  const canShowGrid = weeks.length > 0 && members.length > 0

  return (
    <SectionCard
      icon={CalendarDays}
      title="Planned allocation"
      description="Load per person per week. Muted values use the allocation; a dot marks a weekly override."
      actions={canShowGrid ? unitToggle : undefined}
    >
      {weeks.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No project weeks yet"
          hint="Add phases in Project Schedule to create the weekly columns."
        />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No active team members"
          hint="Add or activate team members above to plan their weeks."
        />
      ) : (
        <div onKeyDown={onKeyDown} className="flex flex-col gap-3">
          {saveBar}
          {hasChanges && (
            <p className="text-xs text-muted">
              The grid and its totals show your unsaved changes. Totals above and baselines use saved values
              only.
            </p>
          )}
          <AssignmentGrid
            members={members}
            weeks={weeks}
            unit={unit}
            readOnly={readOnly}
            pending={visiblePending}
            showFinancials={showFinancials}
            onChange={onChange}
            onApplyRange={setRangeMember}
            onResetAll={resetAll}
          />
        </div>
      )}

      {!readOnly && (
        <ApplyRangeDialog
          member={rangeMember}
          weeks={weeks}
          onApply={applyRange}
          onClose={() => setRangeMember(null)}
        />
      )}
    </SectionCard>
  )
}
