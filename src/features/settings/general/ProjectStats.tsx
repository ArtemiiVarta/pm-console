import { useMemo } from 'react'
import { CalendarCheck, CalendarClock, Clock, Percent, Timer, Users } from 'lucide-react'
import { StatTile } from '@/components/StatTile'
import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import { getForecastSummary, getMarginTone } from '@/lib/summary'
import { useAppStore } from '@/store/useAppStore'

const NONE = '—'

/** Read-only headline numbers from the store. */
export function ProjectStats() {
  const project = useAppStore((state) => state.project)
  const phases = useAppStore((state) => state.phases)
  const members = useAppStore((state) => state.members)
  const summary = useMemo(() => getForecastSummary({ project, phases, members }), [project, phases, members])
  const { range, weeks, activeMembers, inactiveMembers, totals } = summary
  const hasRevenue = totals.revenue > 0
  const marginTone = hasRevenue ? getMarginTone(totals.marginPct) : 'default'

  return (
    <section
      aria-label="Project summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <StatTile
        icon={CalendarClock}
        label="Project start"
        value={range ? formatDate(range.start) : NONE}
        hint={range ? 'First phase start' : 'No phases yet'}
      />
      <StatTile
        icon={CalendarCheck}
        label="Project end"
        value={range ? formatDate(range.end) : NONE}
        hint={range ? 'Last phase end' : 'No phases yet'}
      />
      <StatTile
        icon={Timer}
        label="Duration"
        value={weeks.length > 0 ? `${weeks.length} wk` : NONE}
        hint="Mon–Sun weeks covered"
      />
      <StatTile
        icon={Users}
        label="Team members"
        value={formatNumber(activeMembers)}
        hint={inactiveMembers > 0 ? `${inactiveMembers} inactive not counted` : 'Active members'}
      />
      <StatTile
        icon={Clock}
        label="Forecast hours"
        value={formatNumber(totals.hours)}
        hint={`At ${formatNumber(project.standardHoursPerWeek, 1)} h per 100% week`}
      />
      <StatTile
        icon={Percent}
        label="Forecast margin %"
        value={hasRevenue ? formatPercent(totals.marginPct) : NONE}
        hint={
          !hasRevenue
            ? 'No forecast revenue yet'
            : marginTone === 'success'
              ? 'On target (≥ 25%)'
              : marginTone === 'warning'
                ? 'Below target (10–25%)'
                : 'Low (< 10%)'
        }
        tone={marginTone}
      />
    </section>
  )
}
