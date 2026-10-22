import { PHASE_PALETTE } from '@/lib/palette'
import {
  createInitialData,
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
  useAppStore.setState(createInitialData())
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

  it('selects only existing baselines and clears the selection when it is deleted', () => {
    const { id } = store().createBaseline('B1')
    store().selectBaseline('missing')
    expect(store().selectedBaselineId).toBeNull()
    store().selectBaseline(id)
    expect(store().selectedBaselineId).toBe(id)
    store().deleteBaseline(id)
    expect(store().baselines).toEqual([])
    expect(store().selectedBaselineId).toBeNull()
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
    expect(Object.keys(saved.state).sort()).toEqual([
      'baselines',
      'members',
      'phases',
      'project',
      'selectedBaselineId',
    ])
    expect((saved.state.project as { name: string }).name).toBe('Persisted')
  })
})
