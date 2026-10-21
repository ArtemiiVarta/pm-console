import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Pencil,
  Trash2,
  TrendingDown,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
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
import { MemberDialog, type MemberDialogMode } from '@/features/settings/team/MemberDialog'
import { getMarginPct } from '@/lib/forecast'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import {
  getInitials,
  getRoles,
  getRosterRows,
  sortRosterRows,
  type RosterRow,
  type RosterSortKey,
  type SortDirection,
} from '@/lib/roster'
import { getForecastSummary } from '@/lib/summary'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { Currency } from '@/store/types'

const ALL_ROLES = '__all__'

interface Column {
  key: RosterSortKey
  label: string
  numeric?: boolean
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'defaultLoadPct', label: 'Default load %', numeric: true },
  { key: 'weeklyHours', label: 'Weekly hours', numeric: true },
  { key: 'capacityPct', label: 'Capacity %', numeric: true },
  { key: 'costRate', label: 'Cost/h', numeric: true },
  { key: 'priceRate', label: 'Price/h', numeric: true },
  { key: 'marginPerHour', label: 'Margin/h', numeric: true },
  { key: 'marginPct', label: 'Margin %', numeric: true },
  { key: 'totalHours', label: 'Total hours', numeric: true },
  { key: 'totalMargin', label: 'Total margin', numeric: true },
]

const headClass = 'text-xs font-medium uppercase tracking-wide text-muted'

export function RosterSection() {
  const project = useAppStore((state) => state.project)
  const phases = useAppStore((state) => state.phases)
  const members = useAppStore((state) => state.members)

  const [dialog, setDialog] = useState<MemberDialogMode | null>(null)
  const [sort, setSort] = useState<{ key: RosterSortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  })
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES)

  const summary = useMemo(() => getForecastSummary({ project, phases, members }), [project, phases, members])
  const rows = useMemo(
    () => getRosterRows(members, summary.weeks, project.standardHoursPerWeek),
    [members, summary.weeks, project.standardHoursPerWeek],
  )
  const roles = useMemo(() => getRoles(members), [members])
  const activeFilter = roleFilter !== ALL_ROLES && roles.includes(roleFilter) ? roleFilter : ALL_ROLES
  const visible = useMemo(() => {
    const filtered =
      activeFilter === ALL_ROLES
        ? rows
        : rows.filter((row) => row.member.role.trim().toLowerCase() === activeFilter.toLowerCase())
    return sortRosterRows(filtered, sort.key, sort.direction)
  }, [rows, activeFilter, sort])

  const toggleSort = (key: RosterSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )

  const addButton = (
    <ActionButton
      icon={UserPlus}
      tooltip="Add a person to the forecast"
      onClick={() => setDialog({ kind: 'add' })}
    >
      Add team member
    </ActionButton>
  )

  return (
    <SectionCard
      icon={Users}
      title="Team members"
      description="Inactive members are greyed out and left out of every total."
      actions={members.length > 0 ? addButton : undefined}
    >
      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet"
          hint="Add the people whose time you are forecasting."
          action={addButton}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span id="role-filter-label" className="text-sm font-medium">
              Role
            </span>
            <Select value={activeFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-56" aria-labelledby="role-filter-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROLES}>All roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted">
              Showing {visible.length} of {members.length}
            </span>
          </div>

          <Table aria-label="Team members" containerClassName="max-h-[60vh] rounded-lg border">
            <TableHeader className="sticky top-0 z-10 bg-surface">
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((column) => (
                  <SortableHead
                    key={column.key}
                    column={column}
                    sort={sort.key === column.key ? sort.direction : null}
                    onSort={() => toggleSort(column.key)}
                  />
                ))}
                <TableHead className={cn(headClass, 'text-right')}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <MemberRow key={row.member.id} row={row} currency={project.currency} onDialog={setDialog} />
              ))}
            </TableBody>
            <TotalsFooter rows={visible} currency={project.currency} filtered={activeFilter !== ALL_ROLES} />
          </Table>
        </>
      )}
      <MemberDialog mode={dialog} onClose={() => setDialog(null)} />
    </SectionCard>
  )
}

function SortableHead({
  column,
  sort,
  onSort,
}: {
  column: Column
  sort: SortDirection | null
  onSort: () => void
}) {
  const Icon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ArrowUpDown
  const next = sort === 'asc' ? 'descending' : 'ascending'
  return (
    <TableHead
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'}
      className={cn(headClass, 'whitespace-nowrap px-2', column.numeric && 'text-right')}
    >
      <ActionButton
        variant="ghost"
        size="sm"
        icon={Icon}
        tooltip={`Sort by ${column.label.toLowerCase()}, ${next}`}
        onClick={onSort}
        className={cn(
          'h-7 gap-1 px-1.5 text-xs font-medium uppercase tracking-wide',
          sort ? 'text-foreground' : 'text-muted',
          column.numeric && 'flex-row-reverse',
        )}
      >
        {column.label}
      </ActionButton>
    </TableHead>
  )
}

