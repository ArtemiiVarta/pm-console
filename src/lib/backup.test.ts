import { parseBackup } from '@/lib/backup'
import { countProjects, createBackup, getBackupFileName } from '@/lib/backupFile'
import {
  createInitialWorkspace,
  pickData,
  STORE_VERSION,
  useAppStore,
  type AppData,
  type Workspace,
} from '@/store/useAppStore'

/** Two projects: "Rollout" (with a phase, member, override and baseline) and an empty second one. */
function sampleWorkspace(): Workspace {
  useAppStore.setState(createInitialWorkspace())
  const store = useAppStore.getState()
  store.updateProject({ name: 'Rollout', currency: 'EUR', status: 'amber', statusRationale: 'Late data' })
  store.addPhase({ name: 'Build', startDate: '2026-10-19', duration: 2, durationUnit: 'weeks' })
  const id = store.addMember({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    role: 'Developer',
    costRate: 100,
    priceRate: 150,
  })
  store.setWeeklyOverride(id, '2026-10-26', 60)
  const baseline = store.createBaseline('B1', 'Kick-off')
  store.selectBaseline(baseline.id)
  store.createProject()
  store.updateProject({ name: 'Second' })
  const { library, activeProjectId } = useAppStore.getState()
  return { library, activeProjectId }
}

describe('backup', () => {
  it('round-trips every project through JSON', () => {
    const workspace = sampleWorkspace()
    const backup = createBackup(workspace, STORE_VERSION, new Date('2026-10-21T12:00:00Z'))
    const parsed = parseBackup(JSON.stringify(backup), STORE_VERSION)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.workspace).toEqual(workspace)
    expect(countProjects(parsed.backup)).toBe(2)
    expect(parsed.backup.exportedAt).toBe('2026-10-21T12:00:00.000Z')
    const rollout = Object.values(parsed.backup.workspace.library).find((d) => d.project.name === 'Rollout')
    expect(rollout?.project).toMatchObject({ status: 'amber', statusRationale: 'Late data' })
  })

  it('exports data only, never store actions', () => {
    const backup = createBackup(useAppStore.getState(), STORE_VERSION, new Date())
    expect(Object.keys(backup.workspace).sort()).toEqual(['activeProjectId', 'library'])
  })

  it('imports a single-project backup from version 3 or earlier as one project', () => {
    sampleWorkspace()
    const store = useAppStore.getState()
    const old = store.library[Object.keys(store.library)[0] ?? ''] as AppData
    const { project, ...rest } = old
    // Older backups: `data` instead of `workspace`, no status, no milestones/tasks.
    const { status: _s, statusRationale: _r, ...oldProject } = project
    const { items: _i, milestones: _m, ...oldData } = rest
    const legacy = {
      format: 'pm-console-backup',
      version: 1,
      exportedAt: 'x',
      data: { project: oldProject, ...oldData },
    }
    const parsed = parseBackup(JSON.stringify(legacy), STORE_VERSION)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const data = parsed.backup.workspace.library[project.id]
    expect(parsed.backup.workspace.activeProjectId).toBe(project.id)
    expect(data?.project).toMatchObject({ name: 'Rollout', status: 'green', statusRationale: '' })
    expect(data?.milestones).toEqual([])
    expect(data?.items).toEqual([])
  })

  it('names the file by date', () => {
    expect(getBackupFileName(new Date(2026, 9, 21))).toBe('pm-console-backup-2026-10-21.json')
  })

  it('rejects invalid JSON, other files, damaged data and newer versions', () => {
    expect(parseBackup('{oops', STORE_VERSION)).toEqual({ ok: false, error: 'This file is not valid JSON.' })
    expect(parseBackup('{"hello":1}', STORE_VERSION)).toEqual({
      ok: false,
      error: 'This is not a PM Console backup file.',
    })

    const workspace = sampleWorkspace()
    const backup = createBackup(workspace, STORE_VERSION, new Date())
    const damaged = structuredClone(backup)
    const first = Object.values(damaged.workspace.library)[0]?.members[0]
    if (first) first.defaultLoadPct = 500
    const result = parseBackup(JSON.stringify(damaged), STORE_VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toMatch(
        /damaged or incomplete \(workspace\.library\..+\.members\.0\.defaultLoadPct/,
      )

    expect(
      parseBackup(JSON.stringify({ ...backup, version: STORE_VERSION + 1 }), STORE_VERSION),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version/),
    })
  })

  it('pickData returns only project data', () => {
    expect(Object.keys(pickData(useAppStore.getState())).sort()).toEqual([
      'baselines',
      'items',
      'members',
      'milestones',
      'phases',
      'project',
      'selectedBaselineId',
    ])
  })
})
