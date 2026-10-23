import { useEffect, useState, type FormEvent } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Cloud,
  CloudAlert,
  CloudCheck,
  CloudOff,
  ExternalLink,
  HardDrive,
  KeyRound,
  Plug,
  RefreshCw,
  Unplug,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { FormField } from '@/components/FormField'
import { IconButton } from '@/components/IconButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  forgetSyncMemory,
  pullNow,
  resolveConflict,
  restartSync,
  startSync,
  useSync,
  type SyncStatus,
} from '@/features/sync/sync'
import { countProjects } from '@/lib/backupFile'
import { formatTimestamp } from '@/lib/format'
import {
  checkRepository,
  clearGitHubSettings,
  DEFAULT_GITHUB_SETTINGS,
  loadGitHubSettings,
  saveGitHubSettings,
} from '@/lib/githubSync'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

const STATUS: Record<SyncStatus, { icon: LucideIcon; label: string }> = {
  off: { icon: CloudOff, label: 'Not synced to GitHub (this browser only)' },
  loading: { icon: RefreshCw, label: 'Checking GitHub…' },
  saving: { icon: RefreshCw, label: 'Saving to GitHub…' },
  saved: { icon: CloudCheck, label: 'Saved to GitHub' },
  error: { icon: CloudAlert, label: 'GitHub sync problem' },
  conflict: { icon: AlertTriangle, label: 'Changes on another computer: choose a version' },
}

/** Runs sync for the signed-in app; restarts when this device connects or disconnects. */
export function SyncController() {
  const session = useSync((state) => state.session)
  useEffect(() => startSync(), [session])
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
        tooltip={`${label}${when}. Click for GitHub sync settings`}
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
  const settings = open ? loadGitHubSettings() : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>GitHub sync</DialogTitle>
          <DialogDescription>
            Saves every project to a private GitHub repository, so the same projects appear on any computer
            connected to it.
          </DialogDescription>
        </DialogHeader>
        {settings ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Cloud className="h-4 w-4 text-muted" aria-hidden />
                {settings.owner}/{settings.repo} · {settings.path}
              </p>
              <p className="mt-1 text-xs text-muted">
                {STATUS[status].label}
                {lastSyncedAt ? ` · last synced ${formatTimestamp(lastSyncedAt)}` : ''}
              </p>
              {message && <p className="mt-2 text-xs text-danger">{message}</p>}
            </div>
            <p className="text-xs text-muted">
              Changes save automatically a few seconds after you make them. Other computers pick them up when
              their tab is opened or focused, and every minute.
            </p>
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <ActionButton
                variant="outline"
                icon={Unplug}
                tooltip="Stop syncing on this computer and remove its token (projects stay here and on GitHub)"
                onClick={() => {
                  clearGitHubSettings()
                  forgetSyncMemory()
                  restartSync()
                  toast.success('This computer is no longer synced')
                  onOpenChange(false)
                }}
              >
                Disconnect
              </ActionButton>
              <ActionButton
                icon={RefreshCw}
                tooltip="Check GitHub for changes now and save anything unsaved"
                onClick={() => void pullNow()}
              >
                Sync now
              </ActionButton>
            </DialogFooter>
          </div>
        ) : (
          <ConnectForm onConnected={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ConnectForm({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = useState('')
  const [owner, setOwner] = useState(DEFAULT_GITHUB_SETTINGS.owner)
  const [repo, setRepo] = useState(DEFAULT_GITHUB_SETTINGS.repo)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const connect = async (event: FormEvent) => {
    event.preventDefault()
    if (!token.trim()) return setError('Paste a GitHub token')
    const settings = {
      ...DEFAULT_GITHUB_SETTINGS,
      owner: owner.trim(),
      repo: repo.trim(),
      token: token.trim(),
    }
    setChecking(true)
    setError(null)
    try {
      const repository = await checkRepository(settings)
      saveGitHubSettings(settings)
      if (!repository.private) {
        toast.warning('This repository is public: anyone can read your project data.')
      }
      restartSync()
      toast.success('Connected to GitHub', { description: 'Projects now sync automatically.' })
      onConnected()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not connect.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <form onSubmit={(event) => void connect(event)} noValidate className="flex flex-col gap-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>
          Open{' '}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            GitHub › New fine-grained token
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          .
        </li>
        <li>
          Repository access: <strong>Only select repositories</strong> ›{' '}
          <strong>{repo || 'pm-console-data'}</strong>.
        </li>
        <li>
          Permissions › Repository › <strong>Contents: Read and write</strong>. Nothing else.
        </li>
        <li>Generate the token and paste it below. It is stored only in this browser.</li>
      </ol>
      <FormField id="github-token" label="GitHub token" required error={error ?? undefined}>
        <Input
          id="github-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="github_pat_…"
          value={token}
          onChange={(event) => {
            setToken(event.target.value)
            setError(null)
          }}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="github-owner" label="Owner">
          <Input id="github-owner" value={owner} onChange={(event) => setOwner(event.target.value)} />
        </FormField>
        <FormField id="github-repo" label="Repository">
          <Input id="github-repo" value={repo} onChange={(event) => setRepo(event.target.value)} />
        </FormField>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Anyone using this browser profile can use the token. Give it access to the data repository only, and
        disconnect on shared computers.
      </p>
      <DialogFooter>
        <ActionButton
          type="submit"
          icon={Plug}
          tooltip="Check the token and start syncing"
          disabled={checking}
        >
          {checking ? 'Connecting…' : 'Connect'}
        </ActionButton>
      </DialogFooter>
    </form>
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
