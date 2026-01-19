import { useState } from 'react'
import { Bot, Plus, Play, Trash2, Calendar, Target, Zap, Clock, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react'

// Mock rules
const mockRules = [
    {
        id: 1,
        name: 'Auto-reply to Crypto',
        trigger: 'keywords: "BTC, ETH, moon"',
        action: 'Reply with Persona Clone',
        status: 'active',
        hits: 24,
        lastHit: '12m ago'
    },
    {
        id: 2,
        name: 'Log User Join Events',
        trigger: 'event: JOIN',
        action: 'Save to DB + Forward to Admin',
        status: 'paused',
        hits: 156,
        lastHit: '1h ago'
    },
    {
        id: 3,
        name: 'High Frequency Warning',
        trigger: 'threshold: 5msg/sec',
        action: 'Mute Channel 1h',
        status: 'active',
        hits: 3,
        lastHit: '2d ago'
    },
]

export default function Automation() {
    const [showAdd, setShowAdd] = useState(false)

    return (
        <div className="p-6 space-y-6 bg-[var(--color-bg-base)] min-h-full">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] flex items-center gap-3">
                        <Bot className="w-7 h-7 text-[var(--color-accent)]" />
                        Automation Hub
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Create automated rules for replies, monitoring, and cross-account actions.
                    </p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 h-10 px-4 rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-all shadow-lg shadow-[var(--color-accent)]/20"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Create New Rule</span>
                </button>
            </div>

            {/* Rules List */}
            <div className="grid grid-cols-1 gap-4">
                {mockRules.map((rule) => (
                    <div
                        key={rule.id}
                        className="p-5 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-accent-dim)] transition-all group"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg ${rule.status === 'active' ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'}`}>
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold text-[var(--color-text-primary)]">{rule.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${rule.status === 'active' ? 'bg-green-500/10 text-[var(--color-success)]' : 'bg-orange-500/10 text-[var(--color-warning)]'
                                            }`}>
                                            {rule.status}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-4">
                                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                            <Target className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                            <span className="text-[var(--color-text-muted)]">Trigger:</span> {rule.trigger}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                            <Zap className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                            <span className="text-[var(--color-text-muted)]">Action:</span> {rule.action}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]">
                                    <Play className="w-4 h-4" />
                                </button>
                                <button className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-error)]">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    {rule.hits} executions
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    Last active {rule.lastHit}
                                </span>
                            </div>
                            <button className="text-[var(--color-accent)] hover:underline flex items-center gap-1">
                                Rule Analytics
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Mock Placeholder for Add Overlay */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">New Automation Rule</h2>
                            <button onClick={() => setShowAdd(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] uppercase font-bold tracking-tighter">Rule Name</label>
                                    <input type="text" placeholder="e.g. Crypto Alert" className="w-full mt-1.5 h-10 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]" />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] uppercase font-bold tracking-tighter">Trigger Type</label>
                                    <select className="w-full mt-1.5 h-10 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]">
                                        <option>Keywords</option>
                                        <option>User Identity</option>
                                        <option>Chat Type</option>
                                        <option>LLM Intent Detection</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-[var(--color-info)] mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">LLM Actions require an API Key</h4>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Make sure you've configured Gemini or OpenAI in Settings.</p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                                <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Cancel</button>
                                <button className="px-6 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)]">Save Rule</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
