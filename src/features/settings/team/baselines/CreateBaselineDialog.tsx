import { useMemo, useState, type FormEvent } from 'react'
import { GitBranch, X } from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { FormField } from '@/components/FormField'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getDefaultBaselineName } from '@/lib/baseline'
import { fieldAria } from '@/lib/fieldAria'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { getForecastSummary } from '@/lib/summary'
import { useAppStore } from '@/store/useAppStore'

interface CreateBaselineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateBaselineDialog({ open, onOpenChange }: CreateBaselineDialogProps) {
  // New form per opening (fresh default name); stays mounted while the dialog animates closed.
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create baseline</DialogTitle>
          <DialogDescription>
            Saves a locked copy of the current project, phases and team. Baselines cannot be edited, and are
            compared with actuals in Forecast vs Actual.
          </DialogDescription>
        </DialogHeader>
        <CreateBaselineForm key={session} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateBaselineForm({ onDone }: { onDone: () => void }) {
  const project = useAppStore((state) => state.project)
  const phases = useAppStore((state) => state.phases)
  const members = useAppStore((state) => state.members)
  const baselines = useAppStore((state) => state.baselines)
  const selectedBaselineId = useAppStore((state) => state.selectedBaselineId)
  const createBaseline = useAppStore((state) => state.createBaseline)
  const selectBaseline = useAppStore((state) => state.selectBaseline)

  const [name, setName] = useState(() => getDefaultBaselineName(baselines.length + 1, new Date()))
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const summary = useMemo(() => getForecastSummary({ project, phases, members }), [project, phases, members])
  const money = (value: number) => formatCurrency(value, project.currency)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Enter a baseline name')
    if (trimmed.length > 80) return setError('Use 80 characters or fewer')
    const baseline = createBaseline(trimmed, description)
    // The first baseline becomes the Forecast vs Actual comparison automatically.
    if (!selectedBaselineId) selectBaseline(baseline.id)
    toast.success(`Baseline “${baseline.name}” saved`, {
      description: selectedBaselineId ? undefined : 'Selected for Forecast vs Actual.',
    })
    onDone()
  }

  const preview = [
    { label: 'Team members', value: `${summary.activeMembers} active` },
    { label: 'Weeks', value: formatNumber(summary.weeks.length) },
    { label: 'Hours', value: formatNumber(summary.totals.hours) },
    { label: 'Cost', value: money(summary.totals.cost) },
    { label: 'Revenue', value: money(summary.totals.revenue) },
    { label: 'Margin %', value: summary.totals.revenue > 0 ? formatPercent(summary.totals.marginPct) : '—' },
  ]

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField id="baseline-name" label="Name" required error={error ?? undefined}>
        <Input
          id="baseline-name"
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          {...fieldAria('baseline-name', error ?? undefined)}
        />
      </FormField>
      <FormField
        id="baseline-description"
        label="Description"
        helper="Optional, e.g. “Signed SOW” or “After change request 3”."
      >
        <textarea
          id="baseline-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-describedby="baseline-description-helper"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </FormField>

      <section aria-label="What will be captured" className="rounded-lg border bg-subtle p-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">What will be captured</h3>
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
          {preview.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-muted">{item.label}</dt>
              <dd className="text-sm font-medium tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <DialogFooter className="pt-2">
        <ActionButton
          type="button"
          variant="outline"
          icon={X}
          tooltip="Close without saving a baseline"
          onClick={onDone}
        >
          Cancel
        </ActionButton>
        <ActionButton type="submit" icon={GitBranch} tooltip="Save this locked snapshot">
          Create baseline
        </ActionButton>
      </DialogFooter>
    </form>
  )
}
