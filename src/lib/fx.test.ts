import { formatCurrency } from '@/lib/format'
import { convertCurrency, DEFAULT_FX_RATES, hasMixedCurrencies, type FxRates } from '@/lib/fx'
import { getProjectSummaries } from '@/lib/projects'
import { createEmptyProject } from '@/store/useAppStore'
import type { AppData } from '@/store/useAppStore'
import type { Currency } from '@/store/types'

const RATES: FxRates = { CAD: 1, USD: 1.4, EUR: 1.5, GBP: 2 }

describe('convertCurrency', () => {
  it('converts through the CAD value of each currency', () => {
    expect(convertCurrency(100, 'USD', 'CAD', RATES)).toBeCloseTo(140)
    expect(convertCurrency(140, 'CAD', 'USD', RATES)).toBeCloseTo(100)
    expect(convertCurrency(100, 'EUR', 'GBP', RATES)).toBeCloseTo(75)
  })

  it('leaves same-currency amounts untouched', () => {
    expect(convertCurrency(123.45, 'EUR', 'EUR', RATES)).toBe(123.45)
  })

  it('has CAD as the base of the default rates', () => {
    expect(DEFAULT_FX_RATES.CAD).toBe(1)
  })
})

describe('hasMixedCurrencies', () => {
  it('is true only with more than one currency', () => {
    expect(hasMixedCurrencies([])).toBe(false)
    expect(hasMixedCurrencies(['CAD', 'CAD'])).toBe(false)
    expect(hasMixedCurrencies(['CAD', 'USD'])).toBe(true)
  })
})

describe('formatCurrency explicit dollars', () => {
  it('tells CAD and USD apart only when asked', () => {
    expect(formatCurrency(172800, 'USD')).toBe('$172,800')
    expect(formatCurrency(172800, 'USD', 0, { explicit: true })).toBe('US$172,800')
    expect(formatCurrency(140600, 'CAD', 0, { explicit: true })).toBe('CA$140,600')
    expect(formatCurrency(-5, 'CAD', 2, { explicit: true })).toBe('-CA$5.00')
    expect(formatCurrency(96000, 'EUR', 0, { explicit: true })).toBe('€96,000')
  })
})

describe('getProjectSummaries ordering', () => {
  function project(id: string, currency: Currency, priceRate: number): AppData {
    return {
      project: { ...createEmptyProject(), id, name: id, currency },
      phases: [
        {
          id: 'p',
          name: 'Build',
          color: '#000000',
          order: 0,
          startDate: '2026-10-19',
          duration: 1,
          durationUnit: 'weeks',
        },
      ],
      items: [],
      milestones: [],
      members: [
        {
          id: 'm',
          firstName: 'A',
          lastName: 'B',
          email: 'a@example.com',
          role: 'Dev',
          defaultLoadPct: 100,
          weeklyOverrides: {},
          capacityPct: 100,
          costRate: 0,
          priceRate,
          active: true,
        },
      ],
      baselines: [],
      selectedBaselineId: null,
    }
  }

  it('orders by revenue in the reporting currency, not the raw number', () => {
    // 40 h × 100 EUR = €4,000 ≈ CA$6,000; 40 h × 120 CAD = CA$4,800.
    const library = { eur: project('eur', 'EUR', 100), cad: project('cad', 'CAD', 120) }
    const raw = getProjectSummaries(library)
    expect(raw.map((summary) => summary.id)).toEqual(['cad', 'eur'])

    const converted = getProjectSummaries(library, (amount, currency) =>
      convertCurrency(amount, currency, 'CAD', RATES),
    )
    expect(converted.map((summary) => summary.id)).toEqual(['eur', 'cad'])
    expect(converted[0]).toMatchObject({ revenue: 4000, reportingRevenue: 6000, currency: 'EUR' })
  })
})
