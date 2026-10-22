import { format } from 'date-fns'
import { getMemberTotals } from '@/lib/forecast'
import { getFullName } from '@/lib/roster'
import { sortPhases } from '@/lib/schedule'
import { getForecastSummary } from '@/lib/summary'
import type { ForecastBaseline, ForecastSnapshot, ForecastTotals, ISODateTime } from '@/store/types'

/** Team totals for a forecast over all of its project weeks (active members only). */
export function getForecastTotals(forecast: ForecastSnapshot): ForecastTotals {
  const { hours, cost, revenue, margin, marginPct } = getForecastSummary(forecast).totals
  return { hours, cost, revenue, margin, marginPct }
}

interface BuildBaselineInput {
  id: string
  name: string
  description?: string
  createdAt: ISODateTime
  forecast: ForecastSnapshot
}

/** Locked baseline holding a deep copy of the forecast, with totals computed now. */
export function buildBaseline({
  id,
  name,
  description,
  createdAt,
  forecast,
}: BuildBaselineInput): ForecastBaseline {
  const snapshot = structuredClone(forecast)
  const trimmed = description?.trim()
  return {
    id,
    name: name.trim(),
    ...(trimmed ? { description: trimmed } : {}),
    createdAt,
    isLocked: true,
    snapshot,
    totals: getForecastTotals(snapshot),
  }
}

/** "Baseline 3 – 21 Oct 2026" for the `count`-th baseline. */
export function getDefaultBaselineName(count: number, date: Date): string {
  return `Baseline ${count} – ${format(date, 'dd MMM yyyy')}`
}

/** JSON with sorted object keys, so key order never counts as a difference. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  )
}

function comparable({ project, phases, members }: ForecastSnapshot) {
  // Timestamps change on every save, so they are not compared.
  const { updatedAt, createdAt, ...projectFields } = project
  return stableStringify({ project: projectFields, phases: sortPhases(phases), members })
}

/** True when the working forecast differs from a baseline's snapshot. */
export function hasChangesSince(working: ForecastSnapshot, baseline: ForecastBaseline): boolean {
  return comparable(working) !== comparable(baseline.snapshot)
}

export interface ComparisonValues {
  hours: number
  cost: number
  revenue: number
  margin: number
}

export interface ComparisonRow {
  key: string
  name: string
  role: string
  from: ComparisonValues
  to: ComparisonValues
  /** to − from */
  delta: ComparisonValues
}

export interface ForecastComparison {
  rows: ComparisonRow[]
  totals: Omit<ComparisonRow, 'key' | 'name' | 'role'>
}

const ZERO: ComparisonValues = { hours: 0, cost: 0, revenue: 0, margin: 0 }

function diff(from: ComparisonValues, to: ComparisonValues): ComparisonValues {
  return {
    hours: to.hours - from.hours,
    cost: to.cost - from.cost,
    revenue: to.revenue - from.revenue,
    margin: to.margin - from.margin,
  }
}

function add(a: ComparisonValues, b: ComparisonValues): ComparisonValues {
  return {
    hours: a.hours + b.hours,
    cost: a.cost + b.cost,
    revenue: a.revenue + b.revenue,
    margin: a.margin + b.margin,
  }
}

/** Per-member values over each forecast's own weeks; inactive members count as 0, like every total. */
function memberValues(
  forecast: ForecastSnapshot,
): Map<string, { name: string; role: string; values: ComparisonValues }> {
  const { weeks } = getForecastSummary(forecast)
  const result = new Map<string, { name: string; role: string; values: ComparisonValues }>()
  for (const member of forecast.members) {
    if (!member.active) continue
    const { hours, cost, revenue, margin } = getMemberTotals(
      member,
      weeks,
      forecast.project.standardHoursPerWeek,
    )
    result.set(member.id, {
      name: getFullName(member),
      role: member.role,
      values: { hours, cost, revenue, margin },
    })
  }
  return result
}

/**
 * Member-by-member difference between two forecasts (`to` − `from`), matched by member id.
 * Someone in only one forecast is compared against zero.
 */
export function compareForecasts(from: ForecastSnapshot, to: ForecastSnapshot): ForecastComparison {
  const fromValues = memberValues(from)
  const toValues = memberValues(to)
  const keys = [...new Set([...fromValues.keys(), ...toValues.keys()])]

  const rows = keys
    .map((key) => {
      const a = fromValues.get(key)
      const b = toValues.get(key)
      const fromV = a?.values ?? ZERO
      const toV = b?.values ?? ZERO
      return {
        key,
        name: (b ?? a)?.name ?? '',
        role: (b ?? a)?.role ?? '',
        from: fromV,
        to: toV,
        delta: diff(fromV, toV),
      }
    })
    .sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))

  const fromTotal = rows.reduce((sum, row) => add(sum, row.from), ZERO)
  const toTotal = rows.reduce((sum, row) => add(sum, row.to), ZERO)
  return { rows, totals: { from: fromTotal, to: toTotal, delta: diff(fromTotal, toTotal) } }
}

/** Newest first; ties keep their saved order reversed (later saves first). */
export function sortBaselinesNewestFirst(baselines: ForecastBaseline[]): ForecastBaseline[] {
  return baselines
    .map((baseline, index) => ({ baseline, index }))
    .sort((a, b) => b.baseline.createdAt.localeCompare(a.baseline.createdAt) || b.index - a.index)
    .map(({ baseline }) => baseline)
}
