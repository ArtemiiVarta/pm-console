import { getTeamTotals, type MemberTotals } from '@/lib/forecast'
import {
  getProjectRange,
  getProjectWeeks,
  getWeekWorkingShare,
  WORKING_DAYS_PER_WEEK,
  type DateRange,
} from '@/lib/schedule'
import type { ForecastSnapshot, ISODate } from '@/store/types'

export type MarginTone = 'success' | 'warning' | 'danger'

export interface ForecastSummary {
  range: DateRange | null
  weeks: ISODate[]
  /** Mon–Fri days from project start to end; partial first and last weeks count only their own days. */
  workingDays: number
  activeMembers: number
  inactiveMembers: number
  totals: MemberTotals
}

/** Headline numbers for a forecast: date range, project weeks, member counts and team totals. */
export function getForecastSummary({ project, phases, members }: ForecastSnapshot): ForecastSummary {
  const range = getProjectRange(phases, project.durationMode)
  const weeks = getProjectWeeks(range)
  const activeMembers = members.filter((member) => member.active).length
  return {
    range,
    weeks,
    workingDays: weeks.reduce(
      (days, week) =>
        days + Math.round(getWeekWorkingShare(week, range?.start, range?.end) * WORKING_DAYS_PER_WEEK),
      0,
    ),
    activeMembers,
    inactiveMembers: members.length - activeMembers,
    totals: getTeamTotals(members, weeks, project.standardHoursPerWeek, range),
  }
}

/** success ≥ 25%, warning 10–25%, danger < 10%. `marginPct` is a fraction. */
export function getMarginTone(marginPct: number): MarginTone {
  if (marginPct >= 0.25) return 'success'
  if (marginPct >= 0.1) return 'warning'
  return 'danger'
}
