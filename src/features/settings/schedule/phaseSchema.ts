import { z } from 'zod'
import type { PhaseIssues } from '@/lib/schedule'
import type { DurationMode, DurationUnit } from '@/store/types'

export const phaseSchema = z.object({
  name: z.string().trim().min(1, 'Enter a phase name').max(80, 'Use 80 characters or fewer'),
  startDate: z.iso.date('Pick a start date'),
  duration: z
    .number({ error: 'Enter a duration' })
    .int('Use a whole number')
    .positive('Use a duration above 0')
    .max(999, 'Use 999 or fewer'),
  durationUnit: z.enum(['days', 'weeks']),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a color'),
})

export const milestoneSchema = z.object({
  name: z.string().trim().min(1, 'Enter a milestone name').max(80, 'Use 80 characters or fewer'),
  date: z.iso.date('Pick a date'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a color'),
})

export type MilestoneValues = z.infer<typeof milestoneSchema>

export type PhaseValues = z.infer<typeof phaseSchema>

/** "(working days)" / "(calendar days)" hint for day-based phases; empty for weeks. */
export function getDayCountHint(unit: DurationUnit, mode: DurationMode): string {
  if (unit === 'weeks') return ''
  return mode === 'working' ? '(working days)' : '(calendar days)'
}

/** Plain-language end-date formula for the Info tooltip. */
export function getEndDateFormula(mode: DurationMode): string {
  const days =
    mode === 'working'
      ? 'Days: the Nth working day (Mon–Fri), counting the start as day 1.'
      : 'Days: start date + duration − 1 calendar days.'
  return `Weeks: start date + duration × 7 − 1 days. ${days}`
}

/** Plain-language description of a phase's schedule issues, or null when there are none. */
export function describePhaseIssues(issues: PhaseIssues | undefined, mode: DurationMode): string | null {
  if (!issues) return null
  const parts: string[] = []
  if (issues.overlapsWith.length > 0) {
    parts.push(`Overlaps ${issues.overlapsWith.map((name) => `“${name}”`).join(', ')}`)
  }
  if (issues.gapDaysBefore > 0) {
    const unit = mode === 'working' ? 'working day' : 'day'
    parts.push(
      `${issues.gapDaysBefore} ${unit}${issues.gapDaysBefore === 1 ? '' : 's'} gap after the previous phase`,
    )
  }
  return parts.length > 0 ? parts.join('. ') : null
}
