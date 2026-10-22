import { addDays, differenceInCalendarDays, eachDayOfInterval, isWeekend } from 'date-fns'
import { parseISODate, toISODate } from '@/lib/dates'
import { getPhaseEndDate, sortPhases } from '@/lib/schedule'
import type { DurationMode, ISODate, Milestone, Phase, ScheduleItem } from '@/store/types'

/** Phase (level 0) › task or milestone (level 1) › sub-task or sub-milestone (level 2). */
export const MAX_LEVEL = 2

export type GanttRowKind = 'phase' | 'task' | 'milestone' | 'project-milestone'

export interface GanttRow {
  id: string
  kind: GanttRowKind
  /** 0 for phases and project milestones. */
  level: number
  parentId: string | null
  name: string
  color: string
  start: ISODate
  end: ISODate
  hasChildren: boolean
  /** Fitted edges follow the children and cannot be dragged. */
  fitStart: boolean
  fitEnd: boolean
}

/** Dated node with an optional pinned end: phases and schedule items. */
type Spanned = Pick<Phase, 'startDate' | 'duration' | 'durationUnit' | 'endDate'>

/** Last day of a task (pinned end or duration) or a milestone's date. */
export function getItemEnd(item: ScheduleItem, mode: DurationMode): ISODate {
  return item.kind === 'milestone' ? item.startDate : getPhaseEndDate(item, mode)
}

export function sortByOrder<T extends { order: number; name: string }>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export function getChildren(items: ScheduleItem[], parentId: string): ScheduleItem[] {
  return sortByOrder(items.filter((item) => item.parentId === parentId))
}

/** 1 for children of a phase, 2 for children of a task, 0 if the parent is unknown. */
export function getItemLevel(item: ScheduleItem, phases: Phase[], items: ScheduleItem[]): number {
  if (phases.some((phase) => phase.id === item.parentId)) return 1
  const parent = items.find((candidate) => candidate.id === item.parentId)
  return parent && phases.some((phase) => phase.id === parent.parentId) ? 2 : 0
}

/** Ids of every item under `id` (any depth). */
export function getDescendantIds(items: ScheduleItem[], id: string): string[] {
  const result: string[] = []
  const queue = [id]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const item of items) {
      if (item.parentId === current) {
        result.push(item.id)
        queue.push(item.id)
      }
    }
  }
  return result
}

/** Items whose ancestors still exist (drops children of deleted phases or tasks). */
export function withoutOrphans(phases: Phase[], items: ScheduleItem[]): ScheduleItem[] {
  return items.filter((item) => getItemLevel(item, phases, items) > 0)
}

function childSpan(children: ScheduleItem[], mode: DurationMode): { start: ISODate; end: ISODate } | null {
  if (children.length === 0) return null
  const starts = children.map((child) => child.startDate).sort()
  const ends = children.map((child) => getItemEnd(child, mode)).sort()
  const start = starts[0]
  const end = ends.at(-1)
  return start && end ? { start, end } : null
}

/** New start/end for a parent with fit flags, or the same object when nothing changes. */
function fitNode<T extends Spanned & Pick<Phase, 'fitStart' | 'fitEnd'>>(
  node: T,
  children: ScheduleItem[],
  mode: DurationMode,
): T {
  if (!node.fitStart && !node.fitEnd) return node
  const span = childSpan(children, mode)
  if (!span) return node
  const currentEnd = getPhaseEndDate(node, mode)
  const startDate = node.fitStart ? span.start : node.startDate
  // Fitting the start pins the end so a start-only fit does not drag the end along.
  const endDate = node.fitEnd ? span.end : currentEnd
  const safeEnd = endDate < startDate ? startDate : endDate
  if (startDate === node.startDate && safeEnd === node.endDate) return node
  return { ...node, startDate, endDate: safeEnd }
}

/**
 * Applies "Adjust start/end date" to every parent, bottom-up: level-1 tasks follow their
 * sub-items, then phases follow their tasks and milestones. Unchanged nodes keep their identity.
 */
export function fitSchedule(
  phases: Phase[],
  items: ScheduleItem[],
  mode: DurationMode,
): { phases: Phase[]; items: ScheduleItem[] } {
  const fittedItems = items.map((item) =>
    item.kind === 'task'
      ? fitNode(
          item,
          items.filter((child) => child.parentId === item.id),
          mode,
        )
      : item,
  )
  const fittedPhases = phases.map((phase) =>
    fitNode(
      phase,
      fittedItems.filter((child) => child.parentId === phase.id),
      mode,
    ),
  )
  const changed =
    fittedItems.some((item, index) => item !== items[index]) ||
    fittedPhases.some((phase, index) => phase !== phases[index])
  return changed ? { phases: fittedPhases, items: fittedItems } : { phases, items }
}

