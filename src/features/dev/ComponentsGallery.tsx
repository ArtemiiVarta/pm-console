import { useState } from 'react'
import {
  CalendarRange,
  Clock,
  Copy,
  Download,
  Palette,
  Pencil,
  Percent,
  Plus,
  Save,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { CalculatedField } from '@/components/CalculatedField'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { PageHeader } from '@/components/PageHeader'
import { SectionCard } from '@/components/SectionCard'
import { StatTile } from '@/components/StatTile'

/** Dev-only page (#/dev/components) showing every shared component with sample props. */
export function ComponentsGallery() {
  const [deleted, setDeleted] = useState(0)

  return (
    <>
      <PageHeader
        icon={Palette}
        title="Component gallery"
        description="Dev only. Every shared component with sample props, for checking visual consistency."
        actions={
          <>
            <ActionButton variant="outline" icon={Download} tooltip="Download all data as a backup file">
              Export
            </ActionButton>
            <ActionButton icon={Plus} tooltip="Add a new project phase" shortcut="N">
              Add phase
            </ActionButton>
          </>
        }
      />

      <SectionCard
        icon={CalendarRange}
        title="Buttons"
        description="ActionButton and IconButton in every variant. Hover or focus to see tooltips."
      >
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton icon={Save} tooltip="Save project details" onClick={() => toast.success('Saved')}>
            Save
          </ActionButton>
          <ActionButton variant="outline" icon={Copy} tooltip="Duplicate this phase">
            Duplicate
          </ActionButton>
          <ActionButton variant="ghost" icon={Pencil} tooltip="Edit this phase">
            Edit
          </ActionButton>
          <ConfirmDialog
            title="Delete phase?"
            description="The phase “Realize” and its dates will be removed. This cannot be undone."
            onConfirm={() => {
              setDeleted((n) => n + 1)
              toast.success('Phase deleted')
            }}
            trigger={
              <ActionButton variant="destructive" icon={Trash2} tooltip="Delete this phase">
                Delete
              </ActionButton>
            }
          />
          <span className="mx-2 h-6 w-px bg-border" aria-hidden />
          <IconButton icon={Pencil} label="Edit phase" tooltip="Edit this phase" />
          <IconButton icon={Copy} label="Duplicate phase" tooltip="Duplicate this phase" />
          <IconButton
            variant="outline"
            icon={Plus}
            label="Add phase"
            tooltip="Add a new project phase"
            shortcut="N"
          />
          <ConfirmDialog
            title="Delete phase?"
            description="This cannot be undone."
            onConfirm={() => setDeleted((n) => n + 1)}
            trigger={<IconButton icon={Trash2} label="Delete phase" tooltip="Delete this phase" />}
          />
          <IconButton
            icon={Pencil}
            label="Edit phase (small)"
            tooltip="Small size, used inside fields"
            size="icon-sm"
          />
        </div>
        <p className="text-xs text-muted">Confirmed deletes: {deleted}</p>
      </SectionCard>

      <SectionCard icon={TrendingUp} title="Stat tiles" description="All four tones.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={Clock} label="Forecast hours" value="4,320" hint="Across 18 weeks" />
          <StatTile
            icon={TrendingUp}
            label="Margin %"
            value="31.4%"
            hint="On target (≥ 25%)"
            tone="success"
          />
          <StatTile
            icon={Users}
            label="Peak load"
            value="120%"
            hint="Overallocated in week 7"
            tone="warning"
          />
          <StatTile icon={Wallet} label="Margin" value="−$4,200" hint="Below 10%" tone="danger" />
        </div>
      </SectionCard>

      <SectionCard
        icon={Percent}
        title="Calculated fields"
        description="Read-only values with a formula tooltip."
        actions={<IconButton icon={Plus} label="Add field" tooltip="Example section action" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CalculatedField label="Margin/h" value="$45.00" formula="Price rate − Cost rate" />
          <CalculatedField label="Margin %" value="30.0%" formula="Margin/h ÷ Price rate" />
          <CalculatedField
            label="End date"
            value="14 Nov 2026"
            formula="Start date + duration − 1 (working days)"
          />
        </div>
      </SectionCard>

      <SectionCard icon={Users} title="Empty state">
        <EmptyState
          icon={Users}
          title="No team members yet"
          hint="Add the people who will work on this project."
          action={
            <ActionButton icon={Plus} tooltip="Add a person to the forecast">
              Add team member
            </ActionButton>
          }
        />
      </SectionCard>
    </>
  )
}
