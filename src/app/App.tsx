import { lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
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

// HashRouter is required for GitHub Pages (no server-side routing).
export function App() {
  return (
    <AppProviders>
      <HashRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<ProjectsPage />} />
            <Route path="settings/*" element={<SettingsPage />} />
            <Route path="planning" element={<PlanningPage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
            <Route path="forecast-vs-actual" element={<ForecastVsActualPage />} />
            <Route path="reports" element={<ReportsPage />} />
            {ComponentsGallery && <Route path="dev/components" element={<ComponentsGallery />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProviders>
  )
}
