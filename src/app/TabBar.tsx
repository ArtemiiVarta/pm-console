import { NavLink } from 'react-router-dom'
import { navTabs } from '@/app/navigation'
import { cn } from '@/lib/utils'

export function TabBar() {
  return (
    <nav aria-label="Main" className="border-b bg-surface">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
        {navTabs.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              cn(
                '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:border-border hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
