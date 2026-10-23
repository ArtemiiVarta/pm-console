import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storageKey } from '@/lib/env'
import { DEFAULT_FX_RATES, type FxRates } from '@/lib/fx'
import type { Currency, ISODate } from '@/store/types'

// Per-browser portfolio settings, kept apart from project data (not exported or synced).
interface PortfolioPrefs {
  /** Currency the Projects page compares revenue in. */
  reportingCurrency: Currency
  /** Value of one unit of each currency in CAD. */
  fxRates: FxRates
  /** Date the rates were last entered, or null while they are the defaults. */
  fxRatesAsOf: ISODate | null
  setReportingCurrency: (currency: Currency) => void
  setFxRates: (rates: FxRates, asOf: ISODate) => void
}

export const usePortfolioPrefs = create<PortfolioPrefs>()(
  persist(
    (set) => ({
      reportingCurrency: 'CAD',
      fxRates: DEFAULT_FX_RATES,
      fxRatesAsOf: null,
      setReportingCurrency: (reportingCurrency) => set({ reportingCurrency }),
      setFxRates: (fxRates, fxRatesAsOf) => set({ fxRates: { ...fxRates, CAD: 1 }, fxRatesAsOf }),
    }),
    {
      name: storageKey('portfolio'),
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ reportingCurrency, fxRates, fxRatesAsOf }) => ({
        reportingCurrency,
        fxRates,
        fxRatesAsOf,
      }),
    },
  ),
)
