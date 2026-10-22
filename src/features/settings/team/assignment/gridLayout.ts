import type { DisplayUnit } from '@/lib/assignment'
import { formatNumber } from '@/lib/format'

// Fixed column widths: the left columns stick at cumulative offsets (11rem, 20rem).
export const NAME_COL = 'sticky left-0 w-44 min-w-44 max-w-44'
export const ROLE_COL = 'sticky left-44 w-36 min-w-36 max-w-36'
export const DEFAULT_COL = 'sticky left-80 w-20 min-w-20 max-w-20'
export const TOTAL_COL = 'sticky right-0 w-24 min-w-24'
export const WEEK_COL = 'w-16 min-w-16'

export function formatLoad(pct: number, hours: number, unit: DisplayUnit): string {
  return unit === 'pct' ? `${formatNumber(pct, 1)}%` : formatNumber(hours, 1)
}
