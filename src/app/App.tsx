import { lazy, useState } from 'react'
import { createHashRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import { AppProviders } from '@/app/providers'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'

// Pages load on first visit, so the login screen and app shell ship in a small first bundle.
const ProjectsPage = lazy(() =>
  import('@/features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const PlanningPage = lazy(() =>
  import('@/features/planning/PlanningPage').then((m) => ({ default: m.PlanningPage })),
)
const MonitoringPage = lazy(() =>
  import('@/features/monitoring/MonitoringPage').then((m) => ({ default: m.MonitoringPage })),
)
const ForecastVsActualPage = lazy(() =>
  import('@/features/forecast-vs-actual/ForecastVsActualPage').then((m) => ({
    default: m.ForecastVsActualPage,
  })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)

// Dev-only component gallery; the import is dropped from production builds.
const ComponentsGallery = import.meta.env.DEV
  ? lazy(() => import('@/features/dev/ComponentsGallery').then((m) => ({ default: m.ComponentsGallery })))
  : null

const routes: RouteObject[] = [
  { path: 'login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <ProjectsPage /> },
      { path: 'settings/*', element: <SettingsPage /> },
      { path: 'planning', element: <PlanningPage /> },
      { path: 'monitoring', element: <MonitoringPage /> },
      { path: 'forecast-vs-actual', element: <ForecastVsActualPage /> },
      { path: 'reports', element: <ReportsPage /> },
      ...(ComponentsGallery ? [{ path: 'dev/components', element: <ComponentsGallery /> }] : []),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

// Hash routing is required for GitHub Pages (no server-side routing). It is a data router so
// pages can hold back navigation while they have unsaved changes (useBlocker).
export function App() {
  const [router] = useState(() => createHashRouter(routes))
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
