import { useState } from 'react'
import { Search, Globe, Filter, MessageSquare, Users, Image, Clock, ChevronRight } from 'lucide-react'

// Mock global results
const mockResults = [
    {
        id: 1,
        type: 'message',
        sender: 'Alice Smith',
        chat: 'Crypto Signals',
        text: 'Check out this new alpha for BTC...',
        time: '2h ago',
        account: '@john_doe'
    },
    {
        id: 2,
        type: 'user',
        name: 'Bob Johnson',
        username: '@bob_trader',
        seenIn: '3 shared chats',
        fakeScore: '5%',
        account: 'Global'
    },
    {
        id: 3,
        type: 'message',
        sender: 'Dev Bot',
        chat: 'Trading Group',
        text: 'Market volatility detected in ETH pairs',
        time: '4h ago',
        account: '@john_work'
    },
]

export default function GlobalSearch() {
    const [query, setQuery] = useState('')

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
            {/* Search Header */}
            <div className="p-8 border-b border-[var(--color-border)] bg-[var(--color-bg-panel)]/50">
                <div className="max-w-3xl mx-auto space-y-4">
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                        <Search className="w-7 h-7 text-[var(--color-accent)]" />
                        Global Knowledge Search
                    </h1>
                    <div className="relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search across all accounts, chats, users and archives..."
                            className="w-full h-14 px-6 pl-14 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] shadow-xl transition-all"
                        />
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--color-text-dim)]" />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                            <span className="px-2 py-1 rounded bg-[var(--color-bg-panel)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">⌘ K</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 pl-2">
                        <span className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-widest">Filters:</span>
                        <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-xs border border-[var(--color-accent-dim)]">
                            All Results
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] text-xs border border-[var(--color-border)] hover:text-[var(--color-text-primary)]">
                            <MessageSquare className="w-3.5 h-3.5" />
                            Messages
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] text-xs border border-[var(--color-border)] hover:text-[var(--color-text-primary)]">
                            <Users className="w-3.5 h-3.5" />
                            Users
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] text-xs border border-[var(--color-border)] hover:text-[var(--color-text-primary)]">
                            <Image className="w-3.5 h-3.5" />
                            Media
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-3">
                    {mockResults.map(res => (
                        <div
                            key={res.id}
                            className="p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-accent-dim)] transition-all cursor-pointer group"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {res.type === 'message' ? <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" /> : <Users className="w-4 h-4 text-[var(--color-success)]" />}
                                    <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                                        {res.type}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-[var(--color-border)]"></span>
                                    <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest flex items-center gap-1">
                                        <Globe className="w-3 h-3" />
                                        Account: {res.account}
                                    </span>
                                </div>
                                <span className="text-xs text-[var(--color-text-dim)]">{res.time}</span>
                            </div>

                            {res.type === 'message' ? (
                                <div>
                                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                                        {res.sender} <span className="text-[var(--color-text-muted)] font-normal">in</span> {res.chat}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                                        {res.text}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                                        {res.name} <span className="text-[var(--color-text-muted)] font-normal">(@bob_trader)</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-xs text-[var(--color-text-muted)]">Seen in: <span className="text-[var(--color-text-primary)]">{res.seenIn}</span></span>
                                        <span className="text-xs text-[var(--color-text-muted)]">Fake Score: <span className="text-[var(--color-success)]">{res.fakeScore}</span></span>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="text-xs text-[var(--color-accent)] font-medium flex items-center gap-1">
                                    Go to context
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {!query && (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                            <div className="w-16 h-16 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
                                <Search className="w-8 h-8 text-[var(--color-text-muted)]" />
                            </div>
                            <div>
                                <p className="text-[var(--color-text-primary)] font-medium">Ready to explore?</p>
                                <p className="text-sm text-[var(--color-text-muted)] max-w-xs mx-auto">
                                    Search for keywords, usernames, or identifiers across your entire Telegram network.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
