import { useMemo } from 'react'
import { GanttChart, Star } from 'lucide-react'
import { SectionCard } from '@/components/SectionCard'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { todayISO } from '@/lib/dates'
import { formatDate, formatDuration, formatWeekLabel } from '@/lib/format'
import { getTimelineLayout } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

/** Minimum width of one week column, in rem. */
const WEEK_MIN_REM = 3.5
const LABEL_COLUMN = '10rem'

// Grid positions and phase colors are data-driven, so they are set with inline styles.
export function PhaseTimeline() {
  const phases = useAppStore((state) => state.phases)
  const durationMode = useAppStore((state) => state.project.durationMode)
  const milestones = useAppStore((state) => state.milestones)
  const layout = useMemo(
    () => getTimelineLayout(phases, durationMode, todayISO(), milestones),
    [phases, durationMode, milestones],
  )

  if (layout.bars.length === 0 && layout.markers.length === 0) return null

  // Header + one row per phase + one row per milestone.
  const rows = layout.bars.length + layout.markers.length + 1
  const firstMilestoneRow = layout.bars.length + 2
  const gridStyle = {
    gridTemplateColumns: `${LABEL_COLUMN} repeat(${layout.totalDays}, minmax(0, 1fr))`,
    minWidth: `calc(${LABEL_COLUMN} + ${layout.weeks.length * WEEK_MIN_REM}rem)`,
  }

  return (
    <SectionCard
      icon={GanttChart}
      title="Timeline"
      description="Phases and milestones (★) on a weekly scale. Week labels are Mondays; the blue line marks today."
    >
      <div className="overflow-x-auto rounded-lg border">
        <div className="relative grid text-xs" style={gridStyle} role="table" aria-label="Phase timeline">
          {/* Header row */}
          <div
            role="columnheader"
            className="sticky left-0 z-10 border-b bg-surface px-3 py-2 font-medium uppercase tracking-wide text-muted"
            style={{ gridRow: 1, gridColumn: 1 }}
          >
            Phase
          </div>
          {/* Every cell is placed explicitly so the today marker never shifts auto-placed cells. */}
          {layout.weeks.map((week, index) => (
            <div
              key={week}
              role="columnheader"
              className="border-b border-l px-1 py-2 text-center tabular-nums text-muted"
              style={{ gridRow: 1, gridColumn: `${2 + index * 7} / span 7` }}
            >
              {formatWeekLabel(week)}
            </div>
          ))}

          {/* Week dividers behind the bars */}
          {layout.weeks.map((week, index) => (
            <div
              key={`divider-${week}`}
              aria-hidden
              className="pointer-events-none border-l"
              style={{ gridColumn: `${2 + index * 7} / span 7`, gridRow: `2 / ${rows + 1}` }}
            />
          ))}

          {/* Phase rows */}
          {layout.bars.map(({ phase, endDate, startDay, spanDays }, index) => {
            const label = `${phase.name}: ${formatDate(phase.startDate)} – ${formatDate(endDate)}, ${formatDuration(phase.duration, phase.durationUnit)}`
            return (
              <div key={phase.id} role="row" className="contents">
                <div
                  role="rowheader"
                  className="sticky left-0 z-10 flex items-center truncate border-t bg-surface px-3 py-2 text-sm font-medium"
                  style={{ gridRow: index + 2, gridColumn: 1 }}
                >
                  {phase.name}
                </div>
                <div
                  role="cell"
                  className="flex items-center border-t py-2"
                  style={{ gridRow: index + 2, gridColumn: `${2 + startDay} / span ${spanDays}` }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        tabIndex={0}
                        aria-label={label}
                        className="h-6 w-full rounded-md shadow-sm outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-primary"
                        style={{ backgroundColor: phase.color }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{phase.name}</p>
                      <p className="tabular-nums">
                        {formatDate(phase.startDate)} – {formatDate(endDate)}
                      </p>
                      <p>{formatDuration(phase.duration, phase.durationUnit)}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )
          })}

          {/* Milestone rows: a star on the milestone's day */}
          {layout.markers.map(({ milestone, day }, index) => {
            const label = `Milestone ${milestone.name}: ${formatDate(milestone.date)}`
            return (
              <div key={milestone.id} role="row" className="contents">
                <div
                  role="rowheader"
                  className={cn(
                    'sticky left-0 z-10 flex items-center gap-1.5 truncate border-t bg-surface px-3 py-2 text-sm font-medium',
                    index === 0 && layout.bars.length > 0 && 'border-t-2',
                  )}
                  style={{ gridRow: firstMilestoneRow + index, gridColumn: 1 }}
                >
                  <Star
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: milestone.color, fill: milestone.color }}
                    aria-hidden
                  />
                  <span className="truncate">{milestone.name}</span>
                </div>
                <div
                  role="cell"
                  className={cn(
                    'flex items-center justify-center border-t py-2',
                    index === 0 && layout.bars.length > 0 && 'border-t-2',
                  )}
                  style={{ gridRow: firstMilestoneRow + index, gridColumn: `${2 + day} / span 1` }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        role="img"
                        aria-label={label}
                        className="relative z-[6] flex rounded-full outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Star
                          className="h-5 w-5 drop-shadow-sm"
                          style={{ color: milestone.color, fill: milestone.color }}
                          aria-hidden
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">★ {milestone.name}</p>
                      <p className="tabular-nums">{formatDate(milestone.date)}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )
          })}

          {/* Today marker */}
          {layout.todayDay !== null && (
            <div
              aria-label={`Today, ${formatDate(todayISO())}`}
              role="img"
              className="pointer-events-none z-[5] w-0.5 justify-self-center bg-primary"
              style={{ gridColumn: `${2 + layout.todayDay} / span 1`, gridRow: `2 / ${rows + 1}` }}
            />
          )}
        </div>
      </div>
    </SectionCard>
  )
}
