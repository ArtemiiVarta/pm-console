import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react'
import { toast } from 'sonner'
import { AssignmentRow, type RowEditing } from '@/features/settings/team/assignment/AssignmentRow'
import {
  DEFAULT_COL,
  NAME_COL,
  ROLE_COL,
  TOTAL_COL,
  WEEK_COL,
} from '@/features/settings/team/assignment/gridLayout'
import { GridTooltip, type GridTooltipTarget } from '@/features/settings/team/assignment/GridTooltip'
import { SelectionToolbar } from '@/features/settings/team/assignment/SelectionToolbar'
import {
  getFillRightUpdates,
  getPhaseLanes,
  getRange,
  getRangeCells,
  parseLoadInput,
  type CellPosition,
  type DisplayUnit,
  type PendingChange,
  type PendingChanges,
} from '@/lib/assignment'
import { formatCurrency, formatDate, formatNumber, formatWeekLabel } from '@/lib/format'
import {
  getMemberHours,
  getMemberLoadPct,
  getMemberWeekShare,
  getWeeklyTeamTotals,
  isBeforeStart,
  type WeeklyTeamTotals,
} from '@/lib/forecast'
import { getFullName } from '@/lib/roster'
import { getProjectRange, getWeekWorkingShare, WORKING_DAYS_PER_WEEK } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { useForecastSource } from '@/features/settings/team/forecastSource'
import type { Currency, ISODate, TeamMember } from '@/store/types'

interface AssignmentGridProps {
  members: TeamMember[]
  weeks: ISODate[]
  unit: DisplayUnit
  /** Baseline view: navigation and selection only, no edits. */
  readOnly: boolean
  /** Unsaved changes, to mark edited cells. */
  pending: PendingChanges
  /** Show the Cost and Revenue footer rows. */
  showFinancials: boolean
  /** Edits go to the pending set; nothing is saved until the user clicks Save changes. */
  onChange: (changes: PendingChange[]) => void
  onApplyRange: (member: TeamMember) => void
  onResetAll: (member: TeamMember) => void
}

interface EditState extends CellPosition {
  draft: string
  selectAll: boolean
}

const cellSelector = (pos: CellPosition) => `[data-row="${pos.row}"][data-col="${pos.col}"]`

function readCell(target: EventTarget | null): CellPosition | null {
  const cell = (target as HTMLElement | null)?.closest<HTMLElement>('[data-row][data-col]')
  if (!cell) return null
  return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) }
}

