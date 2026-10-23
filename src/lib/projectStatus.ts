import type { ProjectStatus } from '@/store/types'

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; hint: string }[] = [
  { value: 'green', label: 'Green', hint: 'On track' },
  { value: 'amber', label: 'Amber', hint: 'At risk' },
  { value: 'red', label: 'Red', hint: 'Off track' },
]

/** Tailwind classes per status (paired with the label and icon, never color alone). */
export const STATUS_CLASSES: Record<ProjectStatus, { dot: string; tile: string; text: string }> = {
  green: { dot: 'bg-success', tile: 'bg-success', text: 'text-success' },
  amber: { dot: 'bg-warning', tile: 'bg-warning', text: 'text-warning' },
  red: { dot: 'bg-danger', tile: 'bg-danger', text: 'text-danger' },
}

export function getStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUSES.find((option) => option.value === status)?.label ?? 'Green'
}
