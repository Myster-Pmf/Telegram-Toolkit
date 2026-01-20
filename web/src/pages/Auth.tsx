import { useState, useEffect, useRef } from 'react'
import { Phone, QrCode, Key, FileKey, ArrowRight, CheckCircle2, AlertCircle, Loader2, Shield, Sparkles } from 'lucide-react'
import { requestCode, verifyCode, importSessionString, generateQR, pollQRStatus, importSessionFile } from '../api/auth'

type AuthMethod = 'phone' | 'qr' | 'session_string' | 'session_file'
type AuthStep = 'method' | 'phone_input' | 'code_input' | '2fa_input' | 'qr_display' | 'session_paste' | 'session_upload' | 'success'

export default function Auth() {
    const [step, setStep] = useState<AuthStep>('method')
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [twoFaPassword, setTwoFaPassword] = useState('')
    const [sessionString, setSessionString] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // QR Code Login state
    const [qrToken, setQrToken] = useState<string | null>(null)
    const [qrUrl, setQrUrl] = useState<string | null>(null)
    const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Session file state
    const [sessionFileName, setSessionFileName] = useState<string | null>(null)

    // QR Code polling effect
    useEffect(() => {
        if (step === 'qr_display' && !qrToken) {
            // Generate QR code
            setIsLoading(true)
            generateQR()
                .then((res) => {
                    setQrToken(res.token)
                    setQrUrl(res.url)
                    setIsLoading(false)
                })
                .catch((err) => {
                    setError(err.message)
                    setIsLoading(false)
                })
        }

        // Start polling when we have a token
        if (step === 'qr_display' && qrToken && !qrPollingRef.current) {
            qrPollingRef.current = setInterval(async () => {
                try {
                    const status = await pollQRStatus(qrToken)
                    if (status.status === 'success') {
                        clearInterval(qrPollingRef.current!)
                        qrPollingRef.current = null
                        setStep('success')
                    } else if (status.status === 'expired' || status.status === 'error') {
                        clearInterval(qrPollingRef.current!)
                        qrPollingRef.current = null
                        setError(status.message || 'QR code expired')
                        setQrToken(null)
                        setQrUrl(null)
                    }
                } catch (err: any) {
                    console.error('QR polling error:', err)
                }
            }, 2000)
        }

        // Cleanup on step change
        return () => {
            if (qrPollingRef.current) {
                clearInterval(qrPollingRef.current)
                qrPollingRef.current = null
            }
        }
    }, [step, qrToken])

    const authMethods = [
        {
            id: 'phone' as AuthMethod,
            icon: Phone,
            title: 'Phone Number',
            description: 'Login with your phone number and OTP code',
            recommended: true,
        },
        {
            id: 'qr' as AuthMethod,
            icon: QrCode,
            title: 'QR Code',
            description: 'Scan with your Telegram mobile app',
            recommended: false,
        },
        {
            id: 'session_string' as AuthMethod,
            icon: Key,
            title: 'Session String',
            description: 'Import an existing Telethon/Pyrogram session',
            recommended: false,
        },
        {
            id: 'session_file' as AuthMethod,
            icon: FileKey,
            title: 'Session File',
            description: 'Upload a .session SQLite file',
            recommended: false,
        },
    ]

    const handleSelectMethod = (m: AuthMethod) => {
        setError(null)
        if (m === 'phone') setStep('phone_input')
        else if (m === 'qr') setStep('qr_display')
        else if (m === 'session_string') setStep('session_paste')
        else if (m === 'session_file') setStep('session_upload')
    }

    const handleSendCode = async () => {
        if (!phone) return
        console.log('📱 [FRONTEND] handleSendCode called with phone:', phone)
        setIsLoading(true)
        setError(null)
        try {
            console.log('📱 [FRONTEND] Calling requestCode API...')
            await requestCode(phone)
            console.log('📱 [FRONTEND] requestCode succeeded!')
            setStep('code_input')
        } catch (e: any) {
            console.error('❌ [FRONTEND] requestCode failed:', e)
            setError(e.message || 'Failed to send code. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerifyCode = async () => {
        if (!code) return
        setIsLoading(true)
        setError(null)
        try {
            await verifyCode(phone, code, twoFaPassword || undefined)
            setStep('success')
        } catch (e: any) {
            if (e.code === '2FA_REQUIRED' || e.message?.includes('2FA')) {
                setStep('2fa_input')
            } else {
                setError(e.message || 'Invalid code. Please try again.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleImportSession = async () => {
        if (!sessionString) return
        setIsLoading(true)
        setError(null)
        try {
            await importSessionString(sessionString)
            setStep('success')
        } catch (e: any) {
            setError(e.message || 'Invalid session string.')
        } finally {
            setIsLoading(false)
        }
    }

    const goBack = () => {
        setError(null)
        if (step === 'phone_input' || step === 'qr_display' || step === 'session_paste' || step === 'session_upload') {
            setStep('method')
        } else if (step === 'code_input') {
            setStep('phone_input')
        } else if (step === '2fa_input') {
            setStep('code_input')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] p-4">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center shadow-2xl shadow-[var(--color-accent)]/30">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Connect Telegram Account</h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                        Choose your preferred authentication method
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 text-[var(--color-error)]" />
                        <span className="text-sm text-[var(--color-error)]">{error}</span>
                    </div>
                )}

                {/* Method Selection */}
                {step === 'method' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {authMethods.map((m) => (
                            <button
                                key={m.id}
                                onClick={() => handleSelectMethod(m.id)}
                                className="w-full p-4 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all flex items-center gap-4 group text-left"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${m.recommended
                                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]'
                                    }`}>
                                    <m.icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-[var(--color-text-primary)]">{m.title}</span>
                                        {m.recommended && (
                                            <span className="px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" />
                                                Recommended
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{m.description}</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Phone Input Step */}
                {step === 'phone_input' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center">
                                    <Phone className="w-5 h-5 text-[var(--color-accent)]" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-[var(--color-text-primary)]">Enter Phone Number</h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">We'll send you a verification code</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+1 234 567 8900"
                                        className="w-full mt-2 h-12 px-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)] text-lg font-mono"
                                    />
                                </div>

                                <button
                                    onClick={handleSendCode}
                                    disabled={isLoading || !phone}
                                    className="w-full h-12 rounded-xl bg-[var(--color-accent)] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Send Verification Code
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button onClick={goBack} className="w-full mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                            ← Back to methods
                        </button>
                    </div>
                )}

                {/* Code Input Step */}
                {step === 'code_input' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center">
                                    <Key className="w-5 h-5 text-[var(--color-accent)]" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-[var(--color-text-primary)]">Enter Verification Code</h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">Code sent to {phone}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Verification Code</label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="12345"
                                        maxLength={6}
                                        className="w-full mt-2 h-14 px-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)] text-2xl font-mono tracking-[0.5em] text-center"
                                    />
                                </div>

                                <button
                                    onClick={handleVerifyCode}
                                    disabled={isLoading || !code}
                                    className="w-full h-12 rounded-xl bg-[var(--color-accent)] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Verify & Connect
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button onClick={goBack} className="w-full mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                            ← Back
                        </button>
                    </div>
                )}

                {/* 2FA Password Input Step */}
                {step === '2fa_input' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-[var(--color-accent)]" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-[var(--color-text-primary)]">Two-Factor Authentication</h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">Enter your 2FA password to continue</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">2FA Password</label>
                                    <input
                                        type="password"
                                        value={twoFaPassword}
                                        onChange={(e) => setTwoFaPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full mt-2 h-12 px-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
                                    />
                                </div>

                                <button
                                    onClick={handleVerifyCode}
                                    disabled={isLoading || !twoFaPassword}
                                    className="w-full h-12 rounded-xl bg-[var(--color-accent)] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Verify & Connect
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button onClick={goBack} className="w-full mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                            ← Back
                        </button>
                    </div>
                )}

                {/* QR Code Display */}
                {step === 'qr_display' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center">
                                    <QrCode className="w-5 h-5 text-[var(--color-accent)]" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-[var(--color-text-primary)]">Scan QR Code</h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">Open Telegram on your phone → Settings → Devices → Scan QR</p>
                                </div>
                            </div>

                            <div className="flex justify-center py-6">
                                <div className="w-56 h-56 bg-white rounded-2xl p-3 flex items-center justify-center shadow-lg">
                                    {isLoading ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
                                            <span className="text-sm text-gray-500">Generating QR...</span>
                                        </div>
                                    ) : qrUrl ? (
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                                            alt="Telegram Login QR Code"
                                            className="w-full h-full rounded-lg"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-center p-4">
                                            <AlertCircle className="w-8 h-8 text-red-500" />
                                            <span className="text-sm text-gray-500">Failed to generate QR</span>
                                            <button
                                                onClick={() => { setQrToken(null); setError(null); }}
                                                className="text-xs text-[var(--color-accent)] hover:underline"
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {qrUrl && (
                                <div className="text-center text-sm text-[var(--color-text-muted)] flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Waiting for scan...
                                </div>
                            )}
                        </div>
                        <button onClick={() => { goBack(); setQrToken(null); setQrUrl(null); }} className="w-full mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                            ← Back to methods
                        </button>
                    </div>
                )}

                {/* Session String Paste */}
                {step === 'session_paste' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center">
                                    <Key className="w-5 h-5 text-[var(--color-accent)]" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-[var(--color-text-primary)]">Import Session String</h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">Paste your Telethon or Pyrogram session string</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Session String</label>
                                    <textarea
                                        value={sessionString}
                                        onChange={(e) => setSessionString(e.target.value)}
                                        placeholder="1BVtsOH8Bu..."
                                        rows={4}
                                        className="w-full mt-2 p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)] font-mono text-sm resize-none"
                                    />
                                </div>

                                <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-[var(--color-warning)] mt-0.5" />
                                    <p className="text-[10px] text-[var(--color-text-muted)]">
                                        Your session string is encrypted and stored securely. Never share it with anyone.
                                    </p>
                                </div>

                                <button
                                    onClick={handleImportSession}
                                    disabled={isLoading || !sessionString}
                                    className="w-full h-12 rounded-xl bg-[var(--color-accent)] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Import & Connect
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button onClick={goBack} className="w-full mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                            ← Back to methods
                        </button>
                    </div>
                )}

                {/* Session File Upload */}
                {step === 'session_upload' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-6 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center">
                                    <FileKey className="w-5 h-5 text-[var(--color-accent)]" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-[var(--color-text-primary)]">Upload Session File</h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">Select your .session SQLite file</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex flex-col items-center justify-center py-10 px-6 rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors cursor-pointer bg-[var(--color-bg-elevated)]/50">
                                    {sessionFileName ? (
                                        <>
                                            <CheckCircle2 className="w-10 h-10 text-[var(--color-success)] mb-3" />
                                            <span className="text-sm font-medium text-[var(--color-text-primary)]">{sessionFileName}</span>
                                            <span className="text-xs text-[var(--color-text-muted)] mt-1">Click to change file</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileKey className="w-10 h-10 text-[var(--color-text-muted)] mb-3" />
                                            <span className="text-sm font-medium text-[var(--color-text-primary)]">Click to upload</span>
                                            <span className="text-xs text-[var(--color-text-muted)] mt-1">.session files only</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept=".session"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            setSessionFileName(file.name)

                                            // Read file as base64
                                            const reader = new FileReader()
                                            reader.onload = async () => {
                                                const base64 = (reader.result as string).split(',')[1] || btoa(reader.result as string)
                                                setIsLoading(true)
                                                setError(null)
                                                try {
                                                    await importSessionFile(base64, file.name.replace('.session', ''))
                                                    setStep('success')
                                                } catch (err: any) {
                                                    setError(err.message)
                                                } finally {
                                                    setIsLoading(false)
                                                }
                                            }
                                            reader.readAsDataURL(file)
                                        }}
                                    />
                                </label>

                                {isLoading && (
                                    <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)]">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="text-sm">Importing session...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={goBack} className="w-full mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                            ← Back to methods
                        </button>
                    </div>
                )}

                {/* Success State */}
                {step === 'success' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-8 rounded-2xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
                            </div>
                            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Successfully Connected!</h2>
                            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                                Your Telegram account has been linked to the toolkit.
                            </p>
                            <button
                                onClick={() => window.location.href = '/dashboard'}
                                className="w-full h-12 rounded-xl bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                {step === 'method' && (
                    <p className="text-center text-xs text-[var(--color-text-dim)] mt-8">
                        By connecting, you agree to our Terms of Service. Your data is encrypted and stored locally.
                    </p>
                )}
            </div>
        </div>
    )
}
