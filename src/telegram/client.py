"""
Telegram Client Abstraction Layer

Provides a unified interface for Telegram operations.
Currently implements Telethon, designed for future TDLib support.
"""

from abc import ABC, abstractmethod
from typing import Optional, List, AsyncIterator, Any
from dataclasses import dataclass
from datetime import datetime

from telethon import TelegramClient as TelethonClient
from telethon.sessions import StringSession
from telethon.tl.types import User as TelethonUser, Chat as TelethonChat, Message as TelethonMessage

from src.core.config import settings


@dataclass
class UserInfo:
    """Unified user information."""
    id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    is_bot: bool
    is_premium: bool
    is_verified: bool


@dataclass
class ChatInfo:
    """Unified chat information."""
    id: int
    title: Optional[str]
    username: Optional[str]
    chat_type: str  # private, group, supergroup, channel
    member_count: Optional[int]


@dataclass 
class MessageInfo:
    """Unified message information."""
    id: int
    chat_id: int
    sender_id: Optional[int]
    text: Optional[str]
    date: datetime
    reply_to_msg_id: Optional[int]
    forward_from_id: Optional[int]
    has_media: bool
    media_type: Optional[str]


class BaseTelegramClient(ABC):
    """
    Abstract base class for Telegram client implementations.
    
    This abstraction allows swapping between Telethon and TDLib
    without changing the rest of the application.
    """
    
    @abstractmethod
    async def connect(self) -> None:
        """Connect to Telegram servers."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from Telegram servers."""
        pass
    
    @abstractmethod
    async def is_connected(self) -> bool:
        """Check if connected to Telegram."""
        pass
    
    @abstractmethod
    async def get_me(self) -> UserInfo:
        """Get the current user's information."""
        pass
    
    # Authentication
    @abstractmethod
    async def send_code_request(self, phone: str) -> str:
        """Send OTP code to phone number. Returns phone_code_hash."""
        pass
    
    @abstractmethod
    async def sign_in(self, phone: str, code: str, phone_code_hash: str, password: str = None) -> UserInfo:
        """Sign in with phone number and code."""
        pass
    
    @abstractmethod
    async def qr_login(self) -> AsyncIterator[bytes]:
        """Generate QR codes for login. Yields QR code data until login succeeds."""
        pass
    
    # Session
    @abstractmethod
    async def export_session_string(self) -> str:
        """Export the current session as a string."""
        pass
    
    # Dialogs/Chats
    @abstractmethod
    async def get_dialogs(self, limit: int = 100) -> List[ChatInfo]:
        """Get user's dialogs (chats, groups, channels)."""
        pass
    
    @abstractmethod
    async def get_chat(self, chat_id: int) -> ChatInfo:
        """Get information about a specific chat."""
        pass
    
    # Messages
    @abstractmethod
    async def get_messages(
        self, 
        chat_id: int, 
        limit: int = 100,
        offset_id: int = 0,
        min_id: int = 0,
        max_id: int = 0,
    ) -> List[MessageInfo]:
        """Get messages from a chat."""
        pass
    
    @abstractmethod
    async def send_message(self, chat_id: int, text: str, reply_to: int = None) -> MessageInfo:
        """Send a message to a chat."""
        pass
    
    # Media
    @abstractmethod
    async def download_media(self, message: Any, path: str = None) -> Optional[str]:
        """Download media from a message. Returns file path."""
        pass
    
    # Users
    @abstractmethod
    async def get_user(self, user_id: int) -> UserInfo:
        """Get information about a user."""
        pass
    
    # Event handlers (for monitoring)
    @abstractmethod
    def on_new_message(self, handler, chats=None):
        """Register handler for new messages."""
        pass
    
    @abstractmethod
    def on_message_edited(self, handler, chats=None):
        """Register handler for edited messages."""
        pass
    
    @abstractmethod
    def on_message_deleted(self, handler, chats=None):
        """Register handler for deleted messages."""
        pass


