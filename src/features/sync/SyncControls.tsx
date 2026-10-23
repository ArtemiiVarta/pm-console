import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Cloud,
  CloudAlert,
  CloudCheck,
  CloudOff,
  HardDrive,
  RefreshCw,
  X,
  type LucideIcon,
} from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import { IconButton } from '@/components/IconButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/useAuth'
import { pullNow, resolveConflict, startSync, useSync, type SyncStatus } from '@/features/sync/sync'
import { countProjects } from '@/lib/backupFile'
import { dataPath } from '@/lib/env'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

const STATUS: Record<SyncStatus, { icon: LucideIcon; label: string }> = {
  off: { icon: CloudOff, label: 'Not synced (signed out)' },
  loading: { icon: RefreshCw, label: 'Checking GitHub…' },
  saving: { icon: RefreshCw, label: 'Saving to GitHub…' },
  saved: { icon: CloudCheck, label: 'Saved to GitHub' },
  error: { icon: CloudAlert, label: 'GitHub sync problem' },
  conflict: { icon: AlertTriangle, label: 'Changes on another computer: choose a version' },
}

/** Runs sync while someone is signed in; restarts when the signed-in person changes. */
export function SyncController() {
  const email = useAuth((state) => state.session?.user.email ?? null)
  useEffect(() => startSync(), [email])
  return null
}

/** Top-bar status icon; opens the sync dialog (or the conflict choice). */
export function SyncButton() {
  const status = useSync((state) => state.status)
  const lastSyncedAt = useSync((state) => state.lastSyncedAt)
  const [open, setOpen] = useState(false)
  const { icon, label } = STATUS[status]
  const when =
    status === 'saved' && lastSyncedAt
      ? ` · ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
      : ''

  return (
    <>
      <IconButton
        icon={icon}
        label={label}
        tooltip={`${label}${when}. Click for details`}
        onClick={() => setOpen(true)}
        className={cn(
          (status === 'loading' || status === 'saving') && '[&_svg]:animate-spin',
          status === 'error' && 'text-danger',
          status === 'conflict' && 'text-warning',
          status === 'saved' && 'text-success',
        )}
      />
      <SyncDialog open={open} onOpenChange={setOpen} />
      <ConflictDialog />
    </>
  )
}

function SyncDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const status = useSync((state) => state.status)
  const message = useSync((state) => state.message)
  const lastSyncedAt = useSync((state) => state.lastSyncedAt)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>GitHub sync</DialogTitle>
          <DialogDescription>
            Every project is saved to the private GitHub repository, so everyone signed in sees the same
            projects on any computer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Cloud className="h-4 w-4 text-muted" aria-hidden />
              pm-console-data · {dataPath()}
            </p>
            <p className="mt-1 text-xs text-muted">
              {STATUS[status].label}
              {lastSyncedAt ? ` · last synced ${formatTimestamp(lastSyncedAt)}` : ''}
            </p>
            {message && <p className="mt-2 text-xs text-danger">{message}</p>}
          </div>
          <p className="text-xs text-muted">
            Changes save automatically right after you make them and when you leave the page. Changes made
            elsewhere appear within 15 seconds.
          </p>
          <DialogFooter>
            <ActionButton
              icon={RefreshCw}
              tooltip="Check GitHub for changes now and save anything unsaved"
              onClick={() => void pullNow()}
            >
              Sync now
            </ActionButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Shown when this computer and GitHub both changed since the last sync. */
function ConflictDialog() {
  const conflict = useSync((state) => state.conflict)
  const library = useAppStore((state) => state.library)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const open = conflict !== null && dismissed !== conflict.remoteSha
  const localNames = Object.values(library).map((data) => data.project.name || 'Untitled project')
  const remoteNames = conflict
    ? Object.values(conflict.remote.workspace.library).map((data) => data.project.name || 'Untitled project')
    : []

  return (
    <Dialog open={open} onOpenChange={(next) => !next && conflict && setDismissed(conflict.remoteSha)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Projects changed on another computer</DialogTitle>
          <DialogDescription>
            GitHub has a newer version than this computer last saw, and this computer has unsaved changes.
            Choose which version to keep; the other is replaced.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <HardDrive className="h-4 w-4 text-muted" aria-hidden />
              This computer
            </p>
            <p className="mt-1 text-xs text-muted">
              {localNames.length} project{localNames.length === 1 ? '' : 's'}: {localNames.join(', ')}
            </p>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Cloud className="h-4 w-4 text-muted" aria-hidden />
              GitHub
            </p>
            <p className="mt-1 text-xs text-muted">
              {conflict
                ? `${countProjects(conflict.remote)} project${countProjects(conflict.remote) === 1 ? '' : 's'}, saved ${formatTimestamp(conflict.remote.exportedAt)}: `
                : ''}
              {remoteNames.join(', ')}
            </p>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <ActionButton
            variant="outline"
            icon={X}
            tooltip="Decide later; saving to GitHub stays paused"
            onClick={() => conflict && setDismissed(conflict.remoteSha)}
          >
            Later
          </ActionButton>
          <ActionButton
            variant="outline"
            icon={Cloud}
            tooltip="Replace this computer's projects with GitHub's"
            onClick={() => void resolveConflict('remote')}
          >
            Use GitHub's
          </ActionButton>
          <ActionButton
            icon={HardDrive}
            tooltip="Overwrite GitHub with this computer's projects"
            onClick={() => void resolveConflict('local')}
          >
            Keep this computer's
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
