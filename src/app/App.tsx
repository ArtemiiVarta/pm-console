import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import { AppProviders } from '@/app/providers'
import { ForecastVsActualPage } from '@/features/forecast-vs-actual/ForecastVsActualPage'
import { MonitoringPage } from '@/features/monitoring/MonitoringPage'
import { PlanningPage } from '@/features/planning/PlanningPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

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
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/settings" replace />} />
            <Route path="settings/*" element={<SettingsPage />} />
            <Route path="planning" element={<PlanningPage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
            <Route path="forecast-vs-actual" element={<ForecastVsActualPage />} />
            <Route path="reports" element={<ReportsPage />} />
            {ComponentsGallery && (
              <Route
                path="dev/components"
                element={
                  <Suspense fallback={null}>
                    <ComponentsGallery />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProviders>
  )
}
