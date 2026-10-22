import {
  addPendingChanges,
  countPendingChanges,
  getFillRightUpdates,
  getPreviewMember,
  getResetAllChanges,
  toStoreOperations,
  getPhaseLanes,
  getRange,
  getRangeCells,
  getRangeSize,
  hoursToPct,
  parseLoadInput,
} from '@/lib/assignment'
import type { Phase, TeamMember } from '@/store/types'

const WEEKS = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']

const phase = (id: string, startDate: string, duration: number, order: number): Phase => ({
  id,
  name: id,
  color: '#000000',
  order,
  startDate,
  duration,
  durationUnit: 'weeks',
})

const member = (id: string, overrides: Partial<TeamMember> = {}): TeamMember => ({
  id,
  firstName: id,
  lastName: 'X',
  email: `${id}@example.com`,
  role: 'Developer',
  defaultLoadPct: 100,
  weeklyOverrides: {},
  capacityPct: 100,
  costRate: 0,
  priceRate: 0,
  active: true,
  ...overrides,
})

describe('getPhaseLanes', () => {
  it('maps each phase to the weeks it overlaps, including partial weeks', () => {
    // a: Wed 21 Oct – Tue 3 Nov touches weeks 0–2
    const lanes = getPhaseLanes(WEEKS, [phase('a', '2026-10-21', 2, 0)], 'working')
    expect(lanes).toEqual([[{ phase: expect.objectContaining({ id: 'a' }), startIndex: 0, endIndex: 2 }]])
  })

  it('keeps back-to-back phases in one lane and stacks overlapping ones', () => {
    const lanes = getPhaseLanes(
      WEEKS,
      [
        phase('a', '2026-10-19', 2, 0), // weeks 0–1
        phase('b', '2026-11-02', 2, 1), // weeks 2–3
        phase('c', '2026-10-26', 2, 2), // weeks 1–2, overlaps both
      ],
      'working',
    )
    expect(lanes.map((lane) => lane.map((band) => [band.phase.id, band.startIndex, band.endIndex]))).toEqual([
      [
        ['a', 0, 1],
        ['b', 2, 3],
      ],
      [['c', 1, 2]],
    ])
  })

  it('returns no lanes without weeks', () => {
    expect(getPhaseLanes([], [phase('a', '2026-10-19', 1, 0)], 'working')).toEqual([])
  })
})

describe('hours and input parsing', () => {
  it('converts hours to load %', () => {
    expect(hoursToPct(20, 40)).toBe(50)
    expect(hoursToPct(10, 37.5)).toBe(26.67)
    expect(hoursToPct(10, 0)).toBe(0)
  })

  it('reads % in Load % mode and hours in Hours mode', () => {
    expect(parseLoadInput('80', 'pct', 40)).toEqual({ kind: 'set', pct: 80 })
    expect(parseLoadInput(' 80 % ', 'pct', 40)).toEqual({ kind: 'set', pct: 80 })
    expect(parseLoadInput('20', 'hours', 40)).toEqual({ kind: 'set', pct: 50 })
    expect(parseLoadInput('20h', 'pct', 40)).toEqual({ kind: 'set', pct: 50 })
    expect(parseLoadInput('50%', 'hours', 40)).toEqual({ kind: 'set', pct: 50 })
    expect(parseLoadInput('7,5', 'hours', 30)).toEqual({ kind: 'set', pct: 25 })
  })

  it('treats empty input as "back to default" and rejects junk or over 200%', () => {
    expect(parseLoadInput('  ', 'pct', 40)).toEqual({ kind: 'clear' })
    expect(parseLoadInput('abc', 'pct', 40).kind).toBe('invalid')
    expect(parseLoadInput('-5', 'pct', 40).kind).toBe('invalid')
    expect(parseLoadInput('201', 'pct', 40)).toEqual({ kind: 'invalid', message: 'Load can be at most 200%' })
    expect(parseLoadInput('81', 'hours', 40).kind).toBe('invalid')
  })
})

