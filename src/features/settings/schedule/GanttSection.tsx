import { useCallback, useMemo, useRef, useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import {
  ArrowDown,
  ArrowRightToLine,
  ArrowUp,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  GanttChart,
  Link2,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GanttBar } from '@/features/settings/schedule/GanttBar'
import { PhaseIssueBadge } from '@/features/settings/schedule/PhaseIssueBadge'
import { ScheduleItemDialog, type ScheduleDialogMode } from '@/features/settings/schedule/ScheduleItemDialog'
import { parseISODate, todayISO } from '@/lib/dates'
import { formatDate, formatWeekLabel } from '@/lib/format'
import { getDayAfter, getPhaseEndDate, getPhaseIssues, getProjectWeeks, sortPhases } from '@/lib/schedule'
import {
  buildGanttRows,
  getDescendantIds,
  getScheduleSpan,
  MAX_LEVEL,
  type GanttRow,
} from '@/lib/scheduleTree'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { ISODate } from '@/store/types'

/** Minimum width of one week column, in rem. */
const WEEK_MIN_REM = 3.5
/** Left (tree) column. */
const TREE_REM = 30

export function GanttSection() {
  const store = useAppStore()
  const { phases, items, milestones } = store
  const mode = store.project.durationMode

  const [dialog, setDialog] = useState<ScheduleDialogMode | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<GanttRow | null>(null)
  const [status, setStatus] = useState('')
  const headerRef = useRef<HTMLDivElement>(null)

  const data = useMemo(() => ({ phases, items, milestones }), [phases, items, milestones])
  const rows = useMemo(() => buildGanttRows(data, mode, collapsed), [data, mode, collapsed])
  const issues = useMemo(() => getPhaseIssues(phases, mode), [phases, mode])
  const span = useMemo(() => getScheduleSpan(data, mode), [data, mode])
  const weeks = useMemo(() => getProjectWeeks(span), [span])
  const totalDays = weeks.length * 7
  const origin = weeks[0]
  const dayIndex = (date: ISODate) =>
    origin ? differenceInCalendarDays(parseISODate(date), parseISODate(origin)) : 0
  const today = todayISO()
  const todayDay = origin ? dayIndex(today) : -1
  const parents = rows.filter(
    (row) => row.kind === 'phase' || (row.kind === 'task' && items.some((i) => i.parentId === row.id)),
  )
  const anyCollapsed = collapsed.size > 0

  // One week header cell is 7 days wide.
  const getDayWidth = useCallback(() => (headerRef.current?.getBoundingClientRect().width ?? 56) / 7, [])

  const announce = (row: GanttRow) => {
    const fresh = buildGanttRows(useAppStore.getState(), mode).find((r) => r.id === row.id)
    if (fresh)
      setStatus(
        `${fresh.name}: ${formatDate(fresh.start)}${fresh.end !== fresh.start ? ` to ${formatDate(fresh.end)}` : ''}`,
      )
  }

  const onMove = (row: GanttRow, days: number) => {
    store.moveScheduleNode(row.id, days)
    announce(row)
  }
  const onResize = (row: GanttRow, start: ISODate, end: ISODate) => {
    store.setScheduleNodeRange(row.id, start, end)
    announce(row)
  }
  const openEdit = (row: GanttRow) => {
    if (row.kind === 'phase') {
      const phase = phases.find((p) => p.id === row.id)
      if (phase) setDialog({ kind: 'edit-phase', phase })
    } else if (row.kind === 'project-milestone') {
      const milestone = milestones.find((m) => m.id === row.id)
      if (milestone) setDialog({ kind: 'edit-milestone', milestone })
    } else {
      const item = items.find((i) => i.id === row.id)
      if (item) setDialog({ kind: 'edit-item', item })
    }
  }

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton icon={Plus} tooltip="Add a phase or a project milestone">
          Add
          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
        </ActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setDialog({ kind: 'add', type: 'phase' })}>
          <CalendarRange className="h-4 w-4" aria-hidden />
          Phase
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog({ kind: 'add', type: 'project-milestone' })}>
          <Star className="h-4 w-4" aria-hidden />
          Milestone
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const isEmpty = rows.length === 0

  return (
    <SectionCard
      icon={GanttChart}
      title="Project schedule"
      description="Phases, tasks, sub-tasks and milestones (★). Drag bars to move them, drag their edges to change dates; use ⋯ to add tasks and milestones under a phase or task."
      actions={
        isEmpty ? undefined : (
          <>
            {parents.length > 0 && (
              <ActionButton
                variant="outline"
                icon={anyCollapsed ? ChevronsUpDown : ChevronsDownUp}
                tooltip={anyCollapsed ? 'Show all tasks and sub-tasks' : 'Show phases only'}
                onClick={() =>
                  setCollapsed(
                    anyCollapsed ? new Set() : new Set(sortPhases(phases).map((phase) => phase.id)),
                  )
                }
              >
                {anyCollapsed ? 'Expand all' : 'Collapse all'}
              </ActionButton>
            )}
            {addMenu}
          </>
        )
      }
    >
      {isEmpty ? (
        <EmptyState
          icon={CalendarRange}
          title="No phases yet"
          hint="Add your first phase to define the project timeline, or a milestone for a key date"
          action={addMenu}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div
            role="treegrid"
            aria-label="Project schedule"
            className="relative grid text-xs"
            style={{
              gridTemplateColumns: `${TREE_REM}rem repeat(${totalDays}, minmax(0, 1fr))`,
              minWidth: `${TREE_REM + weeks.length * WEEK_MIN_REM}rem`,
            }}
          >
            {/* Header */}
            <div role="row" className="contents">
              <div
                role="columnheader"
                className="sticky left-0 z-20 flex items-center gap-2 border-b border-r bg-surface px-3 py-2 font-medium uppercase tracking-wide text-muted"
                style={{ gridRow: 1, gridColumn: 1 }}
              >
                <span className="flex-1">Name</span>
                <span className="w-20 text-right">Start</span>
                <span className="w-20 text-right">End</span>
                <span className="w-16" />
              </div>
              {weeks.map((week, index) => (
                <div
                  key={week}
                  ref={index === 0 ? headerRef : undefined}
                  role="columnheader"
                  className="border-b border-l px-1 py-2 text-center tabular-nums text-muted"
                  style={{ gridRow: 1, gridColumn: `${2 + index * 7} / span 7` }}
                >
                  {formatWeekLabel(week)}
                </div>
              ))}
            </div>

            {/* Week dividers behind the bars */}
            {weeks.map((week, index) => (
              <div
                key={`divider-${week}`}
                aria-hidden
                className="pointer-events-none border-l"
                style={{ gridColumn: `${2 + index * 7} / span 7`, gridRow: `2 / ${rows.length + 2}` }}
              />
            ))}

            {rows.map((row, index) => {
              const gridRow = index + 2
              const startDay = dayIndex(row.start)
              const spanDays = dayIndex(row.end) - startDay + 1
              const firstProjectMilestone =
                row.kind === 'project-milestone' && rows[index - 1]?.kind !== 'project-milestone'
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-level={row.level + 1}
                  aria-expanded={row.hasChildren ? !collapsed.has(row.id) : undefined}
                  className="contents"
                >
                  <div
                    role="rowheader"
                    className={cn(
                      'sticky left-0 z-10 flex h-10 items-center gap-1.5 border-r border-t bg-surface pr-1 text-sm',
                      row.kind === 'phase' && 'font-medium',
                      firstProjectMilestone && 'border-t-2',
                    )}
                    style={{ gridRow, gridColumn: 1, paddingLeft: `${0.5 + row.level * 1.25}rem` }}
                  >
                    {row.hasChildren ? (
                      <IconButton
                        icon={collapsed.has(row.id) ? ChevronRight : ChevronDown}
                        size="icon-sm"
                        label={`${collapsed.has(row.id) ? 'Expand' : 'Collapse'} ${row.name}`}
                        tooltip={
                          collapsed.has(row.id) ? 'Show the items under it' : 'Hide the items under it'
                        }
                        onClick={() => toggle(row.id)}
                        aria-expanded={!collapsed.has(row.id)}
                      />
                    ) : (
                      <span className="w-7 shrink-0" aria-hidden />
                    )}
                    <RowIcon row={row} />
                    <span className="min-w-0 flex-1 truncate" title={row.name}>
                      {row.name}
                    </span>
                    {(row.fitStart || row.fitEnd) && <FitBadge start={row.fitStart} end={row.fitEnd} />}
                    {row.kind === 'phase' && <PhaseIssueBadge issues={issues[row.id]} mode={mode} />}
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted">
                      {formatDate(row.start).slice(0, 6)}
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted">
                      {row.end === row.start && row.kind !== 'phase' && row.kind !== 'task'
                        ? '—'
                        : formatDate(row.end).slice(0, 6)}
                    </span>
                    <span className="flex w-16 shrink-0 justify-end">
                      <RowMenu
                        row={row}
                        onEdit={() => openEdit(row)}
                        onAdd={(type) => setDialog({ kind: 'add', type, parentId: row.id })}
                        onDelete={() => setDeleting(row)}
                      />
                    </span>
                  </div>
                  {/* Row line across the timeline, then the bar or star in the same grid row. */}
                  <div
                    aria-hidden
                    className={cn('border-t', firstProjectMilestone && 'border-t-2')}
                    style={{ gridRow, gridColumn: `2 / span ${totalDays}` }}
                  />
                  <GanttBar
                    row={row}
                    gridRow={gridRow}
                    startDay={startDay}
                    spanDays={spanDays}
                    durationMode={mode}
                    getDayWidth={getDayWidth}
                    onMove={onMove}
                    onResize={onResize}
                    onOpen={openEdit}
                  />
                </div>
              )
            })}

            {/* Today marker */}
            {todayDay >= 0 && todayDay < totalDays && (
              <div
                role="img"
                aria-label={`Today, ${formatDate(today)}`}
                className="pointer-events-none z-[5] w-0.5 justify-self-center bg-primary"
                style={{ gridColumn: `${2 + todayDay} / span 1`, gridRow: `2 / ${rows.length + 2}` }}
              />
            )}
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      <ScheduleItemDialog mode={dialog} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete “${deleting.name}”?` : 'Delete?'}
        description={
          deleting && (deleting.kind === 'phase' || deleting.kind === 'task') && deleting.hasChildren
            ? `Everything under it (${getDescendantIds(items, deleting.id).length} items) is deleted too. This cannot be undone.`
            : 'This cannot be undone.'
        }
        onConfirm={() => {
          if (!deleting) return
          if (deleting.kind === 'phase') store.deletePhase(deleting.id)
          else if (deleting.kind === 'project-milestone') store.deleteMilestone(deleting.id)
          else store.deleteItem(deleting.id)
          toast.success(`“${deleting.name}” deleted`)
        }}
      />
    </SectionCard>
  )
}

function RowIcon({ row }: { row: GanttRow }) {
  if (row.kind === 'milestone' || row.kind === 'project-milestone') {
    return (
      <Star
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: row.color, fill: row.color }}
        aria-label="Milestone"
      />
    )
  }
  return (
    <span
      aria-label={row.kind === 'phase' ? 'Phase' : row.level === 2 ? 'Sub-task' : 'Task'}
      role="img"
      className={cn('shrink-0', row.kind === 'phase' ? 'h-3 w-3 rounded-full' : 'h-2 w-3 rounded-sm')}
      style={{ backgroundColor: row.color }}
    />
  )
}

function FitBadge({ start, end }: { start: boolean; end: boolean }) {
  const text =
    start && end
      ? 'Start and end follow the items under it'
      : start
        ? 'Start follows the items under it'
        : 'End follows the items under it'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={text}
          className="shrink-0 rounded text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

function RowMenu({
  row,
  onEdit,
  onAdd,
  onDelete,
}: {
  row: GanttRow
  onEdit: () => void
  onAdd: (type: 'task' | 'milestone') => void
  onDelete: () => void
}) {
  const store = useAppStore()
  const canHaveChildren = row.kind === 'phase' || (row.kind === 'task' && row.level < MAX_LEVEL)
  const childNoun =
    row.kind === 'phase'
      ? { task: 'Add task', milestone: 'Add milestone' }
      : { task: 'Add sub-task', milestone: 'Add sub-milestone' }

  const phaseActions = () => {
    const ordered = sortPhases(store.phases)
    const index = ordered.findIndex((phase) => phase.id === row.id)
    const previous = ordered[index - 1]
    const move = (direction: -1 | 1) => {
      const ids = ordered.map((phase) => phase.id)
      const [moved] = ids.splice(index, 1)
      if (moved) ids.splice(index + direction, 0, moved)
      store.reorderPhases(ids)
    }
    return { index, count: ordered.length, previous, move }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          icon={MoreHorizontal}
          size="icon-sm"
          label={`Actions for ${row.name}`}
          tooltip="Edit, add under it, move or delete"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </DropdownMenuItem>
        {canHaveChildren && (
          <>
            <DropdownMenuItem onSelect={() => onAdd('task')}>
              <ListPlus className="h-4 w-4" aria-hidden />
              {childNoun.task}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAdd('milestone')}>
              <Star className="h-4 w-4" aria-hidden />
              {childNoun.milestone}
            </DropdownMenuItem>
          </>
        )}
        {row.kind === 'phase' &&
          (() => {
            const { index, count, previous, move } = phaseActions()
            return (
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    store.duplicatePhase(row.id)
                    toast.success(`“${row.name}” duplicated`)
                  }}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Duplicate phase
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!previous}
                  onSelect={() => {
                    if (!previous) return
                    const start = getDayAfter(getPhaseEndDate(previous, store.project.durationMode))
                    store.moveScheduleNode(
                      row.id,
                      differenceInCalendarDays(parseISODate(start), parseISODate(row.start)),
                    )
                    toast.success(`“${row.name}” now starts ${formatDate(start)}`)
                  }}
                >
                  <ArrowRightToLine className="h-4 w-4" aria-hidden />
                  Start after previous phase
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={index <= 0} onSelect={() => move(-1)}>
                  <ArrowUp className="h-4 w-4" aria-hidden />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem disabled={index >= count - 1} onSelect={() => move(1)}>
                  <ArrowDown className="h-4 w-4" aria-hidden />
                  Move down
                </DropdownMenuItem>
              </>
            )
          })()}
        {(row.kind === 'task' || row.kind === 'milestone') && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => store.moveItemOrder(row.id, -1)}>
              <ArrowUp className="h-4 w-4" aria-hidden />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => store.moveItemOrder(row.id, 1)}>
              <ArrowDown className="h-4 w-4" aria-hidden />
              Move down
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-danger focus:text-danger">
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
