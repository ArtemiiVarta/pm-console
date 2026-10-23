import { z } from 'zod'
import { CURRENCIES } from '@/lib/format'
import type { Project } from '@/store/types'

export const projectDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name').max(120, 'Use 120 characters or fewer'),
  client: z.string().trim().max(120, 'Use 120 characters or fewer'),
  status: z.enum(['green', 'amber', 'red']),
  statusRationale: z.string().trim().max(500, 'Use 500 characters or fewer'),
  currency: z.enum(CURRENCIES),
  standardHoursPerWeek: z
    .number({ error: 'Enter a number of hours' })
    .min(1, 'Use at least 1 hour')
    .max(80, 'Use 80 hours or fewer'),
  durationMode: z.enum(['working', 'calendar']),
})

export type ProjectDetailsValues = z.infer<typeof projectDetailsSchema>

export function toProjectDetailsValues(project: Project): ProjectDetailsValues {
  const { name, client, currency, standardHoursPerWeek, durationMode } = project
  return {
    name,
    client,
    // Projects saved before statuses existed are green.
    status: project.status ?? 'green',
    statusRationale: project.statusRationale ?? '',
    currency,
    standardHoursPerWeek,
    durationMode,
  }
}
