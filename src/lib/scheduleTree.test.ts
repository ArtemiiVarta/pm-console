import {
  buildGanttRows,
  fitSchedule,
  formatSpan,
  getDescendantIds,
  getScheduleSpan,
  moveNode,
  setNodeRange,
  withoutOrphans,
  type ScheduleData,
} from '@/lib/scheduleTree'
import type { Phase, ScheduleItem } from '@/store/types'

// Mon 19 Oct 2026
const phase = (overrides: Partial<Phase> = {}): Phase => ({
  id: 'p',
  name: 'Explore',
  color: '#2563EB',
  order: 0,
  startDate: '2026-10-19',
  duration: 1,
  durationUnit: 'weeks',
  ...overrides,
})

const item = (id: string, parentId: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem => ({
  id,
  parentId,
  kind: 'task',
  name: id,
  color: '#2563EB',
  order: 0,
  startDate: '2026-10-21',
  duration: 3,
  durationUnit: 'days',
  ...overrides,
})

const data = (phases: Phase[], items: ScheduleItem[] = []): ScheduleData => ({
  phases,
  items,
  milestones: [],
})

describe('fitSchedule', () => {
  const children = [
    item('a', 'p', { startDate: '2026-10-21', duration: 3 }), // Wed–Fri 23 Oct
    item('b', 'p', { startDate: '2026-10-26', duration: 2 }), // Mon–Tue 27 Oct
    item('m', 'p', { kind: 'milestone', startDate: '2026-10-30' }), // Fri 30 Oct
  ]

  it('fits start and end to the earliest child start and latest child end, milestones included', () => {
    const { phases } = fitSchedule([phase({ fitStart: true, fitEnd: true })], children, 'working')
    expect(phases[0]).toMatchObject({ startDate: '2026-10-21', endDate: '2026-10-30' })
  })

  it('fits only the start and keeps the end where it was', () => {
    const { phases } = fitSchedule([phase({ fitStart: true })], children, 'working')
    expect(phases[0]).toMatchObject({ startDate: '2026-10-21', endDate: '2026-10-25' })
  })

  it('fits only the end', () => {
    const { phases } = fitSchedule([phase({ fitEnd: true })], children, 'working')
    expect(phases[0]).toMatchObject({ startDate: '2026-10-19', endDate: '2026-10-30' })
  })

  it('leaves parents without flags or without children untouched (same objects)', () => {
    const plain = [phase()]
    expect(fitSchedule(plain, children, 'working').phases).toBe(plain)
    const flagged = [phase({ fitStart: true, fitEnd: true })]
    expect(fitSchedule(flagged, [], 'working').phases).toBe(flagged)
  })

  it('fits tasks to their sub-items first, then the phase to its tasks', () => {
    const items = [
      item('task', 'p', { startDate: '2026-10-19', duration: 1, fitStart: true, fitEnd: true }),
      item('sub1', 'task', { startDate: '2026-10-22', duration: 2 }), // Thu–Fri 23 Oct
      item('sub2', 'task', { kind: 'milestone', startDate: '2026-11-02' }),
    ]
    const result = fitSchedule([phase({ fitEnd: true })], items, 'working')
    expect(result.items[0]).toMatchObject({ startDate: '2026-10-22', endDate: '2026-11-02' })
    expect(result.phases[0]).toMatchObject({ startDate: '2026-10-19', endDate: '2026-11-02' })
  })
})

describe('moveNode and setNodeRange', () => {
  const tree = data(
    [phase({ endDate: '2026-10-30' })],
    [item('task', 'p'), item('sub', 'task', { endDate: '2026-10-28' }), item('other', 'q')],
  )

  it('moves a phase with all its descendants by calendar days', () => {
    const moved = moveNode(tree, 'p', 7)
    expect(moved.phases[0]).toMatchObject({ startDate: '2026-10-26', endDate: '2026-11-06' })
    expect(moved.items.find((i) => i.id === 'task')?.startDate).toBe('2026-10-28')
    expect(moved.items.find((i) => i.id === 'sub')).toMatchObject({
      startDate: '2026-10-28',
      endDate: '2026-11-04',
    })
    expect(moved.items.find((i) => i.id === 'other')?.startDate).toBe('2026-10-21')
  })

  it('moves a project milestone', () => {
    const moved = moveNode(
      { ...tree, milestones: [{ id: 'go', name: 'Go', date: '2026-12-01', color: '#000000' }] },
      'go',
      -1,
    )
    expect(moved.milestones[0]?.date).toBe('2026-11-30')
  })

  it('sets a start and pinned end without moving children', () => {
    const resized = setNodeRange(tree, 'task', '2026-10-20', '2026-10-29')
    expect(resized.items.find((i) => i.id === 'task')).toMatchObject({
      startDate: '2026-10-20',
      endDate: '2026-10-29',
    })
    expect(resized.items.find((i) => i.id === 'sub')?.startDate).toBe('2026-10-21')
    expect(setNodeRange(tree, 'p', '2026-10-25', '2026-10-20').phases[0]?.endDate).toBe('2026-10-25')
  })
})

describe('tree helpers', () => {
  it('finds descendants and drops orphans', () => {
    const items = [item('task', 'p'), item('sub', 'task'), item('lost', 'gone'), item('lostChild', 'lost')]
    expect(getDescendantIds(items, 'p')).toEqual(['task', 'sub'])
    expect(withoutOrphans([phase()], items).map((i) => i.id)).toEqual(['task', 'sub'])
  })

  it('builds nested rows in order, with project milestones last, honoring collapse', () => {
    const tree: ScheduleData = {
      phases: [phase({ id: 'p2', name: 'Realize', order: 1 }), phase({ fitEnd: true })],
      items: [
        item('t2', 'p', { order: 1, name: 'Second' }),
        item('t1', 'p', { order: 0, name: 'First' }),
        item('s1', 't1', { kind: 'milestone', name: 'Done' }),
      ],
      milestones: [{ id: 'go', name: 'Go-live', date: '2026-12-01', color: '#CA8A04' }],
    }
    const rows = buildGanttRows(tree, 'working')
    expect(rows.map((r) => [r.name, r.kind, r.level])).toEqual([
      ['Explore', 'phase', 0],
      ['First', 'task', 1],
      ['Done', 'milestone', 2],
      ['Second', 'task', 1],
      ['Realize', 'phase', 0],
      ['Go-live', 'project-milestone', 0],
    ])
    expect(rows[0]).toMatchObject({ hasChildren: true, fitEnd: true, fitStart: false })
    expect(rows[2]).toMatchObject({ start: '2026-10-21', end: '2026-10-21' })

    const collapsed = buildGanttRows(tree, 'working', new Set(['p']))
    expect(collapsed.map((r) => r.name)).toEqual(['Explore', 'Realize', 'Go-live'])
  })

  it('spans every node and formats lengths', () => {
    const span = getScheduleSpan(
      { ...data([phase()], [item('t', 'p', { startDate: '2026-11-02' })]), milestones: [] },
      'working',
    )
    expect(span).toEqual({ start: '2026-10-19', end: '2026-11-04' })
    expect(getScheduleSpan(data([]), 'working')).toBeNull()
    expect(formatSpan('2026-10-19', '2026-10-25', 'working')).toBe('5 working days')
    expect(formatSpan('2026-10-19', '2026-10-25', 'calendar')).toBe('7 days')
    expect(formatSpan('2026-10-19', '2026-10-19', 'calendar')).toBe('1 day')
  })
})
