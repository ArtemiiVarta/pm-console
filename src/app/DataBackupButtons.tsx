import { useRef, useState, type ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconButton } from '@/components/IconButton'
import { usePendingAllocation } from '@/features/settings/team/assignment/usePendingAllocation'
import { countProjects, createBackup, getBackupFileName, type Backup } from '@/lib/backupFile'
import { formatTimestamp } from '@/lib/format'
import { STORE_VERSION, useAppStore } from '@/store/useAppStore'

/** Data lives only in this browser, so the top bar offers a JSON backup and restore. */
export function DataBackupButtons() {
  const replaceWorkspace = useAppStore((state) => state.replaceWorkspace)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ backup: Backup; fileName: string } | null>(null)

  const exportData = () => {
    const now = new Date()
    const backup = createBackup(useAppStore.getState(), STORE_VERSION, now)
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = getBackupFileName(now)
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Backup downloaded', { description: link.download })
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again still triggers a change.
    event.target.value = ''
    if (!file) return
    // Validation (zod) is loaded on demand to keep the first bundle small.
    const { parseBackup } = await import('@/lib/backup')
    const parsed = parseBackup(await file.text(), STORE_VERSION)
    if (!parsed.ok) {
      toast.error('Could not import the backup', { description: parsed.error })
      return
    }
    setPending({ backup: parsed.backup, fileName: file.name })
  }

  const summary = pending
    ? `“${pending.fileName}” from ${formatTimestamp(pending.backup.exportedAt)}: ${countProjects(pending.backup)} project${countProjects(pending.backup) === 1 ? '' : 's'} (${Object.values(
        pending.backup.workspace.library,
      )
        .map((data) => data.project.name || 'Untitled project')
        .join(', ')}).`
    : ''

  return (
    <>
      <IconButton
        icon={Download}
        label="Export data"
        tooltip="Download all projects as a backup file"
        onClick={exportData}
      />
      <IconButton
        icon={Upload}
        label="Import data"
        tooltip="Restore data from a backup file"
        onClick={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        data-testid="backup-file-input"
        onChange={(event) => void onFile(event)}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Replace all data with this backup?"
        description={`${summary} Every project currently in this browser — settings, schedule, team, planned allocation and baselines — will be overwritten. Export first if you want to keep it.`}
        confirmLabel="Replace all data"
        confirmIcon={Upload}
        onConfirm={() => {
          if (!pending) return
          replaceWorkspace(pending.backup.workspace)
          // Unsaved grid edits belonged to the data that was just replaced.
          usePendingAllocation.getState().discard()
          toast.success('Backup restored')
        }}
      />
    </>
  )
}
