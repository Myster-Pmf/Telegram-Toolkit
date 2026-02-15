import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Settings, Users, Image, FileText, Send, Copy, Download, AlertCircle, MessageSquare, Play, X, Languages, Paperclip, Pin, Reply, Trash2, Edit3, Code, Terminal, Database, Check } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cloneChat, exportChat, fetchChats, fetchMessages, fetchChatMembers, getMediaStreamUrl, getMediaDownloadUrl, fetchChatPhoto, sendMessage, translateText, sendMedia, editMessage, deleteMessage, pinMessage, unpinMessage, fetchPinnedMessage } from '../lib/api'
import type { Chat, Message, Member } from '../lib/api'

type RightPanelTab = 'members' | 'media' | 'files' | 'links' | 'settings' | 'export' | 'clone'

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
    const [isDevMode, setIsDevMode] = useState(false)
    const [replyToMessage, setReplyToMessage] = useState<Message | null>(null)
    const [editingMessage, setEditingMessage] = useState<Message | null>(null)
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
                    const sorted = ensureUniqueMessages(msgs)
                    setMessages(sorted)
                    setTimeout(() => scrollToBottom(), 100)

                    // Phase 2: Fetch more messages in background (only if still on same chat)
                    if (sorted.length >= 10) {
                        const oldestId = sorted[0]?.id || 0
                        fetchMessages(currentChatId, oldestId, 35)
                            .then(moreMsgs => {
                                if (abortControllerRef.current?.signal.aborted) return
                                setMessages(prev => ensureUniqueMessages([...moreMsgs, ...prev]))
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
            fetchPinnedMessage(currentChatId)
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
                            setMessages(prev => {
                                if (prev.some(m => m.id === msg.id)) return prev
                                return [...prev, msg]
                            })
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

    const ensureUniqueMessages = (msgs: Message[]) => {
        const unique = new Map();
        msgs.forEach(m => unique.set(m.id, m));
        // Sort by date first, then by ID as tiebreaker (higher ID = newer)
        return Array.from(unique.values()).sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return a.id - b.id; // Same date: sort by ID ascending (older ID first)
        });
    }

    const scrollToBottom = () => {
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight
        }
    }

    // Infinite Scroll Handler
    const handleScroll = async () => {
        if (!messageContainerRef.current || isLoadingOlder || messages.length === 0) return

        // If scrolled to top
        if (messageContainerRef.current.scrollTop === 0) {
            const oldestMessageId = messages[0].id // Since we sort oldest to newest, [0] is oldest
            console.log("Fetching older messages than ID:", oldestMessageId)

            setIsLoadingOlder(true)
            // Save scroll height to restore position
            const oldScrollHeight = messageContainerRef.current.scrollHeight

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
                        return ensureUniqueMessages(merged)
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
                setMessages(prev => prev.map(m => m.id === sentMessage.id ? sentMessage : m));
                setEditingMessage(null);
            } else {
                sentMessage = await sendMessage(selectedChatId, messageInput.trim(), replyToMessage?.id)
                setMessages(prev => [...prev, sentMessage])
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
                        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
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

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex group/msg ${msg.is_outgoing ? 'justify-end' : 'justify-start'} ${isPrevSameSender ? 'mt-0.5' : 'mt-3'}`}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
                                    }}
                                >
                                    <div
                                        className={`relative group max-w-[70%] px-3 py-1.5 shadow-sm transition-all ${msg.is_outgoing
                                            ? `bg-[var(--color-accent)] text-white ${isPrevSameSender ? 'rounded-lg' : 'rounded-l-lg rounded-tr-lg'}`
                                            : `bg-[var(--color-bg-panel)] border border-[var(--color-border)] ${isPrevSameSender ? 'rounded-lg' : 'rounded-r-lg rounded-tl-lg'}`
                                            }`}
                                    >
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
                                                    ? 'right-[-2px] bg-[var(--color-accent)] [clip-path:polygon(0_0,100%_0,0_100%)]'
                                                    : 'left-[-4px] bg-[var(--color-bg-panel)] border-l border-t border-[var(--color-border)] [clip-path:polygon(0_0,100%_0,100%_100%)]'}`}
                                            />
                                        )}

                                        {!msg.is_outgoing && !isPrevSameSender && (
                                            <div className="flex items-center gap-2 mb-1">
                                                {isDevMode && <span className="text-[9px] font-mono text-blue-400">#{msg.sender_id}</span>}
                                                <div className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-tight">
                                                    {msg.sender_name || 'User ' + (msg.sender_id || '')}
                                                </div>
                                            </div>
                                        )}

                                        {/* Reply Preview in Message */}
                                        {msg.reply_to_msg_id && (
                                            <div className={`mb-1.5 p-1.5 rounded-md border-l-2 text-[11px] bg-black/5 opacity-80 cursor-pointer hover:bg-black/10 transition-colors ${msg.is_outgoing ? 'border-white/50' : 'border-[var(--color-accent)]'}`}>
                                                <div className="font-bold opacity-60">Replied to message #{msg.reply_to_msg_id}</div>
                                                <div className="truncate opacity-80">Click to jump</div>
                                            </div>
                                        )}

                                        {msg.has_media && (
                                            /* Existing media rendering... kept same but wrapped in container */
                                            <div className="mb-1 rounded overflow-hidden relative group/media">
                                                {msg.media_path ? (
                                                    <div className="relative">
                                                        <img
                                                            src={getAvatarUrl(msg.media_path)!}
                                                            alt={msg.media_type || 'Media'}
                                                            className="max-w-full max-h-80 rounded object-contain cursor-pointer hover:opacity-95 transition-opacity"
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
                                                                <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors">
                                                                    <Play className="w-5 h-5 text-white fill-white" />
                                                                </div>
                                                            </div>
                                                        )}
                                                        <a href={getMediaDownloadUrl(msg.chat_id, msg.id)} download className="absolute top-1 right-1 p-1 rounded bg-black/40 text-white opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black/60" onClick={(e) => e.stopPropagation()}>
                                                            <Download className="w-3.5 h-3.5" />
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div className="p-2 bg-black/10 rounded flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded bg-[var(--color-accent-dim)] flex items-center justify-center flex-shrink-0">
                                                            {msg.media_type === 'video' ? <Play className="w-4 h-4 text-[var(--color-accent)]" /> : <Image className="w-4 h-4 text-[var(--color-accent)]" />}
                                                        </div>
                                                        <div className="overflow-hidden flex-1">
                                                            <div className="text-[11px] font-medium truncate">{msg.media_metadata?.file_name || msg.media_type || 'Media'}</div>
                                                            <div className="text-[9px] opacity-60">{(msg.media_metadata?.file_size || 0) / 1024 > 1024 ? ((msg.media_metadata?.file_size || 0) / (1024 * 1024)).toFixed(1) + 'MB' : Math.round((msg.media_metadata?.file_size || 0) / 1024) + 'KB'}</div>
                                                        </div>
                                                        <a href={getMediaDownloadUrl(msg.chat_id, msg.id)} download className="p-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-muted hover:text-primary transition-colors">
                                                            <Download className="w-3.5 h-3.5" />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.text}</div>

                                        <div className={`flex items-center gap-1.5 text-[9px] mt-1 ${msg.is_outgoing ? 'text-white/60' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors'}`}>
                                            {isDevMode && <span className="font-mono">#{msg.id}</span>}
                                            <span>{new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {msg.edit_date && <span className="font-medium italic">Edited</span>}
                                            {msg.is_pinned && <Pin className="w-2.5 h-2.5 fill-current" />}
                                            {msg.is_outgoing && <Check className="w-2.5 h-2.5" />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

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
                                            setMessages(ensureUniqueMessages(msgs))
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
                            {/* Translate button */}
                            <button
                                onClick={async () => {
                                    if (!messageInput.trim()) return
                                    try {
                                        setIsSending(true)
                                        const result = await translateText(messageInput)
                                        setMessageInput(result.translated_text)
                                    } catch (err: any) {
                                        console.error('Translation failed:', err)
                                        alert(err.message || 'Translation failed')
                                    } finally {
                                        setIsSending(false)
                                    }
                                }}
                                disabled={isSending || !messageInput.trim() || !selectedChatId}
                                className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Translate message (uses configured LLM)"
                            >
                                <Languages className="w-5 h-5 text-[var(--color-text-secondary)]" />
                            </button>
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
                                            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[var(--color-bg-hover)] transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center relative overflow-hidden">
                                                {member.photo_path ? (
                                                    <img src={getAvatarUrl(member.photo_path)!} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[var(--color-accent)] text-xs font-medium">
                                                        {(member.first_name || '?').charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="text-sm text-[var(--color-text-primary)] truncate">
                                                    {member.first_name} {member.last_name}
                                                </div>
                                                <div className="text-xs text-[var(--color-text-muted)] truncate">
                                                    @{member.username || 'No username'}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {rightPanelTab === 'media' && (
                                <div className="grid grid-cols-3 gap-1">
                                    <div className="col-span-3 text-center py-4 text-xs text-[var(--color-text-muted)]">
                                        Media gallery not yet integrated.
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
                    className="fixed z-[60] w-48 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in duration-100"
                    style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 300) }}
                >
                    <button
                        onClick={() => { setReplyToMessage(contextMenu.message); setContextMenu(null); }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                    >
                        <Reply className="w-3.5 h-3.5" /> Reply
                    </button>
                    {contextMenu.message.is_outgoing && (
                        <button
                            onClick={() => {
                                setEditingMessage(contextMenu.message);
                                setMessageInput(contextMenu.message.text || '');
                                setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                        >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                    )}
                    <button
                        onClick={() => { handlePinMessage(contextMenu.message); setContextMenu(null); }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                    >
                        <Pin className="w-3.5 h-3.5" /> {contextMenu.message.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                        onClick={() => { navigator.clipboard.writeText(contextMenu.message.id.toString()); setContextMenu(null); }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                    >
                        <Copy className="w-3.5 h-3.5" /> Copy ID
                    </button>
                    <button
                        onClick={() => {
                            if (contextMenu.message.raw_json) {
                                try {
                                    setShowRawJson(JSON.stringify(JSON.parse(contextMenu.message.raw_json), null, 2));
                                } catch (e) {
                                    setShowRawJson(contextMenu.message.raw_json);
                                }
                            }
                            setContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                    >
                        <Code className="w-3.5 h-3.5" /> View Raw
                    </button>
                    <div className="h-px bg-[var(--color-border)] my-1" />
                    <button
                        onClick={() => { handleDeleteMessage(contextMenu.message); setContextMenu(null); }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
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
