import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Settings, Users, Image, FileText, Link2, MoreVertical, Send, Copy, Download, Languages, Calendar, AlertCircle } from 'lucide-react'

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

const mockAccounts = [
    { id: 1, name: 'Main Account (@john_doe)' },
    { id: 2, name: 'Work Account (@john_work)' },
]

type RightPanelTab = 'members' | 'media' | 'files' | 'links' | 'settings' | 'export' | 'clone'

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
                        {/* Quick Actions in Header */}
                        <button
                            onClick={() => { setShowRightPanel(true); setRightPanelTab('clone'); }}
                            className="p-2 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                            title="Clone Channel"
                        >
                            <Copy className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => { setShowRightPanel(true); setRightPanelTab('export'); }}
                            className="p-2 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                            title="Export Chat"
                        >
                            <Download className="w-5 h-5" />
                        </button>

                        <div className="w-px h-6 bg-[var(--color-border)] mx-1" />

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
                    <div className="flex border-b border-[var(--color-border)] overflow-x-auto no-scrollbar">
                        {[
                            { id: 'members', icon: Users, label: 'Members' },
                            { id: 'media', icon: Image, label: 'Media' },
                            { id: 'files', icon: FileText, label: 'Files' },
                            { id: 'settings', icon: Settings, label: 'Settings' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setRightPanelTab(tab.id as RightPanelTab)}
                                className={`flex-shrink-0 px-4 py-3 flex items-center justify-center transition-colors ${rightPanelTab === tab.id
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

                        {rightPanelTab === 'clone' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                                    <Copy className="w-4 h-4 text-[var(--color-accent)]" />
                                    Channel Cloner
                                </h3>

                                <div className="p-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-[var(--color-text-secondary)] leading-tight">
                                        Clone messages and sentiment from this channel to another. Supports cross-account destination.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-[var(--color-text-secondary)] font-medium">Target Account</label>
                                        <select className="w-full mt-1 px-3 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]">
                                            {mockAccounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--color-text-secondary)] font-medium">Destination Channel</label>
                                        <input
                                            type="text"
                                            placeholder="@channel_username or link"
                                            className="w-full mt-1 px-3 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--color-text-secondary)] font-medium">Content Range</label>
                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-[var(--color-text-muted)] uppercase">From Date</label>
                                                <input type="date" className="w-full px-2 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-[var(--color-text-muted)] uppercase">To Date</label>
                                                <input type="date" className="w-full px-2 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]" />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--color-text-secondary)] font-medium">Message Settings</label>
                                        <div className="mt-1 space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                                <input type="checkbox" defaultChecked className="rounded border-[var(--color-border)]" />
                                                Include Media
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                                <input type="checkbox" defaultChecked className="rounded border-[var(--color-border)]" />
                                                Preserve Formatting
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                                <input type="checkbox" className="rounded border-[var(--color-border)]" />
                                                Rewrite with LLM (Persona)
                                            </label>
                                        </div>
                                    </div>

                                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-4 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-all">
                                        Start Cloning Process
                                    </button>
                                </div>
                            </div>
                        )}

                        {rightPanelTab === 'export' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                                    <Download className="w-4 h-4 text-[var(--color-accent)]" />
                                    Selective Exporter
                                </h3>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-[var(--color-text-secondary)] font-medium">Output Format</label>
                                        <select className="w-full mt-1 px-3 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]">
                                            <option value="json">JSON (Data Analysis)</option>
                                            <option value="html">HTML (Beautiful Report)</option>
                                            <option value="txt">TXT (Clean Text)</option>
                                            <option value="csv">CSV (Spreadsheet)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--color-text-secondary)] font-medium">Advanced Filters</label>
                                        <div className="mt-1 space-y-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-[var(--color-text-muted)] uppercase">Keywords</label>
                                                <input type="text" placeholder="Split by comma..." className="w-full px-3 py-2 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-1">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-[var(--color-text-muted)] uppercase">From ID</label>
                                                    <input type="number" placeholder="Msg ID" className="w-full px-2 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-[var(--color-text-muted)] uppercase">Min Views</label>
                                                    <input type="number" placeholder="0" className="w-full px-2 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--color-text-secondary)] font-medium">Media Extraction</label>
                                        <div className="mt-1 space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                                <input type="checkbox" defaultChecked className="rounded border-[var(--color-border)]" />
                                                Download all media
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                                <input type="checkbox" className="rounded border-[var(--color-border)]" />
                                                Export only media links
                                            </label>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {['Photo', 'Video', 'File', 'Link'].map(t => (
                                                    <span key={t} className="px-2 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)]">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-4 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium hover:bg-[var(--color-bg-hover)] transition-all">
                                        <Download className="w-4 h-4" />
                                        Generate Export Task
                                    </button>
                                </div>
                            </div>
                        )}

                        {rightPanelTab === 'settings' && (
                            <div className="space-y-5">
                                {/* Translation Settings */}
                                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/30">
                                    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Languages className="w-3 h-3" />
                                        Real-time Translation
                                    </h3>
                                    <label className="flex items-center justify-between p-2 rounded-md hover:bg-[var(--color-bg-hover)] cursor-pointer">
                                        <span className="text-sm text-[var(--color-text-primary)]">Enable Auto-Translate</span>
                                        <input type="checkbox" className="rounded border-[var(--color-border)]" />
                                    </label>
                                    <div className="mt-2 pl-2">
                                        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Target Language</label>
                                        <select className="w-full px-2 py-1.5 rounded bg-[var(--color-bg-panel)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]">
                                            <option>English (US)</option>
                                            <option>Spanish (ES)</option>
                                            <option>Russian (RU)</option>
                                            <option>Chinese (Simplified)</option>
                                            <option>German (DE)</option>
                                        </select>
                                    </div>
                                    <p className="px-2 mt-2 text-[10px] text-[var(--color-text-muted)] italic">
                                        Uses configured LLM provider for high-accuracy translation.
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Settings className="w-3 h-3" />
                                        Monitoring Logic
                                    </h3>
                                    <label className="flex items-center justify-between p-2 rounded-md hover:bg-[var(--color-bg-hover)] cursor-pointer">
                                        <span className="text-sm text-[var(--color-text-primary)]">Track Edits & Deletions</span>
                                        <input type="checkbox" className="rounded border-[var(--color-border)]" defaultChecked />
                                    </label>
                                    <label className="flex items-center justify-between p-2 rounded-md hover:bg-[var(--color-bg-hover)] cursor-pointer">
                                        <span className="text-sm text-[var(--color-text-primary)]">Automated Media Save</span>
                                        <input type="checkbox" className="rounded border-[var(--color-border)]" />
                                    </label>
                                    <label className="flex items-center justify-between p-2 rounded-md hover:bg-[var(--color-bg-hover)] cursor-pointer">
                                        <span className="text-sm text-[var(--color-text-primary)]">Log Profile Changes</span>
                                        <input type="checkbox" className="rounded border-[var(--color-border)]" defaultChecked />
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
