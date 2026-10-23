import {
  Activity,
  BarChart3,
  ClipboardList,
  FileText,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavTab {
  path: string
  label: string
  icon: LucideIcon
  /** Active only on an exact match (the home page). */
  end?: boolean
}

/** Main tabs, in display order. Icons follow the CLAUDE.md mapping. */
export const navTabs: NavTab[] = [
  { path: '/', label: 'Projects', icon: LayoutGrid, end: true },
  { path: '/settings', label: 'Project Settings', icon: Settings },
  { path: '/planning', label: 'Planning', icon: ClipboardList },
  { path: '/monitoring', label: 'Monitoring', icon: Activity },
  { path: '/forecast-vs-actual', label: 'Forecast vs Actual', icon: BarChart3 },
  { path: '/reports', label: 'Reports', icon: FileText },
]
