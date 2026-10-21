import { addBusinessDays, addDays, eachWeekOfInterval, isWeekend, max, min } from 'date-fns'
import { parseISODate, toISODate, WEEK_STARTS_ON } from '@/lib/dates'
import type { DurationMode, ISODate, Phase } from '@/store/types'

export interface DateRange {
  start: ISODate
  end: ISODate
}

/**
 * Last day of a phase (inclusive). Durations are whole units; anything below 1 counts as 1.
 * - weeks: start + duration × 7 calendar days − 1
 * - days, calendar mode: start + duration − 1
 * - days, working mode: the `duration`-th weekday, counting the start as day 1 when it is a
 *   weekday (a weekend start begins counting on the following Monday)
 */
export function getPhaseEndDate(
  phase: Pick<Phase, 'startDate' | 'duration' | 'durationUnit'>,
  durationMode: DurationMode,
): ISODate {
  const start = parseISODate(phase.startDate)
  const duration = Math.max(1, Math.ceil(phase.duration))

  if (phase.durationUnit === 'weeks') {
    return toISODate(addDays(start, duration * 7 - 1))
  }
  if (durationMode === 'calendar') {
    return toISODate(addDays(start, duration - 1))
  }
  const remaining = isWeekend(start) ? duration : duration - 1
  return toISODate(addBusinessDays(start, remaining))
}

/** Earliest phase start to latest phase end, or null when there are no phases. */
export function getProjectRange(phases: Phase[], durationMode: DurationMode): DateRange | null {
  if (phases.length === 0) return null
  const starts = phases.map((phase) => parseISODate(phase.startDate))
  const ends = phases.map((phase) => parseISODate(getPhaseEndDate(phase, durationMode)))
  return { start: toISODate(min(starts)), end: toISODate(max(ends)) }
}

/** Monday of every week the range touches, in order. Empty for a null range. */
export function getProjectWeeks(range: DateRange | null): ISODate[] {
  if (!range) return []
  const start = parseISODate(range.start)
  const end = parseISODate(range.end)
  if (end < start) return []
  return eachWeekOfInterval({ start, end }, { weekStartsOn: WEEK_STARTS_ON }).map(toISODate)
}