export function AssignmentGrid({
  members,
  weeks,
  unit,
  readOnly,
  pending,
  showFinancials,
  onChange,
  onApplyRange,
  onResetAll,
}: AssignmentGridProps) {
  const { project, phases } = useForecastSource()
  const std = project.standardHoursPerWeek

  const [anchor, setAnchor] = useState<CellPosition | null>(null)
  const [focus, setFocus] = useState<CellPosition | null>(null)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [tooltip, setTooltip] = useState<GridTooltipTarget | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const dragging = useRef(false)
  /** Mirrors `editing` so blur after Escape/Enter does not commit twice. */
  const editingRef = useRef<EditState | null>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  const wantsFocus = useRef(false)

  const lastRow = members.length - 1
  const lastCol = weeks.length - 1
  const range = anchor && focus ? getRange(anchor, focus) : null

  const lanes = useMemo(
    () => getPhaseLanes(weeks, phases, project.durationMode),
    [weeks, phases, project.durationMode],
  )
  const projectRange = useMemo(
    () => getProjectRange(phases, project.durationMode),
    [phases, project.durationMode],
  )
  const weeklyTotals = useMemo(
    () => getWeeklyTeamTotals(members, weeks, std, projectRange),
    [members, weeks, std, projectRange],
  )
  /** Working days of each week inside the project, for partial first and last weeks. */
  const projectDays = useMemo(
    () =>
      weeks.map((week) =>
        Math.round(getWeekWorkingShare(week, projectRange?.start, projectRange?.end) * WORKING_DAYS_PER_WEEK),
      ),
    [weeks, projectRange],
  )

  // Keep the selection inside the grid when rows or weeks change.
  const clamp = useCallback(
    (pos: CellPosition): CellPosition => ({
      row: Math.max(0, Math.min(lastRow, pos.row)),
      col: Math.max(0, Math.min(lastCol, pos.col)),
    }),
    [lastRow, lastCol],
  )

  // Move DOM focus to the focused cell after keyboard/mouse navigation.
  useEffect(() => {
    if (!focus || editing || !wantsFocus.current) return
    tableRef.current?.querySelector<HTMLElement>(cellSelector(focus))?.focus({ preventScroll: false })
  }, [focus, editing])

  useEffect(() => {
    // DOM focus is skipped while dragging (it forces layout on every step); focus the end cell on release.
    const stop = () => {
      if (!dragging.current) return
      dragging.current = false
      wantsFocus.current = true
      setFocus((current) => (current ? { ...current } : current))
    }
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const moveTo = (pos: CellPosition, extend = false) => {
    const next = clamp(pos)
    wantsFocus.current = !dragging.current
    setFocus(next)
    if (!extend) setAnchor(next)
  }

  const startEdit = (pos: CellPosition, draft?: string) => {
    if (readOnly) return
    const member = members[pos.row]
    const week = weeks[pos.col]
    if (!member || !week) return
    if (isBeforeStart(member, week)) {
      toast.info(
        `${getFullName(member)} starts on ${formatDate(member.startDate ?? week)}; earlier weeks are 0%.`,
      )
      return
    }
    const pct = getMemberLoadPct(member, week)
    const current =
      unit === 'pct' ? String(pct) : formatNumber(getMemberHours(member, week, std, projectRange), 2)
    const state = { ...pos, draft: draft ?? current, selectAll: draft === undefined }
    editingRef.current = state
    setEditing(state)
    setTooltip(null)
  }

  /** Applies the draft. Returns false (and keeps editing) when the input is invalid. */
  const commit = (): boolean => {
    const current = editingRef.current
    if (!current) return true
    const member = members[current.row]
    const weekStart = weeks[current.col]
    if (!member || !weekStart) return true
    // Hours in a partial week convert against the hours that week can hold.
    const share = getMemberWeekShare(member, weekStart, projectRange)
    const parsed = parseLoadInput(current.draft, unit, share > 0 ? std * share : std)
    if (parsed.kind === 'invalid') {
      toast.error(parsed.message)
      return false
    }
    onChange([{ memberId: member.id, weekStart, pct: parsed.kind === 'clear' ? null : parsed.pct }])
    editingRef.current = null
    setEditing(null)
    return true
  }

  const cancelEdit = () => {
    editingRef.current = null
    setEditing(null)
    wantsFocus.current = true
  }

  const onDraftChange = useCallback((draft: string) => {
    setEditing((current) => {
      if (!current) return current
      const next = { ...current, draft }
      editingRef.current = next
      return next
    })
  }, [])

  // The handlers below read the latest state through closures; rows only need stable references.
  const handlers = useRef({ commit, cancelEdit, moveTo })
  useLayoutEffect(() => {
    handlers.current = { commit, cancelEdit, moveTo }
  })

  const onEditKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    const current = editingRef.current
    if (!current) return
    if (event.key === 'Escape') {
      event.preventDefault()
      handlers.current.cancelEdit()
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      if (!handlers.current.commit()) return
      const step = event.key === 'Tab' && event.shiftKey ? -1 : 1
      handlers.current.moveTo({ row: current.row, col: current.col + step })
    }
  }, [])

  const onEditBlur = useCallback(() => {
    // Blur from clicking elsewhere commits; an invalid value is dropped instead of trapping focus.
    if (editingRef.current && !handlers.current.commit()) handlers.current.cancelEdit()
  }, [])

  const onCellKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    if (editing || !focus) return
    if (!(event.target as HTMLElement).matches('[data-row][data-col]')) return
    const { key, shiftKey } = event
    const arrows: Record<string, CellPosition> = {
      ArrowUp: { row: focus.row - 1, col: focus.col },
      ArrowDown: { row: focus.row + 1, col: focus.col },
      ArrowLeft: { row: focus.row, col: focus.col - 1 },
      ArrowRight: { row: focus.row, col: focus.col + 1 },
      Home: { row: focus.row, col: 0 },
      End: { row: focus.row, col: lastCol },
    }
    const target = arrows[key]
    if (target) {
      event.preventDefault()
      moveTo(target, shiftKey)
    } else if (key === 'Enter' || key === 'F2') {
      event.preventDefault()
      startEdit(focus)
    } else if (/^[0-9.,]$/.test(key) && !event.metaKey && !event.ctrlKey) {
      event.preventDefault()
      startEdit(focus, key)
    } else if ((key === 'Delete' || key === 'Backspace') && range && !readOnly) {
      event.preventDefault()
      resetSelection()
    } else if (key === 'Escape') {
      setAnchor(focus)
    }
  }

  const onMouseDown = (event: MouseEvent<HTMLTableSectionElement>) => {
    const pos = readCell(event.target)
    if (!pos || event.button !== 0) return
    if (editing && editing.row === pos.row && editing.col === pos.col) return
    event.preventDefault()
    if (editingRef.current && !commit()) cancelEdit()
    dragging.current = true
    window.clearTimeout(hoverTimer.current)
    setTooltip(null)
    moveTo(pos, event.shiftKey && anchor !== null)
  }

  const onMouseOver = (event: MouseEvent<HTMLTableSectionElement>) => {
    const pos = readCell(event.target)
    if (pos && dragging.current) {
      if (pos.row !== focus?.row || pos.col !== focus.col) moveTo(pos, true)
      return
    }
    window.clearTimeout(hoverTimer.current)
    if (!pos || dragging.current || editing) {
      setTooltip(null)
      return
    }
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-row][data-col]')
    hoverTimer.current = window.setTimeout(() => {
      if (cell) setTooltip({ ...pos, rect: cell.getBoundingClientRect() })
    }, 300)
  }

  // Keyboard focus arriving from outside (Tab) makes that cell the current one.
  const onCellFocus = (event: FocusEvent<HTMLTableSectionElement>) => {
    const pos = readCell(event.target)
    if (!pos || !(event.target as HTMLElement).matches('[data-row][data-col]')) return
    if (focus?.row === pos.row && focus.col === pos.col) return
    setFocus(pos)
    setAnchor(pos)
  }

  const onDoubleClick = (event: MouseEvent<HTMLTableSectionElement>) => {
    const pos = readCell(event.target)
    if (pos && !editing) startEdit(pos)
  }

  const onMouseLeave = () => {
    window.clearTimeout(hoverTimer.current)
    setTooltip(null)
  }

  /** Selected cells, minus weeks before a member's start date (always 0%). */
  const editableCells = () => {
    if (!range) return []
    const byId = new Map(members.map((member) => [member.id, member]))
    return getRangeCells(range, members, weeks).filter((cell) => {
      const member = byId.get(cell.memberId)
      return member !== undefined && !isBeforeStart(member, cell.weekStart)
    })
  }

  const resetSelection = () => {
    onChange(editableCells().map((cell) => ({ ...cell, pct: null })))
  }

  const setSelection = (pct: number) => {
    onChange(editableCells().map((cell) => ({ ...cell, pct })))
  }

  const fillRight = () => {
    if (!range) return
    const byId = new Map(members.map((member) => [member.id, member]))
    onChange(
      getFillRightUpdates(range, members, weeks).filter((update) => {
        const member = byId.get(update.memberId)
        return member !== undefined && !isBeforeStart(member, update.weekStart)
      }),
    )
  }

  const tooltipText = (() => {
    if (!tooltip) return null
    const member = members[tooltip.row]
    const week = weeks[tooltip.col]
    if (!member || !week) return null
    const pct = getMemberLoadPct(member, week)
    const hours = getMemberHours(member, week, std, projectRange)
    const days = Math.round(getMemberWeekShare(member, week, projectRange) * WORKING_DAYS_PER_WEEK)
    const partial = days < WORKING_DAYS_PER_WEEK ? ` · ${days} of ${WORKING_DAYS_PER_WEEK} working days` : ''
    return `Week of ${formatWeekLabel(week)} · ${formatNumber(pct, 1)}%${partial} · ${formatNumber(hours, 1)} h · developer capacity ${formatNumber(hours * (member.capacityPct / 100), 1)} h${pending[member.id]?.[week] !== undefined ? ' · unsaved' : ''}`
  })()

  const headCell = 'border-b bg-surface text-xs font-medium uppercase tracking-wide text-muted'

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <SelectionToolbar
          range={range}
          onSetLoad={setSelection}
          onReset={resetSelection}
          onFillRight={fillRight}
          onClear={() => focus && setAnchor(focus)}
        />
      )}
      <p className="text-xs text-muted">
        {readOnly
          ? 'Read only: baseline values cannot be changed. You can still move around and select cells.'
          : 'Click a cell and type to change one week; Enter or Tab moves to the next week, Esc cancels. Leave a cell empty to go back to the allocation. Changes are marked with a dashed outline until you save them.'}
      </p>
      <div className="max-h-[70vh] overflow-auto rounded-lg border">
        <table
          ref={tableRef}
          role="grid"
          aria-label="Planned allocation"
          aria-rowcount={members.length}
          className="w-max border-separate border-spacing-0 text-sm"
        >
          <thead className="sticky top-0 z-20">
            {lanes.map((lane, laneIndex) => {
              const cells: ReactElement[] = []
              let col = 0
              for (const band of lane) {
                if (band.startIndex > col) {
                  cells.push(<th key={`gap-${col}`} colSpan={band.startIndex - col} className="bg-surface" />)
                }
                cells.push(
                  <th
                    key={band.phase.id}
                    colSpan={band.endIndex - band.startIndex + 1}
                    scope="colgroup"
                    className="bg-surface px-0.5 pt-1 text-left"
                  >
                    {/* Phase color comes from data. */}
                    <div
                      className="truncate rounded px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: band.phase.color }}
                      title={band.phase.name}
                    >
                      {band.phase.name}
                    </div>
                  </th>,
                )
                col = band.endIndex + 1
              }
              if (col <= lastCol)
                cells.push(<th key="gap-end" colSpan={lastCol - col + 1} className="bg-surface" />)
              return (
                <tr key={`lane-${laneIndex}`}>
                  <th
                    colSpan={3}
                    className="sticky left-0 z-10 bg-surface px-3 pt-1 text-left text-xs font-medium text-muted"
                  >
                    {laneIndex === 0 ? 'Phases' : ''}
                  </th>
                  {cells}
                  <th className={cn(TOTAL_COL, 'z-10 bg-surface')} />
                </tr>
              )
            })}
            <tr>
              <th scope="col" className={cn(NAME_COL, headCell, 'z-10 px-3 py-2 text-left')}>
                Name
              </th>
              <th scope="col" className={cn(ROLE_COL, headCell, 'z-10 px-3 py-2 text-left')}>
                Role
              </th>
              <th scope="col" className={cn(DEFAULT_COL, headCell, 'z-10 border-r px-3 py-2 text-right')}>
                Allocation
              </th>
              {weeks.map((week, col) => {
                const days = projectDays[col] ?? WORKING_DAYS_PER_WEEK
                const partial = days < WORKING_DAYS_PER_WEEK
                return (
                  <th
                    key={week}
                    scope="col"
                    title={
                      partial
                        ? `Partial week: ${days} of ${WORKING_DAYS_PER_WEEK} working days are in the project; hours are pro-rated`
                        : undefined
                    }
                    className={cn(
                      WEEK_COL,
                      headCell,
                      'border-l px-1 py-2 text-center normal-case tabular-nums',
                    )}
                  >
                    {formatWeekLabel(week)}
                    {partial && (
                      <span className="block text-[10px] font-normal text-muted">
                        {days}/{WORKING_DAYS_PER_WEEK} days
                      </span>
                    )}
                  </th>
                )
              })}
              <th scope="col" className={cn(TOTAL_COL, headCell, 'z-10 border-l px-3 py-2 text-right')}>
                Total h
              </th>
            </tr>
          </thead>
          <tbody
            onKeyDown={onCellKeyDown}
            onMouseDown={onMouseDown}
            onMouseOver={onMouseOver}
            onDoubleClick={onDoubleClick}
            onFocus={onCellFocus}
            onMouseLeave={onMouseLeave}
          >
            {members.map((member, row) => {
              const inRange = range && row >= range.top && row <= range.bottom
              const rowEditing: RowEditing | null =
                editing && editing.row === row
                  ? { col: editing.col, draft: editing.draft, selectAll: editing.selectAll }
                  : null
              return (
                <AssignmentRow
                  key={member.id}
                  rowIndex={row}
                  member={member}
                  weeks={weeks}
                  standardHoursPerWeek={std}
                  projectRange={projectRange}
                  unit={unit}
                  selectedLeft={inRange ? range.left : -1}
                  selectedRight={inRange ? range.right : -1}
                  focusedCol={focus?.row === row ? focus.col : -1}
                  tabbableCol={focus ? (focus.row === row ? focus.col : -1) : row === 0 ? 0 : -1}
                  editing={rowEditing}
                  onDraftChange={onDraftChange}
                  onEditKeyDown={onEditKeyDown}
                  onEditBlur={onEditBlur}
                  readOnly={readOnly}
                  pendingWeeks={pending[member.id]}
                  onApplyRange={onApplyRange}
                  onResetAll={onResetAll}
                />
              )
            })}
          </tbody>
          <GridFooter
            weeks={weeks}
            weeklyTotals={weeklyTotals}
            currency={project.currency}
            showFinancials={showFinancials}
          />
        </table>
      </div>
      <GridTooltip target={tooltip} text={tooltipText} />
    </div>
  )
}

