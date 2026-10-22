import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Star } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { addDaysISO } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { formatSpan, type GanttRow } from '@/lib/scheduleTree'
import { cn } from '@/lib/utils'
import type { DurationMode, ISODate } from '@/store/types'

type DragMode = 'move' | 'start' | 'end'

interface GanttBarProps {
  row: GanttRow
  /** Row in the chart grid. */
  gridRow: number
  /** Day index (0-based) of the row's start from the first chart Monday. */
  startDay: number
  spanDays: number
  durationMode: DurationMode
  /** Width of one day column in px, measured from the chart. */
  getDayWidth: () => number
  onMove: (row: GanttRow, days: number) => void
  onResize: (row: GanttRow, start: ISODate, end: ISODate) => void
  onOpen: (row: GanttRow) => void
}

const HEIGHT: Record<number, string> = { 0: 'h-6', 1: 'h-4', 2: 'h-3' }

/**
 * A bar (phase/task) or star (milestone) on the chart. Drag to move; drag a bar's edges to
 * change its start or end. Keyboard: ←/→ move a day, Shift+←/→ change the end, Alt+←/→ the start,
 * Enter opens the editor. Grid placement and colors are data-driven, so they use inline styles.
 */
export function GanttBar({
  row,
  gridRow,
  startDay,
  spanDays,
  durationMode,
  getDayWidth,
  onMove,
  onResize,
  onOpen,
}: GanttBarProps) {
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null)
  // The latest offset lives in the ref too: a fast release can arrive before React re-renders.
  const drag = useRef<{ mode: DragMode; x: number; moved: boolean; start: number; end: number } | null>(null)
  const isMilestone = row.kind === 'milestone' || row.kind === 'project-milestone'

  const deltaStart = preview?.start ?? 0
  const deltaEnd = preview?.end ?? 0
  const previewStart = addDaysISO(row.start, deltaStart)
  const previewEnd = addDaysISO(row.end, deltaEnd)

  // One handler for the bar and its edges; the element says which part is dragged.
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const mode = (event.currentTarget.dataset.drag ?? 'move') as DragMode
    event.preventDefault()
    event.stopPropagation()
    try {
      // Keeps the drag alive when the pointer leaves the bar.
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic or already-released pointers cannot be captured; the drag still works over the bar.
    }
    drag.current = { mode, x: event.clientX, moved: false, start: 0, end: 0 }
    setPreview({ start: 0, end: 0 })
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current) return
    const days = Math.round((event.clientX - current.x) / Math.max(1, getDayWidth()))
    if (days !== 0) current.moved = true
    // An edge never crosses the other edge: at least one day remains.
    const next =
      current.mode === 'move'
        ? { start: days, end: days }
        : current.mode === 'start'
          ? { start: Math.min(days, spanDays - 1), end: 0 }
          : { start: 0, end: Math.max(days, -(spanDays - 1)) }
    current.start = next.start
    current.end = next.end
    setPreview(next)
  }

  const finish = () => {
    const current = drag.current
    drag.current = null
    setPreview(null)
    if (!current || !current.moved || (current.start === 0 && current.end === 0)) return
    if (current.mode === 'move') onMove(row, current.start)
    else onResize(row, addDaysISO(row.start, current.start), addDaysISO(row.end, current.end))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onOpen(row)
      return
    }
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    if (event.shiftKey && !isMilestone && !row.fitEnd) {
      if (row.end > row.start || step > 0) onResize(row, row.start, addDaysISO(row.end, step))
    } else if (event.altKey && !isMilestone && !row.fitStart) {
      if (row.start < row.end || step < 0) onResize(row, addDaysISO(row.start, step), row.end)
    } else if (!event.shiftKey && !event.altKey) {
      onMove(row, step)
    }
  }

  const label = isMilestone
    ? `${row.name}: ${formatDate(row.start)}`
    : `${row.name}: ${formatDate(row.start)} – ${formatDate(row.end)}, ${formatSpan(row.start, row.end, durationMode)}`
  const help = isMilestone
    ? 'Drag or use ←/→ to move. Enter to edit.'
    : `Drag to move${row.fitStart && row.fitEnd ? '' : ', drag an edge to resize'}. Keys: ←/→ move, ${
        row.fitEnd ? '' : 'Shift+←/→ end, '
      }${row.fitStart ? '' : 'Alt+←/→ start, '}Enter to edit.`

  const tooltip = (
    <TooltipContent className="max-w-xs">
      <p className="font-medium">
        {isMilestone ? '★ ' : ''}
        {row.name}
      </p>
      <p className="tabular-nums">
        {formatDate(previewStart)}
        {isMilestone
          ? ''
          : ` – ${formatDate(previewEnd)} · ${formatSpan(previewStart, previewEnd, durationMode)}`}
      </p>
      {(row.fitStart || row.fitEnd) && (
        <p className="text-background/70">
          {row.fitStart && row.fitEnd
            ? 'Start and end follow'
            : row.fitStart
              ? 'Start follows'
              : 'End follows'}{' '}
          its children
        </p>
      )}
      <p className="text-background/70">{help}</p>
    </TooltipContent>
  )

  const common = {
    tabIndex: 0,
    role: 'button',
    'aria-label': `${label}. ${help}`,
    onKeyDown,
    onDoubleClick: () => onOpen(row),
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  } as const

  if (isMilestone) {
    return (
      <div
        role="gridcell"
        className="flex h-10 items-center justify-center"
        style={{ gridRow, gridColumn: `${2 + startDay + deltaStart} / span 1` }}
      >
        <Tooltip open={preview ? true : undefined}>
          <TooltipTrigger asChild>
            <span
              {...common}
              data-testid={`gantt-star-${row.id}`}
              data-drag="move"
              onPointerDown={onPointerDown}
              className="relative z-[6] flex cursor-grab touch-none rounded-full outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
            >
              <Star
                className="h-5 w-5 drop-shadow-sm"
                style={{ color: row.color, fill: row.color }}
                aria-hidden
              />
            </span>
          </TooltipTrigger>
          {tooltip}
        </Tooltip>
      </div>
    )
  }

  const handle = (edge: 'start' | 'end', disabled: boolean) =>
    disabled ? null : (
      <span
        aria-hidden
        data-drag={edge}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className={cn(
          'absolute inset-y-0 w-2 cursor-ew-resize touch-none rounded-sm hover:bg-black/20',
          edge === 'start' ? 'left-0' : 'right-0',
        )}
      />
    )

  return (
    <div
      role="gridcell"
      className="flex h-10 items-center"
      style={{
        gridRow,
        gridColumn: `${2 + startDay + deltaStart} / span ${Math.max(1, spanDays - deltaStart + deltaEnd)}`,
      }}
    >
      <Tooltip open={preview ? true : undefined}>
        <TooltipTrigger asChild>
          <div
            {...common}
            data-testid={`gantt-bar-${row.id}`}
            data-drag="move"
            onPointerDown={onPointerDown}
            className={cn(
              'relative z-[6] w-full cursor-grab touch-none rounded-md shadow-sm outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing',
              HEIGHT[row.level] ?? 'h-3',
              row.level > 0 && 'opacity-90',
              preview && 'ring-2 ring-primary/60',
            )}
            style={{ backgroundColor: row.color }}
          >
            {handle('start', row.fitStart)}
            {handle('end', row.fitEnd)}
          </div>
        </TooltipTrigger>
        {tooltip}
      </Tooltip>
    </div>
  )
}
