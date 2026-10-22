import { parseBackup } from '@/lib/backup'
import { createBackup, getBackupFileName } from '@/lib/backupFile'
import { createInitialData, useAppStore, type AppData } from '@/store/useAppStore'

function sampleData(): AppData {
  useAppStore.setState(createInitialData())
  const store = useAppStore.getState()
  store.updateProject({ name: 'Rollout', currency: 'EUR' })
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
  return useAppStore.getState()
}

describe('backup', () => {
  it('round-trips all data through JSON', () => {
    const data = sampleData()
    const backup = createBackup(data, 1, new Date('2026-10-21T12:00:00Z'))
    const parsed = parseBackup(JSON.stringify(backup), 1)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const { project, phases, milestones, members, baselines, selectedBaselineId } = data
    expect(parsed.backup.data).toEqual({
      project,
      phases,
      milestones,
      members,
      baselines,
      selectedBaselineId,
    })
    expect(parsed.backup.exportedAt).toBe('2026-10-21T12:00:00.000Z')
  })

  it('exports data only, never store actions', () => {
    const backup = createBackup(sampleData(), 1, new Date())
    expect(Object.keys(backup.data).sort()).toEqual([
      'baselines',
      'members',
      'milestones',
      'phases',
      'project',
      'selectedBaselineId',
    ])
  })

  it('accepts version 1 backups, which have no milestones', () => {
    const backup = createBackup(sampleData(), 1, new Date()) as unknown as { data: Record<string, unknown> }
    delete backup.data.milestones
    const parsed = parseBackup(JSON.stringify(backup), 2)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.backup.data.milestones).toEqual([])
  })

  it('names the file by date', () => {
    expect(getBackupFileName(new Date(2026, 9, 21))).toBe('pm-console-backup-2026-10-21.json')
  })

  it('rejects invalid JSON, other files, damaged data and newer versions', () => {
    expect(parseBackup('{oops', 1)).toEqual({ ok: false, error: 'This file is not valid JSON.' })
    expect(parseBackup('{"hello":1}', 1)).toEqual({
      ok: false,
      error: 'This is not a PM Console backup file.',
    })

    const backup = createBackup(sampleData(), 1, new Date())
    const damaged = structuredClone(backup) as unknown as { data: { members: { defaultLoadPct: number }[] } }
    const first = damaged.data.members[0]
    if (first) first.defaultLoadPct = 500
    const result = parseBackup(JSON.stringify(damaged), 1)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/damaged or incomplete \(data\.members\.0\.defaultLoadPct/)

    expect(parseBackup(JSON.stringify({ ...backup, version: 2 }), 1)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version/),
    })
  })
})