class TelethonClientWrapper(BaseTelegramClient):
    """
    Telethon-based implementation of the Telegram client.
    """
    
    def __init__(
        self,
        session: str = None,
        api_id: int = None,
        api_hash: str = None,
    ):
        """
        Initialize the Telethon client.
        
        Args:
            session: Session string or None for new session
            api_id: Telegram API ID (uses settings if not provided)
            api_hash: Telegram API hash (uses settings if not provided)
        """
        self.api_id = api_id or settings.telegram_api_id
        self.api_hash = api_hash or settings.telegram_api_hash
        
        if not self.api_id or not self.api_hash:
            raise ValueError(
                "Telegram API credentials not configured. "
                "Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env"
            )
        
        # Create session
        if session:
            session_obj = StringSession(session)
        else:
            session_obj = StringSession()
        
        self._client = TelethonClient(
            session_obj,
            self.api_id,
            self.api_hash,
        )
    
    @property
    def raw_client(self) -> TelethonClient:
        """Get the underlying Telethon client for advanced operations."""
        return self._client
    
    async def connect(self) -> None:
        """Connect to Telegram servers."""
        await self._client.connect()
    
    async def disconnect(self) -> None:
        """Disconnect from Telegram servers."""
        await self._client.disconnect()
    
    async def is_connected(self) -> bool:
        """Check if connected to Telegram."""
        return self._client.is_connected()
    
    def _convert_user(self, user: TelethonUser) -> UserInfo:
        """Convert Telethon user to UserInfo."""
        return UserInfo(
            id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            is_bot=user.bot or False,
            is_premium=getattr(user, 'premium', False) or False,
            is_verified=user.verified or False,
        )
    
    async def get_me(self) -> UserInfo:
        """Get the current user's information."""
        me = await self._client.get_me()
        return self._convert_user(me)
    
    async def send_code_request(self, phone: str) -> str:
        """Send OTP code to phone number. Returns phone_code_hash."""
        result = await self._client.send_code_request(phone)
        return result.phone_code_hash
    
    async def sign_in(
        self, 
        phone: str, 
        code: str, 
        phone_code_hash: str, 
        password: str = None
    ) -> UserInfo:
        """Sign in with phone number and code."""
        try:
            user = await self._client.sign_in(phone, code, phone_code_hash=phone_code_hash)
        except Exception as e:
            # Check if 2FA is required
            if "Two-steps verification" in str(e) or "password" in str(e).lower():
                if not password:
                    raise ValueError("Two-factor authentication required. Please provide password.")
                user = await self._client.sign_in(password=password)
            else:
                raise
        return self._convert_user(user)
    
    async def qr_login(self) -> AsyncIterator[bytes]:
        """Generate QR codes for login."""
        from telethon.tl.functions.auth import ExportLoginTokenRequest, ImportLoginTokenRequest
        import qrcode
        import io
        
        # This is a simplified QR login - full implementation would be more complex
        while not await self._client.is_user_authorized():
            result = await self._client(ExportLoginTokenRequest(
                api_id=self.api_id,
                api_hash=self.api_hash,
                except_ids=[]
            ))
            
            # Create QR code
            login_url = f"tg://login?token={result.token.hex()}"
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(login_url)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            yield buffer.getvalue()
            
            # Wait before generating new QR
            import asyncio
            await asyncio.sleep(5)
    
    async def export_session_string(self) -> str:
        """Export the current session as a string."""
        return self._client.session.save()
    
    async def get_dialogs(self, limit: int = 100) -> List[ChatInfo]:
        """Get user's dialogs."""
        dialogs = await self._client.get_dialogs(limit=limit)
        result = []
        for dialog in dialogs:
            entity = dialog.entity
            if hasattr(entity, 'broadcast') and entity.broadcast:
                chat_type = 'channel'
            elif hasattr(entity, 'megagroup') and entity.megagroup:
                chat_type = 'supergroup'
            elif hasattr(entity, 'gigagroup') and entity.gigagroup:
                chat_type = 'supergroup'
            elif isinstance(entity, TelethonUser):
                chat_type = 'private'
            else:
                chat_type = 'group'
            
            result.append(ChatInfo(
                id=dialog.id,
                title=dialog.title or (entity.first_name if hasattr(entity, 'first_name') else None),
                username=getattr(entity, 'username', None),
                chat_type=chat_type,
                member_count=getattr(entity, 'participants_count', None),
            ))
        return result
    
    async def get_chat(self, chat_id: int) -> ChatInfo:
        """Get information about a specific chat."""
        entity = await self._client.get_entity(chat_id)
        
        if hasattr(entity, 'broadcast') and entity.broadcast:
            chat_type = 'channel'
        elif hasattr(entity, 'megagroup') and entity.megagroup:
            chat_type = 'supergroup'
        elif isinstance(entity, TelethonUser):
            chat_type = 'private'
        else:
            chat_type = 'group'
        
        return ChatInfo(
            id=entity.id,
            title=getattr(entity, 'title', None) or getattr(entity, 'first_name', None),
            username=getattr(entity, 'username', None),
            chat_type=chat_type,
            member_count=getattr(entity, 'participants_count', None),
        )
    
    async def get_messages(
        self, 
        chat_id: int, 
        limit: int = 100,
        offset_id: int = 0,
        min_id: int = 0,
        max_id: int = 0,
    ) -> List[MessageInfo]:
        """Get messages from a chat."""
        messages = await self._client.get_messages(
            chat_id,
            limit=limit,
            offset_id=offset_id,
            min_id=min_id,
            max_id=max_id,
        )
        
        result = []
        for msg in messages:
            media_type = None
            has_media = bool(msg.media)
            if has_media:
                if msg.photo:
                    media_type = 'photo'
                elif msg.video:
                    media_type = 'video'
                elif msg.document:
                    media_type = 'document'
                elif msg.audio:
                    media_type = 'audio'
                elif msg.voice:
                    media_type = 'voice'
                elif msg.sticker:
                    media_type = 'sticker'
            
            result.append(MessageInfo(
                id=msg.id,
                chat_id=chat_id,
                sender_id=msg.sender_id,
                text=msg.text,
                date=msg.date,
                reply_to_msg_id=msg.reply_to_msg_id if msg.reply_to else None,
                forward_from_id=msg.forward.from_id.user_id if msg.forward and hasattr(msg.forward.from_id, 'user_id') else None,
                has_media=has_media,
                media_type=media_type,
            ))
        
        return result
    
    async def send_message(self, chat_id: int, text: str, reply_to: int = None) -> MessageInfo:
        """Send a message to a chat."""
        msg = await self._client.send_message(chat_id, text, reply_to=reply_to)
        return MessageInfo(
            id=msg.id,
            chat_id=chat_id,
            sender_id=msg.sender_id,
            text=msg.text,
            date=msg.date,
            reply_to_msg_id=reply_to,
            forward_from_id=None,
            has_media=False,
            media_type=None,
        )
    
    async def download_media(self, message: Any, path: str = None) -> Optional[str]:
        """Download media from a message."""
        return await self._client.download_media(message, file=path)
    
    async def get_user(self, user_id: int) -> UserInfo:
        """Get information about a user."""
        user = await self._client.get_entity(user_id)
        return self._convert_user(user)
    
    def on_new_message(self, handler, chats=None):
        """Register handler for new messages."""
        from telethon import events
        self._client.add_event_handler(
            handler,
            events.NewMessage(chats=chats)
        )
    
    def on_message_edited(self, handler, chats=None):
        """Register handler for edited messages."""
        from telethon import events
        self._client.add_event_handler(
            handler,
            events.MessageEdited(chats=chats)
        )
    
    def on_message_deleted(self, handler, chats=None):
        """Register handler for deleted messages."""
        from telethon import events
        self._client.add_event_handler(
            handler,
            events.MessageDeleted(chats=chats)
        )


# Type alias for the current implementation
TelegramClient = TelethonClientWrapper


def get_client(
    session: str = None,
    api_id: int = None,
    api_hash: str = None,
) -> TelegramClient:
    """
    Get a Telegram client instance.
    
    This factory function allows future implementation switching.
    """
    return TelethonClientWrapper(session, api_id, api_hash)
