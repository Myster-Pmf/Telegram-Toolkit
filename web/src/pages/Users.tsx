import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Filter, AlertTriangle, MessageSquare, Activity } from 'lucide-react'

// Mock data
const mockUsers = [
    { id: 1, username: '@alice_crypto', firstName: 'Alice', lastName: 'Smith', messageCount: 2341, fakeScore: 0.1, seenIn: 5, lastSeen: '2m ago' },
    { id: 2, username: '@bob_trader', firstName: 'Bob', lastName: 'Johnson', messageCount: 1245, fakeScore: 0.05, seenIn: 3, lastSeen: '15m ago' },
    { id: 3, username: '@charlie', firstName: 'Charlie', lastName: 'Brown', messageCount: 892, fakeScore: 0.8, seenIn: 8, lastSeen: '1h ago' },
    { id: 4, username: '@diana_dev', firstName: 'Diana', lastName: 'Lee', messageCount: 567, fakeScore: 0.02, seenIn: 2, lastSeen: '3h ago' },
    { id: 5, username: '@user12345', firstName: null, lastName: null, messageCount: 23, fakeScore: 0.95, seenIn: 1, lastSeen: '1d ago' },
]

export default function Users() {
    const { userId } = useParams()
    const [selectedUserId, setSelectedUserId] = useState<number | null>(userId ? Number(userId) : null)
    const [searchQuery, setSearchQuery] = useState('')

    const selectedUser = mockUsers.find(u => u.id === selectedUserId)
    const filteredUsers = mockUsers.filter(u =>
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.firstName?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getFakeScoreColor = (score: number) => {
        if (score > 0.7) return 'text-[var(--color-error)]'
        if (score > 0.4) return 'text-[var(--color-warning)]'
        return 'text-[var(--color-success)]'
    }

    return (
        <div className="flex h-full">
            {/* User List */}
            <div className={`${selectedUserId ? 'w-1/2' : 'w-full'} flex flex-col border-r border-[var(--color-border)] transition-all`}>
                {/* Header */}
                <div className="p-4 border-b border-[var(--color-border)]">
                    <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Users Database</h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        {mockUsers.length} users tracked across all accounts
                    </p>

                    {/* Search and Filter */}
                    <div className="flex gap-2 mt-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-9 px-3 pl-9 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                        </div>
                        <button className="h-9 px-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-light)] transition-colors flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            <span className="text-sm">Filter</span>
                        </button>
                    </div>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-[var(--color-bg-panel)]">
                            <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border)]">
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Messages</th>
                                <th className="px-4 py-3">Seen In</th>
                                <th className="px-4 py-3">Fake Score</th>
                                <th className="px-4 py-3">Last Seen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {filteredUsers.map((user) => (
                                <tr
                                    key={user.id}
                                    onClick={() => setSelectedUserId(user.id)}
                                    className={`cursor-pointer transition-colors ${user.id === selectedUserId
                                            ? 'bg-[var(--color-accent-subtle)]'
                                            : 'hover:bg-[var(--color-bg-hover)]'
                                        }`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center">
                                                <span className="text-[var(--color-accent)] text-xs font-medium">
                                                    {(user.firstName || user.username || 'U').charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-sm text-[var(--color-text-primary)]">
                                                    {user.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Unknown'}
                                                </div>
                                                <div className="text-xs text-[var(--color-text-muted)]">{user.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                                        {user.messageCount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                                        {user.seenIn} chats
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            {user.fakeScore > 0.7 && <AlertTriangle className="w-3 h-3 text-[var(--color-error)]" />}
                                            <span className={`text-sm ${getFakeScoreColor(user.fakeScore)}`}>
                                                {(user.fakeScore * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                                        {user.lastSeen}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* User Detail Panel */}
            {selectedUserId && selectedUser && (
                <div className="w-1/2 flex flex-col bg-[var(--color-bg-base)]">
                    {/* Header */}
                    <div className="p-6 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center">
                                <span className="text-[var(--color-accent)] text-2xl font-medium">
                                    {(selectedUser.firstName || selectedUser.username || 'U').charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                                    {selectedUser.firstName ? `${selectedUser.firstName} ${selectedUser.lastName || ''}` : 'Unknown User'}
                                </h2>
                                <p className="text-sm text-[var(--color-text-secondary)]">{selectedUser.username}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    {selectedUser.fakeScore > 0.7 && (
                                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-[var(--color-error)] text-xs flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            High fake probability
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 p-6 border-b border-[var(--color-border)]">
                        <div className="text-center">
                            <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                                {selectedUser.messageCount.toLocaleString()}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">Messages</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                                {selectedUser.seenIn}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">Shared Chats</div>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-semibold ${getFakeScoreColor(selectedUser.fakeScore)}`}>
                                {(selectedUser.fakeScore * 100).toFixed(0)}%
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">Fake Score</div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-6 space-y-4">
                        <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] transition-colors">
                            <MessageSquare className="w-5 h-5 text-[var(--color-accent)]" />
                            <div className="text-left">
                                <div className="text-sm text-[var(--color-text-primary)]">View Messages</div>
                                <div className="text-xs text-[var(--color-text-muted)]">See all messages from this user</div>
                            </div>
                        </button>

                        <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] transition-colors">
                            <Activity className="w-5 h-5 text-[var(--color-accent)]" />
                            <div className="text-left">
                                <div className="text-sm text-[var(--color-text-primary)]">Activity Pattern</div>
                                <div className="text-xs text-[var(--color-text-muted)]">View activity heatmap</div>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
