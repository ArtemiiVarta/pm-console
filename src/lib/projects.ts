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
  /** Forecast revenue (active members over the project weeks). */
  revenue: number
  marginPct: number
  start: ISODate | null
  end: ISODate | null
  updatedAt: ISODateTime
}

/** One summary per project in the library, highest revenue first, then by name. */
export function getProjectSummaries(library: Record<string, AppData>): ProjectSummary[] {
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
        marginPct: totals.marginPct,
        start: range?.start ?? null,
        end: range?.end ?? null,
        updatedAt: data.project.updatedAt,
      }
    })
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
}
