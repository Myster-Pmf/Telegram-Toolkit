import { MessageSquare, Users, Archive, Activity, TrendingUp } from 'lucide-react'

const stats = [
    { label: 'Active Sessions', value: '2', icon: Users, change: '+1 this week' },
    { label: 'Monitored Chats', value: '24', icon: MessageSquare, change: '8 active' },
    { label: 'Tracked Users', value: '1,247', icon: Users, change: '+89 this week' },
    { label: 'Messages Stored', value: '45.2K', icon: Archive, change: '+2.3K today' },
]

const recentActivity = [
    { type: 'message', text: 'New message in #crypto-signals', time: '2m ago' },
    { type: 'join', text: 'User @trader_mike joined Trading Group', time: '5m ago' },
    { type: 'edit', text: 'Message edited in Private Chat', time: '12m ago' },
    { type: 'delete', text: 'Message deleted in #announcements', time: '18m ago' },
    { type: 'message', text: '15 new messages in Dev Community', time: '25m ago' },
]

export default function Dashboard() {
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
                {stats.map((stat) => (
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
                ))}
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
                        <button className="text-xs text-[var(--color-accent)] hover:underline">
                            View all
                        </button>
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
                        <button className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left">
                            <MessageSquare className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">Add Chat</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Monitor a new chat</div>
                        </button>
                        <button className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left">
                            <Archive className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">Create Archive</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Snapshot account</div>
                        </button>
                        <button className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left">
                            <Users className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">Add Account</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Connect new session</div>
                        </button>
                        <button className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left">
                            <Activity className="w-5 h-5 text-[var(--color-accent)] mb-2" />
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">Export Data</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Download archive</div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
