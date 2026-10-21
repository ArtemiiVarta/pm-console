import { Activity, BarChart3, ClipboardList, FileText, Settings, type LucideIcon } from 'lucide-react'

export interface NavTab {
  path: string
  label: string
  icon: LucideIcon
}

/** Main tabs, in display order. Icons follow the CLAUDE.md mapping. */
export const navTabs: NavTab[] = [
  { path: '/settings', label: 'Project Settings', icon: Settings },
  { path: '/planning', label: 'Planning', icon: ClipboardList },
  { path: '/monitoring', label: 'Monitoring', icon: Activity },
  { path: '/forecast-vs-actual', label: 'Forecast vs Actual', icon: BarChart3 },
  { path: '/reports', label: 'Reports', icon: FileText },
]
