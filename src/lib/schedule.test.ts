import { getPhaseEndDate, getProjectRange, getProjectWeeks } from '@/lib/schedule'
import type { DurationUnit, Phase } from '@/store/types'

// Reference week: Mon 2026-10-19 … Sun 2026-10-25.
const MON = '2026-10-19'
const WED = '2026-10-21'
const FRI = '2026-10-23'
const SAT = '2026-10-24'
const SUN = '2026-10-25'

const span = (startDate: string, duration: number, durationUnit: DurationUnit = 'days') => ({
  startDate,
  duration,
  durationUnit,
})

function phase(id: string, startDate: string, duration: number, durationUnit: DurationUnit = 'days'): Phase {
  return { id, name: id, color: '#000000', order: 0, startDate, duration, durationUnit }
}

describe('getPhaseEndDate', () => {
  describe('weeks', () => {
    it('ends the day before the same weekday N weeks later, in either mode', () => {
      expect(getPhaseEndDate(span(MON, 2, 'weeks'), 'working')).toBe('2026-11-01')
      expect(getPhaseEndDate(span(MON, 2, 'weeks'), 'calendar')).toBe('2026-11-01')
      expect(getPhaseEndDate(span(WED, 1, 'weeks'), 'working')).toBe('2026-10-27')
    })

    it('crosses the daylight-saving change and the year boundary', () => {
      expect(getPhaseEndDate(span('2026-10-26', 2, 'weeks'), 'working')).toBe('2026-11-08')
      expect(getPhaseEndDate(span('2026-12-28', 1, 'weeks'), 'working')).toBe('2027-01-03')
    })
  })

  describe('days, calendar mode', () => {
    it('counts every day including the start', () => {
      expect(getPhaseEndDate(span(MON, 1), 'calendar')).toBe(MON)
      expect(getPhaseEndDate(span(MON, 5), 'calendar')).toBe(FRI)
      expect(getPhaseEndDate(span(SAT, 2), 'calendar')).toBe(SUN)
      expect(getPhaseEndDate(span(FRI, 10), 'calendar')).toBe('2026-11-01')
    })
  })

  describe('days, working mode', () => {
    it('counts a weekday start as day 1', () => {
      expect(getPhaseEndDate(span(MON, 1), 'working')).toBe(MON)
      expect(getPhaseEndDate(span(MON, 5), 'working')).toBe(FRI)
    })

    it('skips weekends', () => {
      expect(getPhaseEndDate(span(MON, 6), 'working')).toBe('2026-10-26')
      expect(getPhaseEndDate(span(FRI, 2), 'working')).toBe('2026-10-26')
      expect(getPhaseEndDate(span(WED, 10), 'working')).toBe('2026-11-03')
    })

    it('starts counting on Monday when the start is a weekend', () => {
      expect(getPhaseEndDate(span(SAT, 1), 'working')).toBe('2026-10-26')
      expect(getPhaseEndDate(span(SUN, 1), 'working')).toBe('2026-10-26')
      expect(getPhaseEndDate(span(SAT, 5), 'working')).toBe('2026-10-30')
    })
  })

  it('treats durations below 1 as 1 and rounds fractions up', () => {
    expect(getPhaseEndDate(span(MON, 0), 'calendar')).toBe(MON)
    expect(getPhaseEndDate(span(MON, 2.2), 'calendar')).toBe(WED)
  })
})

describe('getProjectRange', () => {
  it('returns null without phases', () => {
    expect(getProjectRange([], 'working')).toBeNull()
  })

  it('spans the earliest start to the latest end, regardless of order', () => {
    const phases = [phase('b', WED, 2, 'weeks'), phase('a', MON, 5)]
    expect(getProjectRange(phases, 'working')).toEqual({ start: MON, end: '2026-11-03' })
  })

  it('uses the duration mode for day-based phases', () => {
    const phases = [phase('a', FRI, 3)]
    expect(getProjectRange(phases, 'calendar')).toEqual({ start: FRI, end: SUN })
    expect(getProjectRange(phases, 'working')).toEqual({ start: FRI, end: '2026-10-27' })
  })
})

describe('getProjectWeeks', () => {
  it('returns no weeks for a null or inverted range', () => {
    expect(getProjectWeeks(null)).toEqual([])
    expect(getProjectWeeks({ start: FRI, end: MON })).toEqual([])
  })

  it('returns the Monday of every week the range touches', () => {
    expect(getProjectWeeks({ start: WED, end: '2026-11-03' })).toEqual([
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
    ])
  })

  it('returns one week for a range inside a single week, and maps Sunday to its own week', () => {
    expect(getProjectWeeks({ start: '2026-10-20', end: '2026-10-22' })).toEqual([MON])
    expect(getProjectWeeks({ start: SUN, end: SUN })).toEqual([MON])
  })

  it('crosses the year boundary', () => {
    expect(getProjectWeeks({ start: '2026-12-30', end: '2027-01-05' })).toEqual(['2026-12-28', '2027-01-04'])
  })
})
