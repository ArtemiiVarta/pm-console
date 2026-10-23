import type { Currency } from '@/store/types'

/** Value of one unit of each currency in CAD (CAD is always 1). */
export type FxRates = Record<Currency, number>

/** Starting rates until the user enters their own; shown as examples in the UI. */
export const DEFAULT_FX_RATES: FxRates = { CAD: 1, USD: 1.38, EUR: 1.6, GBP: 1.85 }

/** `amount` in `from` expressed in `to`, through the CAD value of each. */
export function convertCurrency(amount: number, from: Currency, to: Currency, rates: FxRates): number {
  if (from === to) return amount
  return (amount * rates[from]) / rates[to]
}

/** True when the amounts are in more than one currency, so `$` alone would be ambiguous. */
export function hasMixedCurrencies(currencies: Currency[]): boolean {
  return new Set(currencies).size > 1
}
