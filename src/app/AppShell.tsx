import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { TabBar } from '@/app/TabBar'
import { TopBar } from '@/app/TopBar'

export function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40">
        <TopBar />
        <TabBar />
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

function PageLoading() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Loading…
    </div>
  )
}
