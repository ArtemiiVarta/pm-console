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
        <Outlet />
      </main>
    </div>
  )
}
