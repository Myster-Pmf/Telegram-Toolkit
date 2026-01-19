import { Database, Bot, Shield, Download, Key, Globe } from 'lucide-react'

export default function Settings() {
    return (
        <div className="p-6 max-w-4xl space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Settings</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    Configure your Telegram Toolkit
                </p>
            </div>

            {/* Telegram API */}
            <div className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
                    <Key className="w-4 h-4 text-[var(--color-accent)]" />
                    <h2 className="font-medium text-[var(--color-text-primary)]">Telegram API</h2>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">API ID</label>
                        <input
                            type="text"
                            placeholder="Enter your API ID"
                            className="w-full h-9 px-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">API Hash</label>
                        <input
                            type="password"
                            placeholder="Enter your API Hash"
                            className="w-full h-9 px-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                        Get your API credentials from <a href="https://my.telegram.org" target="_blank" className="text-[var(--color-accent)] hover:underline">my.telegram.org</a>
                    </p>
                </div>
            </div>

            {/* Database */}
            <div className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
                    <Database className="w-4 h-4 text-[var(--color-accent)]" />
                    <h2 className="font-medium text-[var(--color-text-primary)]">Database</h2>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Database Type</label>
                        <div className="flex gap-2">
                            {['SQLite', 'PostgreSQL', 'Turso'].map((type) => (
                                <button
                                    key={type}
                                    className={`px-4 py-2 rounded-md text-sm transition-colors ${type === 'SQLite'
                                            ? 'bg-[var(--color-accent)] text-white'
                                            : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Database Path</label>
                        <input
                            type="text"
                            defaultValue="./data/telegram_toolkit.db"
                            className="w-full h-9 px-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>
                </div>
            </div>

            {/* LLM Configuration */}
            <div className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[var(--color-accent)]" />
                    <h2 className="font-medium text-[var(--color-text-primary)]">LLM Provider</h2>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Provider</label>
                        <div className="flex gap-2">
                            {['Gemini', 'OpenAI Compatible'].map((type) => (
                                <button
                                    key={type}
                                    className={`px-4 py-2 rounded-md text-sm transition-colors ${type === 'Gemini'
                                            ? 'bg-[var(--color-accent)] text-white'
                                            : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">API Key</label>
                        <input
                            type="password"
                            placeholder="Enter your LLM API key"
                            className="w-full h-9 px-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Model</label>
                        <input
                            type="text"
                            defaultValue="gemini-2.0-flash"
                            className="w-full h-9 px-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--color-accent)]" />
                    <h2 className="font-medium text-[var(--color-text-primary)]">Security</h2>
                </div>
                <div className="p-4 space-y-4">
                    <label className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-[var(--color-text-primary)]">Encrypt sessions at rest</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Session data will be encrypted in the database</div>
                        </div>
                        <input type="checkbox" className="rounded" defaultChecked />
                    </label>
                    <label className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-[var(--color-text-primary)]">Encrypt exported archives</div>
                            <div className="text-xs text-[var(--color-text-muted)]">Archive files will be password protected</div>
                        </div>
                        <input type="checkbox" className="rounded" defaultChecked />
                    </label>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
                <button className="px-4 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    Reset to Defaults
                </button>
                <button className="px-4 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm hover:bg-[var(--color-accent-hover)]">
                    Save Settings
                </button>
            </div>
        </div>
    )
}
