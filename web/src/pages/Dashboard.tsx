import { MessageSquare, Users, Archive, Activity, TrendingUp, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchOverviewStats } from '../lib/api'

const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
}

export default function Dashboard() {
    const { data: stats, isLoading, error } = useQuery({
        queryKey: ['overview-stats'],
        queryFn: fetchOverviewStats,
        refetchInterval: 30000, // Refresh every 30 seconds
    })

    const statCards = stats ? [
        { label: 'Active Sessions', value: stats.active_sessions.toString(), icon: Users, change: `${stats.total_sessions} total` },
        { label: 'Chats', value: formatNumber(stats.total_chats), icon: MessageSquare, change: 'from Telegram' },
        { label: 'Tracked Users', value: formatNumber(stats.total_users), icon: Users, change: 'in database' },
        { label: 'Messages Stored', value: formatNumber(stats.total_messages), icon: Archive, change: 'archived' },
    ] : []

    const recentActivity = [
        { type: 'message', text: 'Real-time monitoring coming soon', time: 'soon' },
        { type: 'join', text: 'WebSocket integration planned', time: 'Phase 2.1' },
    ]

    return (
        <div className="p-6 space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                    Dashboard
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    Overview of your Telegram toolkit activity
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {isLoading ? (
                    <div className="col-span-4 flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
                        <span className="ml-2 text-[var(--color-text-muted)]">Loading stats...</span>
                    </div>
                ) : error ? (
                    <div className="col-span-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        Failed to load stats. Make sure you're logged in.
                    </div>
                ) : (
                    statCards.map((stat) => (
                        <div
                            key={stat.label}
                            className="p-4 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p>
                                    <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">
                                        {stat.value}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                        {stat.change}
                                    </p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-subtle)] flex items-center justify-center">
                                    <stat.icon className="w-5 h-5 text-[var(--color-accent)]" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                        <h2 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Recent Activity
                        </h2>
                        <span className="text-xs text-[var(--color-text-muted)]">Coming soon</span>
                    </div>
                    <div className="divide-y divide-[var(--color-border)]">
                        {recentActivity.map((item, i) => (
                            <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-hover)] transition-colors">
                                <span className="text-sm text-[var(--color-text-primary)]">{item.text}</span>
                                <span className="text-xs text-[var(--color-text-muted)]">{item.time}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="px-4 py-3 border-b border-[var(--color-border)]">
                        <h2 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Quick Actions
                        </h2>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3">
                        <a href="/chats" className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left">
                            <MessageSquare className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">View Chats</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Browse dialogs</div>
                        </a>
                        <a href="/archives" className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left">
                            <Archive className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">Archives</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Saved snapshots</div>
                        </a>
                        <a href="/auth" className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left">
                            <Users className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">Add Account</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Connect new session</div>
                        </a>
                        <a href="/settings" className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left">
                            <Activity className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">Settings</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Configure toolkit</div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
