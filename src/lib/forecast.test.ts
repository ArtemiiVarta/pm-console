import {
  getMemberCapacityHours,
  getMemberHours,
  getMemberLoadPct,
  getMemberTotals,
  getRateMargin,
  getTeamTotals,
  getWeeklyTeamTotals,
} from '@/lib/forecast'
import { getPhaseColor, PHASE_PALETTE } from '@/lib/palette'
import type { TeamMember } from '@/store/types'

const W1 = '2026-10-19'
const W2 = '2026-10-26'
const STD = 40

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'm',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
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

describe('member load and hours', () => {
  const m = member({ defaultLoadPct: 80, weeklyOverrides: { [W2]: 50 }, capacityPct: 75 })

  it('uses the weekly override when set, otherwise the default', () => {
    expect(getMemberLoadPct(m, W1)).toBe(80)
    expect(getMemberLoadPct(m, W2)).toBe(50)
  })

  it('treats a 0% override as an override, not as missing', () => {
    expect(getMemberLoadPct(member({ weeklyOverrides: { [W1]: 0 } }), W1)).toBe(0)
  })

  it('converts load % to hours and capacity hours', () => {
    expect(getMemberHours(m, W1, STD)).toBe(32)
    expect(getMemberHours(m, W2, STD)).toBe(20)
    expect(getMemberCapacityHours(m, W1, STD)).toBe(24)
    expect(getMemberHours(member({ defaultLoadPct: 200 }), W1, 37.5)).toBe(75)
  })
})

describe('getMemberTotals', () => {
  it('sums hours, capacity, cost, revenue and margin over the weeks', () => {
    const m = member({ weeklyOverrides: { [W2]: 50 }, capacityPct: 80 })
    expect(getMemberTotals(m, [W1, W2], STD)).toEqual({
      hours: 60,
      capacityHours: 48,
      cost: 6000,
      revenue: 9000,
      margin: 3000,
      marginPct: 1 / 3,
    })
  })

  it('returns zeros without weeks, with marginPct 0 when revenue is 0', () => {
    expect(getMemberTotals(member(), [], STD)).toEqual({
      hours: 0,
      capacityHours: 0,
      cost: 0,
      revenue: 0,
      margin: 0,
      marginPct: 0,
    })
  })

  it('reports a negative margin when cost exceeds price', () => {
    const totals = getMemberTotals(member({ costRate: 120, priceRate: 100 }), [W1], STD)
    expect(totals.margin).toBe(-800)
    expect(totals.marginPct).toBeCloseTo(-0.2)
  })
})

describe('getRateMargin', () => {
  it('computes margin per hour and margin %', () => {
    expect(getRateMargin(100, 150)).toEqual({ marginPerHour: 50, marginPct: 1 / 3 })
    expect(getRateMargin(150, 100)).toEqual({ marginPerHour: -50, marginPct: -0.5 })
  })

  it('returns 0% when the price rate is 0', () => {
    expect(getRateMargin(100, 0)).toEqual({ marginPerHour: -100, marginPct: 0 })
  })
})

describe('team totals', () => {
  const team = [
    member({ id: 'a', capacityPct: 50 }),
    member({ id: 'b', defaultLoadPct: 50, costRate: 80, priceRate: 120, weeklyOverrides: { [W2]: 100 } }),
    member({ id: 'c', active: false, costRate: 999, priceRate: 999 }),
  ]

  it('sums active members only', () => {
    // a: 80 h, 40 cap, 8000 cost, 12000 rev. b: 20 + 40 = 60 h, 60 cap, 4800 cost, 7200 rev.
    expect(getTeamTotals(team, [W1, W2], STD)).toEqual({
      hours: 140,
      capacityHours: 100,
      cost: 12800,
      revenue: 19200,
      margin: 6400,
      marginPct: 6400 / 19200,
    })
  })

  it('breaks totals down per week, active members only', () => {
    expect(getWeeklyTeamTotals(team, [W1, W2], STD)).toEqual([
      { weekStart: W1, hours: 60, capacityHours: 40, cost: 5600, revenue: 8400 },
      { weekStart: W2, hours: 80, capacityHours: 60, cost: 7200, revenue: 10800 },
    ])
  })

  it('handles an empty team', () => {
    expect(getTeamTotals([], [W1], STD).marginPct).toBe(0)
    expect(getWeeklyTeamTotals([], [W1], STD)).toEqual([
      { weekStart: W1, hours: 0, capacityHours: 0, cost: 0, revenue: 0 },
    ])
  })
})

describe('getPhaseColor', () => {
  it('assigns the 8 palette colors in order, then repeats', () => {
    expect(PHASE_PALETTE).toHaveLength(8)
    expect(new Set(PHASE_PALETTE).size).toBe(8)
    expect(getPhaseColor(0)).toBe(PHASE_PALETTE[0])
    expect(getPhaseColor(7)).toBe(PHASE_PALETTE[7])
    expect(getPhaseColor(8)).toBe(PHASE_PALETTE[0])
  })
})
