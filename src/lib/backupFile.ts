import { format } from 'date-fns'
import type { AppData } from '@/store/useAppStore'

export const BACKUP_FORMAT = 'pm-console-backup'

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: AppData
}

export function createBackup(data: AppData, version: number, now: Date): Backup {
  const { project, phases, members, baselines, selectedBaselineId } = data
  return {
    format: BACKUP_FORMAT,
    version,
    exportedAt: now.toISOString(),
    data: { project, phases, members, baselines, selectedBaselineId },
  }
}

export function getBackupFileName(now: Date): string {
  return `pm-console-backup-${format(now, 'yyyy-MM-dd')}.json`
}
