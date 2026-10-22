import { addWeeks } from 'date-fns'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildBaseline } from '@/lib/baseline'
import { getWeekStart, parseISODate, toISODate } from '@/lib/dates'
import { getPhaseColor } from '@/lib/palette'
import type { ForecastBaseline, ISODate, Phase, Project, TeamMember } from '@/store/types'

export const STORE_KEY = 'pm-console-v1'
export const STORE_VERSION = 1

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

export interface AppData {
  project: Project
  phases: Phase[]
  members: TeamMember[]
  baselines: ForecastBaseline[]
  /** Baseline compared in Forecast vs Actual. */
  selectedBaselineId: string | null
}

export interface AppActions {
  updateProject: (patch: ProjectPatch) => void

  addPhase: (phase: NewPhase) => string
  updatePhase: (id: string, patch: PhasePatch) => void
  deletePhase: (id: string) => void
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
}

export interface WeeklyCell {
  memberId: string
  weekStart: ISODate
}

export interface WeeklyOverrideUpdate extends WeeklyCell {
  pct: number
}

export type AppState = AppData & AppActions

const newId = () => crypto.randomUUID()
const nowISO = () => new Date().toISOString()
const clampLoad = (pct: number) => Math.min(MAX_LOAD_PCT, Math.max(MIN_LOAD_PCT, pct))

export function createEmptyProject(): Project {
  const now = nowISO()
  return {
    id: newId(),
    name: '',
    client: '',
    currency: 'CAD',
    standardHoursPerWeek: 40,
    durationMode: 'working',
    createdAt: now,
    updatedAt: now,
  }
}

export function createInitialData(): AppData {
  return { project: createEmptyProject(), phases: [], members: [], baselines: [], selectedBaselineId: null }
}

/** Phases sorted by `order` with `order` renumbered 0..n-1. */
function normalizeOrder(phases: Phase[]): Phase[] {
  return [...phases].sort((a, b) => a.order - b.order).map((phase, order) => ({ ...phase, order }))
}

function mapMember(members: TeamMember[], id: string, update: (member: TeamMember) => TeamMember) {
  return members.map((member) => (member.id === id ? update(member) : member))
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createInitialData(),

      updateProject: (patch) =>
        set((state) => ({ project: { ...state.project, ...patch, updatedAt: nowISO() } })),

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
        set((state) => ({
          phases: state.phases.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)),
        })),
      deletePhase: (id) =>
        set((state) => ({ phases: normalizeOrder(state.phases.filter((phase) => phase.id !== id)) })),
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
        set({ project: { ...project, updatedAt: nowISO() }, phases, members })
        return true
      },
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
      partialize: ({ project, phases, members, baselines, selectedBaselineId }): AppData => ({
        project,
        phases,
        members,
        baselines,
        selectedBaselineId,
      }),
      // Stub: when STORE_VERSION is bumped, upgrade data saved under older versions here.
      migrate: (persisted) => persisted as AppData,
    },
  ),
)
