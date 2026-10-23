import {
  addBusinessDays,
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  isWeekend,
  max,
  min,
} from 'date-fns'
import { addDaysISO, parseISODate, toISODate, WEEK_STARTS_ON } from '@/lib/dates'
import type { DurationMode, ISODate, Phase } from '@/store/types'

export interface DateRange {
  start: ISODate
  end: ISODate
}

/**
 * Last day of a phase or task (inclusive): the pinned `endDate` when set, otherwise from the
 * duration. Durations are whole units; anything below 1 counts as 1.
 * - weeks: start + duration × 7 calendar days − 1
 * - days, calendar mode: start + duration − 1
 * - days, working mode: the `duration`-th weekday, counting the start as day 1 when it is a
 *   weekday (a weekend start begins counting on the following Monday)
 */
export function getPhaseEndDate(
  phase: Pick<Phase, 'startDate' | 'duration' | 'durationUnit' | 'endDate'>,
  durationMode: DurationMode,
): ISODate {
  // A pinned end wins; it can never fall before the start.
  if (phase.endDate) return phase.endDate < phase.startDate ? phase.startDate : phase.endDate
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

/** Standard hours cover a Mon–Fri working week, whatever the duration mode. */
export const WORKING_DAYS_PER_WEEK = 5

/**
 * Share (0–1) of the Mon–Fri days of the week starting `weekStart` (a Monday) that fall within
 * `from`–`to`, both inclusive and optional. A project starting on a Thursday gets 2/5 of its
 * first week.
 */
export function getWeekWorkingShare(weekStart: ISODate, from?: ISODate, to?: ISODate): number {
  let days = 0
  for (let offset = 0; offset < WORKING_DAYS_PER_WEEK; offset += 1) {
    const day = addDaysISO(weekStart, offset)
    if ((!from || day >= from) && (!to || day <= to)) days += 1
  }
  return days / WORKING_DAYS_PER_WEEK
}

/** Phases in table order. */
export function sortPhases(phases: Phase[]): Phase[] {
  return [...phases].sort((a, b) => a.order - b.order)
}

/** The calendar day after `date`. */
export function getDayAfter(date: ISODate): ISODate {
  return toISODate(addDays(parseISODate(date), 1))
}

/** Day after the last phase (in table order) ends, or null without phases. */
export function getNextPhaseStart(phases: Phase[], durationMode: DurationMode): ISODate | null {
  const last = sortPhases(phases).at(-1)
  return last ? getDayAfter(getPhaseEndDate(last, durationMode)) : null
}

export interface PhaseIssues {
  /** Names of other phases whose dates overlap this one. */
  overlapsWith: string[]
  /**
   * Days with no phase between the previous phase (in table order) and this one. Counts working
   * days in working mode, so a weekend between Friday and Monday is not a gap.
   */
  gapDaysBefore: number
}

/** Overlaps (against every other phase) and gaps (against the previous phase in table order). */
export function getPhaseIssues(phases: Phase[], durationMode: DurationMode): Record<string, PhaseIssues> {
  const ordered = sortPhases(phases).map((phase) => ({
    phase,
    start: parseISODate(phase.startDate),
    end: parseISODate(getPhaseEndDate(phase, durationMode)),
  }))

  const issues: Record<string, PhaseIssues> = {}
  ordered.forEach((current, index) => {
    const overlapsWith = ordered
      .filter((other) => other !== current && other.start <= current.end && current.start <= other.end)
      .map((other) => other.phase.name)

    let gapDaysBefore = 0
    const previous = ordered[index - 1]
    if (previous && differenceInCalendarDays(current.start, previous.end) > 1) {
      const between = eachDayOfInterval({ start: addDays(previous.end, 1), end: addDays(current.start, -1) })
      gapDaysBefore =
        durationMode === 'working' ? between.filter((day) => !isWeekend(day)).length : between.length
    }

    issues[current.phase.id] = { overlapsWith, gapDaysBefore }
  })
  return issues
}
