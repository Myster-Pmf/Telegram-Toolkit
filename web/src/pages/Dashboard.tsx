import { MessageSquare, Users, Archive, Activity, TrendingUp, Loader2, Clock, Zap, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchOverviewStats, fetchRecentActivity } from '../lib/api'
import { StatsSkeleton, Skeleton } from '../components/common/SkeletonLoader'

const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
}

export default function Dashboard() {
    const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
        queryKey: ['overview-stats'],
        queryFn: fetchOverviewStats,
        refetchInterval: 30000,
    })

    const { data: activityLogs = [], isLoading: activityLoading } = useQuery({
        queryKey: ['recent-activity'],
        queryFn: () => fetchRecentActivity(10),
        refetchInterval: 10000, // Refresh more often for "live" feel
    })

    const statCards = stats ? [
        { label: 'Active Sessions', value: stats.active_sessions.toString(), icon: Users, change: `${stats.total_sessions} total accounts`, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Total Chats', value: formatNumber(stats.total_chats), icon: MessageSquare, change: 'Discovered in Telegram', color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { label: 'Tracked Users', value: formatNumber(stats.total_users), icon: Users, change: 'Unique identities in DB', color: 'text-green-500', bg: 'bg-green-500/10' },
        { label: 'Messages Stored', value: formatNumber(stats.total_messages), icon: Archive, change: 'Deep archive capacity', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ] : []

    const getIcon = (type: string) => {
        if (type === 'message') return MessageSquare
        if (type === 'automation') return Zap
        return Activity
    }

    const formatTime = (isoString: string) => {
        const date = new Date(isoString)
        const diff = Date.now() - date.getTime()
        if (diff < 60000) return 'Just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
        return date.toLocaleDateString()
    }

    const isLoading = statsLoading || activityLoading
    const error = statsError

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
                        Analytics Dashboard
                    </h1>
                    <p className="text-[var(--color-text-secondary)] mt-1.5 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Live status as of {new Date().toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="h-10 px-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-light)] transition-all">
                        Generate Report
                    </button>
                    <button className="h-10 px-4 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-all shadow-lg shadow-[var(--color-accent)]/20">
                        Refresh Stats
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            {isLoading ? (
                <StatsSkeleton />
            ) : error ? (
                <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-4">
                    <div className="p-3 rounded-full bg-red-500/20">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold">Database Sync Error</h3>
                        <p className="text-sm opacity-80">Failed to fetch real-time overview. Please check your session status.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {statCards.map((stat) => (
                        <div
                            key={stat.label}
                            className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-accent-dim)] transition-all group relative overflow-hidden"
                        >
                            <div className="relative z-10 flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{stat.label}</p>
                                    <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-2">
                                        {stat.value}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-secondary)] mt-2 font-medium">
                                        {stat.change}
                                    </p>
                                </div>
                                <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                            </div>
                            {/* Decorative background element */}
                            <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${stat.bg} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                        </div>
                    ))}
                </div>
            )}

            {/* Main Dashboard Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Real-time Activity Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-panel)]/50">
                            <h2 className="font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                                <Activity className="w-5 h-5 text-[var(--color-accent)]" />
                                Live Intelligence Feed
                            </h2>
                            <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-[var(--color-success)] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                                Real-time
                            </span>
                        </div>
                        <div className="p-2 divide-y divide-[var(--color-border)]/50">
                            {activityLogs.map((log) => {
                                const Icon = getIcon(log.type)
                                return (
                                    <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-[var(--color-bg-hover)] transition-colors rounded-xl mx-2 my-1">
                                        <div className={`p-2.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)]`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{log.title}</h3>
                                                <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{formatTime(log.time)}</span>
                                            </div>
                                            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{log.desc}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <button className="w-full py-4 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-accent)] uppercase tracking-widest transition-colors border-t border-[var(--color-border)] bg-[var(--color-bg-panel)]/20">
                            View Deep System Logs
                        </button>
                    </div>

                    {/* Chart Placeholder (Future) */}
                    <div className="p-8 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] flex flex-col items-center justify-center space-y-4 h-64 border-dashed opacity-60">
                        <div className="w-16 h-16 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
                            <TrendingUp className="w-8 h-8 text-[var(--color-text-dim)]" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Activity Analytics Visualization</h3>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Collecting data patterns to generate interactive charts...</p>
                        </div>
                    </div>
                </div>

                {/* Right: Quick Actions & Workspace Info */}
                <div className="space-y-6">
                    <div className="rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-[var(--color-border)]">
                            <h2 className="font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                                <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
                                Quick Operations
                            </h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-3">
                            <a href="/search" className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all group flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] group-hover:scale-110 transition-transform">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-[var(--color-text-primary)]">Global Search</div>
                                    <div className="text-xs text-[var(--color-text-muted)]">Find items across network</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-[var(--color-text-dim)]" />
                            </a>
                            <a href="/automation" className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all group flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-[var(--color-success)]/10 text-[var(--color-success)] group-hover:scale-110 transition-transform">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-[var(--color-text-primary)]">Auto-Responder</div>
                                    <div className="text-xs text-[var(--color-text-muted)]">Manage active rules</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-[var(--color-text-dim)]" />
                            </a>
                            <a href="/archives" className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all group flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-[var(--color-warning)]/10 text-[var(--color-warning)] group-hover:scale-110 transition-transform">
                                    <Archive className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-[var(--color-text-primary)]">Snapshots</div>
                                    <div className="text-xs text-[var(--color-text-muted)]">Access cold storage</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-[var(--color-text-dim)]" />
                            </a>
                        </div>
                    </div>

                    {/* Workspace Health */}
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--color-bg-panel)] to-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                        <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-4">Workspace Health</h2>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-[var(--color-text-secondary)]">Storage Usage</span>
                                    <span className="text-[var(--color-text-primary)] font-bold">
                                        {stats ? (stats.storage_usage_mb / 1024).toFixed(1) : '0'} GB / 10 GB
                                    </span>
                                </div>
                                <div className="h-2 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--color-accent)] transition-all duration-1000"
                                        style={{ width: stats ? `${Math.min((stats.storage_usage_mb / 10240) * 100, 100)}%` : '0%' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-[var(--color-text-secondary)]">Session Stability</span>
                                    <span className="text-[var(--color-success)] font-bold">98.5%</span>
                                </div>
                                <div className="h-2 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                                    <div className="h-full bg-[var(--color-success)] w-[98.5%]" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-[var(--color-border)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">All Systems Operational</span>
                            </div>
                            <button className="text-[10px] font-bold text-[var(--color-accent)] uppercase hover:underline">Details</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
