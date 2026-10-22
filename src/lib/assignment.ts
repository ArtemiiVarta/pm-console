import { addDays } from 'date-fns'
import { parseISODate } from '@/lib/dates'
import { getMemberLoadPct } from '@/lib/forecast'
import { getPhaseEndDate, sortPhases } from '@/lib/schedule'
import type { DurationMode, ISODate, Phase, TeamMember } from '@/store/types'
import type { WeeklyCell, WeeklyOverrideUpdate } from '@/store/useAppStore'

export const MAX_LOAD_PCT = 200

export interface PhaseBand {
  phase: Phase
  /** First and last week index (inclusive) the phase overlaps. */
  startIndex: number
  endIndex: number
}

/**
 * Phase header bands over the week columns. A week belongs to every phase it overlaps, so
 * overlapping phases are stacked into separate lanes (rows) that never collide.
 */
export function getPhaseLanes(weeks: ISODate[], phases: Phase[], durationMode: DurationMode): PhaseBand[][] {
  const weekRanges = weeks.map((week) => {
    const start = parseISODate(week)
    return { start, end: addDays(start, 6) }
  })

  const bands: PhaseBand[] = []
  for (const phase of sortPhases(phases)) {
    const start = parseISODate(phase.startDate)
    const end = parseISODate(getPhaseEndDate(phase, durationMode))
    const indexes = weekRanges.flatMap((week, index) =>
      week.start <= end && week.end >= start ? [index] : [],
    )
    const first = indexes[0]
    const last = indexes.at(-1)
    if (first !== undefined && last !== undefined) bands.push({ phase, startIndex: first, endIndex: last })
  }

  const lanes: PhaseBand[][] = []
  for (const band of [...bands].sort((a, b) => a.startIndex - b.startIndex)) {
    const lane = lanes.find((existing) => (existing.at(-1)?.endIndex ?? -1) < band.startIndex)
    if (lane) lane.push(band)
    else lanes.push([band])
  }
  return lanes
}

export type DisplayUnit = 'pct' | 'hours'

/** Load % from hours, rounded to 2 decimals; 0 when standard hours are 0. */
export function hoursToPct(hours: number, standardHoursPerWeek: number): number {
  if (standardHoursPerWeek <= 0) return 0
  return Math.round((hours / standardHoursPerWeek) * 100 * 100) / 100
}

export type LoadInput =
  { kind: 'clear' } | { kind: 'set'; pct: number } | { kind: 'invalid'; message: string }

/**
 * Parses what was typed into a grid cell. Empty input clears the override (back to default).
 * Accepts "50", "50%", "37.5", "20h" (hours, in any mode) and a decimal comma.
 * In hours mode a bare number is hours.
 */
export function parseLoadInput(raw: string, unit: DisplayUnit, standardHoursPerWeek: number): LoadInput {
  const text = raw.trim().toLowerCase().replace(',', '.')
  if (text === '') return { kind: 'clear' }
  const match = /^(\d+(?:\.\d+)?)\s*(%|h)?$/.exec(text)
  const number = match?.[1]
  if (!match || number === undefined) {
    return {
      kind: 'invalid',
      message: unit === 'hours' ? 'Enter hours, e.g. 20' : 'Enter a percentage, e.g. 80',
    }
  }
  const value = Number(number)
  const asHours = match[2] === 'h' || (unit === 'hours' && match[2] !== '%')
  const pct = asHours ? hoursToPct(value, standardHoursPerWeek) : value
  if (pct > MAX_LOAD_PCT) {
    return { kind: 'invalid', message: `Load can be at most ${MAX_LOAD_PCT}%` }
  }
  return { kind: 'set', pct }
}

export interface CellPosition {
  row: number
  col: number
}

export interface CellRange {
  top: number
  left: number
  bottom: number
  right: number
}

export function getRange(a: CellPosition, b: CellPosition): CellRange {
  return {
    top: Math.min(a.row, b.row),
    bottom: Math.max(a.row, b.row),
    left: Math.min(a.col, b.col),
    right: Math.max(a.col, b.col),
  }
}

export function getRangeSize(range: CellRange): number {
  return (range.bottom - range.top + 1) * (range.right - range.left + 1)
}

