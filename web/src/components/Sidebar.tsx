import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Archive,
    Search,
    Bot,
    Terminal,
    TrendingUp,
    Settings
} from 'lucide-react'

const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/chats', icon: MessageSquare, label: 'Chats' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/archives', icon: Archive, label: 'Archives' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/automation', icon: Bot, label: 'Automation' },
    { path: '/commands', icon: Terminal, label: 'Raw Commands' },
    { path: '/analytics', icon: TrendingUp, label: 'Analytics' },
]

export default function Sidebar() {
    return (
        <aside className="w-16 flex flex-col bg-[var(--color-bg-panel)] border-r border-[var(--color-border)] z-20">
            {/* Logo */}
            <div className="h-14 flex items-center justify-center border-b border-[var(--color-border)]">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dim)] flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20">
                    <span className="text-white font-bold text-xs uppercase tracking-tighter">TT</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3 flex flex-col gap-1 items-center">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] shadow-inner'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                            }`
                        }
                        title={item.label}
                    >
                        <item.icon className="w-5 h-5" />
                    </NavLink>
                ))}
            </nav>

            {/* Settings at bottom */}
            <div className="py-3 border-t border-[var(--color-border)] flex justify-center">
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${isActive
                            ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] shadow-inner'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                        }`
                    }
                    title="Settings"
                >
                    <Settings className="w-5 h-5" />
                </NavLink>
            </div>
        </aside>
    )
}
