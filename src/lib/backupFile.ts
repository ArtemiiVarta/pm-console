import { format } from 'date-fns'
import type { Workspace } from '@/store/useAppStore'

export const BACKUP_FORMAT = 'pm-console-backup'

/** A backup file and the GitHub sync document share this shape: every project. */
export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  workspace: Workspace
}

export function createBackup(workspace: Workspace, version: number, now: Date): Backup {
  return {
    format: BACKUP_FORMAT,
    version,
    exportedAt: now.toISOString(),
    workspace: { library: workspace.library, activeProjectId: workspace.activeProjectId },
  }
}

export function getBackupFileName(now: Date): string {
  return `pm-console-backup-${format(now, 'yyyy-MM-dd')}.json`
}

/** Number of projects in a backup, for confirmations. */
export function countProjects(backup: Backup): number {
  return Object.keys(backup.workspace.library).length
}