/** Every (member, week) cell inside the range. */
export function getRangeCells(range: CellRange, members: TeamMember[], weeks: ISODate[]): WeeklyCell[] {
  const cells: WeeklyCell[] = []
  for (let row = range.top; row <= range.bottom; row += 1) {
    const member = members[row]
    if (!member) continue
    for (let col = range.left; col <= range.right; col += 1) {
      const weekStart = weeks[col]
      if (weekStart) cells.push({ memberId: member.id, weekStart })
    }
  }
  return cells
}

/** Per row, copies the load of the first selected week to the other selected weeks. */
export function getFillRightUpdates(
  range: CellRange,
  members: TeamMember[],
  weeks: ISODate[],
): WeeklyOverrideUpdate[] {
  const firstWeek = weeks[range.left]
  if (!firstWeek) return []
  const updates: WeeklyOverrideUpdate[] = []
  for (let row = range.top; row <= range.bottom; row += 1) {
    const member = members[row]
    if (!member) continue
    const pct = getMemberLoadPct(member, firstWeek)
    for (let col = range.left + 1; col <= range.right; col += 1) {
      const weekStart = weeks[col]
      if (weekStart) updates.push({ memberId: member.id, weekStart, pct })
    }
  }
  return updates
}

/** Unsaved grid edits per member and week: a load %, or null for "back to the default load". */
export type PendingChanges = Record<string, Record<ISODate, number | null>>

export interface PendingChange {
  memberId: string
  weekStart: ISODate
  /** null resets the week to the member's default load. */
  pct: number | null
}

/**
 * Adds changes to the pending set. A change that matches what is already saved is dropped,
 * so editing a cell back to its saved value leaves nothing pending.
 */
export function addPendingChanges(
  pending: PendingChanges,
  changes: PendingChange[],
  members: TeamMember[],
): PendingChanges {
  const next: PendingChanges = { ...pending }
  for (const { memberId, weekStart, pct } of changes) {
    const member = members.find((m) => m.id === memberId)
    if (!member) continue
    const saved = member.weeklyOverrides[weekStart]
    const weeks = { ...next[memberId] }
    const matchesSaved = pct === null ? saved === undefined : saved === pct
    if (matchesSaved) delete weeks[weekStart]
    else weeks[weekStart] = pct === null ? null : Math.min(MAX_LOAD_PCT, Math.max(0, pct))
    if (Object.keys(weeks).length > 0) next[memberId] = weeks
    else delete next[memberId]
  }
  return next
}

/** Pending changes that reset every saved override of a member (and drop its other pending edits). */
export function getResetAllChanges(member: TeamMember, pending: PendingChanges): PendingChange[] {
  const weeks = new Set([...Object.keys(member.weeklyOverrides), ...Object.keys(pending[member.id] ?? {})])
  return [...weeks].map((weekStart) => ({ memberId: member.id, weekStart, pct: null }))
}

/** The member as it would be after saving its pending changes (same object when it has none). */
export function getPreviewMember(
  member: TeamMember,
  changes: Record<ISODate, number | null> | undefined,
): TeamMember {
  if (!changes) return member
  const weeklyOverrides = { ...member.weeklyOverrides }
  for (const [week, pct] of Object.entries(changes)) {
    if (pct === null) delete weeklyOverrides[week]
    else weeklyOverrides[week] = pct
  }
  return { ...member, weeklyOverrides }
}

/** Number of pending cell changes for members that still exist. */
export function countPendingChanges(pending: PendingChanges, members: TeamMember[]): number {
  return members.reduce((sum, member) => sum + Object.keys(pending[member.id] ?? {}).length, 0)
}

/** Splits pending changes into store updates (set a %) and clears (back to default). */
export function toStoreOperations(pending: PendingChanges, members: TeamMember[]) {
  const updates: WeeklyOverrideUpdate[] = []
  const clears: WeeklyCell[] = []
  for (const member of members) {
    for (const [weekStart, pct] of Object.entries(pending[member.id] ?? {})) {
      if (pct === null) clears.push({ memberId: member.id, weekStart })
      else updates.push({ memberId: member.id, weekStart, pct })
    }
  }
  return { updates, clears }
}
