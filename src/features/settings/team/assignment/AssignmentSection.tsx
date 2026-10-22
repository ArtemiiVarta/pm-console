import { useMemo, useState } from 'react'
import { CalendarDays, Clock, Percent, RotateCcw, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { SectionCard } from '@/components/SectionCard'
import { ApplyRangeDialog } from '@/features/settings/team/assignment/ApplyRangeDialog'
import { AssignmentGrid } from '@/features/settings/team/assignment/AssignmentGrid'
import type { DisplayUnit } from '@/lib/assignment'
import { getFullName } from '@/lib/roster'
import { getProjectRange, getProjectWeeks } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { useForecastSource } from '@/features/settings/team/forecastSource'
import { useAppStore } from '@/store/useAppStore'
import type { TeamMember } from '@/store/types'

export function AssignmentSection() {
  const { project, phases, members: allMembers, readOnly } = useForecastSource()
  const durationMode = project.durationMode
  const clearAllWeeklyOverrides = useAppStore((state) => state.clearAllWeeklyOverrides)

  const [unit, setUnit] = useState<DisplayUnit>('pct')
  const [rangeMember, setRangeMember] = useState<TeamMember | null>(null)
  const [resetMember, setResetMember] = useState<TeamMember | null>(null)

  const weeks = useMemo(() => getProjectWeeks(getProjectRange(phases, durationMode)), [phases, durationMode])
  const members = useMemo(() => allMembers.filter((member) => member.active), [allMembers])

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

  return (
    <SectionCard
      icon={CalendarDays}
      title="Weekly assignment"
      description="Load per person per week. Muted values use the default load; a dot marks a weekly override."
      actions={weeks.length > 0 && members.length > 0 ? unitToggle : undefined}
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
          hint="Add or activate team members above to assign their weeks."
        />
      ) : (
        <AssignmentGrid
          members={members}
          weeks={weeks}
          unit={unit}
          readOnly={readOnly}
          onApplyRange={setRangeMember}
          onResetAll={setResetMember}
        />
      )}

      {!readOnly && (
        <ApplyRangeDialog member={rangeMember} weeks={weeks} onClose={() => setRangeMember(null)} />
      )}
      <ConfirmDialog
        open={resetMember !== null}
        onOpenChange={(open) => !open && setResetMember(null)}
        title={resetMember ? `Reset all weeks for ${getFullName(resetMember)}?` : 'Reset all weeks?'}
        description="Every weekly override is removed and all weeks go back to the default load. This cannot be undone."
        confirmLabel="Reset all weeks"
        confirmIcon={RotateCcw}
        onConfirm={() => {
          if (!resetMember) return
          clearAllWeeklyOverrides(resetMember.id)
          toast.success(`${getFullName(resetMember)}: all weeks reset to default`)
        }}
      />
    </SectionCard>
  )
}
