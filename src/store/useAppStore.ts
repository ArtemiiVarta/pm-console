import { addWeeks } from 'date-fns'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildBaseline } from '@/lib/baseline'
import { getWeekStart, parseISODate, toISODate } from '@/lib/dates'
import { storageKey } from '@/lib/env'
import { getPhaseColor } from '@/lib/palette'
import {
  fitSchedule,
  getDescendantIds,
  moveNode,
  setNodeRange,
  sortByOrder,
  withoutOrphans,
} from '@/lib/scheduleTree'
import type {
  ForecastBaseline,
  ISODate,
  Milestone,
  Phase,
  Project,
  ScheduleItem,
  TeamMember,
} from '@/store/types'

export const STORE_KEY = storageKey('v1')
export const STORE_VERSION = 4

const MIN_LOAD_PCT = 0
const MAX_LOAD_PCT = 200

export type ProjectPatch = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>
export type NewPhase = Omit<Phase, 'id' | 'order' | 'color'> & { color?: string }
export type PhasePatch = Partial<Omit<Phase, 'id' | 'order'>>
export type NewTeamMember = Omit<
  TeamMember,
  'id' | 'weeklyOverrides' | 'defaultLoadPct' | 'capacityPct' | 'active'
> &
  Partial<Pick<TeamMember, 'weeklyOverrides' | 'defaultLoadPct' | 'capacityPct' | 'active'>>
export type TeamMemberPatch = Partial<Omit<TeamMember, 'id'>>
export type NewMilestone = Omit<Milestone, 'id'>
export type NewScheduleItem = Omit<ScheduleItem, 'id' | 'order'>
export type ScheduleItemPatch = Partial<Omit<ScheduleItem, 'id' | 'parentId'>>
export interface FitOptions {
  fitStart: boolean
  fitEnd: boolean
}
export type MilestonePatch = Partial<NewMilestone>

export interface AppData {
  project: Project
  phases: Phase[]
  /** Tasks and milestones under phases (and sub-items under tasks). */
  items: ScheduleItem[]
  milestones: Milestone[]
  members: TeamMember[]
  baselines: ForecastBaseline[]
  /** Baseline compared in Forecast vs Actual. */
  selectedBaselineId: string | null
}

/** Every project on this device (or synced from GitHub), keyed by project id. */
export interface Workspace {
  library: Record<string, AppData>
  /** The open project; its data is also spread at the top level of the state. */
  activeProjectId: string
}

export interface AppActions {
  /** Adds an empty project and opens it; returns its id. */
  createProject: () => string
  /** Opens another project (the current one is already saved in the library). */
  openProject: (id: string) => void
  /** Deletes a project; if it was open, another (or a new empty one) is opened. */
  deleteProject: (id: string) => void
  /** Replaces every project at once (backup import, GitHub sync). */
  replaceWorkspace: (workspace: Workspace) => void

  updateProject: (patch: ProjectPatch) => void

  addPhase: (phase: NewPhase) => string
  updatePhase: (id: string, patch: PhasePatch) => void
  deletePhase: (id: string) => void

  /** Adds a task or milestone under a phase or task; `parentFit` sets the parent's adjust-to-children options. */
  addItem: (item: NewScheduleItem, parentFit?: FitOptions) => string
  updateItem: (id: string, patch: ScheduleItemPatch, parentFit?: FitOptions) => void
  /** Deletes the item and everything under it. */
  deleteItem: (id: string) => void
  /** Moves an item up (-1) or down (+1) among its siblings. */
  moveItemOrder: (id: string, direction: -1 | 1) => void
  /** "Adjust start/end date to children" on a phase or task. */
  setFit: (id: string, fit: FitOptions) => void
  /** Drag on the Gantt: shift a phase, item or project milestone (with its children) by days. */
  moveScheduleNode: (id: string, days: number) => void
  /** Drag an edge on the Gantt: set start and pinned end of a phase or task. */
  setScheduleNodeRange: (id: string, start: ISODate, end: ISODate) => void

