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
    sender_name: Optional[str]
    sender_photo: Optional[str]
    text: Optional[str]
    date: datetime
    reply_to_msg_id: Optional[int]
    forward_from_id: Optional[int]
    has_media: bool
    media_type: Optional[str]
    media_path: Optional[str]
    media_metadata: Optional[dict]  # file_name, file_size, duration, width, height
    is_outgoing: bool


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
    
    @abstractmethod
    async def get_chat_members(self, chat_id: int, limit: int = 50, offset: int = 0) -> List[UserInfo]:
        """Get members of a chat."""
        pass

    @abstractmethod
    async def download_profile_photo(self, entity: Any) -> Optional[str]:
        """Download profile photo for a user or chat. Returns path relative to media dir."""
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
    
    @abstractmethod
    async def send_file(self, chat_id: int, file: str, caption: str = None, reply_to: int = None) -> MessageInfo:
        """Send a file (image, video, document) to a chat."""
        pass
    
    # Media
    @abstractmethod
    async def download_media(self, message: Any, path: str = None) -> Optional[str]:
        """Download media from a message. Returns file path."""
        pass
    
    @abstractmethod
    async def delete_messages(self, chat_id: int, message_ids: List[int]) -> int:
        """Delete messages from a chat. Returns number of deleted messages."""
        pass
    
    @abstractmethod
    async def forward_messages(self, to_chat_id: int, from_chat_id: int, message_ids: List[int]) -> List[Any]:
        """Forward messages to another chat. Returns list of new messages."""
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

    async def download_profile_photo(self, entity: Any) -> Optional[str]:
        """Download profile photo for a user or chat."""
        from pathlib import Path
        
        # Skip if entity is None
        if entity is None:
            return None
        
        # Check if entity has a photo - different entity types have different photo attrs
        has_photo = False
        try:
            photo = getattr(entity, 'photo', None)
            if photo is not None and str(type(photo).__name__) not in ['UserProfilePhotoEmpty', 'ChatPhotoEmpty']:
                has_photo = True
        except Exception:
            pass
        
        if not has_photo:
            return None
            
        try:
            # Create directory if it doesn't exist - use absolute path
            media_dir_abs = Path(settings.media_dir).resolve()
            avatars_dir = media_dir_abs / "avatars"
            avatars_dir.mkdir(parents=True, exist_ok=True)
            
            path = await self._client.download_profile_photo(
                entity, 
                file=avatars_dir
            )
            if path:
                # Return path relative to media dir, e.g. "avatars/12345.jpg"
                downloaded_path = Path(path).resolve()
                return str(downloaded_path.relative_to(media_dir_abs)).replace("\\", "/")
            return None
        except Exception as e:
            # Silently ignore - many entities don't have downloadable photos
            return None
    
    async def get_dialogs(self, limit: int = 100) -> List[ChatInfo]:
        """Get user's dialogs - fast, no photo downloads."""
        dialogs = await self._client.get_dialogs(limit=limit)
        chat_infos = []
        
        for d in dialogs:
            # Enhanced ChatInfo with dynamic attributes (NO photo download for speed)
            chat = ChatInfo(
                id=d.id,
                title=d.title,
                username=getattr(d.entity, 'username', None),
                chat_type='private' if d.is_user else 'channel' if d.is_channel else 'group',
                member_count=getattr(d.entity, 'participants_count', 0),
            )
            # Monkey-patch extra fields for API response
            setattr(chat, 'unread_count', d.unread_count)
            setattr(chat, 'last_message', d.message.message if d.message else None)
            setattr(chat, 'last_message_date', d.message.date if d.message else None)
            setattr(chat, 'photo_path', None)  # Loaded separately via lazy loading
            
            chat_infos.append(chat)
            
        return chat_infos
    async def get_chat(self, chat_id: int) -> ChatInfo:
        """Get information about a specific chat."""
        entity = await self._client.get_entity(chat_id)
        
        # Download photo if single chat request
        photo_path = await self.download_profile_photo(entity)
        
        chat = ChatInfo(
            id=entity.id,
            title=getattr(entity, 'title', None) or getattr(entity, 'first_name', 'Unknown'),
            username=getattr(entity, 'username', None),
            chat_type='private' if getattr(entity, 'bot', False) or getattr(entity, 'first_name', False) else 'channel',
            member_count=getattr(entity, 'participants_count', 0)
        )
        setattr(chat, 'photo_path', photo_path)
        return chat
        
    async def get_chat_members(self, chat_id: int, limit: int = 50, offset: int = 0) -> List[UserInfo]:
        """Get members of a chat."""
        try:
            participants = await self._client.get_participants(
                chat_id, 
                limit=limit, 
                # aggressive=True  # For large groups
            )
        except Exception as e:
            # Many channels and private groups restrict member access
            print(f"Cannot get participants for {chat_id}: {e}")
            return []
        
        users = []
        for p in participants:
            try:
                u = self._convert_user(p)
                # Add status based on participant type
                status = "member"
                if hasattr(p, 'participant'):
                    p_type = type(p.participant).__name__
                    if 'Creator' in p_type:
                        status = "owner"
                    elif 'Admin' in p_type:
                        status = "admin"
                    elif 'Banned' in p_type:
                        status = "banned"
                    elif 'Left' in p_type:
                        status = "left"
                setattr(u, 'status', status)
                users.append(u)
            except Exception as e:
                print(f"Error converting participant: {e}")
                continue
        return users
    
    async def get_messages(
        self, 
        chat_id: int, 
        limit: int = 100,
        offset_id: int = 0,
        min_id: int = 0,
        max_id: int = 0,
        download_media: bool = True,  # Set to False for faster loading
    ) -> List[MessageInfo]:
        """Get messages from a chat."""
        from pathlib import Path
        
        messages = await self._client.get_messages(
            chat_id,
            limit=limit,
            offset_id=offset_id,
            min_id=min_id, 
            max_id=max_id
        )
        
        # Prepare media directory - use absolute path (only if downloading)
        media_dir_abs = Path(settings.media_dir).resolve()
        messages_media_dir = None
        if download_media:
            messages_media_dir = media_dir_abs / "messages" / str(abs(chat_id))
            messages_media_dir.mkdir(parents=True, exist_ok=True)
        
        result = []
        for m in messages:
            # Determine media type and extract metadata
            media_type = None
            media_metadata = None
            
            if m.photo: 
                media_type = 'photo'
                # Get largest photo size
                if hasattr(m.photo, 'sizes') and m.photo.sizes:
                    largest = max(m.photo.sizes, key=lambda s: getattr(s, 'size', 0) or 0)
                    media_metadata = {
                        'width': getattr(largest, 'w', None),
                        'height': getattr(largest, 'h', None),
                        'file_size': getattr(largest, 'size', None),
                    }
            elif m.video: 
                media_type = 'video'
                media_metadata = {
                    'file_name': getattr(m.video, 'file_name', None) or 'video',
                    'file_size': getattr(m.video, 'size', None),
                    'duration': getattr(m.video, 'duration', None),
                    'width': getattr(m.video, 'w', None),
                    'height': getattr(m.video, 'h', None),
                    'mime_type': getattr(m.video, 'mime_type', None),
                }
            elif m.document: 
                media_type = 'document'
                media_metadata = {
                    'file_name': getattr(m.document, 'file_name', None) or 'file',
                    'file_size': getattr(m.document, 'size', None),
                    'mime_type': getattr(m.document, 'mime_type', None),
                }
                # Check for file name in attributes
                for attr in getattr(m.document, 'attributes', []):
                    if hasattr(attr, 'file_name'):
                        media_metadata['file_name'] = attr.file_name
            elif m.voice: 
                media_type = 'voice'
                media_metadata = {
                    'duration': getattr(m.voice, 'duration', None),
                    'file_size': getattr(m.voice, 'size', None),
                }
            elif m.sticker: 
                media_type = 'sticker'
                media_metadata = {
                    'emoji': getattr(m.sticker, 'emoji', None) if hasattr(m, 'sticker') else None,
                }
            elif m.gif: 
                media_type = 'gif'
            
            # Download media (only if download_media is True)
            media_path = None
            if download_media and messages_media_dir:
                try:
                    existing_file = list(messages_media_dir.glob(f"{m.id}.*"))
                    if existing_file:
                        media_path = str(existing_file[0].relative_to(media_dir_abs)).replace("\\", "/")
                    elif m.photo or m.sticker:
                        # Download full photo/sticker
                        downloaded = await self._client.download_media(
                            m, 
                            file=messages_media_dir / str(m.id)
                        )
                        if downloaded:
                            media_path = str(Path(downloaded).resolve().relative_to(media_dir_abs)).replace("\\", "/")
                    elif m.video or m.document or m.gif:
                        # Download just the thumbnail for videos/documents/gifs
                        thumb_path = messages_media_dir / f"{m.id}_thumb.jpg"
                        if not thumb_path.exists():
                            downloaded = await self._client.download_media(
                                m, 
                                file=thumb_path,
                                thumb=-1  # Download smallest thumb
                            )
                            if downloaded:
                                media_path = str(Path(downloaded).resolve().relative_to(media_dir_abs)).replace("\\", "/")
                        else:
                            media_path = str(thumb_path.relative_to(media_dir_abs)).replace("\\", "/")
                except Exception as e:
                    print(f"Error downloading media for message {m.id}: {e}")
            
            # Get sender info
            sender_name = "Unknown"
            try:
                sender = await m.get_sender()
                if sender:
                    if hasattr(sender, 'title'):
                        sender_name = sender.title
                    elif hasattr(sender, 'first_name'):
                        name_parts = [p for p in [sender.first_name, sender.last_name] if p]
                        sender_name = " ".join(name_parts)
                        if not sender_name and sender.username:
                            sender_name = sender.username
            except Exception:
                pass
            
            result.append(MessageInfo(
                id=m.id,
                chat_id=chat_id,
                sender_id=m.sender_id,
                sender_name=sender_name,
                sender_photo=None, 
                text=m.message,
                date=m.date,
                reply_to_msg_id=m.reply_to_msg_id,
                forward_from_id=m.fwd_from.from_id if m.fwd_from else None,
                has_media=bool(m.media),
                media_type=media_type,
                media_path=media_path,
                media_metadata=media_metadata,
                is_outgoing=m.out
            ))
            
        return result
    
    async def send_message(self, chat_id: int, text: str, reply_to: int = None) -> MessageInfo:
        """Send a message to a chat."""
        m = await self._client.send_message(chat_id, text, reply_to=reply_to)
        
        return MessageInfo(
            id=m.id,
            chat_id=chat_id,
            sender_id=m.sender_id,
            sender_name="Me",
            sender_photo=None,
            text=m.message,
            date=m.date,
            reply_to_msg_id=m.reply_to_msg_id,
            forward_from_id=None,
            has_media=False,
            media_type=None,
            media_path=None,
            media_metadata=None,
            is_outgoing=True
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
    
    async def send_message(self, chat_id: int, text: str, reply_to: int = None) -> MessageInfo:
        """Send a text message to a chat."""
        message = await self._client.send_message(
            chat_id,
            text,
            reply_to=reply_to,
        )
        
        # Get sender info
        me = await self._client.get_me()
        
        return MessageInfo(
            id=message.id,
            chat_id=chat_id,
            sender_id=me.id,
            sender_name=me.first_name,
            sender_photo=None,
            text=message.text,
            date=message.date,
            reply_to_msg_id=reply_to,
            forward_from_id=None,
            has_media=False,
            media_type=None,
            media_path=None,
            media_metadata=None,
            is_outgoing=True,
        )
    
    async def send_file(self, chat_id: int, file: str, caption: str = None, reply_to: int = None) -> MessageInfo:
        """Send a file (image, video, document) to a chat."""
        message = await self._client.send_file(
            chat_id,
            file,
            caption=caption,
            reply_to=reply_to,
        )
        
        # Get sender info
        me = await self._client.get_me()
        
        # Determine media type
        media_type = None
        if message.photo:
            media_type = "photo"
        elif message.video:
            media_type = "video"
        elif message.document:
            media_type = "document"
        
        return MessageInfo(
            id=message.id,
            chat_id=chat_id,
            sender_id=me.id,
            sender_name=me.first_name,
            sender_photo=None,
            text=caption,
            date=message.date,
            reply_to_msg_id=reply_to,
            forward_from_id=None,
            has_media=True,
            media_type=media_type,
            media_path=None,
            media_metadata=None,
            is_outgoing=True,
        )
    
    async def delete_messages(self, chat_id: int, message_ids: List[int]) -> int:
        """Delete messages from a chat. Returns number of deleted messages."""
        result = await self._client.delete_messages(chat_id, message_ids)
        # Telethon returns number of deleted messages
        return len(result) if result else 0
    
    async def forward_messages(self, to_chat_id: int, from_chat_id: int, message_ids: List[int]) -> List[Any]:
        """Forward messages to another chat. Returns list of new messages."""
        result = await self._client.forward_messages(to_chat_id, message_ids, from_chat_id)
        # Return list of forwarded messages
        if isinstance(result, list):
            return result
        return [result] if result else []


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
