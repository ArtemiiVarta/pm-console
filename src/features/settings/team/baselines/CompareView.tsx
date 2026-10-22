import { useMemo, useState } from 'react'
import { ArrowRight, GitCompare, Minus, Triangle } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  compareForecasts,
  sortBaselinesNewestFirst,
  type ComparisonValues,
  type ForecastComparison,
} from '@/lib/baseline'
import { formatCurrency, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { Currency, ForecastSnapshot } from '@/store/types'

const WORKING = 'working'

type Metric = keyof ComparisonValues

/** For cost and hours an increase is shown as bad; for revenue and margin as good. */
const METRICS: { key: Metric; label: string; higherIsBetter: boolean; money: boolean }[] = [
  { key: 'hours', label: 'Hours', higherIsBetter: false, money: false },
  { key: 'cost', label: 'Cost', higherIsBetter: false, money: true },
  { key: 'revenue', label: 'Revenue', higherIsBetter: true, money: true },
  { key: 'margin', label: 'Margin', higherIsBetter: true, money: true },
]

export function CompareView() {
  const project = useAppStore((state) => state.project)
  const phases = useAppStore((state) => state.phases)
  const members = useAppStore((state) => state.members)
  const baselines = useAppStore((state) => state.baselines)
  const ordered = useMemo(() => sortBaselinesNewestFirst(baselines), [baselines])

  const [fromId, setFromId] = useState<string>(() => ordered[0]?.id ?? WORKING)
  const [toId, setToId] = useState<string>(WORKING)

  const options = [
    { id: WORKING, label: 'Working forecast' },
    ...ordered.map((b) => ({ id: b.id, label: b.name })),
  ]
  const resolve = (id: string): ForecastSnapshot | null =>
    id === WORKING ? { project, phases, members } : (baselines.find((b) => b.id === id)?.snapshot ?? null)
  // Fall back to valid options if a selected baseline was deleted.
  const from = resolve(fromId) ?? resolve(ordered[0]?.id ?? WORKING)
  const to = resolve(toId) ?? resolve(WORKING)
  const comparison = useMemo(() => (from && to ? compareForecasts(from, to) : null), [from, to])

  if (baselines.length === 0) {
    return (
      <EmptyState
        icon={GitCompare}
        title="Nothing to compare yet"
        hint="Create a baseline first, then compare it with the working forecast or another baseline."
      />
    )
  }

  const picker = (id: string, label: string, value: string, onChange: (value: string) => void) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label id={`${id}-label`} className="text-sm font-medium">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-labelledby={`${id}-label`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        {picker('compare-from', 'From', fromId, setFromId)}
        <ArrowRight className="mb-2.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        {picker('compare-to', 'To', toId, setToId)}
      </div>
      <p className="text-xs text-muted">
        Each cell shows the “To” value and its change from “From”. Higher cost or hours is shown in red,
        higher revenue or margin in green. Inactive members count as zero.
      </p>
      {comparison && <ComparisonTable comparison={comparison} currency={project.currency} />}
    </div>
  )
}

function ComparisonTable({ comparison, currency }: { comparison: ForecastComparison; currency: Currency }) {
  const head = 'text-xs font-medium uppercase tracking-wide text-muted'
  return (
    <Table aria-label="Forecast comparison" containerClassName="rounded-lg border">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={head}>Member</TableHead>
          {METRICS.map((metric) => (
            <TableHead key={metric.key} className={cn(head, 'text-right')}>
              {metric.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {comparison.rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted">
              No active team members in either version.
            </TableCell>
          </TableRow>
        ) : (
          comparison.rows.map((row) => (
            <TableRow key={row.key} className="hover:bg-subtle/50">
              <TableCell>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-muted">{row.role}</div>
              </TableCell>
              {METRICS.map((metric) => (
                <DeltaCell
                  key={metric.key}
                  value={row.to[metric.key]}
                  delta={row.delta[metric.key]}
                  metric={metric}
                  currency={currency}
                />
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow className="hover:bg-transparent">
          <TableCell className="font-medium">Totals</TableCell>
          {METRICS.map((metric) => (
            <DeltaCell
              key={metric.key}
              value={comparison.totals.to[metric.key]}
              delta={comparison.totals.delta[metric.key]}
              metric={metric}
              currency={currency}
            />
          ))}
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function DeltaCell({
  value,
  delta,
  metric,
  currency,
}: {
  value: number
  delta: number
  metric: (typeof METRICS)[number]
  currency: Currency
}) {
  const format = (n: number) => (metric.money ? formatCurrency(n, currency) : formatNumber(n, 1))
  // Ignore floating-point dust.
  const rounded = Math.abs(delta) < 0.005 ? 0 : delta
  const good = rounded > 0 === metric.higherIsBetter
  const Icon = rounded === 0 ? Minus : Triangle
  const sign = rounded > 0 ? '+' : ''
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'no change'

  return (
    <TableCell className="text-right tabular-nums">
      <div>{format(value)}</div>
      <div
        className={cn(
          'flex items-center justify-end gap-0.5 text-xs',
          rounded === 0 ? 'text-muted' : good ? 'text-success' : 'text-danger',
        )}
        aria-label={rounded === 0 ? 'No change' : `${direction} ${format(Math.abs(rounded))}`}
      >
        {/* ▲ / ▼: one filled triangle, flipped for decreases. */}
        <Icon
          className={cn('h-3 w-3', rounded !== 0 && 'fill-current', rounded < 0 && 'rotate-180')}
          aria-hidden
        />
        {rounded === 0 ? '0' : `${sign}${format(rounded)}`}
      </div>
    </TableCell>
  )
}