  addMilestone: (milestone: NewMilestone) => string
  updateMilestone: (id: string, patch: MilestonePatch) => void
  deleteMilestone: (id: string) => void
  /** Inserts a copy right after the original, named "<name> (copy)"; returns the new id or null. */
  duplicatePhase: (id: string) => string | null
  /** Reorders phases to match `orderedIds`; unknown ids are ignored, missing phases keep their relative order at the end. */
  reorderPhases: (orderedIds: string[]) => void

  addMember: (member: NewTeamMember) => string
  updateMember: (id: string, patch: TeamMemberPatch) => void
  deleteMember: (id: string) => void
  setWeeklyOverride: (memberId: string, weekStart: ISODate, pct: number) => void
  clearWeeklyOverride: (memberId: string, weekStart: ISODate) => void
  /** Sets the same load % for every week from `fromWeek` to `toWeek` (inclusive, either order). */
  applyLoadToRange: (memberId: string, fromWeek: ISODate, toWeek: ISODate, pct: number) => void
  /** Sets many weekly overrides in one update (grid edits across cells and members). */
  setWeeklyOverrides: (updates: WeeklyOverrideUpdate[]) => void
  /** Removes many weekly overrides in one update. */
  clearWeeklyOverrides: (cells: WeeklyCell[]) => void
  /** Removes every weekly override for a member. */
  clearAllWeeklyOverrides: (memberId: string) => void

  createBaseline: (name: string, description?: string) => ForecastBaseline
  /** Deletes a baseline. Refused (returns false) for the one selected for Forecast vs Actual. */
  deleteBaseline: (id: string) => boolean
  /** Replaces the working project, phases and team with a copy of the baseline's snapshot. */
  restoreBaseline: (id: string) => boolean
  selectBaseline: (id: string | null) => void
  /** Replaces the open project's data at once. */
  replaceData: (data: AppData) => void
}

export interface WeeklyCell {
  memberId: string
  weekStart: ISODate
}

export interface WeeklyOverrideUpdate extends WeeklyCell {
  pct: number
}

export type AppState = AppData & Workspace & AppActions

const DATA_KEYS = [
  'project',
  'phases',
  'items',
  'milestones',
  'members',
  'baselines',
  'selectedBaselineId',
] as const

/** The open project's data from the full state. */
export function pickData(state: AppData): AppData {
  const { project, phases, items, milestones, members, baselines, selectedBaselineId } = state
  return { project, phases, items, milestones, members, baselines, selectedBaselineId }
}

function sameData(a: AppData, b: AppData): boolean {
  return DATA_KEYS.every((key) => a[key] === b[key])
}

/** A workspace with one empty project. */
export function createInitialWorkspace(): Workspace & AppData {
  const data = createInitialData()
  return { ...data, library: { [data.project.id]: data }, activeProjectId: data.project.id }
}

/** Opens `id` from a library, falling back to the first project (or a new one). */
function openFrom(library: Record<string, AppData>, id: string | undefined): Workspace & AppData {
  const activeId = id && library[id] ? id : Object.keys(library)[0]
  if (!activeId) return createInitialWorkspace()
  const data = library[activeId] as AppData
  return { ...data, library, activeProjectId: activeId }
}

const newId = () => crypto.randomUUID()
const nowISO = () => new Date().toISOString()
const clampLoad = (pct: number) => Math.min(MAX_LOAD_PCT, Math.max(MIN_LOAD_PCT, pct))

export function createEmptyProject(): Project {
  const now = nowISO()
  return {
    id: newId(),
    name: '',
    client: '',
    status: 'green',
    statusRationale: '',
    currency: 'CAD',
    standardHoursPerWeek: 40,
    durationMode: 'working',
    createdAt: now,
    updatedAt: now,
  }
}

/** Brings data saved under an older STORE_VERSION up to date. */
export function migrateData(persisted: unknown, version: number): AppData {
  let data = persisted as AppData
  // v2 added project milestones, v3 added tasks/sub-items, v4 added project status.
  if (version < 3) {
    const partial = persisted as Partial<AppData>
    data = { ...data, milestones: partial.milestones ?? [], items: partial.items ?? [] }
  }
  if (version < 4) {
    data = {
      ...data,
      project: {
        ...data.project,
        status: data.project.status ?? 'green',
        statusRationale: data.project.statusRationale ?? '',
      },
    }
  }
  return data
}