interface GridFooterProps {
  weeks: ISODate[]
  weeklyTotals: WeeklyTeamTotals[]
  currency: Currency
  showFinancials: boolean
}

/** Weekly team totals; memoized so selection and focus changes skip these rows. */
const GridFooter = memo(function GridFooter({
  weeks,
  weeklyTotals,
  currency,
  showFinancials,
}: GridFooterProps) {
  const money = (value: number) => formatCurrency(value, currency)
  const grandTotals = weeklyTotals.reduce(
    (sum, week) => ({
      hours: sum.hours + week.hours,
      capacityHours: sum.capacityHours + week.capacityHours,
      cost: sum.cost + week.cost,
      revenue: sum.revenue + week.revenue,
    }),
    { hours: 0, capacityHours: 0, cost: 0, revenue: 0 },
  )
  const allRows = [
    {
      label: 'Planned hours',
      values: weeklyTotals.map((w) => formatNumber(w.hours, 1)),
      total: formatNumber(grandTotals.hours, 1),
    },
    {
      label: 'Developer capacity',
      values: weeklyTotals.map((w) => formatNumber(w.capacityHours, 1)),
      total: formatNumber(grandTotals.capacityHours, 1),
    },
    {
      label: 'Cost',
      financial: true,
      values: weeklyTotals.map((w) => money(w.cost)),
      total: money(grandTotals.cost),
    },
    {
      label: 'Revenue',
      financial: true,
      values: weeklyTotals.map((w) => money(w.revenue)),
      total: money(grandTotals.revenue),
    },
  ]
  const footerRows = showFinancials ? allRows : allRows.filter((row) => !row.financial)

  return (
    <tfoot>
      {footerRows.map((footer, index) => (
        <tr key={footer.label}>
          <th
            scope="row"
            colSpan={3}
            className={cn(
              'sticky left-0 z-10 border-r bg-subtle px-3 py-2 text-left text-xs font-medium',
              index === 0 && 'border-t',
            )}
          >
            {footer.label}
          </th>
          {footer.values.map((value, col) => (
            <td
              key={weeks[col]}
              className={cn(
                WEEK_COL,
                'border-l bg-subtle px-1.5 py-2 text-right text-xs tabular-nums',
                index === 0 && 'border-t font-medium',
              )}
            >
              {value}
            </td>
          ))}
          <td
            className={cn(
              TOTAL_COL,
              'z-10 border-l bg-subtle px-3 py-2 text-right text-xs font-medium tabular-nums',
              index === 0 && 'border-t',
            )}
          >
            {footer.total}
          </td>
        </tr>
      ))}
    </tfoot>
  )
})
