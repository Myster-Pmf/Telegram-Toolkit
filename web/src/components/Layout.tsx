import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import AccountSwitcher from './AccountSwitcher'

export default function Layout() {
    return (
        <div className="flex h-screen bg-[var(--color-bg-base)]">
            {/* Navigation Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            Telegram Toolkit
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-64 h-9 px-3 pl-9 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Account Switcher */}
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
