import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Settings, Users, Image, FileText, Link2, MoreVertical, Send } from 'lucide-react'

// Mock data
const mockChats = [
    { id: 1, title: 'Crypto Signals', type: 'channel', lastMessage: 'BTC looking bullish...', time: '12:30', unread: 5, photo: null },
    { id: 2, title: 'Dev Community', type: 'supergroup', lastMessage: 'Anyone using Rust?', time: '11:45', unread: 0, photo: null },
    { id: 3, title: 'John Doe', type: 'private', lastMessage: 'See you tomorrow!', time: '10:20', unread: 1, photo: null },
    { id: 4, title: 'Trading Group', type: 'group', lastMessage: 'Market is crazy today', time: 'Yesterday', unread: 0, photo: null },
    { id: 5, title: 'Tech News', type: 'channel', lastMessage: 'Breaking: New AI model...', time: 'Yesterday', unread: 12, photo: null },
]

const mockMessages = [
    { id: 1, sender: 'Alice', text: 'Hey everyone! 👋', time: '10:30', isOwn: false },
    { id: 2, sender: 'Bob', text: 'Hi Alice! How are you?', time: '10:31', isOwn: false },
    { id: 3, sender: 'You', text: 'Good morning! Ready for the meeting?', time: '10:32', isOwn: true },
    { id: 4, sender: 'Alice', text: 'Yes! I have some updates to share about the project progress.', time: '10:33', isOwn: false },
    { id: 5, sender: 'Bob', text: 'Great, looking forward to it', time: '10:34', isOwn: false },
]

type RightPanelTab = 'members' | 'media' | 'files' | 'links' | 'settings'

export default function Chats() {
    const { chatId } = useParams()
    const [selectedChatId, setSelectedChatId] = useState<number>(chatId ? Number(chatId) : 1)
    const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('members')
    const [showRightPanel, setShowRightPanel] = useState(true)

    const selectedChat = mockChats.find(c => c.id === selectedChatId)

    return (
        <div className="flex h-full">
            {/* Chat List (Left Panel) */}
            <div className="w-72 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                {/* Search Header */}
                <div className="p-3 border-b border-[var(--color-border)]">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search chats..."
                            className="w-full h-9 px-3 pl-9 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                    {mockChats.map((chat) => (
                        <button
                            key={chat.id}
                            onClick={() => setSelectedChatId(chat.id)}
                            className={`w-full p-3 flex items-center gap-3 transition-colors ${chat.id === selectedChatId
                                    ? 'bg-[var(--color-accent-subtle)]'
                                    : 'hover:bg-[var(--color-bg-hover)]'
                                }`}
                        >
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center flex-shrink-0">
                                <span className="text-[var(--color-accent)] font-medium text-sm">
                                    {chat.title.charAt(0)}
                                </span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                        {chat.title}
                                    </span>
                                    <span className="text-xs text-[var(--color-text-muted)]">{chat.time}</span>
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-xs text-[var(--color-text-secondary)] truncate">
                                        {chat.lastMessage}
                                    </span>
                                    {chat.unread > 0 && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white text-xs min-w-[18px] text-center">
                                            {chat.unread}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages (Center Panel) */}
            <div className="flex-1 flex flex-col bg-[var(--color-bg-base)]">
                {/* Chat Header */}
                <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center">
                            <span className="text-[var(--color-accent)] font-medium text-sm">
                                {selectedChat?.title.charAt(0)}
                            </span>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">
                                {selectedChat?.title}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                                {selectedChat?.type} • 1,234 members
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowRightPanel(!showRightPanel)}
                            className={`p-2 rounded-md transition-colors ${showRightPanel
                                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                                }`}
                        >
                            <Users className="w-5 h-5" />
                        </button>
                        <button className="p-2 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {mockMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[70%] px-3 py-2 rounded-lg ${msg.isOwn
                                        ? 'bg-[var(--color-accent)] text-white'
                                        : 'bg-[var(--color-bg-panel)] border border-[var(--color-border)]'
                                    }`}
                            >
                                {!msg.isOwn && (
                                    <div className="text-xs font-medium text-[var(--color-accent)] mb-1">
                                        {msg.sender}
                                    </div>
                                )}
                                <div className="text-sm">{msg.text}</div>
                                <div className={`text-xs mt-1 ${msg.isOwn ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                                    {msg.time}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Type a message..."
                            className="flex-1 h-10 px-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <button className="w-10 h-10 rounded-lg bg-[var(--color-accent)] flex items-center justify-center hover:bg-[var(--color-accent-hover)] transition-colors">
                            <Send className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel (Info) */}
            {showRightPanel && (
                <div className="w-80 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                    {/* Tabs */}
                    <div className="flex border-b border-[var(--color-border)]">
                        {[
                            { id: 'members', icon: Users, label: 'Members' },
                            { id: 'media', icon: Image, label: 'Media' },
                            { id: 'files', icon: FileText, label: 'Files' },
                            { id: 'links', icon: Link2, label: 'Links' },
                            { id: 'settings', icon: Settings, label: 'Settings' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setRightPanelTab(tab.id as RightPanelTab)}
                                className={`flex-1 py-3 flex items-center justify-center transition-colors ${rightPanelTab === tab.id
                                        ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                                    }`}
                                title={tab.label}
                            >
                                <tab.icon className="w-4 h-4" />
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {rightPanelTab === 'members' && (
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                                    Members (1,234)
                                </div>
                                {['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'].map((name) => (
                                    <button
                                        key={name}
                                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[var(--color-bg-hover)] transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center">
                                            <span className="text-[var(--color-accent)] text-xs font-medium">
                                                {name.charAt(0)}
                                            </span>
                                        </div>
                                        <div className="text-sm text-[var(--color-text-primary)]">{name}</div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {rightPanelTab === 'media' && (
                            <div className="grid grid-cols-3 gap-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                                    <div key={i} className="aspect-square bg-[var(--color-bg-elevated)] rounded-md" />
                                ))}
                            </div>
                        )}

                        {rightPanelTab === 'settings' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center justify-between">
                                        <span className="text-sm text-[var(--color-text-primary)]">Monitor this chat</span>
                                        <input type="checkbox" className="rounded" defaultChecked />
                                    </label>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                        Track messages, edits, and deletions
                                    </p>
                                </div>
                                <div>
                                    <label className="flex items-center justify-between">
                                        <span className="text-sm text-[var(--color-text-primary)]">Auto-download media</span>
                                        <input type="checkbox" className="rounded" />
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
