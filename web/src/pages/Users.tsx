import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Filter, AlertTriangle, MessageSquare, Activity, Users as UsersIcon, Shield, ShieldAlert, Bot, Crown, RefreshCw, X, ChevronDown, Network, ScanLine, Tag, StickyNote } from 'lucide-react'

const API_BASE = '/api/profiles'

interface UserProfile {
    id: number
    telegram_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
    phone: string | null
    bio: string | null
    photo_path: string | null
    is_premium: boolean
    is_verified: boolean
    is_bot: boolean
    is_deleted: boolean
    first_seen: string
    last_seen: string
    total_messages: number
    total_chats: number
    risk_score: number
    risk_factors: string[] | null
    notes: string | null
    tags: string[] | null
}

interface ProfileStats {
    total_profiles: number
    high_risk_count: number
    premium_count: number
    bot_count: number
}

interface ActivityPattern {
    hourly_activity: number[]
    daily_activity: number[]
    total_messages: number
    avg_message_length: number
    peak_hour: number | null
    peak_day: string | null
}

interface ChatSighting {
    chat_id: number
    chat_title: string | null
    chat_type: string | null
    is_admin: boolean
    is_owner: boolean
    message_count: number
    first_seen: string | null
    last_seen: string | null
}

export default function Users() {
    const { userId } = useParams()
    const [profiles, setProfiles] = useState<UserProfile[]>([])
    const [stats, setStats] = useState<ProfileStats | null>(null)
    const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null)
    const [activityPattern, setActivityPattern] = useState<ActivityPattern | null>(null)
    const [userChats, setUserChats] = useState<ChatSighting[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [showScanner, setShowScanner] = useState(false)
    const [isScanning, setIsScanning] = useState(false)
    const [filterRisk, setFilterRisk] = useState<string>('all')
    const [notes, setNotes] = useState('')
    const [tags, setTags] = useState<string[]>([])
    const [newTag, setNewTag] = useState('')

    // Scanner state
    const [scannerSessions, setScannerSessions] = useState<{ id: number; name: string; username: string | null }[]>([])
    const [scannerSelectedSession, setScannerSelectedSession] = useState<number | null>(null)
    const [scannerChats, setScannerChats] = useState<{ id: number; title: string; type: string; member_count: number }[]>([])
    const [scannerSelectedChats, setScannerSelectedChats] = useState<Set<number>>(new Set())
    const [scannerLoadingChats, setScannerLoadingChats] = useState(false)

    // Fetch profiles
    useEffect(() => {
        fetchProfiles()
        fetchStats()
    }, [searchQuery, filterRisk])

    const fetchProfiles = async () => {
        try {
            const params = new URLSearchParams({ page: '1', page_size: '100' })
            if (searchQuery) params.append('search', searchQuery)
            if (filterRisk === 'high') params.append('min_risk', '0.5')
            params.append('sort_by', 'last_seen')
            params.append('sort_order', 'desc')

            const response = await fetch(`${API_BASE}?${params.toString()}`)
            if (response.ok) {
                const data = await response.json()
                setProfiles(data.profiles)
            }
        } catch (err) {
            console.error('Failed to fetch profiles:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_BASE}/stats`)
            if (response.ok) {
                setStats(await response.json())
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err)
        }
    }

    const selectProfile = async (profile: UserProfile) => {
        setSelectedProfile(profile)
        setNotes(profile.notes || '')
        setTags(profile.tags || [])

        // Fetch activity patterns
        try {
            const activityRes = await fetch(`${API_BASE}/${profile.telegram_id}/activity`)
            if (activityRes.ok) {
                setActivityPattern(await activityRes.json())
            }

            const chatsRes = await fetch(`${API_BASE}/${profile.telegram_id}/chats`)
            if (chatsRes.ok) {
                setUserChats(await chatsRes.json())
            }
        } catch (err) {
            console.error('Failed to fetch profile details:', err)
        }
    }

    const openScanner = async () => {
        setShowScanner(true)
        setScannerSelectedSession(null)
        setScannerChats([])
        setScannerSelectedChats(new Set())

        // Fetch available sessions
        try {
            const res = await fetch('/api/sessions')
            if (res.ok) {
                const sessions = await res.json()
                setScannerSessions(sessions.map((s: any) => ({
                    id: s.id,
                    name: s.name || s.first_name || `Session ${s.id}`,
                    username: s.username,
                })))
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err)
        }
    }

    const saveNotes = async () => {
        if (!selectedProfile) return
        try {
            await fetch(`${API_BASE}/${selectedProfile.telegram_id}/notes`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes, tags }),
            })
        } catch (err) {
            console.error('Failed to save notes:', err)
        }
    }

    const addTag = () => {
        if (newTag && !tags.includes(newTag)) {
            setTags([...tags, newTag])
            setNewTag('')
        }
    }

    const removeTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag))
    }

    const getRiskColor = (score: number) => {
        if (score >= 0.7) return 'text-red-400'
        if (score >= 0.4) return 'text-amber-400'
        return 'text-emerald-400'
    }

    const getRiskBadge = (score: number) => {
        if (score >= 0.7) return { bg: 'bg-red-500/15', text: 'text-red-400', label: 'High Risk' }
        if (score >= 0.4) return { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Medium' }
        return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Low Risk' }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const mins = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (mins < 60) return `${mins}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`
        return date.toLocaleDateString()
    }

    // Activity Heatmap Component
    const ActivityHeatmap = ({ data }: { data: number[] }) => {
        const max = Math.max(...data, 1)
        return (
            <div className="flex gap-0.5">
                {data.map((val, i) => {
                    const intensity = val / max
                    const bg = intensity === 0
                        ? 'bg-[var(--color-bg-elevated)]'
                        : intensity < 0.25
                            ? 'bg-[var(--color-accent)]/20'
                            : intensity < 0.5
                                ? 'bg-[var(--color-accent)]/40'
                                : intensity < 0.75
                                    ? 'bg-[var(--color-accent)]/60'
                                    : 'bg-[var(--color-accent)]'
                    return (
                        <div
                            key={i}
                            className={`w-3 h-8 rounded-sm ${bg} transition-all hover:scale-110`}
                            title={`${i}:00 - ${val} messages`}
                        />
                    )
                })}
            </div>
        )
    }

    return (
        <div className="flex h-full bg-[var(--color-bg-base)]">
            {/* Left Panel - User List */}
            <div className={`${selectedProfile ? 'w-1/2' : 'w-full'} flex flex-col border-r border-[var(--color-border)] transition-all duration-300`}>
                {/* Header with Stats */}
                <div className="p-6 border-b border-[var(--color-border)] bg-gradient-to-br from-[var(--color-bg-panel)] to-[var(--color-bg-base)]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                <UsersIcon className="w-7 h-7 text-[var(--color-accent)]" />
                                User Intelligence
                            </h1>
                            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                                Profile database with risk analysis
                            </p>
                        </div>
                        <button
                            onClick={openScanner}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
                        >
                            <ScanLine className="w-4 h-4" />
                            Scan Chat
                        </button>
                    </div>

                    {/* Stats Cards */}
                    {stats && (
                        <div className="grid grid-cols-4 gap-3">
                            <div className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                                <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.total_profiles}</div>
                                <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                    <UsersIcon className="w-3 h-3" /> Total Profiles
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                <div className="text-2xl font-bold text-red-400">{stats.high_risk_count}</div>
                                <div className="text-xs text-red-400/70 flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" /> High Risk
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <div className="text-2xl font-bold text-amber-400">{stats.premium_count}</div>
                                <div className="text-xs text-amber-400/70 flex items-center gap-1">
                                    <Crown className="w-3 h-3" /> Premium
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <div className="text-2xl font-bold text-blue-400">{stats.bot_count}</div>
                                <div className="text-xs text-blue-400/70 flex items-center gap-1">
                                    <Bot className="w-3 h-3" /> Bots
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Search and Filter */}
                    <div className="flex gap-2 mt-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search by name, username, phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 px-4 pl-10 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                        </div>
                        <select
                            value={filterRisk}
                            onChange={(e) => setFilterRisk(e.target.value)}
                            className="h-10 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)]"
                        >
                            <option value="all">All Users</option>
                            <option value="high">High Risk Only</option>
                        </select>
                    </div>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-[var(--color-text-muted)]">
                            <UsersIcon className="w-12 h-12 mb-2 opacity-50" />
                            <p>No profiles yet. Scan a chat to start building your database.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--color-border)]">
                            {profiles.map((profile) => {
                                const risk = getRiskBadge(profile.risk_score)
                                return (
                                    <div
                                        key={profile.id}
                                        onClick={() => selectProfile(profile)}
                                        className={`p-4 cursor-pointer transition-all hover:bg-[var(--color-bg-hover)] ${selectedProfile?.id === profile.id ? 'bg-[var(--color-accent-subtle)] border-l-2 border-[var(--color-accent)]' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Avatar */}
                                            <div className="relative">
                                                {profile.photo_path ? (
                                                    <img
                                                        src={`/media/${profile.photo_path}`}
                                                        className="w-12 h-12 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center">
                                                        <span className="text-white text-lg font-medium">
                                                            {(profile.first_name || profile.username || 'U').charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                {profile.is_bot && (
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                                        <Bot className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                                {profile.is_premium && (
                                                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                                        <Crown className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-[var(--color-text-primary)] truncate">
                                                        {profile.first_name
                                                            ? `${profile.first_name} ${profile.last_name || ''}`
                                                            : profile.username || 'Unknown'}
                                                    </span>
                                                    {profile.is_verified && (
                                                        <Shield className="w-4 h-4 text-blue-400" />
                                                    )}
                                                </div>
                                                <div className="text-xs text-[var(--color-text-muted)] truncate">
                                                    {profile.username ? `@${profile.username}` : `ID: ${profile.telegram_id}`}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                                        {profile.total_messages} msgs
                                                    </span>
                                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                                        {profile.total_chats} chats
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Risk Badge */}
                                            <div className="text-right">
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${risk.bg} ${risk.text}`}>
                                                    {profile.risk_score >= 0.7 && <AlertTriangle className="w-3 h-3" />}
                                                    {Math.round(profile.risk_score * 100)}%
                                                </div>
                                                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                                                    {formatDate(profile.last_seen)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Profile Details */}
            {selectedProfile && (
                <div className="w-1/2 flex flex-col overflow-hidden">
                    {/* Profile Header */}
                    <div className="p-6 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-bg-panel)] to-[var(--color-accent)]/5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                {/* Large Avatar */}
                                <div className="relative">
                                    {selectedProfile.photo_path ? (
                                        <img
                                            src={`/media/${selectedProfile.photo_path}`}
                                            className="w-20 h-20 rounded-2xl object-cover shadow-lg"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center shadow-lg">
                                            <span className="text-white text-3xl font-bold">
                                                {(selectedProfile.first_name || selectedProfile.username || 'U').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                                        {selectedProfile.first_name
                                            ? `${selectedProfile.first_name} ${selectedProfile.last_name || ''}`
                                            : 'Unknown User'}
                                    </h2>
                                    <p className="text-sm text-[var(--color-text-secondary)]">
                                        {selectedProfile.username ? `@${selectedProfile.username}` : `ID: ${selectedProfile.telegram_id}`}
                                    </p>

                                    {/* Badges */}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {selectedProfile.is_premium && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs">
                                                <Crown className="w-3 h-3" /> Premium
                                            </span>
                                        )}
                                        {selectedProfile.is_verified && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs">
                                                <Shield className="w-3 h-3" /> Verified
                                            </span>
                                        )}
                                        {selectedProfile.is_bot && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 text-xs">
                                                <Bot className="w-3 h-3" /> Bot
                                            </span>
                                        )}
                                        {(() => {
                                            const risk = getRiskBadge(selectedProfile.risk_score)
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${risk.bg} ${risk.text}`}>
                                                    {risk.label}
                                                </span>
                                            )
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedProfile(null)}
                                className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                            >
                                <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                            </button>
                        </div>

                        {/* Bio */}
                        {selectedProfile.bio && (
                            <p className="mt-4 text-sm text-[var(--color-text-secondary)] italic">
                                "{selectedProfile.bio}"
                            </p>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3 p-4 border-b border-[var(--color-border)]">
                        <div className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]">
                            <div className="text-xl font-bold text-[var(--color-text-primary)]">{selectedProfile.total_messages}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Messages</div>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]">
                            <div className="text-xl font-bold text-[var(--color-text-primary)]">{selectedProfile.total_chats}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Chats</div>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]">
                            <div className={`text-xl font-bold ${getRiskColor(selectedProfile.risk_score)}`}>
                                {Math.round(selectedProfile.risk_score * 100)}%
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">Risk Score</div>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]">
                            <div className="text-xl font-bold text-[var(--color-text-primary)]">
                                {activityPattern?.peak_hour !== null ? `${activityPattern?.peak_hour}:00` : '-'}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">Peak Hour</div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Activity Heatmap */}
                        {activityPattern && (
                            <div className="p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-[var(--color-accent)]" />
                                    Activity Pattern (24h)
                                </h3>
                                <ActivityHeatmap data={activityPattern.hourly_activity} />
                                <div className="flex justify-between mt-1 text-[10px] text-[var(--color-text-muted)]">
                                    <span>00:00</span>
                                    <span>06:00</span>
                                    <span>12:00</span>
                                    <span>18:00</span>
                                    <span>23:00</span>
                                </div>
                            </div>
                        )}

                        {/* Risk Factors */}
                        {selectedProfile.risk_factors && selectedProfile.risk_factors.length > 0 && (
                            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                                <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Risk Factors
                                </h3>
                                <ul className="space-y-1">
                                    {selectedProfile.risk_factors.map((factor, i) => (
                                        <li key={i} className="text-sm text-red-400/80">• {factor}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Seen In Chats */}
                        {userChats.length > 0 && (
                            <div className="p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                                    <Network className="w-4 h-4 text-[var(--color-accent)]" />
                                    Seen In {userChats.length} Chats
                                </h3>
                                <div className="space-y-2">
                                    {userChats.slice(0, 5).map((chat) => (
                                        <div key={chat.chat_id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-bg-elevated)]">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-[var(--color-text-muted)]" />
                                                <span className="text-sm text-[var(--color-text-primary)]">{chat.chat_title || `Chat ${chat.chat_id}`}</span>
                                            </div>
                                            <span className="text-xs text-[var(--color-text-muted)]">{chat.message_count} msgs</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes & Tags */}
                        <div className="p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                                <StickyNote className="w-4 h-4 text-[var(--color-accent)]" />
                                Notes & Tags
                            </h3>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                {tags.map((tag) => (
                                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs">
                                        <Tag className="w-3 h-3" />
                                        {tag}
                                        <button onClick={() => removeTag(tag)} className="hover:text-white">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                        placeholder="Add tag..."
                                        className="w-20 h-6 px-2 text-xs rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                    />
                                </div>
                            </div>

                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                onBlur={saveNotes}
                                placeholder="Add notes about this user..."
                                className="w-full h-20 p-2 text-sm rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Scan Modal */}
            {showScanner && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[var(--color-bg-panel)] rounded-2xl w-[500px] max-h-[80vh] border border-[var(--color-border)] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-5 border-b border-[var(--color-border)]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                                        <ScanLine className="w-5 h-5 text-[var(--color-accent)]" />
                                        Scan Chat Members
                                    </h2>
                                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                                        Select chats to scan and build user profiles
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowScanner(false)
                                        setScannerSelectedChats(new Set())
                                    }}
                                    className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                    <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                                </button>
                            </div>

                            {/* Account Selector */}
                            <div className="mt-4">
                                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Select Account</label>
                                <select
                                    value={scannerSelectedSession || ''}
                                    onChange={async (e) => {
                                        const sessionId = Number(e.target.value)
                                        setScannerSelectedSession(sessionId)
                                        setScannerSelectedChats(new Set())
                                        setScannerLoadingChats(true)
                                        try {
                                            // Switch session and fetch chats
                                            await fetch('/api/sessions/switch', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ session_id: sessionId })
                                            })
                                            const res = await fetch('/api/chats')
                                            if (res.ok) {
                                                const chats = await res.json()
                                                setScannerChats(chats)
                                            }
                                        } catch (err) {
                                            console.error('Failed to fetch chats:', err)
                                        } finally {
                                            setScannerLoadingChats(false)
                                        }
                                    }}
                                    className="w-full h-10 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                >
                                    <option value="">Choose an account...</option>
                                    {scannerSessions.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} {s.username ? `(@${s.username})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Chat List */}
                        <div className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[400px]">
                            {!scannerSelectedSession ? (
                                <div className="flex flex-col items-center justify-center h-40 text-[var(--color-text-muted)]">
                                    <UsersIcon className="w-10 h-10 mb-2 opacity-50" />
                                    <p>Select an account to see chats</p>
                                </div>
                            ) : scannerLoadingChats ? (
                                <div className="flex items-center justify-center h-40">
                                    <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
                                </div>
                            ) : scannerChats.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-[var(--color-text-muted)]">
                                    <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                                    <p>No chats found</p>
                                </div>
                            ) : (
                                <>
                                    {/* Select All */}
                                    <label className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 mb-3 cursor-pointer hover:bg-[var(--color-accent)]/15 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={scannerSelectedChats.size === scannerChats.length && scannerChats.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setScannerSelectedChats(new Set(scannerChats.map(c => c.id)))
                                                } else {
                                                    setScannerSelectedChats(new Set())
                                                }
                                            }}
                                            className="w-4 h-4 rounded accent-[var(--color-accent)]"
                                        />
                                        <span className="text-sm font-medium text-[var(--color-accent)]">
                                            Select All ({scannerChats.length} chats)
                                        </span>
                                    </label>

                                    {/* Chat Items */}
                                    <div className="space-y-2">
                                        {scannerChats.map(chat => (
                                            <label
                                                key={chat.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${scannerSelectedChats.has(chat.id)
                                                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/50'
                                                    : 'bg-[var(--color-bg-elevated)] border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={scannerSelectedChats.has(chat.id)}
                                                    onChange={(e) => {
                                                        const newSet = new Set(scannerSelectedChats)
                                                        if (e.target.checked) {
                                                            newSet.add(chat.id)
                                                        } else {
                                                            newSet.delete(chat.id)
                                                        }
                                                        setScannerSelectedChats(newSet)
                                                    }}
                                                    className="w-4 h-4 rounded accent-[var(--color-accent)]"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                                        {chat.title}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                                        <span className="capitalize">{chat.type}</span>
                                                        {chat.member_count > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{chat.member_count.toLocaleString()} members</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-base)]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-[var(--color-text-secondary)]">
                                    {scannerSelectedChats.size} chat{scannerSelectedChats.size !== 1 ? 's' : ''} selected
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowScanner(false)
                                        setScannerSelectedChats(new Set())
                                    }}
                                    className="flex-1 h-10 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (scannerSelectedChats.size === 0) return
                                        setIsScanning(true)
                                        let totalCreated = 0, totalUpdated = 0
                                        try {
                                            for (const chatId of scannerSelectedChats) {
                                                const res = await fetch(`${API_BASE}/scan/${chatId}`, { method: 'POST' })
                                                if (res.ok) {
                                                    const result = await res.json()
                                                    totalCreated += result.profiles_created
                                                    totalUpdated += result.profiles_updated
                                                }
                                            }
                                            alert(`Scan complete!\nNew profiles: ${totalCreated}\nUpdated: ${totalUpdated}`)
                                            fetchProfiles()
                                            fetchStats()
                                            setShowScanner(false)
                                            setScannerSelectedChats(new Set())
                                        } catch (err) {
                                            console.error('Scan failed:', err)
                                            alert('Scan failed. Check console for details.')
                                        } finally {
                                            setIsScanning(false)
                                        }
                                    }}
                                    disabled={scannerSelectedChats.size === 0 || isScanning}
                                    className="flex-1 h-10 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                                    {isScanning ? 'Scanning...' : 'Start Scan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
