import { format } from 'date-fns'
import { parseISODate } from '@/lib/dates'
import type { Currency, DurationUnit, ISODate } from '@/store/types'

export const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const satisfies readonly Currency[]

const LOCALE = 'en-CA'

/** `14 Nov 2026` */
export function formatDate(value: ISODate): string {
  return format(parseISODate(value), 'dd MMM yyyy')
}

/** Week column label, e.g. `19 Oct`. */
export function formatWeekLabel(value: ISODate): string {
  return format(parseISODate(value), 'dd MMM')
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value)
}

export function formatHours(value: number): string {
  return `${formatNumber(value, 1)} h`
}

/** `value` is a fraction: 0.314 → `31.4%`. */
export function formatPercent(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value)
}

export function formatCurrency(value: number, currency: Currency, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    // Fixed decimals so rates line up in tables ($95.00, not $95).
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value)
}

/** `1 week`, `3 days` */
export function formatDuration(duration: number, unit: DurationUnit): string {
  const word = unit === 'weeks' ? 'week' : 'day'
  return `${duration} ${word}${duration === 1 ? '' : 's'}`
}
