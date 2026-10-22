/** ISO calendar date, `yyyy-MM-dd`, interpreted in local time. */
export type ISODate = string

/** ISO timestamp from `Date.toISOString()`. */
export type ISODateTime = string

export type Currency = 'CAD' | 'USD' | 'EUR' | 'GBP'

/** How phase "days" are counted: Mon–Fri only, or every calendar day. */
export type DurationMode = 'working' | 'calendar'

export type DurationUnit = 'days' | 'weeks'

export interface Project {
  id: string
  name: string
  client: string
  currency: Currency
  standardHoursPerWeek: number
  durationMode: DurationMode
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Phase {
  id: string
  name: string
  /** Hex color from the phase palette (src/lib/palette.ts). */
  color: string
  order: number
  startDate: ISODate
  /** Positive whole number of `durationUnit`s. */
  duration: number
  durationUnit: DurationUnit
  /**
   * Pinned last day. When set it wins over duration (set by dragging an edge on the Gantt chart,
   * or by fitting to children). Read the end with getPhaseEndDate, never directly.
   */
  endDate?: ISODate
  /** Keep the start on the earliest child start (children: tasks and milestones). */
  fitStart?: boolean
  /** Keep the end on the latest child end. */
  fitEnd?: boolean
  notes?: string
}

export type ScheduleItemKind = 'task' | 'milestone'

/**
 * A task or milestone under a phase (level 1) or under a level-1 task (level 2: sub-task or
 * sub-milestone). Milestones use `startDate` as their date and ignore duration.
 */
export interface ScheduleItem {
  id: string
  /** Phase id (level 1) or task id (level 2). */
  parentId: string
  kind: ScheduleItemKind
  name: string
  color: string
  /** Position among siblings. */
  order: number
  startDate: ISODate
  duration: number
  durationUnit: DurationUnit
  endDate?: ISODate
  fitStart?: boolean
  fitEnd?: boolean
}

/** A single key date shown as a star on the Timeline. Does not change project dates or weeks. */
export interface Milestone {
  id: string
  name: string
  date: ISODate
  /** Hex color of the star. */
  color: string
}

export interface TeamMember {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  /** 0–200, % of the project's standard hours per week. */
  defaultLoadPct: number
  /** Load % for specific weeks, keyed by the week's Monday. Absent = use defaultLoadPct. */
  weeklyOverrides: Record<ISODate, number>
  /** 0–100, share of assigned hours counted as development capacity. */
  capacityPct: number
  /** First day on the project. Weeks that end before it count as 0%. Absent = from project start. */
  startDate?: ISODate
  /** Per hour, in the project currency. */
  costRate: number
  /** Per hour, in the project currency. */
  priceRate: number
  active: boolean
}

export interface ForecastTotals {
  hours: number
  cost: number
  revenue: number
  margin: number
  /** Fraction (0.25 = 25%); 0 when revenue is 0. */
  marginPct: number
}

export interface ForecastSnapshot {
  project: Project
  phases: Phase[]
  members: TeamMember[]
}

/** Locked copy of the forecast, compared against actuals later. */
export interface ForecastBaseline {
  id: string
  name: string
  description?: string
  createdAt: ISODateTime
  isLocked: true
  snapshot: ForecastSnapshot
  totals: ForecastTotals
}
