import { useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CalendarRange, ChevronDown, Info, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { SectionCard } from '@/components/SectionCard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddPhaseDialog } from '@/features/settings/schedule/AddPhaseDialog'
import { MilestoneDialog, type MilestoneDialogMode } from '@/features/settings/schedule/MilestoneDialog'
import { PhaseRow, type PhaseField } from '@/features/settings/schedule/PhaseRow'
import { getEndDateFormula } from '@/features/settings/schedule/phaseSchema'
import { getPhaseIssues, sortPhases } from '@/lib/schedule'
import { formatDate } from '@/lib/format'
import { getColorName } from '@/lib/palette'
import { useAppStore } from '@/store/useAppStore'
import type { Milestone } from '@/store/types'

const headClass = 'text-xs font-medium uppercase tracking-wide text-muted'

export function PhasesSection() {
  const phases = useAppStore((state) => state.phases)
  const durationMode = useAppStore((state) => state.project.durationMode)
  const reorderPhases = useAppStore((state) => state.reorderPhases)

  const milestones = useAppStore((state) => state.milestones)
  const [addOpen, setAddOpen] = useState(false)
  const [milestoneDialog, setMilestoneDialog] = useState<MilestoneDialogMode | null>(null)
  const [editing, setEditing] = useState<{ id: string; field: PhaseField } | null>(null)

  const ordered = useMemo(() => sortPhases(phases), [phases])
  const issues = useMemo(() => getPhaseIssues(phases, durationMode), [phases, durationMode])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Screen-reader announcements by phase name and position instead of internal ids.
  const announcements = useMemo<Announcements>(() => {
    const name = (id: string | number) => ordered.find((phase) => phase.id === id)?.name ?? 'phase'
    const position = (id: string | number) =>
      `position ${ordered.findIndex((phase) => phase.id === id) + 1} of ${ordered.length}`
    return {
      onDragStart: ({ active }) => `Picked up ${name(active.id)}, ${position(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${name(active.id)} moved to ${position(over.id)}.`
          : `${name(active.id)} is no longer over a position.`,
      onDragEnd: ({ active, over }) =>
        over ? `${name(active.id)} dropped at ${position(over.id)}.` : `${name(active.id)} dropped.`,
      onDragCancel: ({ active }) => `Reordering cancelled. ${name(active.id)} returned to its position.`,
    }
  }, [ordered])

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = ordered.map((phase) => phase.id)
    reorderPhases(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  const addButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton icon={Plus} tooltip="Add a phase or a milestone">
          Add
          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
        </ActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setAddOpen(true)}>
          <CalendarRange className="h-4 w-4" aria-hidden />
          Phase
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMilestoneDialog({ kind: 'add' })}>
          <Star className="h-4 w-4" aria-hidden />
          Milestone
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const isEmpty = ordered.length === 0 && milestones.length === 0

  return (
    <SectionCard
      icon={CalendarRange}
      title="Phases & milestones"
      description="Drag phases to reorder. Double-click a cell or use Edit to change a phase."
      actions={isEmpty ? undefined : addButton}
    >
      {isEmpty ? (
        <EmptyState
          icon={CalendarRange}
          title="No phases yet"
          hint="Add your first phase to define the project timeline, or a milestone for a key date"
          action={addButton}
        />
      ) : ordered.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted">
          No phases yet. Phases set the project dates and weeks; use Add › Phase.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{ announcements }}
        >
          <Table aria-label="Phases" containerClassName="max-h-[60vh] rounded-lg border">
            <TableHeader className="sticky top-0 z-20 bg-surface">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pr-0">
                  <span className="sr-only">Reorder</span>
                </TableHead>
                <TableHead className="w-6 pr-0">
                  <span className="sr-only">Color</span>
                </TableHead>
                <TableHead className={headClass}>Phase name</TableHead>
                <TableHead className={headClass}>Start date</TableHead>
                <TableHead className={`${headClass} text-right`}>Duration</TableHead>
                <TableHead className={headClass}>Unit</TableHead>
                <TableHead className={headClass}>
                  <span className="inline-flex items-center gap-1">
                    End date
                    <IconButton
                      icon={Info}
                      size="icon-sm"
                      label="How the end date is calculated"
                      tooltip={getEndDateFormula(durationMode)}
                    />
                  </span>
                </TableHead>
                <TableHead className={`${headClass} text-right`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={ordered.map((phase) => phase.id)}
                strategy={verticalListSortingStrategy}
              >
                {ordered.map((phase, index) => (
                  <PhaseRow
                    key={phase.id}
                    phase={phase}
                    previous={ordered[index - 1]}
                    durationMode={durationMode}
                    issues={issues[phase.id]}
                    isEditing={editing?.id === phase.id}
                    focusField={editing?.id === phase.id ? editing.field : 'name'}
                    onStartEdit={(field) => setEditing({ id: phase.id, field })}
                    onStopEdit={() => setEditing(null)}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      )}
      {milestones.length > 0 && <MilestonesTable milestones={milestones} onEdit={setMilestoneDialog} />}
      <AddPhaseDialog open={addOpen} onOpenChange={setAddOpen} />
      <MilestoneDialog mode={milestoneDialog} onClose={() => setMilestoneDialog(null)} />
    </SectionCard>
  )
}

function MilestonesTable({
  milestones,
  onEdit,
}: {
  milestones: Milestone[]
  onEdit: (mode: MilestoneDialogMode) => void
}) {
  const deleteMilestone = useAppStore((state) => state.deleteMilestone)
  const ordered = [...milestones].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-base font-medium">
        <Star className="h-4 w-4 text-muted" aria-hidden />
        Milestones
      </h3>
      <Table aria-label="Milestones" containerClassName="rounded-lg border">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 pr-0">
              <span className="sr-only">Color</span>
            </TableHead>
            <TableHead className={headClass}>Milestone</TableHead>
            <TableHead className={headClass}>Date</TableHead>
            <TableHead className={`${headClass} text-right`}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map((milestone) => (
            <TableRow key={milestone.id} className="hover:bg-subtle/50">
              <TableCell className="w-8 pr-0">
                {/* Star color comes from data. */}
                <Star
                  className="h-4 w-4"
                  style={{ color: milestone.color, fill: milestone.color }}
                  aria-label={`Star color: ${getColorName(milestone.color)}`}
                />
              </TableCell>
              <TableCell className="font-medium" onDoubleClick={() => onEdit({ kind: 'edit', milestone })}>
                {milestone.name}
              </TableCell>
              <TableCell className="tabular-nums">{formatDate(milestone.date)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-0.5">
                  <IconButton
                    icon={Pencil}
                    label={`Edit ${milestone.name}`}
                    tooltip="Edit this milestone"
                    onClick={() => onEdit({ kind: 'edit', milestone })}
                  />
                  <ConfirmDialog
                    title={`Delete “${milestone.name}”?`}
                    description="The milestone is removed from the timeline. This cannot be undone."
                    onConfirm={() => {
                      deleteMilestone(milestone.id)
                      toast.success(`Milestone “${milestone.name}” deleted`)
                    }}
                    trigger={
                      <IconButton
                        icon={Trash2}
                        label={`Delete ${milestone.name}`}
                        tooltip="Delete this milestone"
                      />
                    }
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
