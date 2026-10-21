import { formatCurrency, formatDate, formatPercent, formatWeekLabel } from '@/lib/format'
import { getForecastSummary, getMarginTone } from '@/lib/summary'
import { createEmptyProject } from '@/store/useAppStore'
import type { Phase, TeamMember } from '@/store/types'

const phase: Phase = {
  id: 'p',
  name: 'Build',
  color: '#000000',
  order: 0,
  startDate: '2026-10-21',
  duration: 2,
  durationUnit: 'weeks',
}

const member = (id: string, active: boolean): TeamMember => ({
  id,
  firstName: 'A',
  lastName: 'B',
  email: `${id}@example.com`,
  role: 'Developer',
  defaultLoadPct: 100,
  weeklyOverrides: {},
  capacityPct: 100,
  costRate: 100,
  priceRate: 125,
  active,
})

describe('getForecastSummary', () => {
  it('is empty without phases or members', () => {
    const summary = getForecastSummary({ project: createEmptyProject(), phases: [], members: [] })
    expect(summary.range).toBeNull()
    expect(summary.weeks).toEqual([])
    expect(summary.totals.hours).toBe(0)
  })

  it('combines range, weeks, member counts and active-only totals', () => {
    const summary = getForecastSummary({
      project: createEmptyProject(),
      phases: [phase],
      members: [member('a', true), member('b', false)],
    })
    expect(summary.range).toEqual({ start: '2026-10-21', end: '2026-11-03' })
    expect(summary.weeks).toEqual(['2026-10-19', '2026-10-26', '2026-11-02'])
    expect(summary.activeMembers).toBe(1)
    expect(summary.inactiveMembers).toBe(1)
    expect(summary.totals).toMatchObject({
      hours: 120,
      cost: 12000,
      revenue: 15000,
      margin: 3000,
      marginPct: 0.2,
    })
  })
})

describe('getMarginTone', () => {
  it('uses the 25% and 10% thresholds', () => {
    expect(getMarginTone(0.25)).toBe('success')
    expect(getMarginTone(0.2499)).toBe('warning')
    expect(getMarginTone(0.1)).toBe('warning')
    expect(getMarginTone(0.0999)).toBe('danger')
    expect(getMarginTone(-0.5)).toBe('danger')
  })
})

describe('format', () => {
  it('formats dates, week labels, percentages and money', () => {
    expect(formatDate('2026-11-03')).toBe('03 Nov 2026')
    expect(formatWeekLabel('2026-10-19')).toBe('19 Oct')
    expect(formatPercent(0.314)).toBe('31.4%')
    expect(formatPercent(0.2)).toBe('20%')
    expect(formatCurrency(12345.6, 'CAD')).toBe('$12,346')
    expect(formatCurrency(-50, 'EUR', 2)).toBe('-€50.00')
  })
})
