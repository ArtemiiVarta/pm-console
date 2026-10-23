import { memo, type KeyboardEvent } from 'react'
import { AlertTriangle, CalendarRange, MoreHorizontal, RotateCcw } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  DEFAULT_COL,
  formatLoad,
  NAME_COL,
  ROLE_COL,
  TOTAL_COL,
  WEEK_COL,
} from '@/features/settings/team/assignment/gridLayout'
import type { DisplayUnit } from '@/lib/assignment'
import { formatNumber } from '@/lib/format'
import { getMemberHours, getMemberLoadPct, isBeforeStart } from '@/lib/forecast'
import { getFullName } from '@/lib/roster'
import type { DateRange } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import type { ISODate, TeamMember } from '@/store/types'

export interface RowEditing {
  col: number
  draft: string
  /** Select the whole value (Enter/F2) instead of continuing after a typed first character. */
  selectAll: boolean
}

interface AssignmentRowProps {
  rowIndex: number
  member: TeamMember
  weeks: ISODate[]
  standardHoursPerWeek: number
  /** Project dates; partial first and last weeks are pro-rated. */
  projectRange: DateRange | null
  unit: DisplayUnit
  /** Selected column range in this row, or -1/-1. */
  selectedLeft: number
  selectedRight: number
  /** Focused column in this row, or -1. */
  focusedCol: number
  /** Column reachable with Tab in this row (the focused cell, or the first cell before any focus), or -1. */
  tabbableCol: number
  editing: RowEditing | null
  onDraftChange: (draft: string) => void
  onEditKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onEditBlur: () => void
  readOnly: boolean
  /** Unsaved changes for this member, keyed by week. */
  pendingWeeks: Record<ISODate, number | null> | undefined
  onApplyRange: (member: TeamMember) => void
  onResetAll: (member: TeamMember) => void
}

/** One member's row. Memoized: re-renders only when this member, the view or this row's selection changes. */
export const AssignmentRow = memo(function AssignmentRow({
  rowIndex,
  member,
  weeks,
  standardHoursPerWeek,
  projectRange,
  unit,
  selectedLeft,
  selectedRight,
  focusedCol,
  tabbableCol,
  editing,
  onDraftChange,
  onEditKeyDown,
  onEditBlur,
  readOnly,
  pendingWeeks,
  onApplyRange,
  onResetAll,
}: AssignmentRowProps) {
  const name = getFullName(member)
  let totalHours = 0

  const cells = weeks.map((week, col) => {
    const pct = getMemberLoadPct(member, week)
    const hours = getMemberHours(member, week, standardHoursPerWeek, projectRange)
    totalHours += hours
    const isEditing = editing?.col === col
    return (
      <WeekCell
        key={week}
        rowIndex={rowIndex}
        col={col}
        name={name}
        week={week}
        pct={pct}
        hours={hours}
        capHours={hours * (member.capacityPct / 100)}
        isOverride={member.weeklyOverrides[week] !== undefined}
        beforeStart={isBeforeStart(member, week)}
        unsaved={pendingWeeks?.[week] !== undefined}
        selected={col >= selectedLeft && col <= selectedRight}
        focused={col === focusedCol}
        tabbable={col === tabbableCol}
        unit={unit}
        draft={isEditing ? editing.draft : null}
        selectAll={isEditing ? editing.selectAll : false}
        onDraftChange={onDraftChange}
        onEditKeyDown={onEditKeyDown}
        onEditBlur={onEditBlur}
      />
    )
  })

  return (
    <tr>
      <RowHeader
        member={member}
        name={name}
        readOnly={readOnly}
        onApplyRange={onApplyRange}
        onResetAll={onResetAll}
      />
      <td
        className={cn(ROLE_COL, 'z-10 truncate border-b bg-surface px-3 text-xs text-muted')}
        title={member.role}
      >
        {member.role}
      </td>
      <td
        className={cn(DEFAULT_COL, 'z-10 border-b border-r bg-surface px-3 text-right text-xs tabular-nums')}
      >
        {formatNumber(member.defaultLoadPct, 1)}%
      </td>
      {cells}
      <td
        className={cn(
          TOTAL_COL,
          'z-10 border-b border-l bg-surface px-3 text-right text-sm font-medium tabular-nums',
        )}
      >
        {formatNumber(totalHours, 1)}
      </td>
    </tr>
  )
})