const shiftDate = (date: ISODate, days: number) => toISODate(addDays(parseISODate(date), days))

function shiftSpanned<T extends Spanned>(node: T, days: number): T {
  return {
    ...node,
    startDate: shiftDate(node.startDate, days),
    ...(node.endDate ? { endDate: shiftDate(node.endDate, days) } : {}),
  }
}

export interface ScheduleData {
  phases: Phase[]
  items: ScheduleItem[]
  milestones: Milestone[]
}

/** Moves a node by whole calendar days; phases and tasks take all their children along. */
export function moveNode(data: ScheduleData, id: string, days: number): ScheduleData {
  if (days === 0) return data
  const moving = new Set([id, ...getDescendantIds(data.items, id)])
  return {
    phases: data.phases.map((phase) => (phase.id === id ? shiftSpanned(phase, days) : phase)),
    items: data.items.map((item) => (moving.has(item.id) ? shiftSpanned(item, days) : item)),
    milestones: data.milestones.map((milestone) =>
      milestone.id === id ? { ...milestone, date: shiftDate(milestone.date, days) } : milestone,
    ),
  }
}

/** Sets a node's start and end (end pinned); children do not move. End is kept on or after start. */
export function setNodeRange(data: ScheduleData, id: string, start: ISODate, end: ISODate): ScheduleData {
  const endDate = end < start ? start : end
  return {
    ...data,
    phases: data.phases.map((phase) => (phase.id === id ? { ...phase, startDate: start, endDate } : phase)),
    items: data.items.map((item) =>
      item.id === id ? { ...item, startDate: start, ...(item.kind === 'task' ? { endDate } : {}) } : item,
    ),
  }
}

/** Visible Gantt rows: phases in order with their children nested, then project milestones. */
export function buildGanttRows(
  data: ScheduleData,
  mode: DurationMode,
  collapsed: ReadonlySet<string> = new Set(),
): GanttRow[] {
  const rows: GanttRow[] = []
  const addItems = (parentId: string, level: number) => {
    for (const item of getChildren(data.items, parentId)) {
      const children = item.kind === 'task' ? getChildren(data.items, item.id) : []
      rows.push({
        id: item.id,
        kind: item.kind,
        level,
        parentId,
        name: item.name,
        color: item.color,
        start: item.startDate,
        end: getItemEnd(item, mode),
        hasChildren: children.length > 0,
        fitStart: Boolean(item.fitStart) && children.length > 0,
        fitEnd: Boolean(item.fitEnd) && children.length > 0,
      })
      if (children.length > 0 && level < MAX_LEVEL && !collapsed.has(item.id)) addItems(item.id, level + 1)
    }
  }

  for (const phase of sortPhases(data.phases)) {
    const children = getChildren(data.items, phase.id)
    rows.push({
      id: phase.id,
      kind: 'phase',
      level: 0,
      parentId: null,
      name: phase.name,
      color: phase.color,
      start: phase.startDate,
      end: getPhaseEndDate(phase, mode),
      hasChildren: children.length > 0,
      fitStart: Boolean(phase.fitStart) && children.length > 0,
      fitEnd: Boolean(phase.fitEnd) && children.length > 0,
    })
    if (!collapsed.has(phase.id)) addItems(phase.id, 1)
  }

  for (const milestone of [...data.milestones].sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  )) {
    rows.push({
      id: milestone.id,
      kind: 'project-milestone',
      level: 0,
      parentId: null,
      name: milestone.name,
      color: milestone.color,
      start: milestone.date,
      end: milestone.date,
      hasChildren: false,
      fitStart: false,
      fitEnd: false,
    })
  }
  return rows
}

/** Earliest start and latest end over all rows (collapsed children included), or null. */
export function getScheduleSpan(
  data: ScheduleData,
  mode: DurationMode,
): { start: ISODate; end: ISODate } | null {
  const dates = [
    ...data.phases.flatMap((phase) => [phase.startDate, getPhaseEndDate(phase, mode)]),
    ...data.items.flatMap((item) => [item.startDate, getItemEnd(item, mode)]),
    ...data.milestones.map((milestone) => milestone.date),
  ].sort()
  const start = dates[0]
  const end = dates.at(-1)
  return start && end ? { start, end } : null
}

/** Length of a span for display: working days in working mode, otherwise calendar days. */
export function formatSpan(start: ISODate, end: ISODate, mode: DurationMode): string {
  const from = parseISODate(start)
  const to = parseISODate(end)
  if (to < from) return '1 day'
  const days =
    mode === 'working'
      ? eachDayOfInterval({ start: from, end: to }).filter((day) => !isWeekend(day)).length
      : differenceInCalendarDays(to, from) + 1
  const count = Math.max(1, days)
  return `${count} ${mode === 'working' ? 'working ' : ''}day${count === 1 ? '' : 's'}`
}
