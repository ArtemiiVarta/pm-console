import { PHASE_PALETTE } from '@/lib/palette'
import {
  createInitialData,
  createInitialWorkspace,
  migrateData,
  migrateStore,
  STORE_KEY,
  STORE_VERSION,
  useAppStore,
  type NewPhase,
  type NewTeamMember,
} from '@/store/useAppStore'

const store = () => useAppStore.getState()

const phaseInput = (name: string, startDate = '2026-10-19'): NewPhase => ({
  name,
  startDate,
  duration: 2,
  durationUnit: 'weeks',
})

const memberInput: NewTeamMember = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'Developer',
  costRate: 100,
  priceRate: 150,
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialWorkspace())
})

describe('initial state', () => {
  it('starts empty with project defaults', () => {
    const { project, phases, members, baselines, selectedBaselineId } = store()
    expect(project).toMatchObject({
      name: '',
      client: '',
      currency: 'CAD',
      standardHoursPerWeek: 40,
      durationMode: 'working',
    })
    expect(phases).toEqual([])
    expect(members).toEqual([])
    expect(baselines).toEqual([])
    expect(selectedBaselineId).toBeNull()
  })
})

describe('project', () => {
  it('updates fields and bumps updatedAt', () => {
    const before = store().project
    store().updateProject({ name: 'S/4 rollout', currency: 'EUR' })
    expect(store().project).toMatchObject({ id: before.id, name: 'S/4 rollout', currency: 'EUR' })
    expect(store().project.updatedAt >= before.updatedAt).toBe(true)
  })
})

describe('phases', () => {
  it('assigns order and palette colors in sequence', () => {
    store().addPhase(phaseInput('Prepare'))
    store().addPhase(phaseInput('Explore'))
    expect(store().phases.map((p) => [p.name, p.order, p.color])).toEqual([
      ['Prepare', 0, PHASE_PALETTE[0]],
      ['Explore', 1, PHASE_PALETTE[1]],
    ])
  })

  it('updates, deletes and renumbers order', () => {
    const a = store().addPhase(phaseInput('A'))
    const b = store().addPhase(phaseInput('B'))
    const c = store().addPhase(phaseInput('C'))
    store().updatePhase(b, { name: 'B2', duration: 3 })
    store().deletePhase(a)
    expect(store().phases.map((p) => [p.id, p.name, p.order])).toEqual([
      [b, 'B2', 0],
      [c, 'C', 1],
    ])
  })

  it('duplicates a phase right after the original with a new color', () => {
    const a = store().addPhase(phaseInput('A'))
    store().addPhase(phaseInput('B'))
    const copy = store().duplicatePhase(a)
    expect(store().phases.map((p) => [p.name, p.order])).toEqual([
      ['A', 0],
      ['A (copy)', 1],
      ['B', 2],
    ])
    const duplicated = store().phases.find((p) => p.id === copy)
    expect(duplicated).toMatchObject({ startDate: '2026-10-19', duration: 2, durationUnit: 'weeks' })
    expect(duplicated?.color).toBe(PHASE_PALETTE[2])
    expect(store().duplicatePhase('missing')).toBeNull()
  })

  it('reorders by id list', () => {
    const a = store().addPhase(phaseInput('A'))
    const b = store().addPhase(phaseInput('B'))
    const c = store().addPhase(phaseInput('C'))
    store().reorderPhases([c, a, b])
    expect(store().phases.map((p) => [p.id, p.order])).toEqual([
      [c, 0],
      [a, 1],
      [b, 2],
    ])
  })
})

