import { Plus, Download, Eye, Trash2, Clock, HardDrive } from 'lucide-react'

// Mock data
const mockArchives = [
    {
        id: 1,
        name: 'Full Backup - Jan 2026',
        account: '@john_doe',
        status: 'completed',
        size: '1.2 GB',
        chats: 45,
        messages: 12500,
        createdAt: '2026-01-15 10:30',
    },
    {
        id: 2,
        name: 'Crypto Channels Only',
        account: '@john_doe',
        status: 'completed',
        size: '450 MB',
        chats: 8,
        messages: 4200,
        createdAt: '2026-01-10 14:20',
    },
    {
        id: 3,
        name: 'Work Account Snapshot',
        account: '@john_work',
        status: 'in_progress',
        progress: 67,
        size: '---',
        chats: 12,
        messages: 0,
        createdAt: '2026-01-19 12:00',
    },
]

export default function Archives() {
    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Archives</h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Full account snapshots for backup and offline viewing
                    </p>
                </div>
                <button className="flex items-center gap-2 h-9 px-4 rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Create Archive</span>
                </button>
            </div>

            {/* Archives Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockArchives.map((archive) => (
                    <div
                        key={archive.id}
                        className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-border-light)] transition-colors"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-[var(--color-border)]">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-medium text-[var(--color-text-primary)]">{archive.name}</h3>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{archive.account}</p>
                                </div>
                                {archive.status === 'completed' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-[var(--color-success)] text-xs">
                                        Completed
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-[var(--color-accent)] text-xs">
                                        In Progress
                                    </span>
                                )}
                            </div>

                            {/* Progress bar for in-progress */}
                            {archive.status === 'in_progress' && (
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-[var(--color-text-muted)]">Progress</span>
                                        <span className="text-[var(--color-text-secondary)]">{archive.progress}%</span>
                                    </div>
                                    <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                                            style={{ width: `${archive.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="p-4 grid grid-cols-3 gap-4 text-center border-b border-[var(--color-border)]">
                            <div>
                                <div className="text-lg font-semibold text-[var(--color-text-primary)]">{archive.chats}</div>
                                <div className="text-xs text-[var(--color-text-muted)]">Chats</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {archive.messages > 0 ? (archive.messages / 1000).toFixed(1) + 'K' : '---'}
                                </div>
                                <div className="text-xs text-[var(--color-text-muted)]">Messages</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-[var(--color-text-primary)]">{archive.size}</div>
                                <div className="text-xs text-[var(--color-text-muted)]">Size</div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 flex items-center justify-between bg-[var(--color-bg-elevated)]">
                            <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                <Clock className="w-3 h-3" />
                                <span>{archive.createdAt}</span>
                            </div>

                            <div className="flex items-center gap-1">
                                {archive.status === 'completed' && (
                                    <>
                                        <button className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" title="View">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" title="Download">
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                                <button className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-error)]" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Create New Card */}
                <button className="rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors p-8 flex flex-col items-center justify-center gap-3 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
                    <HardDrive className="w-8 h-8" />
                    <div className="text-sm font-medium">Create New Archive</div>
                    <div className="text-xs">Snapshot your entire account</div>
                </button>
            </div>
        </div>
    )
}
