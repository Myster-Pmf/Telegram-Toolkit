import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import AccountSwitcher from './AccountSwitcher'
import { Globe, User } from 'lucide-react'

export default function Layout() {
    const location = useLocation()

    // Determine if we are in a global or account-specific view
    // Chats are account-specific. Dashboard, Users, Archives, Settings are global.
    const isAccountView = location.pathname.startsWith('/chats')
    const isGlobalView = !isAccountView

    return (
        <div className="flex h-screen bg-[var(--color-bg-base)]">
            {/* Navigation Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            Telegram Toolkit
                            {isGlobalView && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    Global View
                                </span>
                            )}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Context Indicator */}
                        {isAccountView ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--color-accent-subtle)] border border-[var(--color-accent-dim)]">
                                <User className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                                <span className="text-xs font-medium text-[var(--color-accent)]">
                                    Viewing as @john_doe
                                </span>
                            </div>
                        ) : (
                            <div className="text-xs text-[var(--color-text-muted)] mr-2">
                                Managing all accounts
                            </div>
                        )}

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={isAccountView ? "Search in this account..." : "Global search..."}
                                className="w-64 h-9 px-3 pl-9 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Account Switcher - Always present to switch specific account context or add new ones */}
                        <AccountSwitcher />
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
