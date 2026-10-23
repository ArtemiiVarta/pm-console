import { getForecastSummary } from '@/lib/summary'
import type { AppData } from '@/store/useAppStore'
import type { Currency, ISODate, ISODateTime, ProjectStatus } from '@/store/types'

export interface ProjectSummary {
  id: string
  name: string
  client: string
  status: ProjectStatus
  rationale: string
  currency: Currency
  /** Forecast revenue (active members over the project weeks), in the project currency. */
  revenue: number
  /** The same revenue in the reporting currency, for comparing projects. */
  reportingRevenue: number
  marginPct: number
  start: ISODate | null
  end: ISODate | null
  updatedAt: ISODateTime
}

/** Converts an amount to the reporting currency; the default leaves it as is. */
export type ToReportingCurrency = (amount: number, currency: Currency) => number

/** One summary per project in the library, highest revenue (in the reporting currency) first, then by name. */
export function getProjectSummaries(
  library: Record<string, AppData>,
  toReporting: ToReportingCurrency = (amount) => amount,
): ProjectSummary[] {
  return Object.entries(library)
    .map(([id, data]) => {
      const { range, totals } = getForecastSummary(data)
      return {
        id,
        name: data.project.name.trim() || 'Untitled project',
        client: data.project.client,
        status: data.project.status ?? 'green',
        rationale: data.project.statusRationale ?? '',
        currency: data.project.currency,
        revenue: totals.revenue,
        reportingRevenue: toReporting(totals.revenue, data.project.currency),
        marginPct: totals.marginPct,
        start: range?.start ?? null,
        end: range?.end ?? null,
        updatedAt: data.project.updatedAt,
      }
    })
    .sort((a, b) => b.reportingRevenue - a.reportingRevenue || a.name.localeCompare(b.name))
}
