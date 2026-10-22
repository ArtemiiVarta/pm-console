import {
  buildBaseline,
  compareForecasts,
  getDefaultBaselineName,
  hasChangesSince,
  sortBaselinesNewestFirst,
} from '@/lib/baseline'
import { createEmptyProject } from '@/store/useAppStore'
import type { ForecastSnapshot, Phase, TeamMember } from '@/store/types'

const phase: Phase = {
  id: 'ph',
  name: 'Build',
  color: '#000000',
  order: 0,
  startDate: '2026-10-19',
  duration: 2,
  durationUnit: 'weeks',
}

function member(id: string, overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id,
    firstName: id.toUpperCase(),
    lastName: 'Test',
    email: `${id}@example.com`,
    role: 'Developer',
    defaultLoadPct: 100,
    weeklyOverrides: {},
    capacityPct: 100,
    costRate: 100,
    priceRate: 150,
    active: true,
    ...overrides,
  }
}

function forecast(members: TeamMember[], phases: Phase[] = [phase]): ForecastSnapshot {
  return { project: { ...createEmptyProject(), id: 'p', createdAt: 'c', updatedAt: 'u' }, phases, members }
}

const baselineOf = (snapshot: ForecastSnapshot, createdAt = '2026-10-21T10:00:00.000Z', id = 'b') =>
  buildBaseline({ id, name: id, createdAt, forecast: snapshot })

describe('getDefaultBaselineName', () => {
  it('numbers and dates the name', () => {
    expect(getDefaultBaselineName(3, new Date(2026, 9, 21))).toBe('Baseline 3 – 21 Oct 2026')
  })
})

describe('hasChangesSince', () => {
  const working = forecast([member('a')])
  const baseline = baselineOf(working)

  it('is false right after creating the baseline', () => {
    expect(hasChangesSince(working, baseline)).toBe(false)
  })

  it('ignores key order and project timestamps', () => {
    const reordered: ForecastSnapshot = {
      project: { ...working.project, updatedAt: 'later' },
      phases: working.phases.map(({ durationUnit, ...rest }) => ({ durationUnit, ...rest })),
      members: working.members.map(({ id, ...rest }) => ({ ...rest, id })),
    }
    expect(hasChangesSince(reordered, baseline)).toBe(false)
  })

  it('detects changes to project settings, phases, members and weekly overrides', () => {
    expect(hasChangesSince({ ...working, project: { ...working.project, name: 'X' } }, baseline)).toBe(true)
    expect(hasChangesSince({ ...working, phases: [{ ...phase, duration: 3 }] }, baseline)).toBe(true)
    expect(hasChangesSince({ ...working, members: [] }, baseline)).toBe(true)
    expect(
      hasChangesSince(
        { ...working, members: [member('a', { weeklyOverrides: { '2026-10-19': 50 } })] },
        baseline,
      ),
    ).toBe(true)
  })
})

describe('compareForecasts', () => {
  it('computes per-member and total deltas (to − from)', () => {
    // 2 weeks × 40 h. a: cost 100, price 150. b: cost 80, price 120.
    const from = forecast([member('a'), member('b', { costRate: 80, priceRate: 120 })])
    const to = forecast([
      member('a', { weeklyOverrides: { '2026-10-19': 50 } }), // 60 h instead of 80
      member('b', { costRate: 80, priceRate: 140 }), // price up
    ])
    const { rows, totals } = compareForecasts(from, to)

    expect(rows.map((row) => [row.name, row.delta])).toEqual([
      ['A Test', { hours: -20, cost: -2000, revenue: -3000, margin: -1000 }],
      ['B Test', { hours: 0, cost: 0, revenue: 1600, margin: 1600 }],
    ])
    expect(totals.from).toEqual({ hours: 160, cost: 14400, revenue: 21600, margin: 7200 })
    expect(totals.to).toEqual({ hours: 140, cost: 12400, revenue: 20200, margin: 7800 })
    expect(totals.delta).toEqual({ hours: -20, cost: -2000, revenue: -1400, margin: 600 })
  })

  it('compares people in only one version against zero, and counts inactive members as zero', () => {
    const from = forecast([member('a'), member('gone')])
    const to = forecast([member('a', { active: false }), member('new')])
    const byName = Object.fromEntries(compareForecasts(from, to).rows.map((row) => [row.name, row]))

    expect(byName['GONE Test']?.to).toEqual({ hours: 0, cost: 0, revenue: 0, margin: 0 })
    expect(byName['NEW Test']?.from).toEqual({ hours: 0, cost: 0, revenue: 0, margin: 0 })
    expect(byName['NEW Test']?.delta.hours).toBe(80)
    expect(byName['A Test']?.delta.hours).toBe(-80)
  })
})

describe('sortBaselinesNewestFirst', () => {
  it('orders by creation time, newest first', () => {
    const snapshot = forecast([])
    const older = baselineOf(snapshot, '2026-10-01T09:00:00.000Z', 'older')
    const newer = baselineOf(snapshot, '2026-10-21T09:00:00.000Z', 'newer')
    expect(sortBaselinesNewestFirst([older, newer]).map((b) => b.id)).toEqual(['newer', 'older'])
  })
})
