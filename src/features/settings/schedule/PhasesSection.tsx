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
import { CalendarRange, Info, Plus } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { SectionCard } from '@/components/SectionCard'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddPhaseDialog } from '@/features/settings/schedule/AddPhaseDialog'
import { PhaseRow, type PhaseField } from '@/features/settings/schedule/PhaseRow'
import { getEndDateFormula } from '@/features/settings/schedule/phaseSchema'
import { getPhaseIssues, sortPhases } from '@/lib/schedule'
import { useAppStore } from '@/store/useAppStore'

const headClass = 'text-xs font-medium uppercase tracking-wide text-muted'

export function PhasesSection() {
  const phases = useAppStore((state) => state.phases)
  const durationMode = useAppStore((state) => state.project.durationMode)
  const reorderPhases = useAppStore((state) => state.reorderPhases)

  const [addOpen, setAddOpen] = useState(false)
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
    <ActionButton icon={Plus} tooltip="Add a new project phase" onClick={() => setAddOpen(true)}>
      Add phase
    </ActionButton>
  )

  return (
    <SectionCard
      icon={CalendarRange}
      title="Phases"
      description="Drag to reorder. Double-click a cell or use Edit to change a phase."
      actions={ordered.length > 0 ? addButton : undefined}
    >
      {ordered.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No phases yet"
          hint="Add your first phase to define the project timeline"
          action={addButton}
        />
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
      <AddPhaseDialog open={addOpen} onOpenChange={setAddOpen} />
    </SectionCard>
  )
}
