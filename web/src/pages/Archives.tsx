import { useState } from 'react'
import { Plus, Eye, Trash2, Clock, Globe, Upload, MessageSquare, Image, Search, FolderOpen, ArrowLeft, MoreVertical, Users, HardDrive, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import ImportModal from '../components/archives/ImportModal'
import { fetchArchives, fetchArchivedChats, fetchArchivedMessages } from '../lib/api'


// Imports are loaded from exports directory
type ActiveTab = 'snapshots' | 'imports'

export default function Archives() {
    const [activeTab, setActiveTab] = useState<ActiveTab>('snapshots')
    const [viewingArchive, setViewingArchive] = useState<any | null>(null)
    const [selectedArchiveChatId, setSelectedArchiveChatId] = useState<number>(1)
    const [showRightPanel, setShowRightPanel] = useState(true)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)

    const { data: archives = [], isLoading, error } = useQuery({
        queryKey: ['archives'],
        queryFn: fetchArchives,
    })

    const { data: archivedChats = [] } = useQuery({
        queryKey: ['archives', viewingArchive?.id, 'chats'],
        queryFn: () => fetchArchivedChats(viewingArchive.id),
        enabled: !!viewingArchive,
    })

    const { data: archivedMessages = [] } = useQuery({
        queryKey: ['archives', viewingArchive?.id, 'chats', selectedArchiveChatId, 'messages'],
        queryFn: () => fetchArchivedMessages(viewingArchive.id, selectedArchiveChatId),
        enabled: !!viewingArchive && !!selectedArchiveChatId,
    })

    // IMMERSIVE VIEW: This takes over the whole page to feel like the actual Chats section
    if (viewingArchive) {
        const selectedChat = archivedChats.find((c: any) => c.id === selectedArchiveChatId)

        return (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
                {/* Sub-header for Archive Context */}
                <div className="h-12 px-4 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setViewingArchive(null)}
                            className="p-1 px-2 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] flex items-center gap-1.5 text-xs font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Exit Archive View
                        </button>
                        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
                        <span className="text-xs text-[var(--color-text-primary)] font-semibold flex items-center gap-2">
                            <HistoryIcon className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                            {viewingArchive.name}
                            <span className="text-[var(--color-text-muted)] font-normal">({viewingArchive.account || 'Imported File'})</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] border border-[var(--color-border)] px-2 py-0.5 rounded">
                            READ-ONLY ARCHIVE
                        </span>
                    </div>
                </div>

                {/* 3-Panel Layout (mimicking Chats.tsx) */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Archived Chat List */}
                    <div className="w-72 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                        <div className="p-3 border-b border-[var(--color-border)]">
                            <div className="relative">
                                <input type="text" placeholder="Search in archive..." className="w-full h-8 px-3 pl-8 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]" />
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {archivedChats.map((chat: any) => (
                                <button
                                    key={chat.id}
                                    onClick={() => setSelectedArchiveChatId(chat.id)}
                                    className={`w-full p-3 flex items-center gap-3 border-b border-[var(--color-border)]/30 transition-colors ${chat.id === selectedArchiveChatId ? 'bg-[var(--color-accent-subtle)]' : 'hover:bg-[var(--color-bg-hover)]'}`}
                                >
                                    <div className="w-9 h-9 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-xs font-medium text-[var(--color-text-primary)]">
                                        {chat.title.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{chat.title}</span>
                                            <span className="text-[10px] text-[var(--color-text-muted)]">{chat.time}</span>
                                        </div>
                                        <p className="text-xs text-[var(--color-text-secondary)] truncate">{chat.last_message}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Center: Message View */}
                    <div className="flex-1 flex flex-col bg-[var(--color-bg-base)]">
                        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center text-[var(--color-accent)] font-medium">
                                    {selectedChat?.title.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{selectedChat?.title}</div>
                                    <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{selectedChat?.type} • 1.2K messages archived</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowRightPanel(!showRightPanel)} className="p-2 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]">
                                    <Users className="w-5 h-5" />
                                </button>
                                <button className="p-2 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="flex justify-center">
                                <span className="px-3 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-bold">
                                    Archive data from January 2026
                                </span>
                            </div>
                            {archivedMessages.map((msg: any) => (
                                <div key={msg.id} className={`flex ${msg.is_own ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-3 rounded-xl ${msg.is_own ? 'bg-[var(--color-accent)] text-white shadow-lg' : 'bg-[var(--color-bg-panel)] border border-[var(--color-border)]'}`}>
                                        {!msg.is_own && <div className="text-[10px] font-bold text-[var(--color-accent)] mb-1 uppercase tracking-tight">{msg.sender}</div>}
                                        <p className="text-sm leading-relaxed">{msg.text}</p>
                                        <div className={`text-[10px] mt-1.5 ${msg.is_own ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>{msg.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* No input bar in archive view, just a notice */}
                        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-panel)]/50 text-center">
                            <p className="text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                This is a read-only archive session. You cannot send messages.
                            </p>
                        </div>
                    </div>

                    {/* Right: Info Panel */}
                    {showRightPanel && (
                        <div className="w-80 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                            <div className="flex border-b border-[var(--color-border)]">
                                {['Media', 'Files', 'Links'].map(t => (
                                    <button key={t} className="flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                                        {t}
                                    </button>
                                ))}
                            </div>
                            <div className="p-4 space-y-6 overflow-y-auto">
                                <div>
                                    <h4 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">Archived Photos (156)</h4>
                                    <div className="grid grid-cols-3 gap-1">
                                        {[1, 2, 3, 4, 5, 6].map(i => (
                                            <div key={i} className="aspect-square bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border)]" />
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                                    <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">Export Info</h4>
                                    <p className="text-[10px] text-[var(--color-text-muted)]">Source: JSON Dump</p>
                                    <p className="text-[10px] text-[var(--color-text-muted)]">Date: 2026-01-19</p>
                                    <button className="w-full mt-3 py-1.5 rounded bg-[var(--color-accent)] text-white text-[10px] font-bold">RE-EXPORT DATA</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full bg-[var(--color-bg-base)]">
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                                Archives
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] flex items-center gap-1 font-normal">
                                    <Globe className="w-3 h-3" />
                                    Global Hub
                                </span>
                            </h1>
                            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                                Centralized history for account snapshots and chat dumps.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {/* Import Options always visible or contextual */}
                            <button
                                title="Import existing .session or json archive"
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
                                onClick={() => setIsImportModalOpen(true)} // Open Import Modal
                            >
                                <Upload className="w-4 h-4" />
                                <span className="text-sm font-medium">Import Snapshot</span>
                            </button>

                            <button
                                className="flex items-center gap-2 h-9 px-4 rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors shadow-lg shadow-[var(--color-accent)]/20"
                                onClick={() => { }} // Create Snapshot
                            >
                                <Plus className="w-4 h-4" />
                                <span className="text-sm font-medium">New Backup</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-elevated)] w-fit mt-1">
                        <button
                            onClick={() => setActiveTab('snapshots')}
                            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'snapshots'
                                ? 'bg-[var(--color-bg-panel)] text-[var(--color-accent)] shadow-sm'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                                }`}
                        >
                            Account Snapshots
                        </button>
                        <button
                            onClick={() => setActiveTab('imports')}
                            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'imports'
                                ? 'bg-[var(--color-bg-panel)] text-[var(--color-accent)] shadow-sm'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                                }`}
                        >
                            Chat Imports
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'snapshots' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {isLoading && (
                                <div className="col-span-full py-20 text-center">
                                    <div className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-[var(--color-text-muted)] animate-pulse">Scanning Archive Vault...</p>
                                </div>
                            )}

                            {error && (
                                <div className="col-span-full py-12 px-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center max-w-lg mx-auto">
                                    <Globe className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-red-500 mb-2">Connection Interrupted</h3>
                                    <p className="text-sm text-red-500/80 mb-6">We couldn't reach the archive server. Please verify your connection.</p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="px-6 py-2 rounded-xl bg-red-500 text-white font-bold text-sm"
                                    >
                                        RETRY CONNECTION
                                    </button>
                                </div>
                            )}

                            {!isLoading && !error && archives.length === 0 && (
                                <div className="col-span-full py-20 text-center border-2 border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-bg-panel)]/50">
                                    <HardDrive className="w-16 h-16 text-[var(--color-text-dim)] mx-auto mb-4 opacity-20" />
                                    <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Workspace Empty</h3>
                                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto mb-8">
                                        No snapshots found. Start by creating a new backup or importing an existing session strings.
                                    </p>
                                </div>
                            )}

                            {archives.map((archive: any) => (
                                <div
                                    key={archive.id}
                                    className="rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-accent-dim)] transition-all group shadow-sm hover:shadow-xl"
                                >
                                    <div className="p-4 border-b border-[var(--color-border)]">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-semibold text-[var(--color-text-primary)]">{archive.name}</h3>
                                                <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5 font-mono uppercase tracking-tighter">
                                                    <HistoryIcon className="w-3.5 h-3.5" />
                                                    Session ID: {archive.session_id}
                                                </p>
                                            </div>
                                            {archive.status === 'completed' ? (
                                                <span className="px-2 py-0.5 rounded-md bg-green-500/10 text-[var(--color-success)] text-[10px] font-bold uppercase tracking-widest">
                                                    Safe
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[var(--color-accent)] text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                                    {archive.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-5 grid grid-cols-3 gap-4 text-center border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/30">
                                        <div>
                                            <div className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
                                                {archive.stats?.chats || '0'}
                                            </div>
                                            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Chats</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
                                                {archive.stats?.messages ? (archive.stats.messages / 1000).toFixed(1) + 'K' : '--'}
                                            </div>
                                            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Msg</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight whitespace-nowrap">
                                                {archive.file_size ? (archive.file_size / (1024 * 1024)).toFixed(1) + ' MB' : '--'}
                                            </div>
                                            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Size</div>
                                        </div>
                                    </div>

                                    <div className="p-3 flex items-center justify-between bg-[var(--color-bg-elevated)]/50 border-t border-[var(--color-border)]/50">
                                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{new Date(archive.created_at).toLocaleDateString()}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setViewingArchive(archive)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent-subtle)] text-[var(--color-accent)] text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--color-accent)] hover:text-white transition-all shadow-sm"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Immersive View
                                            </button>
                                            <button className="p-2 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-error)]">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                className="rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all p-8 flex flex-col items-center justify-center gap-4 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] bg-[var(--color-bg-panel)]/30"
                                onClick={() => setIsImportModalOpen(true)} // Import Trigger
                            >
                                <div className="w-12 h-12 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <div className="text-center">
                                    <div className="text-sm font-bold uppercase tracking-widest">Import Session/Snapshot</div>
                                    <div className="text-xs font-normal opacity-70 mt-1">Add existing backups to your library</div>
                                </div>
                            </button>
                        </div>
                    )}

                    {activeTab === 'imports' && (
                        <div className="max-w-4xl mx-auto space-y-4">
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] text-white shadow-xl flex items-center justify-between mb-8 overflow-hidden relative">
                                <div className="relative z-10">
                                    <h2 className="text-xl font-bold mb-1">Archive Importer</h2>
                                    <p className="text-xs opacity-80 max-w-sm">
                                        Drag and drop any Telegram export folder or JSON file here to start exploring your data in a full high-fidelity environment.
                                    </p>
                                </div>
                                <Upload className="w-20 h-20 opacity-20 absolute -right-4 -bottom-4 z-0 rotate-12" />
                                <button
                                    className="relative z-10 px-6 py-2 rounded-lg bg-white text-[var(--color-accent)] font-bold text-sm shadow-lg hover:scale-105 transition-transform"
                                    onClick={() => setIsImportModalOpen(true)}
                                >
                                    Select File
                                </button>
                            </div>


                            {/* Imported archives will show here after uploading via the modal */}
                            <div className="py-12 text-center border-2 border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-bg-panel)]/50">
                                <FolderOpen className="w-12 h-12 text-[var(--color-text-dim)] mx-auto mb-4 opacity-30" />
                                <p className="text-sm text-[var(--color-text-muted)]">
                                    No imported archives yet. Use the button above to import a Telegram export.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />
        </div>
    )
}

function HistoryIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    )
}
