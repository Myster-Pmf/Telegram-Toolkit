import { useState, useEffect } from 'react'
import { Bot, Plus, Play, Pause, Trash2, Target, Zap, Clock, ChevronRight, MessageSquare, AlertCircle, Users, Loader2, X } from 'lucide-react'

const API_BASE = '/api'

interface AutoResponderConfig {
    chat_id: number
    enabled: boolean
    mode: string
    persona_user_id?: number
    custom_prompt?: string
    trigger_keywords: string[]
    trigger_mentions: boolean
    trigger_dms: boolean
    min_delay_seconds: number
    max_delay_seconds: number
    ignore_bots: boolean
    ignore_users: number[]
    only_users: number[]
}

interface PersonalityProfile {
    user_id: number
    username?: string
    tone: string
    analyzed_at: string
    message_count: number
}

export default function Automation() {
    const [showAdd, setShowAdd] = useState(false)
    const [configs, setConfigs] = useState<AutoResponderConfig[]>([])
    const [profiles, setProfiles] = useState<PersonalityProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Form state
    const [chatId, setChatId] = useState('')
    const [mode, setMode] = useState<'persona' | 'custom'>('custom')
    const [personaUserId, setPersonaUserId] = useState('')
    const [customPrompt, setCustomPrompt] = useState('You are a helpful assistant. Respond naturally and concisely.')
    const [keywords, setKeywords] = useState('')
    const [triggerMentions, setTriggerMentions] = useState(true)
    const [triggerDms, setTriggerDms] = useState(true)

    useEffect(() => {
        loadConfigs()
        loadProfiles()
    }, [])

    const loadConfigs = async () => {
        try {
            const res = await fetch(`${API_BASE}/llm/auto-responder/configs`)
            const data = await res.json()
            setConfigs(data.configs || [])
        } catch (e) {
            console.error('Failed to load configs:', e)
        } finally {
            setLoading(false)
        }
    }

    const loadProfiles = async () => {
        try {
            const res = await fetch(`${API_BASE}/llm/personality/profiles`)
            const data = await res.json()
            setProfiles(data.profiles || [])
        } catch (e) {
            console.error('Failed to load profiles:', e)
        }
    }

    const toggleConfig = async (chatId: number, enable: boolean) => {
        try {
            await fetch(`${API_BASE}/llm/auto-responder/${chatId}/${enable ? 'enable' : 'disable'}`, {
                method: 'POST'
            })
            loadConfigs()
        } catch (e) {
            console.error('Failed to toggle config:', e)
        }
    }

    const saveConfig = async () => {
        if (!chatId) return

        setSaving(true)
        try {
            const res = await fetch(`${API_BASE}/llm/auto-responder/${chatId}/configure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: true,
                    mode,
                    persona_user_id: mode === 'persona' ? parseInt(personaUserId) : null,
                    custom_prompt: mode === 'custom' ? customPrompt : null,
                    trigger_keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
                    trigger_mentions: triggerMentions,
                    trigger_dms: triggerDms,
                    min_delay_seconds: 1.0,
                    max_delay_seconds: 3.0,
                    ignore_bots: true,
                    ignore_users: [],
                    only_users: []
                })
            })

            if (res.ok) {
                setShowAdd(false)
                resetForm()
                loadConfigs()
            }
        } catch (e) {
            console.error('Failed to save config:', e)
        } finally {
            setSaving(false)
        }
    }

    const resetForm = () => {
        setChatId('')
        setMode('custom')
        setPersonaUserId('')
        setCustomPrompt('You are a helpful assistant. Respond naturally and concisely.')
        setKeywords('')
        setTriggerMentions(true)
        setTriggerDms(true)
    }

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
                        Configure auto-responders with AI persona cloning or custom prompts.
                    </p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 h-10 px-4 rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-all shadow-lg shadow-[var(--color-accent)]/20"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">New Auto-Responder</span>
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase font-bold">
                        <Bot className="w-4 h-4" />
                        Active Responders
                    </div>
                    <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                        {configs.filter(c => c.enabled).length}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase font-bold">
                        <Users className="w-4 h-4" />
                        Personality Profiles
                    </div>
                    <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                        {profiles.length}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase font-bold">
                        <MessageSquare className="w-4 h-4" />
                        Total Configs
                    </div>
                    <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                        {configs.length}
                    </div>
                </div>
            </div>

            {/* Rules List */}
            {loading ? (
                <div className="py-20 flex justify-center">
                    <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
                </div>
            ) : configs.length === 0 ? (
                <div className="py-20 text-center">
                    <Bot className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4 opacity-50" />
                    <p className="text-[var(--color-text-muted)]">No auto-responders configured yet</p>
                    <button
                        onClick={() => setShowAdd(true)}
                        className="mt-4 text-[var(--color-accent)] hover:underline text-sm"
                    >
                        Create your first auto-responder
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {configs.map((config) => (
                        <div
                            key={config.chat_id}
                            className="p-5 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-accent-dim)] transition-all group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${config.enabled ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'}`}>
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold text-[var(--color-text-primary)]">
                                                Chat ID: {config.chat_id}
                                            </h3>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${config.enabled
                                                    ? 'bg-green-500/10 text-[var(--color-success)]'
                                                    : 'bg-orange-500/10 text-[var(--color-warning)]'
                                                }`}>
                                                {config.enabled ? 'active' : 'paused'}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-4">
                                            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                                <Target className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                                <span className="text-[var(--color-text-muted)]">Mode:</span>
                                                {config.mode === 'persona' ? `Persona Clone (User ${config.persona_user_id})` : 'Custom Prompt'}
                                            </div>
                                            {config.trigger_keywords?.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                                    <Zap className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                                    <span className="text-[var(--color-text-muted)]">Keywords:</span>
                                                    {config.trigger_keywords.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleConfig(config.chat_id, !config.enabled)}
                                        className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
                                    >
                                        {config.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1">
                                        {config.trigger_mentions && '@ Mentions'}
                                        {config.trigger_mentions && config.trigger_dms && ' • '}
                                        {config.trigger_dms && 'DMs'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Delay: {config.min_delay_seconds}-{config.max_delay_seconds}s
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded-2xl shadow-2xl">
                        <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">New Auto-Responder</h2>
                            <button onClick={() => setShowAdd(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] uppercase font-bold tracking-tighter">Chat ID</label>
                                    <input
                                        type="text"
                                        value={chatId}
                                        onChange={(e) => setChatId(e.target.value)}
                                        placeholder="e.g. -1001234567890"
                                        className="w-full mt-1.5 h-10 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] uppercase font-bold tracking-tighter">Response Mode</label>
                                    <select
                                        value={mode}
                                        onChange={(e) => setMode(e.target.value as 'persona' | 'custom')}
                                        className="w-full mt-1.5 h-10 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                    >
                                        <option value="custom">Custom Prompt</option>
                                        <option value="persona">Persona Clone</option>
                                    </select>
                                </div>
                            </div>

                            {mode === 'persona' ? (
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] uppercase font-bold tracking-tighter">Persona User ID</label>
                                    <input
                                        type="text"
                                        value={personaUserId}
                                        onChange={(e) => setPersonaUserId(e.target.value)}
                                        placeholder="User ID to clone style from"
                                        className="w-full mt-1.5 h-10 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                    />
                                    {profiles.length > 0 && (
                                        <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                                            Available profiles: {profiles.map(p => p.user_id).join(', ')}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] uppercase font-bold tracking-tighter">System Prompt</label>
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        rows={3}
                                        className="w-full mt-1.5 p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] resize-none focus:outline-none focus:border-[var(--color-accent)]"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-[var(--color-text-secondary)] uppercase font-bold tracking-tighter">Trigger Keywords (comma-separated)</label>
                                <input
                                    type="text"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    placeholder="e.g. help, question, support (leave empty for all messages)"
                                    className="w-full mt-1.5 h-10 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                />
                            </div>

                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={triggerMentions}
                                        onChange={(e) => setTriggerMentions(e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-sm text-[var(--color-text-secondary)]">Respond to @mentions</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={triggerDms}
                                        onChange={(e) => setTriggerDms(e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-sm text-[var(--color-text-secondary)]">Respond to DMs</span>
                                </label>
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
                                <button
                                    onClick={saveConfig}
                                    disabled={saving || !chatId}
                                    className="px-6 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Save Rule
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
