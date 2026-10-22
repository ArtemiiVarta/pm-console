import { useRef, useState, type ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconButton } from '@/components/IconButton'
import { createBackup, getBackupFileName, type Backup } from '@/lib/backupFile'
import { formatTimestamp } from '@/lib/format'
import { STORE_VERSION, useAppStore } from '@/store/useAppStore'

/** Data lives only in this browser, so the top bar offers a JSON backup and restore. */
export function DataBackupButtons() {
  const replaceData = useAppStore((state) => state.replaceData)
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
    ? `“${pending.fileName}” from ${formatTimestamp(pending.backup.exportedAt)}: project “${pending.backup.data.project.name || 'Untitled project'}”, ${pending.backup.data.phases.length} phases, ${pending.backup.data.members.length} team members, ${pending.backup.data.baselines.length} baselines.`
    : ''

  return (
    <>
      <IconButton
        icon={Download}
        label="Export data"
        tooltip="Download all data as a backup file"
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
        description={`${summary} Everything currently in this browser — project, phases, team, weekly assignments and baselines — will be overwritten. Export first if you want to keep it.`}
        confirmLabel="Replace all data"
        confirmIcon={Upload}
        onConfirm={() => {
          if (!pending) return
          replaceData(pending.backup.data)
          toast.success('Backup restored')
        }}
      />
    </>
  )
}
