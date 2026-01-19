import { useState } from 'react'
import { Terminal, Play, Save, Star, Search, Sparkles, History, Code, ChevronRight } from 'lucide-react'

// Mock command history
const mockHistory = [
    { id: 1, name: 'Get all members', code: 'await client.get_participants(chat)', time: '2h ago', favorite: true },
    { id: 2, name: 'Search message content', code: 'async for message in client.iter_messages(chat, search="crypto"):', time: '1d ago', favorite: false },
    { id: 3, name: 'Export stickers', code: 'for pack in await client(functions.messages.GetAllStickersRequest(0)):', time: '3d ago', favorite: true },
]

export default function RawCommands() {
    const [code, setCode] = useState('import telethon\nfrom telethon import functions, types\n\nasync def run(client):\n    # Your raw MTProto code here\n    me = await client.get_me()\n    print(f"Logged in as {me.first_name}")\n    return me')
    const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor')

    return (
        <div className="flex h-full bg-[var(--color-bg-base)]">
            {/* Sidebar - History & Snippets */}
            <div className="w-80 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                    <h2 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                        <History className="w-4 h-4 text-[var(--color-accent)]" />
                        Command Center
                    </h2>
                    <button className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
                        <Search className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex border-b border-[var(--color-border)]">
                    <button
                        onClick={() => setActiveTab('editor')}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === 'editor' ? 'text-[var(--color-accent)] border-b border-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                    >
                        Snippets
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === 'history' ? 'text-[var(--color-accent)] border-b border-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                    >
                        History
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {mockHistory.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setCode(item.code)}
                            className="w-full p-3 mb-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent-dim)] transition-all text-left group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.name}</span>
                                {item.favorite && <Star className="w-3 h-3 text-[var(--color-warning)] fill-[var(--color-warning)]" />}
                            </div>
                            <code className="text-[10px] text-[var(--color-text-muted)] block truncate font-mono">
                                {item.code}
                            </code>
                            <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-[var(--color-text-dim)]">{item.time}</span>
                                <ChevronRight className="w-3 h-3 text-[var(--color-accent)]" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Runner Area */}
            <div className="flex-1 flex flex-col">
                {/* Editor Toolbar */}
                <div className="h-12 border-b border-[var(--color-border)] bg-[var(--color-bg-panel)] flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] font-mono">
                            <Code className="w-3.5 h-3.5" />
                            raw_executor.py
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors">
                            <Save className="w-3.5 h-3.5" />
                            Save
                        </button>
                        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
                        <button className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-hover)] transition-all shadow-lg shadow-[var(--color-accent)]/20">
                            <Play className="w-3.5 h-3.5 fill-white" />
                            Execute Script
                        </button>
                    </div>
                </div>

                {/* Code Editor */}
                <div className="flex-1 relative flex flex-col">
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        spellCheck={false}
                        className="flex-1 p-6 bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-mono text-sm resize-none focus:outline-none placeholder:text-[var(--color-text-dim)]"
                    />

                    {/* AI Assistant Overlay */}
                    <div className="absolute right-6 bottom-6 w-96 p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">AI script Generator</span>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Describe what you want to do..."
                                className="w-full h-10 px-3 pr-10 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                            Generated code will follow Telethon/MTProto best practices.
                        </p>
                    </div>
                </div>

                {/* Console / Output */}
                <div className="h-48 border-t border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                    <div className="h-8 px-4 flex items-center bg-[var(--color-bg-elevated)]/50 border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                        Execution Output
                    </div>
                    <div className="p-4 font-mono text-xs text-[var(--color-success)] overflow-y-auto h-[calc(100%-32px)]">
                        <div className="text-[var(--color-text-muted)] mb-1">[2026-01-19 13:12:06] Starting execution...</div>
                        <div>Connected to Telegram as @john_doe</div>
                        <div>Fetching dialogs... (found 128)</div>
                        <div>Scan complete. 0 errors.</div>
                        <div className="text-[var(--color-text-muted)] mt-1">Process finished with exit code 0</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
