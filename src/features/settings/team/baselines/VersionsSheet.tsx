import { useState } from 'react'
import { Check, Eye, GitBranch, GitCompare, History, Lock, RotateCcw, Target, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompareView } from '@/features/settings/team/baselines/CompareView'
import { sortBaselinesNewestFirst } from '@/lib/baseline'
import { formatCurrency, formatNumber, formatPercent, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { ForecastBaseline } from '@/store/types'

interface VersionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewingId: string | null
  onView: (baselineId: string | null) => void
}

export function VersionsSheet({ open, onOpenChange, viewingId, onView }: VersionsSheetProps) {
  const baselines = useAppStore((state) => state.baselines)
  const [tab, setTab] = useState('versions')
  const ordered = sortBaselinesNewestFirst(baselines)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted" aria-hidden />
            Versions
          </SheetTitle>
          <SheetDescription>
            Baselines are locked snapshots of the forecast. View, compare or restore them, and choose the one
            used in Forecast vs Actual.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
          <TabsList className="h-auto self-start rounded-full">
            <TabsTrigger value="versions" className="gap-2 rounded-full px-4 py-1.5">
              <GitBranch className="h-4 w-4" aria-hidden />
              Baselines
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-2 rounded-full px-4 py-1.5">
              <GitCompare className="h-4 w-4" aria-hidden />
              Compare
            </TabsTrigger>
          </TabsList>
          <TabsContent value="versions" className="mt-0">
            {ordered.length === 0 ? (
              <EmptyState
                icon={GitBranch}
                title="No baselines yet"
                hint="Use Create baseline to save a locked snapshot of the forecast."
              />
            ) : (
              <ul className="flex flex-col gap-3" aria-label="Baselines, newest first">
                {ordered.map((baseline) => (
                  <BaselineItem
                    key={baseline.id}
                    baseline={baseline}
                    viewing={viewingId === baseline.id}
                    onView={onView}
                  />
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="compare" className="mt-0">
            <CompareView />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function BaselineItem({
  baseline,
  viewing,
  onView,
}: {
  baseline: ForecastBaseline
  viewing: boolean
  onView: (baselineId: string | null) => void
}) {
  const selectedId = useAppStore((state) => state.selectedBaselineId)
  const currency = useAppStore((state) => state.project.currency)
  const selectBaseline = useAppStore((state) => state.selectBaseline)
  const restoreBaseline = useAppStore((state) => state.restoreBaseline)
  const deleteBaseline = useAppStore((state) => state.deleteBaseline)
  const selected = selectedId === baseline.id
  const { totals } = baseline

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4',
        selected && 'border-primary/40 bg-primary/5',
      )}
      aria-label={baseline.name}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-base font-medium">
            <Lock className="h-4 w-4 shrink-0 text-muted" aria-label="Locked" />
            <span className="truncate">{baseline.name}</span>
          </h3>
          <p className="text-xs text-muted">Created {formatTimestamp(baseline.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {selected && (
            <Badge className="gap-1">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Used for Forecast vs Actual
            </Badge>
          )}
          {viewing && (
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Viewing
            </Badge>
          )}
        </div>
      </div>

      {baseline.description && <p className="text-sm">{baseline.description}</p>}

      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-subtle px-3 py-2">
        <div>
          <dt className="text-xs text-muted">Hours</dt>
          <dd className="text-sm font-medium tabular-nums">{formatNumber(totals.hours)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Cost</dt>
          <dd className="text-sm font-medium tabular-nums">{formatCurrency(totals.cost, currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Margin %</dt>
          <dd className="text-sm font-medium tabular-nums">
            {totals.revenue > 0 ? formatPercent(totals.marginPct) : '—'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          size="sm"
          variant="outline"
          icon={Eye}
          tooltip="Open a read-only view of this baseline's roster and weekly grid"
          onClick={() => onView(baseline.id)}
        >
          View
        </ActionButton>
        <ActionButton
          size="sm"
          variant="outline"
          icon={Target}
          tooltip={selected ? 'Already used for Forecast vs Actual' : 'Compare actuals against this baseline'}
          aria-pressed={selected}
          onClick={() => {
            if (selected) return
            selectBaseline(baseline.id)
            toast.success(`“${baseline.name}” is now used for Forecast vs Actual`)
          }}
        >
          Use for Forecast vs Actual
        </ActionButton>
        <div className="ml-auto flex items-center gap-1">
          <ConfirmDialog
            title={`Restore “${baseline.name}”?`}
            description="This overwrites the current project settings, phases and team with this baseline. Changes since then are lost unless you save a baseline first. The baseline itself is kept."
            confirmLabel="Restore"
            confirmIcon={RotateCcw}
            onConfirm={() => {
              restoreBaseline(baseline.id)
              onView(null)
              toast.success(`Working forecast restored from “${baseline.name}”`)
            }}
            trigger={
              <IconButton
                icon={RotateCcw}
                label={`Restore ${baseline.name} to working forecast`}
                tooltip="Restore to working forecast (overwrites current phases and team)"
              />
            }
          />
          {selected ? (
            <IconButton
              icon={Trash2}
              label={`Delete ${baseline.name}`}
              tooltip="Used for Forecast vs Actual: choose another baseline before deleting this one"
              aria-disabled
              className="cursor-not-allowed opacity-50"
              onClick={() =>
                toast.info('Choose another baseline for Forecast vs Actual before deleting this one.')
              }
            />
          ) : (
            <ConfirmDialog
              title={`Delete “${baseline.name}”?`}
              description="The locked snapshot is removed permanently. The working forecast is not affected."
              onConfirm={() => {
                if (deleteBaseline(baseline.id)) {
                  if (viewing) onView(null)
                  toast.success(`Baseline “${baseline.name}” deleted`)
                }
              }}
              trigger={
                <IconButton icon={Trash2} label={`Delete ${baseline.name}`} tooltip="Delete this baseline" />
              }
            />
          )}
        </div>
      </div>
    </li>
  )
}
