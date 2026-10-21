import { getTeamTotals, type MemberTotals } from '@/lib/forecast'
import { getProjectRange, getProjectWeeks, type DateRange } from '@/lib/schedule'
import type { ForecastSnapshot, ISODate } from '@/store/types'

export type MarginTone = 'success' | 'warning' | 'danger'

export interface ForecastSummary {
  range: DateRange | null
  weeks: ISODate[]
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
    activeMembers,
    inactiveMembers: members.length - activeMembers,
    totals: getTeamTotals(members, weeks, project.standardHoursPerWeek),
  }
}

/** success ≥ 25%, warning 10–25%, danger < 10%. `marginPct` is a fraction. */
export function getMarginTone(marginPct: number): MarginTone {
  if (marginPct >= 0.25) return 'success'
  if (marginPct >= 0.1) return 'warning'
  return 'danger'
}
