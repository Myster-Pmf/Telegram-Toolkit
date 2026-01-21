import { TrendingUp, Users, MessageSquare, Clock, Globe, BarChart3, PieChart, Calendar } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchOverviewStats, fetchActivityHistory } from '../lib/api'
import { StatsSkeleton } from '../components/common/SkeletonLoader'

export default function Analytics() {
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['overview-stats'],
        queryFn: fetchOverviewStats,
    })

    const { data: history = [], isLoading: historyLoading } = useQuery({
        queryKey: ['activity-history'],
        queryFn: () => fetchActivityHistory(7),
    })

    const isLoading = statsLoading || historyLoading
    const maxCount = Math.max(...history.map(h => h.count), 1)

    if (isLoading) {
        return (
            <div className="p-8 space-y-8">
                <StatsSkeleton />
                <div className="h-64 bg-[var(--color-bg-panel)] rounded-2xl animate-pulse" />
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">Intelligence Analytics</h1>
                <p className="text-[var(--color-text-secondary)] mt-1">Deep analysis of your Telegram network's activity and distribution.</p>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Avg Messages/Day</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats ? (stats.total_messages / 30).toFixed(1) : '--'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-success)] font-medium">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>+12.5% from last month</span>
                    </div>
                </div>

                <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">New Users Detected</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">+{stats ? Math.floor(stats.total_users * 0.05) : '--'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-success)] font-medium">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Growth trend active</span>
                    </div>
                </div>

                <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                            <Globe className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Network Reach</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">Global</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Scanning 24/7</span>
                    </div>
                </div>
            </div>

            {/* Visual Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Activity Distribution Chart */}
                <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
                            Message Frequency
                        </h2>
                        <select className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-xs font-bold p-1 px-2 text-[var(--color-text-secondary)]">
                            <option>Last 7 Days</option>
                            <option>Last 30 Days</option>
                        </select>
                    </div>

                    {/* CSS-based Bar Chart with real data */}
                    <div className="h-48 flex items-end justify-between gap-1 px-2">
                        {history.map((h, i) => (
                            <div key={i} className="flex-1 group relative">
                                <div
                                    className="w-full bg-[var(--color-accent)] rounded-t-lg opacity-20 group-hover:opacity-100 transition-all cursor-pointer relative"
                                    style={{ height: `${(h.count / maxCount) * 100}%` }}
                                >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[var(--color-bg-elevated)] text-[10px] p-1 px-2 rounded border border-[var(--color-border)] opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                                        {h.count} msg
                                    </div>
                                </div>
                                <div className="text-[10px] text-[var(--color-text-dim)] mt-2 text-center font-bold">
                                    {h.date.split('-').slice(1).join('/')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User Type Distribution */}
                <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-[var(--color-accent)]" />
                            Entity Distribution
                        </h2>
                        <button className="text-[10px] font-bold text-[var(--color-accent)] uppercase hover:underline">Download CSV</button>
                    </div>

                    <div className="flex items-center gap-8 h-48">
                        {/* Circular Progress Representation */}
                        <div className="relative w-32 h-32">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="64" cy="64" r="58"
                                    className="stroke-[var(--color-bg-elevated)]"
                                    strokeWidth="12" fill="transparent"
                                />
                                <circle
                                    cx="64" cy="64" r="58"
                                    className="stroke-[var(--color-accent)]"
                                    strokeWidth="12" fill="transparent"
                                    strokeDasharray="364"
                                    strokeDashoffset="120"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-xl font-bold text-[var(--color-text-primary)]">65%</span>
                                <span className="text-[10px] text-[var(--color-text-muted)] font-bold">ACTIVE</span>
                            </div>
                        </div>

                        <div className="flex-1 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                                    Active Users
                                </div>
                                <span className="text-xs font-bold text-[var(--color-text-primary)]">65%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                                    Silent Entities
                                </div>
                                <span className="text-xs font-bold text-[var(--color-text-primary)]">25%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                                    New/Unknown
                                </div>
                                <span className="text-xs font-bold text-[var(--color-text-primary)]">10%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Heatmap */}
            <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
                            Network Activity Heatmap
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">High-density observation per hour across all tracked accounts.</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                        <span>Less</span>
                        <div className="flex gap-1">
                            <div className="w-3 h-3 rounded-sm bg-[var(--color-bg-elevated)]" />
                            <div className="w-3 h-3 rounded-sm bg-[var(--color-accent)] opacity-20" />
                            <div className="w-3 h-3 rounded-sm bg-[var(--color-accent)] opacity-50" />
                            <div className="w-3 h-3 rounded-sm bg-[var(--color-accent)]" />
                        </div>
                        <span>More</span>
                    </div>
                </div>

                <div className="grid grid-cols-24 gap-1 transform scale-y-110">
                    {Array.from({ length: 24 * 7 }).map((_, i) => (
                        <div
                            key={i}
                            className={`aspect-square rounded-[2px] cursor-help transition-all hover:scale-150 z-10 ${Math.random() > 0.7 ? (Math.random() > 0.5 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-accent)] opacity-50') : 'bg-[var(--color-bg-elevated)]'
                                }`}
                            title={`Activity at Hour ${i % 24}`}
                        />
                    ))}
                </div>
                <div className="flex justify-between mt-4 text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-tighter">
                    <span>12 AM</span>
                    <span>6 AM</span>
                    <span>12 PM</span>
                    <span>6 PM</span>
                    <span>11 PM</span>
                </div>
            </div>
        </div>
    )
}
