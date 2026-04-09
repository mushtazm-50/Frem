import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Activity, Target, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/activities', icon: Activity, label: 'Activities' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const { signOut } = useAuth()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-bg-secondary flex flex-col border-r border-border-subtle">
      <div className="px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">
          <span className="text-accent">F</span>rem
        </h1>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-muted text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-surface transition-colors w-full"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
