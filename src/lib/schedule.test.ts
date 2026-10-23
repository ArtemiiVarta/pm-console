import {
  getDayAfter,
  getNextPhaseStart,
  getPhaseEndDate,
  getPhaseIssues,
  getProjectRange,
  getProjectWeeks,
  getWeekWorkingShare,
  sortPhases,
} from '@/lib/schedule'
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

describe('phase ordering helpers', () => {
  const a = { ...phase('a', MON, 5), order: 1 }
  const b = { ...phase('b', '2026-11-02', 1, 'weeks'), order: 0 }

  it('sorts by table order and finds the day after the last phase', () => {
    expect(sortPhases([a, b]).map((p) => p.id)).toEqual(['b', 'a'])
    expect(getDayAfter('2026-12-31')).toBe('2027-01-01')
    // Last in table order is "a" (ends Fri 23 Oct), even though "b" ends later.
    expect(getNextPhaseStart([a, b], 'working')).toBe(SAT)
    expect(getNextPhaseStart([], 'working')).toBeNull()
  })
})

describe('getPhaseIssues', () => {
  const ordered = (...phases: Phase[]) => phases.map((p, order) => ({ ...p, order }))

  it('reports no issues for back-to-back phases', () => {
    const issues = getPhaseIssues(ordered(phase('a', MON, 5), phase('b', SAT, 2)), 'calendar')
    expect(issues).toEqual({
      a: { overlapsWith: [], gapDaysBefore: 0 },
      b: { overlapsWith: [], gapDaysBefore: 0 },
    })
  })

  it('detects overlaps in both directions, including non-adjacent phases', () => {
    const issues = getPhaseIssues(
      ordered(phase('a', MON, 2, 'weeks'), phase('b', '2026-11-09', 1, 'weeks'), phase('c', FRI, 3)),
      'calendar',
    )
    expect(issues.a?.overlapsWith).toEqual(['c'])
    expect(issues.b?.overlapsWith).toEqual([])
    expect(issues.c?.overlapsWith).toEqual(['a'])
  })

  it('treats sharing a single day as an overlap', () => {
    const issues = getPhaseIssues(ordered(phase('a', MON, 5), phase('b', FRI, 1)), 'calendar')
    expect(issues.b?.overlapsWith).toEqual(['a'])
  })

  it('counts gap days against the previous phase in table order', () => {
    // a ends Fri 23 Oct; b starts Wed 28 Oct.
    const phases = ordered(phase('a', MON, 5), phase('b', '2026-10-28', 1))
    expect(getPhaseIssues(phases, 'calendar').b?.gapDaysBefore).toBe(4)
    expect(getPhaseIssues(phases, 'working').b?.gapDaysBefore).toBe(2)
  })

  it('does not count a weekend between Friday and Monday as a gap in working mode', () => {
    const phases = ordered(phase('a', MON, 5), phase('b', '2026-10-26', 5))
    expect(getPhaseIssues(phases, 'working').b?.gapDaysBefore).toBe(0)
    expect(getPhaseIssues(phases, 'calendar').b?.gapDaysBefore).toBe(2)
  })
})

describe('pinned end date', () => {
  it('wins over the duration and never falls before the start', () => {
    expect(getPhaseEndDate({ ...span(MON, 2, 'weeks'), endDate: '2026-10-28' }, 'working')).toBe('2026-10-28')
    expect(getPhaseEndDate({ ...span(WED, 1), endDate: MON }, 'calendar')).toBe(WED)
  })
})

describe('getWeekWorkingShare', () => {
  it('is a full week without bounds, or when the range covers Mon–Fri', () => {
    expect(getWeekWorkingShare(MON)).toBe(1)
    expect(getWeekWorkingShare(MON, MON, FRI)).toBe(1)
    expect(getWeekWorkingShare(MON, '2026-10-01', '2026-12-31')).toBe(1)
  })

  it('counts only the working days inside the range', () => {
    expect(getWeekWorkingShare(MON, '2026-10-22')).toBe(2 / 5) // starts Thursday
    expect(getWeekWorkingShare(MON, undefined, WED)).toBe(3 / 5) // ends Wednesday
    expect(getWeekWorkingShare(MON, WED, WED)).toBe(1 / 5)
  })

  it('ignores weekends, whatever the range', () => {
    expect(getWeekWorkingShare(MON, SAT, SUN)).toBe(0)
    expect(getWeekWorkingShare(MON, MON, SUN)).toBe(1)
  })

  it('is 0 when the range misses the week', () => {
    expect(getWeekWorkingShare(MON, '2026-11-02')).toBe(0)
    expect(getWeekWorkingShare(MON, undefined, '2026-10-16')).toBe(0)
  })
})
