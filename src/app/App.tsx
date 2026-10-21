import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { Home } from '@/app/Home'

// HashRouter is required for GitHub Pages (no server-side routing).
export function App() {
  return (
    <AppProviders>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppProviders>
  )
}
