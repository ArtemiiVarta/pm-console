import { useMemo, useState } from 'react'
import { CircleDot, GitBranch, History, Lock, Pencil } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import { Badge } from '@/components/ui/badge'
import { CreateBaselineDialog } from '@/features/settings/team/baselines/CreateBaselineDialog'
import { VersionsSheet } from '@/features/settings/team/baselines/VersionsSheet'
import { hasChangesSince, sortBaselinesNewestFirst } from '@/lib/baseline'
import { formatTimestampDate } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'
import type { ForecastBaseline } from '@/store/types'

interface BaselineBarProps {
  viewing: ForecastBaseline | null
  onView: (baselineId: string | null) => void
}

/** Top of Team Forecast: working vs baseline status, Create baseline and Versions. */
export function BaselineBar({ viewing, onView }: BaselineBarProps) {
  const project = useAppStore((state) => state.project)
  const phases = useAppStore((state) => state.phases)
  const members = useAppStore((state) => state.members)
  const baselines = useAppStore((state) => state.baselines)
  const [createOpen, setCreateOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)

  const latest = useMemo(() => sortBaselinesNewestFirst(baselines)[0] ?? null, [baselines])
  const changed = useMemo(
    () => (latest ? hasChangesSince({ project, phases, members }, latest) : false),
    [latest, project, phases, members],
  )

  return (
    <div
      role="region"
      aria-label="Forecast versions"
      className="flex flex-wrap items-center gap-3 rounded-xl border bg-surface px-4 py-3 shadow-sm"
    >
      {viewing ? (
        <Badge variant="outline" className="gap-1 border-primary/40 py-1 text-primary">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Baseline: {viewing.name}
        </Badge>
      ) : (
        <Badge className="gap-1 py-1">
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Working forecast
        </Badge>
      )}

      {latest ? (
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <GitBranch className="h-4 w-4" aria-hidden />
          Latest baseline: <span className="font-medium text-foreground">{latest.name}</span> ·{' '}
          {formatTimestampDate(latest.createdAt)}
        </span>
      ) : (
        <span className="text-sm text-muted">No baselines yet</span>
      )}

      {changed && (
        <Badge variant="outline" className="gap-1 border-warning/40 bg-warning/10 py-1 text-warning">
          <CircleDot className="h-3.5 w-3.5" aria-hidden />
          Changed since last baseline
        </Badge>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ActionButton
          variant="outline"
          icon={History}
          tooltip="View and compare saved baselines"
          onClick={() => setVersionsOpen(true)}
        >
          Versions{baselines.length > 0 ? ` (${baselines.length})` : ''}
        </ActionButton>
        <ActionButton
          icon={GitBranch}
          tooltip="Save a locked snapshot of the current forecast for Forecast vs Actual comparison"
          onClick={() => setCreateOpen(true)}
        >
          Create baseline
        </ActionButton>
      </div>

      <CreateBaselineDialog open={createOpen} onOpenChange={setCreateOpen} />
      <VersionsSheet
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        viewingId={viewing?.id ?? null}
        onView={(id) => {
          onView(id)
          setVersionsOpen(false)
        }}
      />
    </div>
  )
}
