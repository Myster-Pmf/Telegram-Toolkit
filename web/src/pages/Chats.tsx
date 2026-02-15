import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Settings, Users, Image as ImageIcon, FileText, Send, Copy, Download, AlertCircle, MessageSquare, Play, X, Languages, Paperclip, Pin, Reply, Trash2, Edit3, Terminal, Database, Check, ChevronDown, Share2, ExternalLink, Flag, MousePointer2, Code, ChevronLeft, Music, Smile, Mic } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cloneChat, exportChat, fetchChats, fetchMessages, fetchChatMembers, getMediaStreamUrl, getMediaDownloadUrl, fetchChatPhoto, sendMessage, translateText, sendMedia, editMessage, deleteMessage, pinMessage, unpinMessage, getPinnedMessage, sendReaction } from '../lib/api'
import type { Chat, Message, Member } from '../lib/api'

type RightPanelTab = 'members' | 'media' | 'files' | 'links' | 'music' | 'gif' | 'voice' | 'settings' | 'export' | 'clone'

export default function Chats() {
    const { chatId } = useParams()
    const [selectedChatId, setSelectedChatId] = useState<number | null>(chatId ? Number(chatId) : null)
    const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('members')
    const [showRightPanel, setShowRightPanel] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Manual message state for infinite scroll
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [isLoadingOlder, setIsLoadingOlder] = useState(false)
    const messageContainerRef = useRef<HTMLDivElement>(null)

    // Members State
    const [members, setMembers] = useState<Member[]>([])
    const [isLoadingMembers, setIsLoadingMembers] = useState(false)

    // Message input state
    const [messageInput, setMessageInput] = useState('')
    const [isSending, setIsSending] = useState(false)

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

    // Enhanced Features State
    const [isDevMode, setIsDevMode] = useState(() => localStorage.getItem('isDevMode') === 'true')

    useEffect(() => {
        localStorage.setItem('isDevMode', isDevMode.toString())
    }, [isDevMode])

    const [replyToMessage, setReplyToMessage] = useState<Message | null>(null)
    const [editingMessage, setEditingMessage] = useState<Message | null>(null)
    const [showScrollBottom, setShowScrollBottom] = useState(false)
    const [rightPanelSearch, setRightPanelSearch] = useState('')
    const [targetLanguage, setTargetLanguage] = useState(() => localStorage.getItem('targetLanguage') || 'English')
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)

    useEffect(() => {
        localStorage.setItem('targetLanguage', targetLanguage)
    }, [targetLanguage])

    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowLanguageDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, message: Message } | null>(null)
    const [showRawJson, setShowRawJson] = useState<string | null>(null)


    const { data: chats = [], isLoading: isLoadingChats } = useQuery({
        queryKey: ['chats'],
        queryFn: fetchChats,
    })

    // Lazy-loaded chat photos (cached after first load)
    const [chatPhotos, setChatPhotos] = useState<Record<number, string | null>>({})
    const chatPhotoLoadingRef = useRef<Set<number>>(new Set())
    const chatListRef = useRef<HTMLDivElement>(null)

    // Load chat photo on demand
    const loadChatPhoto = useCallback(async (chatId: number) => {
        if (chatPhotos[chatId] !== undefined || chatPhotoLoadingRef.current.has(chatId)) return
        chatPhotoLoadingRef.current.add(chatId)
        const photo = await fetchChatPhoto(chatId)
        setChatPhotos(prev => ({ ...prev, [chatId]: photo }))
        chatPhotoLoadingRef.current.delete(chatId)
    }, [chatPhotos])

    // Observe visible chat items and load their photos
    useEffect(() => {
        if (!chatListRef.current || chats.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const chatId = Number(entry.target.getAttribute('data-chat-id'))
                        if (chatId) loadChatPhoto(chatId)
                    }
                })
            },
            { root: chatListRef.current, rootMargin: '50px', threshold: 0 }
        )

        // Observe all chat items
        const items = chatListRef.current.querySelectorAll('[data-chat-id]')
        items.forEach(item => observer.observe(item))

        return () => observer.disconnect()
    }, [chats, loadChatPhoto])

    // Auto-select first chat when chats load and none is selected
    useEffect(() => {
        if (!selectedChatId && chats.length > 0) {
            setSelectedChatId(chats[0].id)
        }
    }, [chats, selectedChatId])

    const selectedChat = chats.find((c: Chat) => c.id === selectedChatId)

    // Video Modal State
    const [videoModal, setVideoModal] = useState<{ chatId: number; messageId: number; title?: string } | null>(null)

    const isToolView = rightPanelTab === 'clone' || rightPanelTab === 'export'

    // AbortController ref for cancelling requests when chat changes
    const abortControllerRef = useRef<AbortController | null>(null)

    // Progressive loading with request cancellation
    useEffect(() => {
        if (selectedChatId) {
            // Cancel any pending requests from previous chat
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            abortControllerRef.current = new AbortController()
            const currentChatId = selectedChatId

            setMessages([])
            setIsLoadingMessages(true)

            // Phase 1: Fetch first 15 messages (fast, no media download)
            fetchMessages(currentChatId, 0, 15)
                .then(msgs => {
                    // Check if we're still on the same chat
                    if (abortControllerRef.current?.signal.aborted) return
                    const sorted = ensureUniqueMessages(msgs, currentChatId)
                    setMessages(sorted)
                    setTimeout(() => scrollToBottom(), 100)

                    // Phase 2: Fetch more messages in background (only if still on same chat)
                    if (sorted.length >= 10) {
                        const oldestId = sorted[0]?.id || 0
                        fetchMessages(currentChatId, oldestId, 35)
                            .then(moreMsgs => {
                                if (abortControllerRef.current?.signal.aborted) return
                                setMessages(prev => ensureUniqueMessages([...moreMsgs, ...prev], currentChatId))
                            })
                            .catch(() => { }) // Silently ignore aborted requests
                    }
                })
                .catch(err => {
                    if (!abortControllerRef.current?.signal.aborted) {
                        console.error(err)
                    }
                })
                .finally(() => {
                    if (!abortControllerRef.current?.signal.aborted) {
                        setIsLoadingMessages(false)
                    }
                })

            // Fetch Pinned Message
            getPinnedMessage(currentChatId)
                .then(m => {
                    if (!abortControllerRef.current?.signal.aborted) setPinnedMessage(m)
                })
                .catch(() => { })

            // Fetch Members
            setIsLoadingMembers(true)
            fetchChatMembers(currentChatId)
                .then(m => {
                    if (!abortControllerRef.current?.signal.aborted) setMembers(m)
                })
                .catch(() => { })
                .finally(() => {
                    if (!abortControllerRef.current?.signal.aborted) setIsLoadingMembers(false)
                })
        }

        // Cleanup on unmount or chat change
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [selectedChatId])

    // WebSocket for real-time message updates
    const wsRef = useRef<WebSocket | null>(null)
    const selectedChatIdRef = useRef<number | null>(selectedChatId)

    // Keep the ref in sync with state
    useEffect(() => {
        selectedChatIdRef.current = selectedChatId
    }, [selectedChatId])

    useEffect(() => {
        // Connect to WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/ws/messages`

        const connect = () => {
            // Don't reconnect if already connected
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                return
            }

            wsRef.current = new WebSocket(wsUrl)

            wsRef.current.onopen = () => {
                console.log('WebSocket connected')
                wsRef.current?.send('subscribe')
            }

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type === 'new_message' && data.data) {
                        const msg = data.data
                        const currentChatId = selectedChatIdRef.current
                        if (msg.chat_id === currentChatId) {
                            setMessages(prev => ensureUniqueMessages([...prev, msg], currentChatId))
                            setTimeout(() => scrollToBottom(), 100)
                        }
                    } else if (data.type === 'message_edited' && data.data) {
                        const msg = data.data
                        if (msg.chat_id === selectedChatIdRef.current) {
                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m))
                        }
                    } else if (data.type === 'message_deleted' && data.data) {
                        const { message_ids, chat_id } = data.data
                        if (chat_id === selectedChatIdRef.current) {
                            setMessages(prev => prev.filter(m => !message_ids.includes(m.id)))
                        }
                    }
                } catch (err) {
                    console.error('WebSocket message error:', err)
                }
            }

            wsRef.current.onclose = () => {
                console.log('WebSocket disconnected, reconnecting in 3s...')
                setTimeout(connect, 3000)
            }

            wsRef.current.onerror = (err) => {
                console.error('WebSocket error:', err)
            }
        }

        connect()

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, []) // Only run once on mount

    // Deterministic color generation for users
    const getUserColor = (userId: number | null | undefined) => {
        if (!userId) return 'text-[var(--color-accent)]';
        const colors = [
            'text-red-400', 'text-orange-400', 'text-amber-400',
            'text-green-400', 'text-emerald-400', 'text-teal-400',
            'text-cyan-400', 'text-blue-400', 'text-indigo-400',
            'text-violet-400', 'text-purple-400', 'text-fuchsia-400',
            'text-pink-400', 'text-rose-400'
        ];
        return colors[userId % colors.length];
    };

    const ensureUniqueMessages = (msgs: Message[], currentChatId: number | null) => {
        if (!currentChatId) return [];
        const unique = new Map();
        msgs.forEach(m => {
            if (!m.id || m.chat_id !== currentChatId) return; // Strict isolation
            const existing = unique.get(m.id);
            // Merge metadata if message already exists (to preserve local reactions during sync)
            unique.set(m.id, existing ? { ...existing, ...m } : m);
        });

        return Array.from(unique.values()).sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return a.id - b.id;
        });
    }

    const scrollToBottom = () => {
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight
        }
    }

    // Infinite Scroll Handler
    const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100
        setShowScrollBottom(!isAtBottom)

        if (container.scrollTop === 0 && !isLoadingOlder && messages.length > 0) {
            const oldestMessageId = messages[0].id // Since we sort oldest to newest, [0] is oldest
            console.log("Fetching older messages than ID:", oldestMessageId)

            setIsLoadingOlder(true)
            // Save scroll height to restore position
            const oldScrollHeight = messageContainerRef.current!.scrollHeight

            try {
                // We need to fetch messages older than the oldest one we have.
                // Our API implementation uses offset_id to get older messages.
                // HOWEVER, we need to pass the ID of the oldest message we have.
                const olderMessages = await fetchMessages(selectedChatId!, oldestMessageId)

                if (olderMessages.length > 0) {
                    // Sorting and merging
                    // API returns newest to oldest usually, so reverse them if needed? 
                    // Let's assume ensureUniqueMessages handles sort.

                    setMessages(prev => {
                        const merged = [...prev, ...olderMessages]
                        return ensureUniqueMessages(merged, selectedChatId)
                    })

                    // Restore scroll position
                    // We need to wait for render?
                    setTimeout(() => {
                        if (messageContainerRef.current) {
                            const newScrollHeight = messageContainerRef.current.scrollHeight
                            messageContainerRef.current.scrollTop = newScrollHeight - oldScrollHeight
                        }
                    }, 0)
                }
            } catch (err) {
                console.error("Failed to load older messages", err)
            } finally {
                setIsLoadingOlder(false)
            }
        }
    }

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

    const getAvatarUrl = (path?: string) => {
        if (!path) return null
        // Ensure path starts with /media/ or just /media
        return path.startsWith('media') || path.startsWith('/media')
            ? `/${path.replace(/^\/?/, '')}` // Ensure leading slash
            : `/media/${path}`;
    }

    // Send message handler
    const handleSendMessage = async () => {
        if (!selectedChatId || !messageInput.trim() || isSending) return

        setIsSending(true)
        try {
            let sentMessage: Message;
            if (editingMessage) {
                sentMessage = await editMessage(selectedChatId, editingMessage.id, messageInput.trim());
                setMessages(prev => ensureUniqueMessages(prev.map(m => m.id === sentMessage.id ? sentMessage : m), selectedChatId));
                setEditingMessage(null);
            } else {
                sentMessage = await sendMessage(selectedChatId, messageInput.trim(), replyToMessage?.id)
                setMessages(prev => ensureUniqueMessages([...prev, sentMessage], selectedChatId))
            }
            setMessageInput('')
            setReplyToMessage(null)
            setTimeout(() => scrollToBottom(), 100)
        } catch (err) {
            console.error('Failed to send message:', err)
            alert('Failed to send message')
        } finally {
            setIsSending(false)
        }
    }

    const handleDeleteMessage = async (msg: Message) => {
        if (!selectedChatId) return;
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            await deleteMessage(selectedChatId, msg.id);
            setMessages(prev => prev.filter(m => m.id !== msg.id));
        } catch (err) {
            alert('Failed to delete message');
        }
    }

    const handlePinMessage = async (msg: Message) => {
        if (!selectedChatId) return;
        try {
            if (msg.is_pinned) {
                await unpinMessage(selectedChatId, msg.id);
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: false } : m));
                if (pinnedMessage?.id === msg.id) setPinnedMessage(null);
                alert('Message unpinned');
            } else {
                await pinMessage(selectedChatId, msg.id);
                const updatedMsg = { ...msg, is_pinned: true };
                setMessages(prev => prev.map(m => m.id === msg.id ? updatedMsg : m));
                setPinnedMessage(updatedMsg);
                alert('Message pinned');
            }
        } catch (err) {
            alert('Failed to update pin status');
        }
    }

    const handleReaction = async (messageId: number, emoticon: string) => {
        if (!selectedChatId) return;

        // Optimistically update local state immediately
        setMessages(prev => prev.map(m => {
            if (m.id !== messageId) return m;

            const reactions = [...(m.reactions || [])];
            const rIdx = reactions.findIndex(r => r.emoticon === emoticon);

            if (rIdx >= 0) {
                const r = { ...reactions[rIdx] };
                if (r.chosen) {
                    r.count = Math.max(0, r.count - 1);
                    r.chosen = false;
                } else {
                    r.count += 1;
                    r.chosen = true;
                }

                if (r.count === 0) reactions.splice(rIdx, 1);
                else reactions[rIdx] = r;
            } else {
                reactions.push({ emoticon, count: 1, chosen: true });
            }

            return { ...m, reactions };
        }));

        try {
            await sendReaction(selectedChatId, messageId, emoticon);
            // No need to re-fetch all, the WS or periodic sync will confirm it
        } catch (err) {
            console.error('Failed to toggle reaction:', err);
            // Re-fetch only this chat's recent messages to sync on error
            const msgs = await fetchMessages(selectedChatId, 0, 15);
            setMessages(prev => ensureUniqueMessages([...prev, ...msgs], selectedChatId));
        }
    };

    return (
        <>
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
                    <div ref={chatListRef} className="flex-1 overflow-y-auto">
                        {isLoadingChats && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 py-10 opacity-50">
                                <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-medium">Loading Dialogs...</span>
                            </div>
                        )}
                        {chats.map((chat: Chat) => {
                            const photoPath = chatPhotos[chat.id] || chat.photo_path;
                            return (
                                <button
                                    key={chat.id}
                                    data-chat-id={chat.id}
                                    onClick={() => setSelectedChatId(chat.id)}
                                    className={`w-full p-3 flex items-center gap-3 transition-colors ${chat.id === selectedChatId
                                        ? 'bg-[var(--color-accent-subtle)]'
                                        : 'hover:bg-[var(--color-bg-hover)]'
                                        }`}
                                >
                                    {/* Avatar - uses lazy-loaded photo */}
                                    <div className="w-10 h-10 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                        {photoPath ? (
                                            <img
                                                src={getAvatarUrl(photoPath)!}
                                                alt={chat.title || 'Chat'}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : null}
                                        <span className={`text-[var(--color-accent)] font-medium text-sm ${photoPath ? 'hidden' : ''}`}>
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
                                        <div className="flex items-center justify-between mt-0.5 gap-2">
                                            <span className="text-xs text-[var(--color-text-secondary)] truncate flex-1 min-w-0">
                                                {chat.last_message}
                                            </span>
                                            {(chat.unread_count || 0) > 0 && (
                                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-medium min-w-[20px] max-w-[50px] text-center truncate">
                                                    {(chat.unread_count || 0) > 9999 ? '9999+' : chat.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Messages (Center Panel) */}
                <div className="flex-1 flex flex-col bg-[var(--color-bg-base)]">
                    {/* Chat Header */}
                    <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-panel)]">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center relative overflow-hidden">
                                {(selectedChatId && chatPhotos[selectedChatId]) ? (
                                    <img
                                        src={getAvatarUrl(chatPhotos[selectedChatId]!)!}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-[var(--color-accent)] font-medium text-sm">
                                        {(selectedChat?.title || '?').charAt(0)}
                                    </span>
                                )}
                            </div>

                            {/* Pinned Message Banner */}
                            {pinnedMessage && (
                                <div className="h-10 px-4 bg-[var(--color-bg-panel)] border-b border-[var(--color-border)] flex items-center justify-between group cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors overflow-hidden">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-0.5 h-6 bg-[var(--color-accent)] rounded-full flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-[var(--color-accent)] uppercase leading-none mb-0.5">Pinned Message</div>
                                            <div className="text-xs text-[var(--color-text-secondary)] truncate">
                                                {pinnedMessage.text || (pinnedMessage.has_media ? '[' + pinnedMessage.media_type + ']' : 'No text')}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setPinnedMessage(null); }}
                                        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-black/10"
                                    >
                                        <X className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                    </button>
                                </div>
                            )}
                            <div>
                                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                                    {selectedChat?.title || 'Select a chat'}
                                </div>
                                <div className="text-xs text-[var(--color-text-muted)]">
                                    {selectedChat ? `${selectedChat.chat_type} • ${selectedChat.member_count || '?'} members` : ''}
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
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={messageContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth relative"
                        style={{
                            backgroundImage: 'url("/message_bg.jpg")',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundAttachment: 'local'
                        }}
                    >
                        {isLoadingOlder && (
                            <div className="flex justify-center py-2">
                                <span className="text-xs text-[var(--color-text-muted)] animate-pulse">Loading older messages...</span>
                            </div>
                        )}

                        {isLoadingMessages && messages.length === 0 && (
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

                        {messages.map((msg: Message, idx) => {
                            const isPrevSameSender = idx > 0 && messages[idx - 1].sender_id === msg.sender_id && (new Date(msg.date).getTime() - new Date(messages[idx - 1].date).getTime() < 300000);
                            const isNextSameSender = idx < messages.length - 1 && messages[idx + 1].sender_id === msg.sender_id && (new Date(messages[idx + 1].date).getTime() - new Date(msg.date).getTime() < 300000);
                            const showAvatar = !msg.is_outgoing && !isNextSameSender && (selectedChat?.chat_type === 'group' || selectedChat?.chat_type === 'supergroup');

                            return (
                                <div
                                    key={msg.id}
                                    id={`msg-${msg.id}`}
                                    className={`flex group/msg ${msg.is_outgoing ? 'justify-end' : 'justify-start'} ${isPrevSameSender ? 'mt-0.5' : 'mt-3'}`}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
                                    }}
                                >
                                    {/* Avatar Column (Incoming Group Messages) */}
                                    {!msg.is_outgoing && (selectedChat?.chat_type === 'group' || selectedChat?.chat_type === 'supergroup') && (
                                        <div className={`flex-shrink-0 w-8 h-8 mr-2 flex items-end ${!showAvatar ? 'invisible' : ''}`}>
                                            <div className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center overflow-hidden">
                                                {/* We don't have sender photo in Message object yet, using initial or generic */}
                                                <span className={`text-[10px] font-bold ${getUserColor(msg.sender_id)}`}>
                                                    {(msg.sender_name || '?').charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div
                                        onClick={(e) => {
                                            // Only open if clicking the bubble background or text, not buttons
                                            if ((e.target as HTMLElement).closest('button, a')) return;
                                            setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
                                        }}
                                        className={`max-w-[85%] lg:max-w-[70%] rounded-2xl p-2.5 px-3 relative shadow-sm transition-all group overflow-hidden cursor-pointer active:scale-[0.99] origin-center ${msg.is_outgoing
                                            ? 'bg-[#766ac8] text-white rounded-tr-none'
                                            : 'bg-[#2b2b2b] text-[var(--color-text-primary)] rounded-tl-none'
                                            }`}
                                    >
                                        {!msg.is_outgoing && selectedChat?.chat_type !== 'private' && (
                                            <div className="flex items-center gap-2 mb-1">
                                                {isDevMode && <span className="text-[9px] font-mono text-blue-400">#{msg.sender_id}</span>}
                                                <div className={`text-[10px] font-bold cursor-pointer hover:underline uppercase tracking-tight ${getUserColor(msg.sender_id)}`}>
                                                    {msg.sender_name || 'User ' + (msg.sender_id || '')}
                                                </div>
                                            </div>
                                        )}

                                        {/* Reply Icon Hover */}
                                        <button
                                            onClick={() => setReplyToMessage(msg)}
                                            className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-full bg-black/10 hover:bg-black/20 ${msg.is_outgoing ? '-left-8' : '-right-8'}`}
                                        >
                                            <Reply className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                        </button>

                                        {/* Message Tail (only for first message in group) */}
                                        {!isPrevSameSender && (
                                            <div
                                                className={`absolute top-0 w-2 h-2 ${msg.is_outgoing
                                                    ? 'right-[-2px] bg-[#766ac8] [clip-path:polygon(0_0,100%_0,0_100%)]'
                                                    : 'left-[-4px] bg-[#2b2b2b] [clip-path:polygon(0_0,100%_0,100%_100%)]'}`}
                                            />
                                        )}

                                        {/* Reply Preview in Message */}
                                        {msg.reply_to_msg_id && (
                                            <div
                                                className={`mb-1.5 p-1.5 py-1 px-2.5 rounded-md border-l-[3px] text-[11px] bg-white/5 border-white/5 cursor-pointer hover:bg-white/10 transition-all flex flex-col gap-0.5 ${msg.is_outgoing ? 'border-white/60' : 'border-[var(--color-accent)]'}`}
                                                onClick={() => {
                                                    const target = document.getElementById(`msg-${msg.reply_to_msg_id}`);
                                                    if (target) {
                                                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        target.classList.add('ring-2', 'ring-[var(--color-accent)]', 'ring-offset-2');
                                                        setTimeout(() => target.classList.remove('ring-2', 'ring-[var(--color-accent)]', 'ring-offset-2'), 2000);
                                                    }
                                                }}
                                            >
                                                {(() => {
                                                    const repliedMsg = messages.find(m => m.id === msg.reply_to_msg_id);
                                                    return (
                                                        <>
                                                            <div className={`font-bold text-[10px] leading-tight ${getUserColor(repliedMsg?.sender_id)}`}>
                                                                {repliedMsg?.sender_name || `User ${msg.reply_to_msg_id}`}
                                                            </div>
                                                            <div className="truncate opacity-70 text-[10px] italic">
                                                                {repliedMsg?.text || (repliedMsg?.has_media ? '[Media]' : 'Original message not found')}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {/* Media Layout: Media top, Text bottom if both exist */}
                                        {msg.has_media && (
                                            <div className={`mb-2 -mx-3 rounded-t-xl overflow-hidden relative group/media ${(!msg.is_outgoing && selectedChat?.chat_type !== 'private') || msg.reply_to_msg_id ? 'mt-1' : '-mt-2.5'}`}>
                                                {msg.media_path ? (
                                                    <div className="relative">
                                                        <img
                                                            src={getAvatarUrl(msg.media_path)!}
                                                            alt={msg.media_type || 'Media'}
                                                            className="w-full max-h-[450px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                                            onClick={() => {
                                                                if (msg.media_type === 'video') {
                                                                    setVideoModal({ chatId: msg.chat_id, messageId: msg.id, title: msg.media_metadata?.file_name })
                                                                } else {
                                                                    window.open(getAvatarUrl(msg.media_path)!, '_blank')
                                                                }
                                                            }}
                                                        />
                                                        {msg.media_type === 'video' && (
                                                            <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={() => setVideoModal({ chatId: msg.chat_id, messageId: msg.id, title: msg.media_metadata?.file_name })}>
                                                                <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors backdrop-blur-sm">
                                                                    <Play className="w-6 h-6 text-white fill-white" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="p-2 py-2.5 px-3 bg-white/5 flex items-center gap-3 hover:bg-white/10 transition-colors cursor-pointer group/file border border-white/5">
                                                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover/file:scale-105 ${msg.is_outgoing ? 'bg-white/10' : 'bg-[var(--color-accent)]'}`}>
                                                            {(() => {
                                                                const ext = msg.media_metadata?.file_name?.split('.').pop()?.toLowerCase();
                                                                if (msg.media_type === 'video') return <Play className="w-5 h-5 text-white fill-white" />;
                                                                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="w-5 h-5 text-white" />;
                                                                return <FileText className="w-5 h-5 text-white" />;
                                                            })()}
                                                        </div>
                                                        <div className="overflow-hidden flex-1 flex flex-col gap-0.5">
                                                            <div className="text-[13px] font-bold truncate leading-tight">{msg.media_metadata?.file_name || msg.media_type || 'Media'}</div>
                                                            <div className={`text-[10px] font-medium opacity-60`}>
                                                                {((msg.media_metadata?.file_size || 0) / 1024 > 1024
                                                                    ? ((msg.media_metadata?.file_size || 0) / (1024 * 1024)).toFixed(1) + ' MB'
                                                                    : Math.round((msg.media_metadata?.file_size || 0) / 1024) + ' KB'
                                                                )}
                                                                {msg.media_metadata?.mime_type && ` • ${msg.media_metadata.mime_type.split('/')[1].toUpperCase()}`}
                                                            </div>
                                                        </div>
                                                        <div className="ml-2 flex-shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                                            <Download className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Link Preview (WebPage) */}
                                        {msg.web_page && (
                                            <div className={`mb-2 p-2 rounded-lg border-l-2 flex flex-col gap-1.5 transition-colors cursor-pointer hover:bg-black/5 ${msg.is_outgoing ? 'bg-black/10 border-white/40' : 'bg-white/5 border-[var(--color-accent)]'}`} onClick={() => window.open(msg.web_page?.url, '_blank')}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-wider">{msg.web_page.site_name || 'Telegram'}</span>
                                                        <span className="text-xs font-bold leading-tight truncate">{msg.web_page.title}</span>
                                                    </div>
                                                    {msg.web_page.photo_path && (
                                                        <img src={getAvatarUrl(msg.web_page.photo_path)!} className="w-12 h-12 rounded-md object-cover flex-shrink-0" alt="preview" />
                                                    )}
                                                </div>
                                                {msg.web_page.description && (
                                                    <p className="text-[11px] leading-snug opacity-80 line-clamp-3">{msg.web_page.description}</p>
                                                )}
                                                {msg.web_page.url.includes('t.me/') && (
                                                    <div className="pt-1 mt-1 border-t border-black/5 text-center">
                                                        <span className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-widest">{msg.web_page.url.includes('/s/') ? 'VIEW CHANNEL' : 'VIEW GROUP'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {msg.text && (
                                            <div className="text-sm leading-snug whitespace-pre-wrap break-words min-w-[80px]">
                                                {msg.text}
                                                <div className={`float-right flex items-center justify-end gap-1 text-[10px] leading-none pt-2 pl-2 h-4 select-none ${msg.is_outgoing ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>
                                                    {msg.edit_date && (new Date(msg.edit_date).getTime() - new Date(msg.date).getTime() > 5000) && (
                                                        <span className="opacity-70 italic text-[9px] mr-1">edited</span>
                                                    )}
                                                    <span>{new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {msg.is_outgoing && (
                                                        <div className="flex -space-x-1 ml-0.5">
                                                            <Check className="w-3 h-3" />
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Unified timestamp for non-text messages (media, links, etc.) */}
                                        {!msg.text && (
                                            <div className={`flex items-center justify-end gap-1 text-[10px] leading-none mt-1 select-none ${msg.is_outgoing ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>
                                                {msg.edit_date && (new Date(msg.edit_date).getTime() - new Date(msg.date).getTime() > 5000) && (
                                                    <span className="opacity-70 italic text-[9px] mr-1">edited</span>
                                                )}
                                                <span>{new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {msg.is_outgoing && (
                                                    <div className="flex -space-x-1 ml-0.5">
                                                        <Check className="w-3 h-3" />
                                                        <Check className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Reactions */}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5 -mb-0.5">
                                                {msg.reactions.map((r, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleReaction(msg.id, r.emoticon);
                                                        }}
                                                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] transition-all hover:scale-110 active:scale-95 ${r.chosen
                                                            ? 'bg-[var(--color-accent)] text-white shadow-sm ring-1 ring-white/20'
                                                            : 'bg-black/10 hover:bg-black/20 text-[var(--color-text-primary)]'
                                                            }`}
                                                    >
                                                        <span>{r.emoticon}</span>
                                                        <span className="font-bold opacity-80">{r.count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Scroll to Bottom Button */}
                    {showScrollBottom && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-24 right-6 w-10 h-10 rounded-full bg-[var(--color-bg-panel)] border border-[var(--color-border)] shadow-xl flex items-center justify-center text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-all animate-in zoom-in-50 duration-200 z-10"
                        >
                            <ChevronDown className="w-6 h-6" />
                        </button>
                    )}

                    {/* Message Input Container */}
                    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-panel)] relative">
                        {/* Reply Preview */}
                        {replyToMessage && (
                            <div className="absolute bottom-full left-0 right-0 p-2 bg-[var(--color-bg-panel)] border-t border-[var(--color-border)] flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Reply className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-[var(--color-accent)] uppercase">Replying to {replyToMessage.sender_name}</div>
                                        <div className="text-xs text-[var(--color-text-secondary)] truncate">
                                            {replyToMessage.text || (replyToMessage.has_media ? '[Media]' : '...')}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setReplyToMessage(null)} className="p-1 rounded-md hover:bg-black/10">
                                    <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                                </button>
                            </div>
                        )}

                        {/* Edit Preview */}
                        {editingMessage && (
                            <div className="absolute bottom-full left-0 right-0 p-2 bg-[var(--color-accent-subtle)] border-t border-[var(--color-accent)] flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Edit3 className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-[var(--color-accent)] uppercase">Editing Message #{editingMessage.id}</div>
                                        <div className="text-xs text-[var(--color-text-secondary)] truncate">{editingMessage.text}</div>
                                    </div>
                                </div>
                                <button onClick={() => { setEditingMessage(null); setMessageInput(''); }} className="p-1 rounded-md hover:bg-black/10">
                                    <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                                </button>
                            </div>
                        )}

                        <div className="p-4 flex items-center gap-2">
                            {/* Attachment button */}
                            <label
                                className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-accent)] transition-colors cursor-pointer"
                                title="Send file (image, video, document)"
                            >
                                <Paperclip className="w-5 h-5 text-[var(--color-text-secondary)]" />
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                                    disabled={!selectedChatId || isSending}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file || !selectedChatId) return
                                        try {
                                            setIsSending(true)
                                            await sendMedia(selectedChatId, file, '')
                                            // Refresh messages
                                            const msgs = await fetchMessages(selectedChatId, 0, 15)
                                            setMessages(ensureUniqueMessages(msgs, selectedChatId))
                                            setTimeout(() => scrollToBottom(), 100)
                                        } catch (err) {
                                            console.error('Failed to send file:', err)
                                            alert('Failed to send file')
                                        } finally {
                                            setIsSending(false)
                                            e.target.value = ''
                                        }
                                    }}
                                />
                            </label>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                placeholder="Type a message..."
                                disabled={isSending || !selectedChatId}
                                className="flex-1 h-10 px-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
                            />
                            {/* Translate Split Button */}
                            <div className="relative flex" ref={dropdownRef}>
                                <button
                                    onClick={async () => {
                                        if (!messageInput.trim()) return
                                        try {
                                            setIsSending(true)
                                            const result = await translateText(messageInput, targetLanguage)
                                            setMessageInput(result.translated_text)
                                        } catch (err: any) {
                                            console.error('Translation failed:', err)
                                            alert(err.message || 'Translation failed')
                                        } finally {
                                            setIsSending(false)
                                        }
                                    }}
                                    disabled={isSending || !messageInput.trim() || !selectedChatId}
                                    className="h-10 px-3 rounded-l-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] border-r-0 flex items-center justify-center hover:border-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/trans"
                                    title={`Translate to ${targetLanguage}`}
                                >
                                    <Languages className="w-5 h-5 text-[var(--color-text-secondary)] group-hover/trans:text-[var(--color-accent)]" />
                                    <span className="ml-2 text-[10px] font-bold text-[var(--color-text-muted)] group-hover/trans:text-[var(--color-accent)] hidden md:block">{targetLanguage}</span>
                                </button>
                                <button
                                    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                                    disabled={isSending || !selectedChatId}
                                    className="h-10 px-1.5 rounded-r-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Language Dropdown */}
                                {showLanguageDropdown && (
                                    <div className="absolute bottom-full mb-2 right-0 w-40 bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded-lg shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight border-b border-[var(--color-border)] mb-1">Target Language</div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar">
                                            {[
                                                'English', 'Spanish', 'French', 'German', 'Italian',
                                                'Portuguese', 'Russian', 'Chinese', 'Japanese',
                                                'Korean', 'Arabic', 'Hindi', 'Bengali', 'Turkish'
                                            ].map(lang => (
                                                <button
                                                    key={lang}
                                                    onClick={() => {
                                                        setTargetLanguage(lang)
                                                        setShowLanguageDropdown(false)
                                                    }}
                                                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${targetLanguage === lang ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/5 font-bold' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'}`}
                                                >
                                                    {lang}
                                                    {targetLanguage === lang && <Check className="w-3 h-3" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleSendMessage}
                                disabled={isSending || !messageInput.trim() || !selectedChatId}
                                className="w-10 h-10 rounded-lg bg-[var(--color-accent)] flex items-center justify-center hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSending ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5 text-white" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel (Info) */}
                {showRightPanel && (
                    <div className="w-80 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-panel)] h-full overflow-hidden animate-in slide-in-from-right-4 duration-300">
                        {isToolView ? (
                            <div className="p-3 border-b border-[var(--color-border)] flex items-center gap-3 bg-[var(--color-bg-panel)]">
                                <button
                                    onClick={() => setRightPanelTab('members')}
                                    className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                                        {rightPanelTab === 'clone' ? 'Channel Cloner' : 'Selective Exporter'}
                                    </h3>
                                    <p className="text-[10px] text-[var(--color-accent)] font-medium">@{selectedChat?.username || 'tool'}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Close Button & Header */}
                                <div className="p-2 flex justify-between items-center border-b border-[var(--color-border)]">
                                    <span className="text-xs font-bold px-2 text-[var(--color-text-secondary)] uppercase tracking-tight">Chat Info</span>
                                    <button
                                        onClick={() => setShowRightPanel(false)}
                                        className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-muted)]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Profile Header */}
                                <div className="p-6 flex flex-col items-center text-center border-b border-[var(--color-border)] bg-black/5">
                                    <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent-dim)] flex items-center justify-center relative shadow-lg mb-4 overflow-hidden">
                                        {selectedChat?.photo_path ? (
                                            <img src={getAvatarUrl(selectedChat.photo_path)!} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[var(--color-accent)] text-2xl font-bold">
                                                {(selectedChat?.title || '?').charAt(0)}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate w-full px-2">
                                        {selectedChat?.title}
                                    </h2>
                                    <p className="text-xs text-[var(--color-accent)] font-medium mt-1">
                                        @{selectedChat?.username || 'private_chat'}
                                    </p>
                                    <div className="flex gap-4 mt-6 w-full">
                                        <button className="flex-1 flex flex-col items-center gap-1 group">
                                            <div className="w-9 h-9 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center group-hover:bg-[var(--color-bg-hover)] transition-colors">
                                                <AlertCircle className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                            </div>
                                            <span className="text-[10px] text-[var(--color-text-muted)]">Mute</span>
                                        </button>
                                        <button className="flex-1 flex flex-col items-center gap-1 group">
                                            <div className="w-9 h-9 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center group-hover:bg-[var(--color-bg-hover)] transition-colors">
                                                <Search className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                            </div>
                                            <span className="text-[10px] text-[var(--color-text-muted)]">Search</span>
                                        </button>
                                        <button className="flex-1 flex flex-col items-center gap-1 group">
                                            <div className="w-9 h-9 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center group-hover:bg-[var(--color-bg-hover)] transition-colors">
                                                <ExternalLink className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                            </div>
                                            <span className="text-[10px] text-[var(--color-text-muted)]">More</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-[var(--color-border)] overflow-x-auto no-scrollbar bg-[var(--color-bg-panel)] sticky top-0 z-10 transition-all duration-300">
                                    {[
                                        { id: 'members', icon: Users, label: 'Members' },
                                        { id: 'media', icon: ImageIcon, label: 'Media' },
                                        { id: 'files', icon: FileText, label: 'Files' },
                                        { id: 'links', icon: ExternalLink, label: 'Links' },
                                        { id: 'music', icon: Music, label: 'Music' },
                                        { id: 'gif', icon: Smile, label: 'GIF' },
                                        { id: 'voice', icon: Mic, label: 'Voice' },
                                        { id: 'settings', icon: Settings, label: 'Settings' },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setRightPanelTab(tab.id as RightPanelTab)}
                                            className={`flex-1 px-2 py-3.5 flex items-center justify-center transition-colors border-b-2 ${rightPanelTab === tab.id
                                                ? 'text-[var(--color-accent)] border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border-transparent'
                                                }`}
                                            title={tab.label}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {rightPanelTab === 'settings' && (
                                <div className="space-y-4">
                                    <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Workspace Controls</div>

                                    <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                    <Terminal className="w-4 h-4 text-blue-500" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold">Developer Mode</div>
                                                    <div className="text-[10px] text-[var(--color-text-muted)]">Show IDs & Raw Data</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsDevMode(!isDevMode)}
                                                className={`w-10 h-5 rounded-full transition-colors relative ${isDevMode ? 'bg-[var(--color-accent)]' : 'bg-gray-600'}`}
                                            >
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isDevMode ? 'left-6' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                                    <Database className="w-4 h-4 text-green-500" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold">Persistent History</div>
                                                    <div className="text-[10px] text-[var(--color-text-muted)]">Force refresh cache</div>
                                                </div>
                                            </div>
                                            <button className="px-3 py-1 bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded text-[10px] font-bold hover:bg-[var(--color-bg-hover)]">Refresh</button>
                                        </div>
                                    </div>

                                    <button className="w-full p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all">
                                        <Trash2 className="w-4 h-4" />
                                        Clear Chat History
                                    </button>
                                </div>
                            )}

                            {rightPanelTab === 'members' && (
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                                        Members {members.length > 0 ? `(${members.length})` : ''}
                                    </div>

                                    {isLoadingMembers && (
                                        <div className="text-center py-4 text-xs text-[var(--color-text-muted)]">Loading members...</div>
                                    )}

                                    {members.map((member) => (
                                        <button
                                            key={member.id}
                                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--color-bg-hover)] transition-all group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="w-11 h-11 rounded-full border-2 border-transparent group-hover:border-[var(--color-accent)] transition-all p-0.5 relative flex-shrink-0">
                                                    <div className="w-full h-full rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center overflow-hidden">
                                                        {member.photo_path ? (
                                                            <img src={getAvatarUrl(member.photo_path)!} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[var(--color-accent)] text-sm font-bold">
                                                                {(member.first_name || '?').charAt(0)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--color-bg-panel)] shadow-sm" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                                                        {member.first_name} {member.last_name}
                                                    </div>
                                                    <div className="text-[11px] text-[var(--color-text-muted)] font-medium">
                                                        {member.status || 'last seen recently'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0 ml-2">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${member.rank === 'admin'
                                                        ? 'bg-[var(--color-accent)] text-white'
                                                        : 'text-[var(--color-text-muted)]'
                                                    }`}>
                                                    {member.rank || ''}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {rightPanelTab === 'media' && (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                        <input
                                            type="text"
                                            placeholder="Search media..."
                                            value={rightPanelSearch}
                                            onChange={(e) => setRightPanelSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {messages.filter(m => (m.media_type === 'photo' || m.media_type === 'video') && (m.text?.toLowerCase().includes(rightPanelSearch.toLowerCase()) || !rightPanelSearch)).length > 0 ? (
                                            messages.filter(m => (m.media_type === 'photo' || m.media_type === 'video') && (m.text?.toLowerCase().includes(rightPanelSearch.toLowerCase()) || !rightPanelSearch)).map(m => (
                                                <div
                                                    key={m.id}
                                                    className="aspect-square bg-[var(--color-bg-elevated)] rounded-md overflow-hidden relative group cursor-pointer"
                                                    onClick={() => m.media_type === 'video' ? setVideoModal({ chatId: m.chat_id, messageId: m.id, title: m.media_metadata?.file_name }) : null}
                                                >
                                                    <img
                                                        src={getMediaStreamUrl(m.chat_id, m.id)}
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                    />
                                                    {m.media_type === 'video' && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                            <Play className="w-5 h-5 text-white fill-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-3 text-center py-10 opacity-50">
                                                <ImageIcon className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-muted)]" />
                                                <p className="text-xs">No media found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {rightPanelTab === 'files' && (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                        <input
                                            type="text"
                                            placeholder="Search files..."
                                            value={rightPanelSearch}
                                            onChange={(e) => setRightPanelSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        {messages.filter(m => m.media_type === 'document' && (m.media_metadata?.file_name?.toLowerCase().includes(rightPanelSearch.toLowerCase()) || !rightPanelSearch)).length > 0 ? (
                                            messages.filter(m => m.media_type === 'document' && (m.media_metadata?.file_name?.toLowerCase().includes(rightPanelSearch.toLowerCase()) || !rightPanelSearch)).map(m => (
                                                <div key={m.id} className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center gap-3 hover:bg-[var(--color-bg-hover)] transition-colors group cursor-pointer">
                                                    <div className="w-8 h-8 rounded bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
                                                        <FileText className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[11px] font-bold text-[var(--color-text-primary)] truncate">{m.media_metadata?.file_name || 'unnamed'}</div>
                                                        <div className="text-[9px] text-[var(--color-text-muted)] uppercase">{m.media_metadata?.file_size ? `${Math.round(m.media_metadata.file_size / 1024)} KB` : 'size unknown'} • {m.media_metadata?.mime_type || 'DATA'}</div>
                                                    </div>
                                                    <a href={getMediaDownloadUrl(m.chat_id, m.id)} download className="p-1 text-[var(--color-text-muted)] hover:text-white transition-colors">
                                                        <Download className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 opacity-50">
                                                <FileText className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-muted)]" />
                                                <p className="text-xs">No files found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {rightPanelTab === 'music' && (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                        <input
                                            type="text"
                                            placeholder="Search music..."
                                            value={rightPanelSearch}
                                            onChange={(e) => setRightPanelSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        {messages.filter(m => m.media_type === 'audio' && (m.media_metadata?.file_name?.toLowerCase().includes(rightPanelSearch.toLowerCase()) || !rightPanelSearch)).length > 0 ? (
                                            messages.filter(m => m.media_type === 'audio' && (m.media_metadata?.file_name?.toLowerCase().includes(rightPanelSearch.toLowerCase()) || !rightPanelSearch)).map(m => (
                                                <div key={m.id} className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center gap-3 hover:bg-[var(--color-bg-hover)] transition-colors group cursor-pointer">
                                                    <div className="w-8 h-8 rounded bg-pink-500 flex items-center justify-center flex-shrink-0">
                                                        <Music className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[11px] font-bold text-[var(--color-text-primary)] truncate">{m.media_metadata?.file_name || 'unknown song'}</div>
                                                        <div className="text-[9px] text-[var(--color-text-muted)] uppercase">
                                                            {m.media_metadata?.duration ? `${Math.floor(m.media_metadata.duration / 60)}:${String(m.media_metadata.duration % 60).padStart(2, '0')}` : '??:??'} • {m.media_metadata?.file_size ? `${Math.round(m.media_metadata.file_size / 1024 / 1024 * 10) / 10} MB` : 'N/A'}
                                                        </div>
                                                    </div>
                                                    <button className="p-1.5 rounded-full bg-[var(--color-bg-panel)] text-[var(--color-accent)] hover:scale-110 transition-transform">
                                                        <Play className="w-3 h-3 fill-current" />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 opacity-50">
                                                <Music className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-muted)]" />
                                                <p className="text-xs">No music found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {rightPanelTab === 'gif' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-1">
                                        {messages.filter(m => m.media_type === 'video' && m.media_metadata?.is_animated).length > 0 ? (
                                            messages.filter(m => m.media_type === 'video' && m.media_metadata?.is_animated).map(m => (
                                                <div key={m.id} className="aspect-square bg-[var(--color-bg-elevated)] rounded-md overflow-hidden relative group cursor-pointer">
                                                    <img
                                                        src={getMediaStreamUrl(m.chat_id, m.id)}
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                    />
                                                    <div className="absolute bottom-1 right-1 px-1 rounded bg-black/50 text-[8px] text-white font-bold">GIF</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-3 text-center py-10 opacity-50">
                                                <Smile className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-muted)]" />
                                                <p className="text-xs">No GIFs found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {rightPanelTab === 'voice' && (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        {messages.filter(m => m.media_type === 'voice').length > 0 ? (
                                            messages.filter(m => m.media_type === 'voice').map(m => (
                                                <div key={m.id} className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center gap-3 hover:bg-[var(--color-bg-hover)] transition-colors group cursor-pointer">
                                                    <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                                        <Mic className="w-4 h-4 text-blue-500" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[11px] font-bold text-[var(--color-text-primary)]">Voice Message</div>
                                                        <div className="text-[9px] text-[var(--color-text-muted)] uppercase">
                                                            {m.media_metadata?.duration ? `${Math.floor(m.media_metadata.duration / 60)}:${String(m.media_metadata.duration % 60).padStart(2, '0')}` : '??:??'} • {new Date(m.date).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <button className="p-1.5 rounded-full bg-[var(--color-bg-panel)] text-blue-500 hover:scale-110 transition-transform">
                                                        <Play className="w-3 h-3 fill-current" />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 opacity-50">
                                                <Mic className="w-10 h-10 mx-auto mb-2 text-[var(--color-text-muted)]" />
                                                <p className="text-xs">No voice messages</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Keep Clone/Export forms as is */}

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
                                                {/* TODO: Fetch real sessions for clone target */}
                                                <option value={1}>Current Account</option>
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

                        </div>
                    </div>
                )}
            </div >

            {/* Video Player Modal */}
            {
                videoModal && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                        onClick={() => setVideoModal(null)}
                    >
                        <div
                            className="relative max-w-4xl max-h-[90vh] w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setVideoModal(null)}
                                className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition-colors"
                                title="Close"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            {/* Title */}
                            {videoModal.title && (
                                <div className="absolute -top-10 left-0 text-white/80 text-sm truncate max-w-[80%]">
                                    {videoModal.title}
                                </div>
                            )}

                            {/* Video Player */}
                            <video
                                src={getMediaStreamUrl(videoModal.chatId, videoModal.messageId)}
                                controls
                                autoPlay
                                className="w-full max-h-[85vh] rounded-lg shadow-2xl"
                            />

                            {/* Download button */}
                            <div className="absolute bottom-4 right-4">
                                <a
                                    href={getMediaDownloadUrl(videoModal.chatId, videoModal.messageId)}
                                    download
                                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Download
                                </a>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Context Menu Backdrop */}
            {contextMenu && (
                <div
                    className="fixed inset-0 z-50"
                    onClick={() => setContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                />
            )}

            {/* Message Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-[60] w-52 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in duration-100"
                    style={{ left: Math.min(contextMenu.x, window.innerWidth - 220), top: Math.min(contextMenu.y, window.innerHeight - 450) }}
                >
                    <div className="flex items-center justify-around px-2 py-2 border-b border-[var(--color-border)] bg-black/5">
                        {['😊', '👀', '😁', '🤣', '😢', '❤️', '🔥'].map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => { handleReaction(contextMenu.message.id, emoji); setContextMenu(null); }}
                                className="text-lg hover:scale-125 transition-transform active:scale-90 p-1"
                            >
                                {emoji}
                            </button>
                        ))}
                        <button className="p-1 opacity-50 hover:opacity-100"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <button
                        onClick={() => { setReplyToMessage(contextMenu.message); setContextMenu(null); }}
                        className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        <Reply className="w-4 h-4 opacity-70" /> Reply
                    </button>
                    {contextMenu.message.is_outgoing && (
                        <button
                            onClick={() => {
                                setEditingMessage(contextMenu.message);
                                setMessageInput(contextMenu.message.text || '');
                                setContextMenu(null);
                            }}
                            className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                        >
                            <Edit3 className="w-4 h-4 opacity-70" /> Edit
                        </button>
                    )}
                    {contextMenu.message.has_media && (
                        <button
                            onClick={() => { /* Implementation for copy image would go here */ setContextMenu(null); }}
                            className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                        >
                            <ImageIcon className="w-4 h-4 opacity-70" /> Copy Image
                        </button>
                    )}
                    <button
                        onClick={() => { navigator.clipboard.writeText(contextMenu.message.text || ''); setContextMenu(null); }}
                        className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        <Copy className="w-4 h-4 opacity-70" /> Copy Text
                    </button>
                    <button
                        onClick={() => { /* Implementation for copy link */ setContextMenu(null); }}
                        className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        <ExternalLink className="w-4 h-4 opacity-70" /> Copy Message Link
                    </button>
                    <button
                        onClick={() => { handlePinMessage(contextMenu.message); setContextMenu(null); }}
                        className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        <Pin className="w-4 h-4 opacity-70" /> {contextMenu.message.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                    {contextMenu.message.has_media && (
                        <a
                            href={getMediaDownloadUrl(contextMenu.message.chat_id, contextMenu.message.id)}
                            download
                            onClick={() => setContextMenu(null)}
                            className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                        >
                            <Download className="w-4 h-4 opacity-70" /> Download
                        </a>
                    )}
                    <button
                        onClick={() => { /* Implementation for forward */ setContextMenu(null); }}
                        className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        <Share2 className="w-4 h-4 opacity-70" /> Forward
                    </button>
                    <button
                        onClick={() => { /* Implementation for select */ setContextMenu(null); }}
                        className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        <MousePointer2 className="w-4 h-4 opacity-70" /> Select
                    </button>
                    <button
                        onClick={() => { /* Implementation for report */ setContextMenu(null); }}
                        className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                        <Flag className="w-4 h-4 opacity-70" /> Report
                    </button>
                    {isDevMode && (
                        <button
                            onClick={() => { setShowRawJson(JSON.stringify(contextMenu.message, null, 2)); setContextMenu(null); }}
                            className="w-full px-4 py-2 flex items-center gap-3 text-sm text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors border-t border-[var(--color-border)]"
                        >
                            <Code className="w-4 h-4 opacity-70" /> View Raw JSON
                        </button>
                    )}
                    <div className="h-px bg-[var(--color-border)] my-1" />
                    <button
                        onClick={() => { handleDeleteMessage(contextMenu.message); setContextMenu(null); }}
                        className="w-full px-4 py-2 flex items-center gap-3 text-sm text-red-500 hover:bg-black/10 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" /> Delete
                    </button>
                </div>
            )}

            {/* Raw JSON Modal */}
            {showRawJson && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl max-h-[80vh] bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--color-text-primary)]">
                                <Terminal className="w-4 h-4 text-[var(--color-accent)]" />
                                Raw Message Payload
                            </h3>
                            <button onClick={() => setShowRawJson(null)} className="p-1 rounded-md hover:bg-[var(--color-bg-hover)] transition-colors">
                                <X className="w-4 h-4 text-[var(--color-text-primary)]" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-[#0d1117] relative group/json">
                            <pre className="text-[11px] font-mono text-blue-300">
                                {showRawJson}
                            </pre>
                            <button
                                onClick={() => { navigator.clipboard.writeText(showRawJson); }}
                                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-all opacity-0 group-hover/json:opacity-100"
                                title="Copy JSON"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="p-3 border-t border-[var(--color-border)] flex justify-end">
                            <button
                                onClick={() => setShowRawJson(null)}
                                className="px-4 py-1.5 bg-[var(--color-accent)] text-white text-xs font-bold rounded-md hover:bg-[var(--color-accent-hover)] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
