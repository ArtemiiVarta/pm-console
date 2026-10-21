import { getMemberTotals, getRateMargin, type MemberTotals } from '@/lib/forecast'
import type { ISODate, TeamMember } from '@/store/types'

export interface RosterRow {
  member: TeamMember
  fullName: string
  /** Hours in a week at the default load. */
  weeklyHours: number
  marginPerHour: number
  /** Fraction; 0 when the price rate is 0. */
  marginPct: number
  totals: MemberTotals
}

export type RosterSortKey =
  | 'name'
  | 'role'
  | 'defaultLoadPct'
  | 'weeklyHours'
  | 'capacityPct'
  | 'costRate'
  | 'priceRate'
  | 'marginPerHour'
  | 'marginPct'
  | 'totalHours'
  | 'totalMargin'

export type SortDirection = 'asc' | 'desc'

export function getFullName(member: Pick<TeamMember, 'firstName' | 'lastName'>): string {
  return `${member.firstName} ${member.lastName}`.trim()
}

/** Up to two uppercase initials, e.g. "Ada Lovelace" → "AL". */
export function getInitials(member: Pick<TeamMember, 'firstName' | 'lastName'>): string {
  return [member.firstName, member.lastName]
    .map((part) => part.trim().charAt(0))
    .join('')
    .toUpperCase()
}

/** Per-member figures for the roster table over the project weeks. */
export function getRosterRows(
  members: TeamMember[],
  weeks: ISODate[],
  standardHoursPerWeek: number,
): RosterRow[] {
  return members.map((member) => {
    const { marginPerHour, marginPct } = getRateMargin(member.costRate, member.priceRate)
    return {
      member,
      fullName: getFullName(member),
      weeklyHours: (member.defaultLoadPct / 100) * standardHoursPerWeek,
      marginPerHour,
      marginPct,
      totals: getMemberTotals(member, weeks, standardHoursPerWeek),
    }
  })
}

const sortValue: Record<RosterSortKey, (row: RosterRow) => string | number> = {
  name: (row) => row.fullName.toLowerCase(),
  role: (row) => row.member.role.toLowerCase(),
  defaultLoadPct: (row) => row.member.defaultLoadPct,
  weeklyHours: (row) => row.weeklyHours,
  capacityPct: (row) => row.member.capacityPct,
  costRate: (row) => row.member.costRate,
  priceRate: (row) => row.member.priceRate,
  marginPerHour: (row) => row.marginPerHour,
  marginPct: (row) => row.marginPct,
  totalHours: (row) => row.totals.hours,
  totalMargin: (row) => row.totals.margin,
}

/** Stable sort by a column; ties keep their original order. */
export function sortRosterRows(rows: RosterRow[], key: RosterSortKey, direction: SortDirection): RosterRow[] {
  const factor = direction === 'asc' ? 1 : -1
  const value = sortValue[key]
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const x = value(a.row)
      const y = value(b.row)
      const compared =
        typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y)
      return compared * factor || a.index - b.index
    })
    .map(({ row }) => row)
}

/** Distinct roles, sorted, ignoring case duplicates and blanks. */
export function getRoles(members: TeamMember[]): string[] {
  const byKey = new Map<string, string>()
  for (const { role } of members) {
    const trimmed = role.trim()
    if (trimmed && !byKey.has(trimmed.toLowerCase())) byKey.set(trimmed.toLowerCase(), trimmed)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/** True when another member (not `exceptId`) already uses this email, ignoring case and spaces. */
export function isEmailTaken(members: TeamMember[], email: string, exceptId?: string): boolean {
  const normalized = email.trim().toLowerCase()
  return members.some((member) => member.id !== exceptId && member.email.trim().toLowerCase() === normalized)
}
