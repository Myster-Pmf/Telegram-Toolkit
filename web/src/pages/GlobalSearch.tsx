import { useState, useEffect, useCallback } from 'react'
import { Search, Globe, Filter, MessageSquare, Users, Image, Clock, ChevronRight, Loader2 } from 'lucide-react'

const API_BASE = '/api'

type FilterType = 'all' | 'messages' | 'users'

interface SearchResult {
    type: 'message' | 'user'
    id: number
    // Message fields
    sender?: string
    chat?: string
    chatId?: number
    text?: string
    time?: string
    // User fields
    name?: string
    username?: string
    firstName?: string
    lastName?: string
    seenIn?: number
    fakeScore?: number
    lastSeen?: string
}

export default function GlobalSearch() {
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<FilterType>('all')
    const [results, setResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)

    // Debounced search
    const search = useCallback(async () => {
        if (!query.trim()) {
            setResults([])
            setHasSearched(false)
            return
        }

        setIsSearching(true)
        setHasSearched(true)
        const searchResults: SearchResult[] = []

        try {
            // Search users if filter allows
            if (filter === 'all' || filter === 'users') {
                const usersRes = await fetch(`${API_BASE}/profiles/search?query=${encodeURIComponent(query)}&limit=20`)
                if (usersRes.ok) {
                    const userData = await usersRes.json()
                    const users = userData.users || []
                    users.forEach((u: any) => {
                        searchResults.push({
                            type: 'user',
                            id: u.user_id || u.id,
                            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'Unknown',
                            username: u.username,
                            firstName: u.first_name,
                            lastName: u.last_name,
                            seenIn: u.shared_chats_count || 0,
                            fakeScore: u.fake_probability,
                            lastSeen: u.last_seen,
                        })
                    })
                }
            }

            // Search messages across chats if filter allows
            if (filter === 'all' || filter === 'messages') {
                // First get list of chats
                const chatsRes = await fetch(`${API_BASE}/chats/`)
                if (chatsRes.ok) {
                    const chatsData = await chatsRes.json()
                    const chats = chatsData.chats?.slice(0, 5) || [] // Limit to 5 chats for performance

                    // Search in each chat (limited)
                    for (const chat of chats) {
                        try {
                            const msgsRes = await fetch(
                                `${API_BASE}/chats/${chat.id}/messages?limit=50&search=${encodeURIComponent(query)}`
                            )
                            if (msgsRes.ok) {
                                const msgsData = await msgsRes.json()
                                const messages = msgsData.messages || []
                                messages.forEach((m: any) => {
                                    if (m.text?.toLowerCase().includes(query.toLowerCase())) {
                                        searchResults.push({
                                            type: 'message',
                                            id: m.id,
                                            sender: m.sender_name || 'Unknown',
                                            chat: chat.title || chat.name,
                                            chatId: chat.id,
                                            text: m.text,
                                            time: m.date ? new Date(m.date).toLocaleString() : '',
                                        })
                                    }
                                })
                            }
                        } catch (e) {
                            console.error(`Failed to search chat ${chat.id}:`, e)
                        }
                    }
                }
            }

            setResults(searchResults)
        } catch (e) {
            console.error('Search failed:', e)
        } finally {
            setIsSearching(false)
        }
    }, [query, filter])

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                search()
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [query, filter])

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
                            placeholder="Search across all chats, users and archives..."
                            className="w-full h-14 px-6 pl-14 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] shadow-xl transition-all"
                        />
                        {isSearching ? (
                            <Loader2 className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--color-accent)] animate-spin" />
                        ) : (
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--color-text-dim)]" />
                        )}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                            <span className="px-2 py-1 rounded bg-[var(--color-bg-panel)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">⌘ K</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 pl-2">
                        <span className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-widest">Filters:</span>
                        <button
                            onClick={() => setFilter('all')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${filter === 'all'
                                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent-dim)]'
                                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
                                }`}
                        >
                            All Results
                        </button>
                        <button
                            onClick={() => setFilter('messages')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${filter === 'messages'
                                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent-dim)]'
                                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
                                }`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Messages
                        </button>
                        <button
                            onClick={() => setFilter('users')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${filter === 'users'
                                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent-dim)]'
                                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
                                }`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Users
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-3">
                    {results.map((res, idx) => (
                        <div
                            key={`${res.type}-${res.id}-${idx}`}
                            className="p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-accent-dim)] transition-all cursor-pointer group"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {res.type === 'message' ? (
                                        <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />
                                    ) : (
                                        <Users className="w-4 h-4 text-[var(--color-success)]" />
                                    )}
                                    <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                                        {res.type}
                                    </span>
                                </div>
                                <span className="text-xs text-[var(--color-text-dim)]">{res.time || res.lastSeen || ''}</span>
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
                                        {res.name} {res.username && <span className="text-[var(--color-text-muted)] font-normal">@{res.username}</span>}
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                            Seen in: <span className="text-[var(--color-text-primary)]">{res.seenIn} chats</span>
                                        </span>
                                        {res.fakeScore !== undefined && (
                                            <span className="text-xs text-[var(--color-text-muted)]">
                                                Fake Score: <span className={res.fakeScore > 50 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}>
                                                    {res.fakeScore}%
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="text-xs text-[var(--color-accent)] font-medium flex items-center gap-1">
                                    View Details
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Empty state */}
                    {!query && !hasSearched && (
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

                    {/* No results state */}
                    {hasSearched && results.length === 0 && !isSearching && (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                            <div className="w-16 h-16 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
                                <Search className="w-8 h-8 text-[var(--color-text-muted)]" />
                            </div>
                            <div>
                                <p className="text-[var(--color-text-primary)] font-medium">No results found</p>
                                <p className="text-sm text-[var(--color-text-muted)]">
                                    Try a different search term
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Results count */}
                    {results.length > 0 && (
                        <div className="pt-4 text-center text-xs text-[var(--color-text-muted)]">
                            Found {results.length} result{results.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
