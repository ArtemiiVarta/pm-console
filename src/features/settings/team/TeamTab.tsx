import { useMemo } from 'react'
import { BadgeDollarSign, Clock, Cpu, GitBranch, Info, Percent, Receipt, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatTile } from '@/components/StatTile'
import { AssignmentSection } from '@/features/settings/team/assignment/AssignmentSection'
import { RosterSection } from '@/features/settings/team/RosterSection'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { getForecastSummary, getMarginTone, type ForecastSummary } from '@/lib/summary'
import { useAppStore } from '@/store/useAppStore'
import type { Currency } from '@/store/types'

export function TeamTab() {
  const project = useAppStore((state) => state.project)
  const phases = useAppStore((state) => state.phases)
  const members = useAppStore((state) => state.members)
  const summary = useMemo(() => getForecastSummary({ project, phases, members }), [project, phases, members])

  return (
    <>
      {/* Slot for the baseline bar (versions), built in a later step. */}
      <div
        data-testid="baseline-bar-slot"
        className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs text-muted"
      >
        <GitBranch className="h-4 w-4" aria-hidden />
        Forecast baselines (saved versions) will appear here.
      </div>

      {phases.length === 0 && <NoPhasesNotice />}

      <TeamStats summary={summary} currency={project.currency} />
      <RosterSection />
      <AssignmentSection />
    </>
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
        Add phases to set the project duration — weekly assignments depend on it.{' '}
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
  const { totals, weeks } = summary
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
        hint={`Over ${weeks.length} week${weeks.length === 1 ? '' : 's'}, active members`}
      />
      <StatTile
        icon={Cpu}
        label="Development capacity"
        value={`${formatNumber(totals.capacityHours)} h`}
        hint="Hours × capacity %"
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