describe('members and weekly overrides', () => {
  it('adds members with defaults', () => {
    const id = store().addMember(memberInput)
    expect(store().members[0]).toMatchObject({
      id,
      defaultLoadPct: 100,
      capacityPct: 100,
      active: true,
      weeklyOverrides: {},
    })
  })

  it('stores overrides on the week Monday and clamps them to 0–200', () => {
    const id = store().addMember(memberInput)
    store().setWeeklyOverride(id, '2026-10-21', 60)
    store().setWeeklyOverride(id, '2026-10-26', 250)
    store().setWeeklyOverride(id, '2026-11-02', -10)
    expect(store().members[0]?.weeklyOverrides).toEqual({
      '2026-10-19': 60,
      '2026-10-26': 200,
      '2026-11-02': 0,
    })

    store().clearWeeklyOverride(id, '2026-10-25')
    expect(store().members[0]?.weeklyOverrides).toEqual({ '2026-10-26': 200, '2026-11-02': 0 })
  })

  it('applies a load to an inclusive range of weeks, in either order', () => {
    const id = store().addMember({ ...memberInput, weeklyOverrides: { '2026-10-12': 10 } })
    store().applyLoadToRange(id, '2026-11-04', '2026-10-20', 50)
    expect(store().members[0]?.weeklyOverrides).toEqual({
      '2026-10-12': 10,
      '2026-10-19': 50,
      '2026-10-26': 50,
      '2026-11-02': 50,
    })
  })

  it('sets and clears many overrides across members in one update', () => {
    const a = store().addMember(memberInput)
    const b = store().addMember({
      ...memberInput,
      email: 'b@example.com',
      weeklyOverrides: { '2026-10-12': 5 },
    })
    store().setWeeklyOverrides([
      { memberId: a, weekStart: '2026-10-19', pct: 50 },
      { memberId: a, weekStart: '2026-10-28', pct: 300 },
      { memberId: b, weekStart: '2026-10-19', pct: 70 },
    ])
    expect(store().members[0]?.weeklyOverrides).toEqual({ '2026-10-19': 50, '2026-10-26': 200 })
    expect(store().members[1]?.weeklyOverrides).toEqual({ '2026-10-12': 5, '2026-10-19': 70 })

    store().clearWeeklyOverrides([
      { memberId: a, weekStart: '2026-10-19' },
      { memberId: b, weekStart: '2026-10-21' },
    ])
    expect(store().members[0]?.weeklyOverrides).toEqual({ '2026-10-26': 200 })
    expect(store().members[1]?.weeklyOverrides).toEqual({ '2026-10-12': 5 })

    store().clearAllWeeklyOverrides(b)
    expect(store().members[1]?.weeklyOverrides).toEqual({})
    expect(store().members[0]?.weeklyOverrides).toEqual({ '2026-10-26': 200 })
  })

  it('only changes the targeted member, and deletes', () => {
    const a = store().addMember(memberInput)
    const b = store().addMember({ ...memberInput, email: 'b@example.com' })
    store().updateMember(a, { active: false })
    expect(store().members.find((m) => m.id === b)?.active).toBe(true)
    store().deleteMember(a)
    expect(store().members.map((m) => m.id)).toEqual([b])
  })
})