interface WeekCellProps {
  rowIndex: number
  col: number
  name: string
  week: ISODate
  pct: number
  hours: number
  capHours: number
  isOverride: boolean
  /** Week ends before the member's start date: always 0%, not editable. */
  beforeStart: boolean
  /** Edited but not saved yet. */
  unsaved: boolean
  selected: boolean
  focused: boolean
  tabbable: boolean
  unit: DisplayUnit
  /** The draft while this cell is being edited, otherwise null. */
  draft: string | null
  selectAll: boolean
  onDraftChange: (draft: string) => void
  onEditKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onEditBlur: () => void
}

/** One week cell. Memoized on primitive props so a selection change re-renders only the cells it touches. */
const WeekCell = memo(function WeekCell({
  rowIndex,
  col,
  name,
  week,
  pct,
  hours,
  capHours,
  isOverride,
  beforeStart,
  unsaved,
  selected,
  focused,
  tabbable,
  unit,
  draft,
  selectAll,
  onDraftChange,
  onEditKeyDown,
  onEditBlur,
}: WeekCellProps) {
  const over = pct > 100
  const isEditing = draft !== null
  return (
    <td
      role="gridcell"
      data-row={rowIndex}
      data-col={col}
      tabIndex={tabbable ? 0 : -1}
      aria-selected={selected}
      aria-label={`${name}, week of ${week}: ${formatNumber(pct, 1)}%, ${formatNumber(hours, 1)} h, capacity ${formatNumber(capHours, 1)} h${beforeStart ? ', before start date' : isOverride ? ', weekly override' : ', allocation'}${over ? ', overallocated' : ''}${unsaved ? ', unsaved' : ''}`}
      className={cn(
        WEEK_COL,
        'relative h-9 cursor-cell select-none border-b border-l px-1.5 text-right text-xs tabular-nums outline-none',
        over && 'bg-warning/15 text-warning',
        !over && pct === 0 && 'text-muted/70',
        beforeStart && 'cursor-not-allowed bg-subtle/60',
        unsaved && 'italic outline-dashed outline-1 -outline-offset-4 outline-primary',
        !over && pct !== 0 && (isOverride ? 'font-medium text-foreground' : 'text-muted'),
        selected && 'bg-primary/10',
        focused && 'ring-2 ring-inset ring-primary',
      )}
    >
      {isEditing ? (
        <input
          autoFocus
          aria-label={`Load for ${name}, week of ${week}`}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onEditKeyDown}
          onBlur={onEditBlur}
          onFocus={(event) => {
            const input = event.target
            if (selectAll) input.select()
            else input.setSelectionRange(input.value.length, input.value.length)
          }}
          className="absolute inset-0 h-full w-full bg-surface px-1.5 text-right text-xs tabular-nums text-foreground outline-none"
        />
      ) : (
        <span className="flex items-center justify-end gap-0.5">
          {over && <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />}
          {beforeStart ? '—' : formatLoad(pct, hours, unit)}
        </span>
      )}
      {isOverride && !isEditing && (
        <span aria-hidden className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
      )}
    </td>
  )
})

interface RowHeaderProps {
  member: TeamMember
  name: string
  readOnly: boolean
  onApplyRange: (member: TeamMember) => void
  onResetAll: (member: TeamMember) => void
}

/** Sticky name cell with the row menu; memoized so selection changes skip the menu and its tooltip. */
const RowHeader = memo(function RowHeader({
  member,
  name,
  readOnly,
  onApplyRange,
  onResetAll,
}: RowHeaderProps) {
  return (
    <th scope="row" className={cn(NAME_COL, 'z-10 border-b bg-surface px-3 text-left text-sm font-medium')}>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate" title={name}>
          {name}
        </span>
        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                icon={MoreHorizontal}
                size="icon-sm"
                label={`Actions for ${name}`}
                tooltip="More actions for this row"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => onApplyRange(member)}>
                <CalendarRange className="h-4 w-4" aria-hidden />
                Apply % to a date range…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onResetAll(member)}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset all weeks to default
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </th>
  )
})
