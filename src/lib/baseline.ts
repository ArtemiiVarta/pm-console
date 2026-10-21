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
