import type { ForecastTotals, ISODate, TeamMember } from '@/store/types'

export interface MemberTotals extends ForecastTotals {
  capacityHours: number
}

export interface WeeklyTeamTotals {
  weekStart: ISODate
  hours: number
  capacityHours: number
  cost: number
  revenue: number
}

export interface RateMargin {
  marginPerHour: number
  /** Fraction; 0 when the price rate is 0. */
  marginPct: number
}

type RateFields = Pick<TeamMember, 'costRate' | 'priceRate'>
type LoadFields = Pick<TeamMember, 'defaultLoadPct' | 'weeklyOverrides'>
type ForecastMember = LoadFields & RateFields & Pick<TeamMember, 'capacityPct'>

/** margin / revenue, or 0 when revenue is 0. */
export function getMarginPct(margin: number, revenue: number): number {
  return revenue === 0 ? 0 : margin / revenue
}

/** Weekly override when set, otherwise the member's default load. */
export function getMemberLoadPct(member: LoadFields, weekStart: ISODate): number {
  return member.weeklyOverrides[weekStart] ?? member.defaultLoadPct
}

/** loadPct / 100 × standard hours per week. */
export function getMemberHours(member: LoadFields, weekStart: ISODate, standardHoursPerWeek: number): number {
  return (getMemberLoadPct(member, weekStart) / 100) * standardHoursPerWeek
}

/** Assigned hours × capacityPct / 100. */
export function getMemberCapacityHours(
  member: LoadFields & Pick<TeamMember, 'capacityPct'>,
  weekStart: ISODate,
  standardHoursPerWeek: number,
): number {
  return getMemberHours(member, weekStart, standardHoursPerWeek) * (member.capacityPct / 100)
}

/** Hours, capacity, cost, revenue and margin for one member over the given weeks. */
export function getMemberTotals(
  member: ForecastMember,
  weeks: ISODate[],
  standardHoursPerWeek: number,
): MemberTotals {
  let hours = 0
  for (const week of weeks) hours += getMemberHours(member, week, standardHoursPerWeek)
  const capacityHours = hours * (member.capacityPct / 100)
  const cost = hours * member.costRate
  const revenue = hours * member.priceRate
  const margin = revenue - cost
  return { hours, capacityHours, cost, revenue, margin, marginPct: getMarginPct(margin, revenue) }
}

/** Margin per hour and margin % from a member's rates. */
export function getRateMargin(costRate: number, priceRate: number): RateMargin {
  const marginPerHour = priceRate - costRate
  return { marginPerHour, marginPct: getMarginPct(marginPerHour, priceRate) }
}

/** Sum of member totals over active members only. */
export function getTeamTotals(
  members: (ForecastMember & Pick<TeamMember, 'active'>)[],
  weeks: ISODate[],
  standardHoursPerWeek: number,
): MemberTotals {
  const totals = { hours: 0, capacityHours: 0, cost: 0, revenue: 0 }
  for (const member of members) {
    if (!member.active) continue
    const memberTotals = getMemberTotals(member, weeks, standardHoursPerWeek)
    totals.hours += memberTotals.hours
    totals.capacityHours += memberTotals.capacityHours
    totals.cost += memberTotals.cost
    totals.revenue += memberTotals.revenue
  }
  const margin = totals.revenue - totals.cost
  return { ...totals, margin, marginPct: getMarginPct(margin, totals.revenue) }
}

/** Per-week team hours, capacity, cost and revenue over active members only. */
export function getWeeklyTeamTotals(
  members: (ForecastMember & Pick<TeamMember, 'active'>)[],
  weeks: ISODate[],
  standardHoursPerWeek: number,
): WeeklyTeamTotals[] {
  const active = members.filter((member) => member.active)
  return weeks.map((weekStart) => {
    const week = { weekStart, hours: 0, capacityHours: 0, cost: 0, revenue: 0 }
    for (const member of active) {
      const hours = getMemberHours(member, weekStart, standardHoursPerWeek)
      week.hours += hours
      week.capacityHours += hours * (member.capacityPct / 100)
      week.cost += hours * member.costRate
      week.revenue += hours * member.priceRate
    }
    return week
  })
}