describe('baselines', () => {
  function seedForecast() {
    store().updateProject({ name: 'Rollout' })
    store().addPhase(phaseInput('Build')) // 2 weeks from Mon 2026-10-19 → 2 project weeks
    return store().addMember(memberInput)
  }

  it('snapshots the forecast with precomputed totals', () => {
    seedForecast()
    const baseline = store().createBaseline('  Baseline 1 ', '  Kick-off  ')
    expect(baseline).toMatchObject({ name: 'Baseline 1', description: 'Kick-off', isLocked: true })
    expect(baseline.totals).toEqual({ hours: 80, cost: 8000, revenue: 12000, margin: 4000, marginPct: 1 / 3 })
    expect(store().baselines).toHaveLength(1)
  })

  it('is a deep copy: later edits do not change the baseline', () => {
    const memberId = seedForecast()
    const baseline = store().createBaseline('Baseline 1')

    store().updateProject({ name: 'Renamed' })
    store().updatePhase(store().phases[0]?.id ?? '', { duration: 10 })
    store().setWeeklyOverride(memberId, '2026-10-19', 10)
    store().updateMember(memberId, { costRate: 1 })

    const saved = store().baselines[0]
    expect(saved).toEqual(baseline)
    expect(saved?.snapshot.project.name).toBe('Rollout')
    expect(saved?.snapshot.phases[0]?.duration).toBe(2)
    expect(saved?.snapshot.members[0]?.weeklyOverrides).toEqual({})
    expect(saved?.snapshot.members[0]?.costRate).toBe(100)
    expect(saved?.snapshot.members[0]).not.toBe(store().members[0])
  })

  it('selects only existing baselines', () => {
    const { id } = store().createBaseline('B1')
    store().selectBaseline('missing')
    expect(store().selectedBaselineId).toBeNull()
    store().selectBaseline(id)
    expect(store().selectedBaselineId).toBe(id)
  })

  it('refuses to delete the selected baseline until another is selected', () => {
    const first = store().createBaseline('B1')
    const second = store().createBaseline('B2')
    store().selectBaseline(first.id)

    expect(store().deleteBaseline(first.id)).toBe(false)
    expect(store().baselines.map((b) => b.id)).toEqual([first.id, second.id])

    store().selectBaseline(second.id)
    expect(store().deleteBaseline(first.id)).toBe(true)
    expect(store().baselines.map((b) => b.id)).toEqual([second.id])
    expect(store().selectedBaselineId).toBe(second.id)
  })

  it('restores a baseline into the working forecast as an independent copy', () => {
    const memberId = seedForecast()
    const baseline = store().createBaseline('Kick-off')
    store().updateProject({ name: 'Changed' })
    store().addPhase(phaseInput('Extra'))
    store().deleteMember(memberId)

    expect(store().restoreBaseline(baseline.id)).toBe(true)
    expect(store().project.name).toBe('Rollout')
    expect(store().phases.map((p) => p.name)).toEqual(['Build'])
    expect(store().members.map((m) => m.id)).toEqual([memberId])

    // Editing after a restore leaves the snapshot untouched.
    store().setWeeklyOverride(memberId, '2026-10-19', 10)
    expect(store().baselines[0]?.snapshot.members[0]?.weeklyOverrides).toEqual({})
    expect(store().restoreBaseline('missing')).toBe(false)
  })
})

describe('tasks and sub-items', () => {
  function seedPhase() {
    return store().addPhase({ name: 'Explore', startDate: '2026-10-19', duration: 1, durationUnit: 'weeks' })
  }
  const task = (parentId: string, startDate: string, duration: number) => ({
    parentId,
    kind: 'task' as const,
    name: `Task ${startDate}`,
    color: '#2563EB',
    startDate,
    duration,
    durationUnit: 'days' as const,
  })

  it('adds a child with "adjust parent" options and keeps the parent fitted afterwards', () => {
    const phaseId = seedPhase()
    const id = store().addItem(task(phaseId, '2026-10-21', 10), { fitStart: true, fitEnd: true })
    expect(store().phases[0]).toMatchObject({
      fitStart: true,
      fitEnd: true,
      startDate: '2026-10-21',
      endDate: '2026-11-03',
    })

    // Keeps following the child after it changes…
    store().updateItem(id, { duration: 2 })
    expect(store().phases[0]).toMatchObject({ startDate: '2026-10-21', endDate: '2026-10-22' })
    // …and after it moves (drag).
    store().moveScheduleNode(id, 7)
    expect(store().phases[0]).toMatchObject({ startDate: '2026-10-28', endDate: '2026-10-29' })
  })

  it('adds sub-items under a task and fits the task, then the phase', () => {
    const phaseId = seedPhase()
    const taskId = store().addItem(task(phaseId, '2026-10-19', 1), { fitStart: false, fitEnd: true })
    store().addItem(task(taskId, '2026-10-22', 5), { fitStart: true, fitEnd: true })
    expect(store().items.find((i) => i.id === taskId)).toMatchObject({
      startDate: '2026-10-22',
      endDate: '2026-10-28',
    })
    expect(store().phases[0]?.endDate).toBe('2026-10-28')
  })

  it('moving a phase moves its children; deleting removes them', () => {
    const phaseId = seedPhase()
    const taskId = store().addItem(task(phaseId, '2026-10-21', 2))
    const subId = store().addItem(task(taskId, '2026-10-21', 1))
    store().moveScheduleNode(phaseId, 14)
    expect(store().items.map((i) => i.startDate)).toEqual(['2026-11-04', '2026-11-04'])

    store().deleteItem(taskId)
    expect(store().items.map((i) => i.id)).not.toContain(subId)
    store().addItem(task(phaseId, '2026-10-21', 2))
    store().deletePhase(phaseId)
    expect(store().items).toEqual([])
  })

  it('reorders siblings', () => {
    const phaseId = seedPhase()
    const a = store().addItem({ ...task(phaseId, '2026-10-19', 1), name: 'A' })
    const b = store().addItem({ ...task(phaseId, '2026-10-19', 1), name: 'B' })
    store().moveItemOrder(b, -1)
    const order = (id: string) => store().items.find((i) => i.id === id)?.order
    expect([order(b), order(a)]).toEqual([0, 1])
  })

  it('migrates version 2 data (no tasks)', () => {
    const { items: _omit, ...v2 } = createInitialData()
    expect(migrateData(v2, 2).items).toEqual([])
  })
})

