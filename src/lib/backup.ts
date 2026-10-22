import { z } from 'zod'
import { BACKUP_FORMAT, type Backup } from '@/lib/backupFile'

const isoDate = z.iso.date()

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  client: z.string(),
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']),
  standardHoursPerWeek: z.number().min(1).max(80),
  durationMode: z.enum(['working', 'calendar']),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const phaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  startDate: isoDate,
  duration: z.number().positive(),
  durationUnit: z.enum(['days', 'weeks']),
  endDate: isoDate.optional(),
  fitStart: z.boolean().optional(),
  fitEnd: z.boolean().optional(),
  notes: z.string().optional(),
})

const memberSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: z.string(),
  defaultLoadPct: z.number().min(0).max(200),
  weeklyOverrides: z.record(isoDate, z.number().min(0).max(200)),
  capacityPct: z.number().min(0).max(100),
  startDate: isoDate.optional(),
  costRate: z.number().min(0),
  priceRate: z.number().min(0),
  active: z.boolean(),
})

const snapshotSchema = z.object({
  project: projectSchema,
  phases: z.array(phaseSchema),
  members: z.array(memberSchema),
})

const baselineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  isLocked: z.literal(true),
  snapshot: snapshotSchema,
  totals: z.object({
    hours: z.number(),
    cost: z.number(),
    revenue: z.number(),
    margin: z.number(),
    marginPct: z.number(),
  }),
})

const milestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: isoDate,
  color: z.string(),
})

const itemSchema = z.object({
  id: z.string(),
  parentId: z.string(),
  kind: z.enum(['task', 'milestone']),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  startDate: isoDate,
  duration: z.number().positive(),
  durationUnit: z.enum(['days', 'weeks']),
  endDate: isoDate.optional(),
  fitStart: z.boolean().optional(),
  fitEnd: z.boolean().optional(),
})

const appDataSchema = z.object({
  project: projectSchema,
  phases: z.array(phaseSchema),
  // Backups from versions 1–2 have no tasks.
  items: z.array(itemSchema).default([]),
  // Backups from version 1 have no milestones.
  milestones: z.array(milestoneSchema).default([]),
  members: z.array(memberSchema),
  baselines: z.array(baselineSchema),
  selectedBaselineId: z.string().nullable(),
})

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  data: appDataSchema,
})

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string }

/** Reads a backup file's text (zod lives here, so this module is loaded only when importing). Rejects anything that is not a complete, valid backup. */
export function parseBackup(text: string, currentVersion: number): ParsedBackup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  const marker = (json as { format?: unknown } | null)?.format
  if (marker !== BACKUP_FORMAT) {
    return { ok: false, error: 'This is not a PM Console backup file.' }
  }
  const result = backupSchema.safeParse(json)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue?.path.join('.') || 'file'
    return {
      ok: false,
      error: `The backup is damaged or incomplete (${where}: ${issue?.message ?? 'invalid'}).`,
    }
  }
  if (result.data.version > currentVersion) {
    return {
      ok: false,
      error: 'This backup was made by a newer version of PM Console. Reload the app and try again.',
    }
  }
  return { ok: true, backup: result.data as Backup }
}
