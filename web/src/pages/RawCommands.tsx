import { useState, useEffect } from 'react'
import { Terminal, Play, Save, Star, Search, Sparkles, History, Code, ChevronRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

const API_BASE = '/api'

interface CommandTemplate {
    name: string
    description: string
    code: string
}

interface ExecutionResult {
    success: boolean
    output: any
    error: string | null
    execution_time_ms: number
    code: string
    timestamp: string
}

interface HistoryItem extends ExecutionResult {
    id: number
}

export default function RawCommands() {
    const [code, setCode] = useState(`# Telethon Raw Command
# Available: client, types, functions, asyncio, datetime, json, re

# Example: Get your account info
await client.get_me()`)
    const [aiPrompt, setAiPrompt] = useState('')
    const [activeTab, setActiveTab] = useState<'snippets' | 'history'>('snippets')
    const [templates, setTemplates] = useState<CommandTemplate[]>([])
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [output, setOutput] = useState<string[]>([])
    const [isExecuting, setIsExecuting] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [lastResult, setLastResult] = useState<ExecutionResult | null>(null)

    // Load templates and history on mount
    useEffect(() => {
        loadTemplates()
        loadHistory()
    }, [])

    const loadTemplates = async () => {
        try {
            const res = await fetch(`${API_BASE}/commands/templates`)
            const data = await res.json()
            setTemplates(data.templates || [])
        } catch (e) {
            console.error('Failed to load templates:', e)
        }
    }

    const loadHistory = async () => {
        try {
            const res = await fetch(`${API_BASE}/commands/history?limit=20`)
            const data = await res.json()
            const historyItems = (data.history || []).map((h: ExecutionResult, i: number) => ({
                ...h,
                id: i
            }))
            setHistory(historyItems)
        } catch (e) {
            console.error('Failed to load history:', e)
        }
    }

    const executeCode = async () => {
        if (!code.trim() || isExecuting) return

        setIsExecuting(true)
        setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] Executing...`])

        try {
            const res = await fetch(`${API_BASE}/commands/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, timeout_seconds: 30 })
            })

            const result: ExecutionResult = await res.json()
            setLastResult(result)

            if (result.success) {
                setOutput(prev => [
                    ...prev,
                    `[${new Date().toLocaleTimeString()}] ✓ Success (${result.execution_time_ms.toFixed(0)}ms)`,
                    typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)
                ])
            } else {
                setOutput(prev => [
                    ...prev,
                    `[${new Date().toLocaleTimeString()}] ✗ Error:`,
                    result.error || 'Unknown error'
                ])
            }

            // Reload history
            loadHistory()
        } catch (e: any) {
            setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Request failed: ${e.message}`])
        } finally {
            setIsExecuting(false)
        }
    }

    const generateCode = async () => {
        if (!aiPrompt.trim() || isGenerating) return

        setIsGenerating(true)
        setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] Generating code for: "${aiPrompt}"...`])

        try {
            const res = await fetch(`${API_BASE}/commands/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: aiPrompt })
            })

            const data = await res.json()

            if (data.code) {
                setCode(data.code)
                setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Code generated! Review and execute.`])
                setAiPrompt('')
            } else {
                setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Generation failed`])
            }
        } catch (e: any) {
            setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Generation failed: ${e.message}`])
        } finally {
            setIsGenerating(false)
        }
    }

    const clearOutput = () => {
        setOutput([])
        setLastResult(null)
    }

    return (
        <div className="flex h-full bg-[var(--color-bg-base)]">
            {/* Sidebar - History & Snippets */}
            <div className="w-80 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                    <h2 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-[var(--color-accent)]" />
                        Command Center
                    </h2>
                </div>

                <div className="flex border-b border-[var(--color-border)]">
                    <button
                        onClick={() => setActiveTab('snippets')}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === 'snippets' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                    >
                        Templates
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === 'history' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                    >
                        History
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {activeTab === 'snippets' ? (
                        templates.length === 0 ? (
                            <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">
                                Loading templates...
                            </div>
                        ) : (
                            templates.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCode(item.code)}
                                    className="w-full p-3 mb-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent-dim)] transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.name}</span>
                                        <Code className="w-3 h-3 text-[var(--color-accent)]" />
                                    </div>
                                    <p className="text-[10px] text-[var(--color-text-muted)] mb-1">{item.description}</p>
                                    <code className="text-[10px] text-[var(--color-text-dim)] block truncate font-mono">
                                        {item.code.slice(0, 50)}...
                                    </code>
                                </button>
                            ))
                        )
                    ) : (
                        history.length === 0 ? (
                            <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">
                                No execution history yet
                            </div>
                        ) : (
                            history.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setCode(item.code)}
                                    className="w-full p-3 mb-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent-dim)] transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="flex items-center gap-1">
                                            {item.success ? (
                                                <CheckCircle className="w-3 h-3 text-[var(--color-success)]" />
                                            ) : (
                                                <AlertCircle className="w-3 h-3 text-[var(--color-error)]" />
                                            )}
                                            <span className="text-[10px] text-[var(--color-text-muted)]">
                                                {item.execution_time_ms.toFixed(0)}ms
                                            </span>
                                        </span>
                                    </div>
                                    <code className="text-[10px] text-[var(--color-text-muted)] block truncate font-mono">
                                        {item.code.slice(0, 60)}...
                                    </code>
                                    <div className="mt-1 text-[10px] text-[var(--color-text-dim)]">
                                        {new Date(item.timestamp).toLocaleString()}
                                    </div>
                                </button>
                            ))
                        )
                    )}
                </div>
            </div>

            {/* Main Runner Area */}
            <div className="flex-1 flex flex-col">
                {/* Editor Toolbar */}
                <div className="h-12 border-b border-[var(--color-border)] bg-[var(--color-bg-panel)] flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] font-mono">
                            <Code className="w-3.5 h-3.5" />
                            raw_command.py
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={clearOutput}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                        >
                            Clear Output
                        </button>
                        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
                        <button
                            onClick={executeCode}
                            disabled={isExecuting}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-hover)] transition-all shadow-lg shadow-[var(--color-accent)]/20 disabled:opacity-50"
                        >
                            {isExecuting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Play className="w-3.5 h-3.5 fill-white" />
                            )}
                            {isExecuting ? 'Executing...' : 'Execute'}
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
                        placeholder="Enter Telethon/Python code here..."
                    />

                    {/* AI Assistant Overlay */}
                    <div className="absolute right-6 bottom-6 w-96 p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] shadow-2xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">AI Code Generator</span>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && generateCode()}
                                placeholder="Describe what you want to do..."
                                className="w-full h-10 px-3 pr-10 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <button
                                onClick={generateCode}
                                disabled={isGenerating}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                            >
                                {isGenerating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ChevronRight className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                            E.g., "Get last 10 messages from chat ID -1001234567890"
                        </p>
                    </div>
                </div>

                {/* Console / Output */}
                <div className="h-48 border-t border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                    <div className="h-8 px-4 flex items-center justify-between bg-[var(--color-bg-elevated)]/50 border-b border-[var(--color-border)]">
                        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                            Execution Output
                        </span>
                        {lastResult && (
                            <span className={`text-[10px] font-medium ${lastResult.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                                {lastResult.success ? '✓ Success' : '✗ Failed'}
                            </span>
                        )}
                    </div>
                    <div className="p-4 font-mono text-xs overflow-y-auto h-[calc(100%-32px)] space-y-1">
                        {output.length === 0 ? (
                            <div className="text-[var(--color-text-muted)]">Ready to execute commands...</div>
                        ) : (
                            output.map((line, i) => (
                                <div
                                    key={i}
                                    className={
                                        line.includes('✓') ? 'text-[var(--color-success)]' :
                                            line.includes('✗') ? 'text-[var(--color-error)]' :
                                                line.startsWith('[') ? 'text-[var(--color-text-muted)]' :
                                                    'text-[var(--color-text-primary)]'
                                    }
                                >
                                    {line}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