describe('milestones', () => {
  it('adds, updates and deletes milestones without touching project dates', () => {
    const id = store().addMilestone({ name: 'Go-live', date: '2026-12-01', color: '#CA8A04' })
    expect(store().milestones).toEqual([{ id, name: 'Go-live', date: '2026-12-01', color: '#CA8A04' }])
    store().updateMilestone(id, { color: '#DC2626', date: '2026-12-08' })
    expect(store().milestones[0]).toMatchObject({ color: '#DC2626', date: '2026-12-08' })
    expect(store().phases).toEqual([])
    store().deleteMilestone(id)
    expect(store().milestones).toEqual([])
  })

  it('migrates data saved by version 1 (no milestones)', () => {
    const { milestones: _omit, ...v1 } = createInitialData()
    expect(migrateData(v1, 1).milestones).toEqual([])
    const current = {
      ...createInitialData(),
      milestones: [{ id: 'm', name: 'x', date: '2026-01-01', color: '#000000' }],
    }
    expect(migrateData(current, 4)).toBe(current)
  })
})

describe('multiple projects', () => {
  it('creates and opens projects, keeping each one in the library', () => {
    store().updateProject({ name: 'First' })
    const firstId = store().activeProjectId
    const secondId = store().createProject()
    expect(store().activeProjectId).toBe(secondId)
    expect(store().project.name).toBe('')
    store().updateProject({ name: 'Second' })
    store().addPhase({ name: 'Build', startDate: '2026-10-19', duration: 1, durationUnit: 'weeks' })

    store().openProject(firstId)
    expect(store().project.name).toBe('First')
    expect(store().phases).toEqual([])
    expect(store().library[secondId]?.phases.map((p) => p.name)).toEqual(['Build'])

    store().openProject(secondId)
    expect(store().phases.map((p) => p.name)).toEqual(['Build'])
  })

  it('deletes projects, opening another when the open one goes', () => {
    const firstId = store().activeProjectId
    const secondId = store().createProject()
    store().deleteProject(firstId)
    expect(Object.keys(store().library)).toEqual([secondId])
    store().deleteProject(secondId)
    // Never empty: a fresh project takes its place.
    expect(Object.keys(store().library)).toHaveLength(1)
    expect(store().activeProjectId).not.toBe(secondId)
  })

  it('new projects start green with no rationale', () => {
    store().createProject()
    expect(store().project).toMatchObject({ status: 'green', statusRationale: '' })
  })

  it('migrates a single-project save (v3) into a library', () => {
    const { status: _s, statusRationale: _r, ...oldProject } = createInitialData().project
    const v3 = { ...createInitialData(), project: oldProject }
    const migrated = migrateStore(v3, 3)
    expect(migrated.activeProjectId).toBe(oldProject.id)
    expect(migrated.library[oldProject.id]?.project).toMatchObject({ status: 'green', statusRationale: '' })
  })
})

describe('persistence', () => {
  it(`saves data (not actions) to localStorage under ${STORE_KEY}`, () => {
    store().updateProject({ name: 'Persisted' })
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as {
      version: number
      state: Record<string, unknown>
    }
    expect(saved.version).toBe(STORE_VERSION)
    // Every project is saved in the library, keyed by id, plus which one is open.
    expect(Object.keys(saved.state).sort()).toEqual(['activeProjectId', 'library'])
    const library = saved.state.library as Record<string, { project: { name: string } }>
    expect(library[saved.state.activeProjectId as string]?.project.name).toBe('Persisted')
  })
})
