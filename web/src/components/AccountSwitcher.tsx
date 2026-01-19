import { useState } from 'react'
import { ChevronDown, Plus, Check, User } from 'lucide-react'

// Mock data for now - will be replaced with API calls
const mockSessions = [
    { id: 1, name: 'Main Account', username: '@john_doe', isActive: true },
    { id: 2, name: 'Work Account', username: '@john_work', isActive: false },
]

export default function AccountSwitcher() {
    const [isOpen, setIsOpen] = useState(false)
    const [sessions] = useState(mockSessions)

    const activeSession = sessions.find(s => s.isActive) || sessions[0]

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] transition-colors"
            >
                <div className="w-6 h-6 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                </div>
                <span className="text-sm text-[var(--color-text-primary)]">
                    {activeSession?.username || 'No Account'}
                </span>
                <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute right-0 top-full mt-2 w-64 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-lg z-50">
                        <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                            Accounts
                        </div>

                        {sessions.map((session) => (
                            <button
                                key={session.id}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-hover)] transition-colors"
                                onClick={() => setIsOpen(false)}
                            >
                                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center">
                                    <User className="w-4 h-4 text-[var(--color-accent)]" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-sm text-[var(--color-text-primary)]">
                                        {session.name}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-muted)]">
                                        {session.username}
                                    </div>
                                </div>
                                {session.isActive && (
                                    <Check className="w-4 h-4 text-[var(--color-success)]" />
                                )}
                            </button>
                        ))}

                        <div className="border-t border-[var(--color-border)] mt-2 pt-2">
                            <button
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-accent)]"
                                onClick={() => {
                                    setIsOpen(false)
                                    // TODO: Open add account dialog
                                }}
                            >
                                <Plus className="w-5 h-5" />
                                <span className="text-sm">Add Account</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
