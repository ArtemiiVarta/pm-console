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
import { parseISODate, toISODate, WEEK_STARTS_ON } from '@/lib/dates'
import type { DurationMode, ISODate, Milestone, Phase } from '@/store/types'

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

export interface TimelineBar {
  phase: Phase
  endDate: ISODate
  /** Day index (0-based) from the first timeline Monday. */
  startDay: number
  /** Number of days covered, inclusive. */
  spanDays: number
}

export interface TimelineMarker {
  milestone: Milestone
  /** Day index (0-based) from the first timeline Monday. */
  day: number
}

export interface TimelineLayout {
  weeks: ISODate[]
  totalDays: number
  bars: TimelineBar[]
  /** Milestones by date (then name). */
  markers: TimelineMarker[]
  /** Day index of `today`, or null when outside the timeline. */
  todayDay: number | null
}

/**
 * Day-based layout for the Gantt view: whole Mon–Sun weeks with one bar per phase in table order
 * and one star per milestone. The weeks cover phases and milestones, so a milestone outside the
 * phases still shows (project dates themselves come from phases only).
 */
export function getTimelineLayout(
  phases: Phase[],
  durationMode: DurationMode,
  today: ISODate,
  milestones: Milestone[] = [],
): TimelineLayout {
  const phaseRange = getProjectRange(phases, durationMode)
  const dates = [
    ...(phaseRange ? [phaseRange.start, phaseRange.end] : []),
    ...milestones.map((milestone) => milestone.date),
  ].sort()
  const first = dates[0]
  const last = dates.at(-1)
  const weeks = first && last ? getProjectWeeks({ start: first, end: last }) : []
  const firstWeek = weeks[0]
  if (!firstWeek) return { weeks, totalDays: 0, bars: [], markers: [], todayDay: null }

  const origin = parseISODate(firstWeek)
  const totalDays = weeks.length * 7
  const dayIndex = (date: ISODate) => differenceInCalendarDays(parseISODate(date), origin)

  const bars = sortPhases(phases).map((phase) => {
    const endDate = getPhaseEndDate(phase, durationMode)
    const startDay = dayIndex(phase.startDate)
    return { phase, endDate, startDay, spanDays: dayIndex(endDate) - startDay + 1 }
  })
  const markers = [...milestones]
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
    .map((milestone) => ({ milestone, day: dayIndex(milestone.date) }))
  const todayIndex = dayIndex(today)
  return {
    weeks,
    totalDays,
    bars,
    markers,
    todayDay: todayIndex >= 0 && todayIndex < totalDays ? todayIndex : null,
  }
}
