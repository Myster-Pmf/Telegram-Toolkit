import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Settings, Users, Image, FileText, Link2, MoreVertical, Send, Copy, Download, Languages, Calendar, AlertCircle, MessageSquare } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cloneChat, exportChat, fetchChats, fetchMessages } from '../lib/api'

const mockAccounts = [
    { id: 1, name: 'Main Account (@john_doe)' },
    { id: 2, name: 'Work Account (@john_work)' },
]

type RightPanelTab = 'members' | 'media' | 'files' | 'links' | 'settings' | 'export' | 'clone'

export default function Chats() {
    const { chatId } = useParams()
    const [selectedChatId, setSelectedChatId] = useState<number | null>(chatId ? Number(chatId) : null)
    const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('members')
    const [showRightPanel, setShowRightPanel] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Clone Form State
    const [cloneForm, setCloneForm] = useState({
        target_account_id: 1,
        destination_chat: '',
        from_date: null,
        to_date: null,
        include_media: true,
        preserve_formatting: true,
        rewrite_persona: null
    })

    // Export Form State
    const [exportForm, setExportForm] = useState({
        format: 'json',
        keywords: '',
        from_id: null,
        min_views: null,
        include_media: true
    })


    const { data: chats = [], isLoading: isLoadingChats } = useQuery({
        queryKey: ['chats'],
        queryFn: fetchChats,
    })

    // Auto-select first chat when chats load and none is selected
    useEffect(() => {
        if (!selectedChatId && chats.length > 0) {
            setSelectedChatId(chats[0].id)
        }
    }, [chats, selectedChatId])

    const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
        queryKey: ['chats', selectedChatId, 'messages'],
        queryFn: () => fetchMessages(selectedChatId!),
        enabled: !!selectedChatId,
    })

    const startClone = async () => {
        if (!selectedChatId) return
        setIsSubmitting(true)
        try {
            const result = await cloneChat(selectedChatId, cloneForm)
            alert(result.message || 'Cloning task started successfully!')
        } catch (err: any) {
            alert('Failed to start cloning: ' + err.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const startExport = async () => {
        if (!selectedChatId) return
        setIsSubmitting(true)
        try {
            const result = await exportChat(selectedChatId, exportForm)
            alert(result.message || 'Export task generated successfully!')
        } catch (err: any) {
            alert('Failed to start export: ' + err.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const selectedChat = chats.find((c: any) => c.id === selectedChatId)

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
                    {isLoadingChats && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-10 opacity-50">
                            <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-medium">Loading Dialogs...</span>
                        </div>
                    )}
                    {chats.map((chat: any) => (
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
                                    {(chat.title || '?').charAt(0)}
                                </span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                        {chat.title || 'Unknown Chat'}
                                    </span>
                                    <span className="text-[10px] text-[var(--color-text-muted)]">
                                        {chat.last_message_date ? new Date(chat.last_message_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-xs text-[var(--color-text-secondary)] truncate">
                                        {chat.last_message}
                                    </span>
                                    {chat.unread_count > 0 && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white text-xs min-w-[18px] text-center">
                                            {chat.unread_count}
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
                                {(selectedChat?.title || '?').charAt(0)}
                            </span>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">
                                {selectedChat?.title || 'Select a chat'}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                                {selectedChat ? `${selectedChat.chat_type} • ${selectedChat.member_count || 0} members` : ''}
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
                    {isLoadingMessages && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                            <MessageSquare className="w-8 h-8 text-[var(--color-accent)] animate-pulse" />
                            <span className="text-xs font-semibold uppercase tracking-widest">Hydrating History</span>
                        </div>
                    )}
                    {!isLoadingMessages && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full opacity-20">
                            <MessageSquare className="w-16 h-16 mb-2" />
                            <span className="text-sm font-bold">No messages found</span>
                        </div>
                    )}
                    {messages.map((msg: any) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.is_outgoing ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[70%] px-3 py-2 rounded-lg ${msg.is_outgoing
                                    ? 'bg-[var(--color-accent)] text-white shadow-md'
                                    : 'bg-[var(--color-bg-panel)] border border-[var(--color-border)] shadow-sm'
                                    }`}
                            >
                                {!msg.is_outgoing && (
                                    <div className="text-[10px] font-bold text-[var(--color-accent)] mb-1 uppercase tracking-tight">
                                        {msg.sender_name || 'User'}
                                    </div>
                                )}
                                <div className="text-sm leading-relaxed">{msg.text}</div>
                                <div className={`text-[10px] mt-1.5 ${msg.is_outgoing ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                                    {new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                        <select
                                            value={cloneForm.target_account_id}
                                            onChange={(e) => setCloneForm({ ...cloneForm, target_account_id: parseInt(e.target.value) })}
                                            className="w-full mt-1 px-3 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                        >
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
                                            value={cloneForm.destination_chat}
                                            onChange={(e) => setCloneForm({ ...cloneForm, destination_chat: e.target.value })}
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
                                            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={cloneForm.include_media}
                                                    onChange={(e) => setCloneForm({ ...cloneForm, include_media: e.target.checked })}
                                                    className="rounded border-[var(--color-border)]"
                                                />
                                                Include Media
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={cloneForm.preserve_formatting}
                                                    onChange={(e) => setCloneForm({ ...cloneForm, preserve_formatting: e.target.checked })}
                                                    className="rounded border-[var(--color-border)]"
                                                />
                                                Preserve Formatting
                                            </label>
                                        </div>
                                    </div>

                                    <button
                                        onClick={startClone}
                                        disabled={isSubmitting || !cloneForm.destination_chat}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-4 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? 'Initializing...' : 'Start Cloning Process'}
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
                                        <select
                                            value={exportForm.format}
                                            onChange={(e) => setExportForm({ ...exportForm, format: e.target.value })}
                                            className="w-full mt-1 px-3 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                        >
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

                                    <button
                                        onClick={startExport}
                                        disabled={isSubmitting}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-4 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium hover:bg-[var(--color-bg-hover)] transition-all disabled:opacity-50"
                                    >
                                        <Download className="w-4 h-4" />
                                        {isSubmitting ? 'Preparing Data...' : 'Generate Export Task'}
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
