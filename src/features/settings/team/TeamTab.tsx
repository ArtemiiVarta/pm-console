import { useMemo, useState } from 'react'
import { ArrowLeft, BadgeDollarSign, Clock, Cpu, Eye, Info, Percent, Receipt, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActionButton } from '@/components/ActionButton'
import { StatTile } from '@/components/StatTile'
import { AssignmentSection } from '@/features/settings/team/assignment/AssignmentSection'
import { BaselineBar } from '@/features/settings/team/baselines/BaselineBar'
import { useForecastSource, ViewedBaselineContext } from '@/features/settings/team/forecastSource'
import { RosterSection } from '@/features/settings/team/RosterSection'
import { formatCurrency, formatNumber, formatPercent, formatTimestamp } from '@/lib/format'
import { WORKING_DAYS_PER_WEEK } from '@/lib/schedule'
import { getForecastSummary, getMarginTone, type ForecastSummary } from '@/lib/summary'
import { useAppStore } from '@/store/useAppStore'
import type { Currency, ForecastBaseline } from '@/store/types'

export function TeamTab() {
  const baselines = useAppStore((state) => state.baselines)
  const [viewingId, setViewingId] = useState<string | null>(null)
  // A deleted baseline simply drops back to the working forecast.
  const viewing = baselines.find((baseline) => baseline.id === viewingId) ?? null

  return (
    <>
      <BaselineBar viewing={viewing} onView={setViewingId} />
      <ViewedBaselineContext.Provider value={viewing}>
        {viewing && <ViewingBanner baseline={viewing} onBack={() => setViewingId(null)} />}
        <ForecastBody />
      </ViewedBaselineContext.Provider>
    </>
  )
}

function ForecastBody() {
  const { project, phases, members, readOnly } = useForecastSource()
  const summary = useMemo(() => getForecastSummary({ project, phases, members }), [project, phases, members])

  return (
    <>
      {phases.length === 0 && !readOnly && <NoPhasesNotice />}
      <TeamStats summary={summary} currency={project.currency} />
      <RosterSection />
      <AssignmentSection />
    </>
  )
}

function ViewingBanner({ baseline, onBack }: { baseline: ForecastBaseline; onBack: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3"
    >
      <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="text-sm">
        <span className="font-medium">Viewing baseline {baseline.name} — read only</span>
        <span className="text-muted"> · saved {formatTimestamp(baseline.createdAt)}</span>
      </p>
      <ActionButton
        size="sm"
        variant="outline"
        icon={ArrowLeft}
        tooltip="Leave the baseline and edit the live forecast again"
        onClick={onBack}
        className="ml-auto"
      >
        Back to working forecast
      </ActionButton>
    </div>
  )
}

function NoPhasesNotice() {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p>
        Add phases to set the project duration — the planned allocation depends on it.{' '}
        <Link
          to="/settings/schedule"
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Go to Project Schedule
        </Link>
      </p>
    </div>
  )
}

function TeamStats({ summary, currency }: { summary: ForecastSummary; currency: Currency }) {
  const { totals, workingDays } = summary
  const hasRevenue = totals.revenue > 0
  const tone = hasRevenue ? getMarginTone(totals.marginPct) : 'default'
  const toneHint =
    tone === 'success'
      ? 'On target (≥ 25%)'
      : tone === 'warning'
        ? 'Below target (10–25%)'
        : tone === 'danger'
          ? 'Low (< 10%)'
          : 'No forecast revenue yet'
  const money = (value: number) => formatCurrency(value, currency)

  return (
    <section
      aria-label="Forecast totals"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <StatTile
        icon={Clock}
        label="Total forecast hours"
        value={formatNumber(totals.hours)}
        hint={`Over ${formatNumber(workingDays / WORKING_DAYS_PER_WEEK, 1)} week${workingDays === WORKING_DAYS_PER_WEEK ? '' : 's'}, active members`}
      />
      <StatTile
        icon={Cpu}
        label="Developer capacity"
        value={`${formatNumber(totals.capacityHours)} h`}
        hint="Planned hours × developer capacity %"
      />
      <StatTile icon={Receipt} label="Total cost" value={money(totals.cost)} hint="Hours × cost rate" />
      <StatTile
        icon={BadgeDollarSign}
        label="Total revenue"
        value={money(totals.revenue)}
        hint="Hours × price rate"
      />
      <StatTile icon={Wallet} label="Margin" value={money(totals.margin)} hint={toneHint} tone={tone} />
      <StatTile
        icon={Percent}
        label="Margin %"
        value={hasRevenue ? formatPercent(totals.marginPct) : '—'}
        hint={toneHint}
        tone={tone}
      />
    </section>
  )
}