describe('ranges', () => {
  const members = [
    member('a', { weeklyOverrides: { '2026-10-26': 60 } }),
    member('b', { defaultLoadPct: 50 }),
  ]

  it('normalizes a range from any two corners', () => {
    const range = getRange({ row: 1, col: 3 }, { row: 0, col: 1 })
    expect(range).toEqual({ top: 0, bottom: 1, left: 1, right: 3 })
    expect(getRangeSize(range)).toBe(6)
  })

  it('lists the cells in a range', () => {
    expect(getRangeCells({ top: 0, bottom: 1, left: 2, right: 3 }, members, WEEKS)).toEqual([
      { memberId: 'a', weekStart: '2026-11-02' },
      { memberId: 'a', weekStart: '2026-11-09' },
      { memberId: 'b', weekStart: '2026-11-02' },
      { memberId: 'b', weekStart: '2026-11-09' },
    ])
  })

  it('fills right with each row’s first selected value (override or default)', () => {
    expect(getFillRightUpdates({ top: 0, bottom: 1, left: 1, right: 2 }, members, WEEKS)).toEqual([
      { memberId: 'a', weekStart: '2026-11-02', pct: 60 },
      { memberId: 'b', weekStart: '2026-11-02', pct: 50 },
    ])
  })
})

describe('pending changes', () => {
  const saved = [member('a', { weeklyOverrides: { '2026-10-19': 40 } }), member('b')]

  it('adds changes, dropping ones that match what is saved', () => {
    let pending = addPendingChanges({}, [{ memberId: 'a', weekStart: '2026-10-26', pct: 60 }], saved)
    expect(pending).toEqual({ a: { '2026-10-26': 60 } })

    // Back to the saved value → nothing pending for that week.
    pending = addPendingChanges(pending, [{ memberId: 'a', weekStart: '2026-10-26', pct: null }], saved)
    expect(pending).toEqual({})

    // Same as the saved override → nothing pending; clearing a saved override → pending null.
    expect(addPendingChanges({}, [{ memberId: 'a', weekStart: '2026-10-19', pct: 40 }], saved)).toEqual({})
    expect(addPendingChanges({}, [{ memberId: 'a', weekStart: '2026-10-19', pct: null }], saved)).toEqual({
      a: { '2026-10-19': null },
    })
  })

  it('clamps to 0–200% and ignores unknown members', () => {
    const pending = addPendingChanges(
      {},
      [
        { memberId: 'b', weekStart: '2026-10-19', pct: 500 },
        { memberId: 'gone', weekStart: '2026-10-19', pct: 10 },
      ],
      saved,
    )
    expect(pending).toEqual({ b: { '2026-10-19': 200 } })
  })

  it('previews, counts and converts pending changes for saving', () => {
    const pending = { a: { '2026-10-19': null, '2026-10-26': 70 }, gone: { '2026-10-19': 5 } }
    const [a] = saved
    if (!a) throw new Error('no member')
    expect(getPreviewMember(a, pending.a).weeklyOverrides).toEqual({ '2026-10-26': 70 })
    expect(getPreviewMember(a, undefined)).toBe(a)
    expect(countPendingChanges(pending, saved)).toBe(2)
    expect(toStoreOperations(pending, saved)).toEqual({
      updates: [{ memberId: 'a', weekStart: '2026-10-26', pct: 70 }],
      clears: [{ memberId: 'a', weekStart: '2026-10-19' }],
    })
  })

  it('resets every saved and pending week of a member', () => {
    const [a] = saved
    if (!a) throw new Error('no member')
    const changes = getResetAllChanges(a, { a: { '2026-11-02': 30 } })
    expect(changes).toEqual([
      { memberId: 'a', weekStart: '2026-10-19', pct: null },
      { memberId: 'a', weekStart: '2026-11-02', pct: null },
    ])
  })
})
