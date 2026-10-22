import { BarChart3, Construction, GitBranch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { SectionCard } from '@/components/SectionCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sortBaselinesNewestFirst } from '@/lib/baseline'
import { formatTimestampDate } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'

export function ForecastVsActualPage() {
  const baselines = useAppStore((state) => state.baselines)
  const selectedBaselineId = useAppStore((state) => state.selectedBaselineId)
  const selectBaseline = useAppStore((state) => state.selectBaseline)
  const ordered = sortBaselinesNewestFirst(baselines)

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Forecast vs Actual"
        description="Compare a forecast baseline with actuals."
      />
      <SectionCard
        icon={GitBranch}
        title="Baseline"
        description="The locked forecast that actuals are compared against."
      >
        {ordered.length === 0 ? (
          <p className="text-sm text-muted">
            No baselines yet.{' '}
            <Link
              to="/settings/team"
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Create one in Team Forecast
            </Link>
          </p>
        ) : (
          <div className="flex max-w-md flex-col gap-1.5">
            <label id="fva-baseline-label" className="text-sm font-medium">
              Compare against
            </label>
            <Select value={selectedBaselineId ?? undefined} onValueChange={selectBaseline}>
              <SelectTrigger aria-labelledby="fva-baseline-label">
                <SelectValue placeholder="Choose a baseline" />
              </SelectTrigger>
              <SelectContent>
                {ordered.map((baseline) => (
                  <SelectItem key={baseline.id} value={baseline.id}>
                    {baseline.name} · {formatTimestampDate(baseline.createdAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SectionCard>
      <EmptyState
        icon={Construction}
        title="Coming soon"
        hint="Weekly actuals against the selected baseline will appear here."
      />
    </>
  )
}
