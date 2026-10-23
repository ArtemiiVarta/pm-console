import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  LayoutGrid,
  Plus,
  Trash2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ActionButton } from '@/components/ActionButton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconButton } from '@/components/IconButton'
import { PageHeader } from '@/components/PageHeader'
import { SectionCard } from '@/components/SectionCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePendingAllocation } from '@/features/settings/team/assignment/usePendingAllocation'
import { formatCurrency, formatDate, formatPercent } from '@/lib/format'
import { getProjectSummaries, type ProjectSummary } from '@/lib/projects'
import { getStatusLabel, STATUS_CLASSES } from '@/lib/projectStatus'
import { getTileWeights, squarify } from '@/lib/treemap'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { ProjectStatus } from '@/store/types'

const STATUS_ICON: Record<ProjectStatus, LucideIcon> = {
  green: CheckCircle2,
  amber: AlertTriangle,
  red: XCircle,
}

const head = 'text-xs font-medium uppercase tracking-wide text-muted'

export function ProjectsPage() {
  const library = useAppStore((state) => state.library)
  const activeProjectId = useAppStore((state) => state.activeProjectId)
  const openProject = useAppStore((state) => state.openProject)
  const createProject = useAppStore((state) => state.createProject)
  const deleteProject = useAppStore((state) => state.deleteProject)
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null)

  const projects = useMemo(() => getProjectSummaries(library), [library])
  const tiles = useMemo(() => {
    const weights = getTileWeights(projects.map((project) => project.revenue))
    return squarify(
      projects.map((project, index) => ({ ...project, value: weights[index] ?? 1 })),
      100,
      100,
    )
  }, [projects])

  const open = (id: string) => {
    // Unsaved grid edits belong to the project being left.
    usePendingAllocation.getState().discard()
    openProject(id)
    navigate('/settings/general')
  }

  const create = () => {
    usePendingAllocation.getState().discard()
    createProject()
    toast.success('New project created', { description: 'Fill in the project details.' })
    navigate('/settings/general')
  }

  const newButton = (
    <ActionButton icon={Plus} tooltip="Create a new project and open its details" onClick={create}>
      New project
    </ActionButton>
  )

  return (
    <>
      <PageHeader
        icon={LayoutGrid}
        title="Projects"
        description="Tile size follows forecast revenue; color shows the project status. Click a project to open it."
        actions={newButton}
      />

      <SectionCard icon={LayoutGrid} title="Portfolio" description="Larger tile = higher forecast revenue.">
        <div className="flex flex-wrap gap-3 text-xs text-muted" aria-label="Legend">
          {(['green', 'amber', 'red'] as const).map((status) => {
            const Icon = STATUS_ICON[status]
            return (
              <span key={status} className="flex items-center gap-1.5">
                <span aria-hidden className={cn('h-3 w-3 rounded-sm', STATUS_CLASSES[status].dot)} />
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {getStatusLabel(status)}
              </span>
            )
          })}
        </div>
        <div
          role="list"
          aria-label="Projects by revenue"
          className="relative h-[60vh] min-h-[22rem] w-full overflow-hidden rounded-lg border bg-subtle"
        >
          {tiles.map((tile) => (
            <ProjectTile
              key={tile.id}
              project={tile}
              rect={tile}
              active={tile.id === activeProjectId}
              onOpen={() => open(tile.id)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={FolderOpen} title="All projects" description="The same projects as a list.">
        <Table aria-label="All projects" containerClassName="rounded-lg border">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={head}>Project</TableHead>
              <TableHead className={head}>Status</TableHead>
              <TableHead className={cn(head, 'text-right')}>Forecast revenue</TableHead>
              <TableHead className={cn(head, 'text-right')}>Margin %</TableHead>
              <TableHead className={head}>Dates</TableHead>
              <TableHead className={cn(head, 'text-right')}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const Icon = STATUS_ICON[project.status]
              return (
                <TableRow key={project.id} className="hover:bg-subtle/50">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => open(project.id)}
                      className="rounded text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {project.name}
                    </button>
                    {project.client && <div className="text-xs text-muted">{project.client}</div>}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'flex items-center gap-1.5 font-medium',
                        STATUS_CLASSES[project.status].text,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {getStatusLabel(project.status)}
                    </span>
                    {project.rationale && (
                      <div className="max-w-xs truncate text-xs text-muted">{project.rationale}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(project.revenue, project.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {project.revenue > 0 ? formatPercent(project.marginPct) : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted">
                    {project.start && project.end
                      ? `${formatDate(project.start)} – ${formatDate(project.end)}`
                      : 'No phases yet'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <IconButton
                        icon={FolderOpen}
                        label={`Open ${project.name}`}
                        tooltip="Open this project's settings"
                        onClick={() => open(project.id)}
                      />
                      <IconButton
                        icon={Trash2}
                        label={`Delete ${project.name}`}
                        tooltip="Delete this project"
                        onClick={() => setDeleting(project)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </SectionCard>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(isOpen) => !isOpen && setDeleting(null)}
        title={deleting ? `Delete “${deleting.name}”?` : 'Delete project?'}
        description="The project and everything in it — schedule, team, planned allocation and baselines — are removed. This cannot be undone."
        onConfirm={() => {
          if (!deleting) return
          deleteProject(deleting.id)
          toast.success(`“${deleting.name}” deleted`)
        }}
      />
    </>
  )
}

function ProjectTile({
  project,
  rect,
  active,
  onOpen,
}: {
  project: ProjectSummary
  rect: { x: number; y: number; w: number; h: number }
  active: boolean
  onOpen: () => void
}) {
  const Icon = STATUS_ICON[project.status]
  const area = rect.w * rect.h
  // Bigger tiles get bigger text, like a market heat map.
  const nameSize = area > 1500 ? 'text-3xl' : area > 500 ? 'text-xl' : area > 150 ? 'text-base' : 'text-xs'
  const showDetails = area > 300
  return (
    <div
      role="listitem"
      className="absolute p-0.5"
      style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`${project.name}, status ${getStatusLabel(project.status)}, forecast revenue ${formatCurrency(project.revenue, project.currency)}${project.rationale ? `. ${project.rationale}` : ''}. Open project`}
            className={cn(
              'flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-md p-2 text-center text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground',
              STATUS_CLASSES[project.status].tile,
              active && 'ring-2 ring-inset ring-white/80',
            )}
          >
            <span className={cn('max-w-full truncate font-semibold tracking-tight', nameSize)}>
              {project.name}
            </span>
            {showDetails && (
              <>
                {project.client && (
                  <span className="max-w-full truncate text-xs opacity-90">{project.client}</span>
                )}
                <span className="text-sm font-medium tabular-nums opacity-95">
                  {formatCurrency(project.revenue, project.currency)}
                </span>
                <span className="flex items-center gap-1 text-xs opacity-90">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {getStatusLabel(project.status)}
                </span>
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{project.name}</p>
          <p>
            {getStatusLabel(project.status)} · {formatCurrency(project.revenue, project.currency)} forecast
            revenue
          </p>
          {project.rationale && <p className="opacity-80">{project.rationale}</p>}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
