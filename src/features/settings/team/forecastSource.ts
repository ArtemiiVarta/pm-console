import { createContext, useContext } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { ForecastBaseline, Phase, Project, TeamMember } from '@/store/types'

export interface ForecastSource {
  project: Project
  phases: Phase[]
  members: TeamMember[]
  /** True while showing a baseline: nothing can be edited. */
  readOnly: boolean
  baseline: ForecastBaseline | null
}

/** The baseline being viewed in Team Forecast, or null for the working forecast. */
export const ViewedBaselineContext = createContext<ForecastBaseline | null>(null)

/** Data for the roster and grid: the live store, or a baseline snapshot (read-only). */
export function useForecastSource(): ForecastSource {
  const baseline = useContext(ViewedBaselineContext)
  const project = useAppStore((state) => state.project)
  const phases = useAppStore((state) => state.phases)
  const members = useAppStore((state) => state.members)
  if (baseline) return { ...baseline.snapshot, readOnly: true, baseline }
  return { project, phases, members, readOnly: false, baseline: null }
}