/** Upgrades what was saved in localStorage: up to v3 one project, from v4 a library of projects. */
export function migrateStore(persisted: unknown, version: number): Workspace {
  if (version < 4) {
    const data = migrateData(persisted, version)
    return { library: { [data.project.id]: data }, activeProjectId: data.project.id }
  }
  return persisted as Workspace
}

export function createInitialData(): AppData {
  return {
    project: createEmptyProject(),
    phases: [],
    items: [],
    milestones: [],
    members: [],
    baselines: [],
    selectedBaselineId: null,
  }
}

/** Phases sorted by `order` with `order` renumbered 0..n-1. */
function normalizeOrder(phases: Phase[]): Phase[] {
  return [...phases].sort((a, b) => a.order - b.order).map((phase, order) => ({ ...phase, order }))
}

/** Re-applies "adjust to children" after any schedule change (drops items whose parent is gone). */
function refit(
  state: Pick<AppData, 'project'>,
  phases: Phase[],
  items: ScheduleItem[],
): Pick<AppData, 'phases' | 'items'> {
  return fitSchedule(phases, withoutOrphans(phases, items), state.project.durationMode)
}

function applyFit(items: ScheduleItem[], phases: Phase[], parentId: string, fit: FitOptions | undefined) {
  if (!fit) return { phases, items }
  return {
    phases: phases.map((phase) => (phase.id === parentId ? { ...phase, ...fit } : phase)),
    items: items.map((item) => (item.id === parentId ? { ...item, ...fit } : item)),
  }
}