function Money({ value, currency }: { value: number; currency: Currency }) {
  return (
    <span className={cn('inline-flex items-center justify-end gap-1', value < 0 && 'text-danger')}>
      {value < 0 && <TrendingDown className="h-3.5 w-3.5" aria-label="Negative" />}
      {formatCurrency(value, currency, 2)}
    </span>
  )
}

function Pct({ value }: { value: number }) {
  return (
    <span className={cn('inline-flex items-center justify-end gap-1', value < 0 && 'text-danger')}>
      {value < 0 && <TrendingDown className="h-3.5 w-3.5" aria-label="Negative" />}
      {formatPercent(value)}
    </span>
  )
}

function MemberRow({
  row,
  currency,
  onDialog,
}: {
  row: RosterRow
  currency: Currency
  onDialog: (mode: MemberDialogMode) => void
}) {
  const updateMember = useAppStore((state) => state.updateMember)
  const deleteMember = useAppStore((state) => state.deleteMember)
  const { member, fullName } = row
  const num = 'text-right tabular-nums'

  return (
    <TableRow
      className={cn('hover:bg-subtle/50', !member.active && 'text-muted')}
      data-testid={`member-row-${member.id}`}
    >
      <TableCell className="min-w-56">
        <div className={cn('flex items-center gap-3', !member.active && 'opacity-60')}>
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
          >
            {getInitials(member)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{fullName}</span>
              {!member.active && (
                <Badge variant="outline" className="font-normal text-muted">
                  Inactive
                </Badge>
              )}
            </div>
            <span className="block truncate text-xs text-muted">{member.email}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{member.role}</TableCell>
      <TableCell className={num}>{formatNumber(member.defaultLoadPct)}%</TableCell>
      <TableCell className={num}>{formatNumber(row.weeklyHours, 1)}</TableCell>
      <TableCell className={num}>{formatNumber(member.capacityPct)}%</TableCell>
      <TableCell className={num}>{formatCurrency(member.costRate, currency, 2)}</TableCell>
      <TableCell className={num}>{formatCurrency(member.priceRate, currency, 2)}</TableCell>
      <TableCell className={num}>
        <Money value={row.marginPerHour} currency={currency} />
      </TableCell>
      <TableCell className={num}>
        <Pct value={row.marginPct} />
      </TableCell>
      <TableCell className={num}>{formatNumber(row.totals.hours, 1)}</TableCell>
      <TableCell className={num}>
        <Money value={row.totals.margin} currency={currency} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            icon={Pencil}
            label={`Edit ${fullName}`}
            tooltip="Edit this team member"
            onClick={() => onDialog({ kind: 'edit', member })}
          />
          <IconButton
            icon={Copy}
            label={`Duplicate ${fullName}`}
            tooltip="Add a new person with the same role, load and rates"
            onClick={() => onDialog({ kind: 'duplicate', member })}
          />
          <IconButton
            icon={member.active ? UserX : UserCheck}
            label={member.active ? `Deactivate ${fullName}` : `Activate ${fullName}`}
            tooltip={
              member.active
                ? 'Deactivate: keep this person but leave them out of totals'
                : 'Activate: include this person in totals again'
            }
            onClick={() => {
              updateMember(member.id, { active: !member.active })
              toast.success(member.active ? `${fullName} deactivated` : `${fullName} activated`)
            }}
          />
          <ConfirmDialog
            title={`Delete ${fullName}?`}
            description="Their rates and weekly assignments will be removed from the forecast. Saved baselines keep their copy. This cannot be undone."
            onConfirm={() => {
              deleteMember(member.id)
              toast.success(`${fullName} deleted`)
            }}
            trigger={
              <IconButton icon={Trash2} label={`Delete ${fullName}`} tooltip="Delete this team member" />
            }
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

function TotalsFooter({
  rows,
  currency,
  filtered,
}: {
  rows: RosterRow[]
  currency: Currency
  filtered: boolean
}) {
  const active = rows.filter((row) => row.member.active)
  const hours = active.reduce((sum, row) => sum + row.totals.hours, 0)
  const margin = active.reduce((sum, row) => sum + row.totals.margin, 0)
  const revenue = active.reduce((sum, row) => sum + row.totals.revenue, 0)
  const weekly = active.reduce((sum, row) => sum + row.weeklyHours, 0)
  const num = 'text-right tabular-nums'

  return (
    <TableFooter className="sticky bottom-0 bg-subtle">
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={3}>
          Totals{filtered ? ' (filtered)' : ''} · {active.length} active
        </TableCell>
        <TableCell className={num}>{formatNumber(weekly, 1)}</TableCell>
        <TableCell colSpan={4} />
        <TableCell className={num}>
          <Pct value={getMarginPct(margin, revenue)} />
        </TableCell>
        <TableCell className={num}>{formatNumber(hours, 1)}</TableCell>
        <TableCell className={num}>
          <Money value={margin} currency={currency} />
        </TableCell>
        <TableCell />
      </TableRow>
    </TableFooter>
  )
}