function mapMember(members: TeamMember[], id: string, update: (member: TeamMember) => TeamMember) {
  return members.map((member) => (member.id === id ? update(member) : member))
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createInitialWorkspace(),

      createProject: () => {
        const data = createInitialData()
        set((state) => ({
          ...data,
          library: { ...state.library, [data.project.id]: data },
          activeProjectId: data.project.id,
        }))
        return data.project.id
      },
      openProject: (id) => set((state) => (state.library[id] ? openFrom(state.library, id) : {})),
      deleteProject: (id) =>
        set((state) => {
          const library = { ...state.library }
          delete library[id]
          if (id !== state.activeProjectId) return { library }
          if (Object.keys(library).length === 0) return createInitialWorkspace()
          return openFrom(library, undefined)
        }),
      replaceWorkspace: ({ library, activeProjectId }) => set(openFrom(library, activeProjectId)),

      updateProject: (patch) =>
        set((state) => {
          const project = { ...state.project, ...patch, updatedAt: nowISO() }
          // Day counting can change task ends, so parents are refitted.
          return { project, ...refit({ project }, state.phases, state.items) }
        }),

      addPhase: ({ color, ...phase }) => {
        const id = newId()
        set((state) => ({
          phases: [
            ...state.phases,
            { ...phase, id, order: state.phases.length, color: color ?? getPhaseColor(state.phases.length) },
          ],
        }))
        return id
      },
      updatePhase: (id, patch) =>
        set((state) =>
          refit(
            state,
            state.phases.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)),
            state.items,
          ),
        ),
      deletePhase: (id) =>
        set((state) =>
          // Its tasks and milestones go with it (orphans are dropped by refit).
          refit(state, normalizeOrder(state.phases.filter((phase) => phase.id !== id)), state.items),
        ),
      duplicatePhase: (id) => {
        const original = get().phases.find((phase) => phase.id === id)
        if (!original) return null
        const copyId = newId()
        set((state) => {
          const ordered = normalizeOrder(state.phases)
          const copy: Phase = {
            ...original,
            id: copyId,
            name: `${original.name} (copy)`,
            color: getPhaseColor(state.phases.length),
          }
          ordered.splice(ordered.findIndex((phase) => phase.id === id) + 1, 0, copy)
          return { phases: ordered.map((phase, order) => ({ ...phase, order })) }
        })
        return copyId
      },
      reorderPhases: (orderedIds) =>
        set((state) => {
          const rank = new Map(orderedIds.map((id, index) => [id, index]))
          const sorted = normalizeOrder(state.phases).sort(
            (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.order - b.order,
          )
          return { phases: sorted.map((phase, order) => ({ ...phase, order })) }
        }),

      addMember: (member) => {
        const id = newId()
        set((state) => ({
          members: [
            ...state.members,
            { defaultLoadPct: 100, capacityPct: 100, active: true, weeklyOverrides: {}, ...member, id },
          ],
        }))
        return id
      },
      updateMember: (id, patch) =>
        set((state) => ({ members: mapMember(state.members, id, (member) => ({ ...member, ...patch })) })),
      deleteMember: (id) => set((state) => ({ members: state.members.filter((member) => member.id !== id) })),
      setWeeklyOverride: (memberId, weekStart, pct) =>
        set((state) => ({
          members: mapMember(state.members, memberId, (member) => ({
            ...member,
            weeklyOverrides: { ...member.weeklyOverrides, [getWeekStart(weekStart)]: clampLoad(pct) },
          })),
        })),
      clearWeeklyOverride: (memberId, weekStart) =>
        set((state) => ({
          members: mapMember(state.members, memberId, (member) => {
            const weeklyOverrides = { ...member.weeklyOverrides }
            delete weeklyOverrides[getWeekStart(weekStart)]
            return { ...member, weeklyOverrides }
          }),
        })),
      applyLoadToRange: (memberId, fromWeek, toWeek, pct) =>
        set((state) => {
          let week = parseISODate(getWeekStart(fromWeek))
          let last = parseISODate(getWeekStart(toWeek))
          if (last < week) [week, last] = [last, week]
          const updates: Record<ISODate, number> = {}
          for (; week <= last; week = addWeeks(week, 1)) updates[toISODate(week)] = clampLoad(pct)
          return {
            members: mapMember(state.members, memberId, (member) => ({
              ...member,
              weeklyOverrides: { ...member.weeklyOverrides, ...updates },
            })),
          }
        }),
      setWeeklyOverrides: (updates) =>
        set((state) => {
          const byMember = new Map<string, Record<ISODate, number>>()
          for (const { memberId, weekStart, pct } of updates) {
            const entry = byMember.get(memberId) ?? {}
            entry[getWeekStart(weekStart)] = clampLoad(pct)
            byMember.set(memberId, entry)
          }
          return {
            members: state.members.map((member) => {
              const changes = byMember.get(member.id)
              return changes
                ? { ...member, weeklyOverrides: { ...member.weeklyOverrides, ...changes } }
                : member
            }),
          }
        }),
      clearWeeklyOverrides: (cells) =>
        set((state) => {
          const byMember = new Map<string, Set<ISODate>>()
          for (const { memberId, weekStart } of cells) {
            const weeks = byMember.get(memberId) ?? new Set<ISODate>()
            weeks.add(getWeekStart(weekStart))
            byMember.set(memberId, weeks)
          }
          return {
            members: state.members.map((member) => {
              const weeks = byMember.get(member.id)
              if (!weeks) return member
              const weeklyOverrides = Object.fromEntries(
                Object.entries(member.weeklyOverrides).filter(([week]) => !weeks.has(week)),
              )
              return { ...member, weeklyOverrides }
            }),
          }
        }),
      clearAllWeeklyOverrides: (memberId) =>
        set((state) => ({
          members: mapMember(state.members, memberId, (member) => ({ ...member, weeklyOverrides: {} })),
        })),

      createBaseline: (name, description) => {
        const { project, phases, members } = get()
        const baseline = buildBaseline({
          id: newId(),
          name,
          description,
          createdAt: nowISO(),
          forecast: { project, phases, members },
        })
        set((state) => ({ baselines: [...state.baselines, baseline] }))
        return baseline
      },
      deleteBaseline: (id) => {
        if (get().selectedBaselineId === id) return false
        set((state) => ({ baselines: state.baselines.filter((baseline) => baseline.id !== id) }))
        return true
      },
      restoreBaseline: (id) => {
        const baseline = get().baselines.find((b) => b.id === id)
        if (!baseline) return false
        // Deep copy so later edits never reach the (immutable) snapshot.
        const { project, phases, members } = structuredClone(baseline.snapshot)
        set((state) => ({
          project: { ...project, updatedAt: nowISO() },
          members,
          // Baselines hold phases only: keep tasks whose phase still exists.
          ...refit({ project }, phases, state.items),
        }))
        return true
      },
      replaceData: ({ project, phases, items, milestones, members, baselines, selectedBaselineId }) =>
        set({ project, phases, items, milestones, members, baselines, selectedBaselineId }),

      addItem: (item, parentFit) => {
        const id = newId()
        set((state) => {
          const siblings = state.items.filter((other) => other.parentId === item.parentId)
          const items = [...state.items, { ...item, id, order: siblings.length }]
          const fitted = applyFit(items, state.phases, item.parentId, parentFit)
          return refit(state, fitted.phases, fitted.items)
        })
        return id
      },
      updateItem: (id, patch, parentFit) =>
        set((state) => {
          const items = state.items.map((item) => (item.id === id ? { ...item, ...patch } : item))
          const parentId = state.items.find((item) => item.id === id)?.parentId ?? ''
          const fitted = applyFit(items, state.phases, parentId, parentFit)
          return refit(state, fitted.phases, fitted.items)
        }),
      deleteItem: (id) =>
        set((state) => {
          const removed = new Set([id, ...getDescendantIds(state.items, id)])
          return refit(
            state,
            state.phases,
            state.items.filter((item) => !removed.has(item.id)),
          )
        }),
      moveItemOrder: (id, direction) =>
        set((state) => {
          const item = state.items.find((candidate) => candidate.id === id)
          if (!item) return {}
          const siblings = sortByOrder(state.items.filter((other) => other.parentId === item.parentId))
          const index = siblings.findIndex((sibling) => sibling.id === id)
          const target = index + direction
          if (target < 0 || target >= siblings.length) return {}
          const reordered = [...siblings]
          reordered.splice(index, 1)
          reordered.splice(target, 0, item)
          const rank = new Map(reordered.map((sibling, order) => [sibling.id, order]))
          return {
            items: state.items.map((other) =>
              rank.has(other.id) ? { ...other, order: rank.get(other.id) ?? other.order } : other,
            ),
          }
        }),
      setFit: (id, fit) =>
        set((state) => {
          const fitted = applyFit(state.items, state.phases, id, fit)
          return refit(state, fitted.phases, fitted.items)
        }),
      moveScheduleNode: (id, days) =>
        set((state) => {
          const moved = moveNode(state, id, days)
          return { milestones: moved.milestones, ...refit(state, moved.phases, moved.items) }
        }),
      setScheduleNodeRange: (id, start, end) =>
        set((state) => {
          const resized = setNodeRange(state, id, start, end)
          return refit(state, resized.phases, resized.items)
        }),

      addMilestone: (milestone) => {
        const id = newId()
        set((state) => ({ milestones: [...state.milestones, { ...milestone, id }] }))
        return id
      },
      updateMilestone: (id, patch) =>
        set((state) => ({
          milestones: state.milestones.map((milestone) =>
            milestone.id === id ? { ...milestone, ...patch } : milestone,
          ),
        })),
      deleteMilestone: (id) =>
        set((state) => ({ milestones: state.milestones.filter((milestone) => milestone.id !== id) })),
      selectBaseline: (id) =>
        set((state) => ({
          selectedBaselineId:
            id === null || state.baselines.some((b) => b.id === id) ? id : state.selectedBaselineId,
        })),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Saved: every project, plus which one is open. The open project is rebuilt from the library on load.
      partialize: ({ library, activeProjectId }): Workspace => ({ library, activeProjectId }),
      migrate: (persisted, version) => migrateStore(persisted, version),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Workspace> | undefined
        if (!saved?.library || Object.keys(saved.library).length === 0) return current
        return { ...current, ...openFrom(saved.library, saved.activeProjectId) }
      },
    },
  ),
)

// Keep the open project's slot in the library up to date after every change.
useAppStore.subscribe((state) => {
  const current = pickData(state)
  const stored = state.library[state.activeProjectId]
  if (stored && sameData(stored, current)) return
  useAppStore.setState({ library: { ...state.library, [state.activeProjectId]: current } })
})
