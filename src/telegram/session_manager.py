"""
Session Manager

Manages multiple Telegram accounts with fast switching.
Handles authentication, session storage, and export.
"""

from datetime import datetime
from typing import Optional, List, Dict
from dataclasses import dataclass
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.core.encryption import encrypt_data, decrypt_data
from src.models.session import Session as SessionModel
from src.telegram.client import TelegramClient, get_client, UserInfo


@dataclass
class SessionInfo:
    """Information about a stored session."""
    id: int
    name: str
    auth_type: str
    telegram_user_id: Optional[int]
    username: Optional[str]
    phone: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    is_bot: bool
    is_active: bool
    is_connected: bool
    created_at: datetime
    last_used_at: Optional[datetime]


@dataclass
class CodeRequest:
    """Result of requesting an OTP code."""
    phone_code_hash: str
    phone: str


@dataclass
class QRLoginSession:
    """QR login session data."""
    session_id: int
    qr_data: bytes


class SessionManager:
    """
    Manages multiple Telegram sessions.
    
    Features:
    - Add/remove accounts
    - Fast switching between accounts
    - Session import/export
    - Phone + OTP authentication
    - QR code authentication
    """
    
    def __init__(self):
        # Active clients cache: session_id -> TelegramClient
        self._clients: Dict[int, TelegramClient] = {}
        # Current active session
        self._active_session_id: Optional[int] = None
        # Pending auth states
        self._pending_auth: Dict[str, dict] = {}
    
    # ==================== Session CRUD ====================
    
    async def list_sessions(self) -> List[SessionInfo]:
        """List all stored sessions."""
        async with get_db() as db:
            result = await db.execute(
                select(SessionModel).order_by(SessionModel.created_at.desc())
            )
            sessions = result.scalars().all()
            
            return [
                SessionInfo(
                    id=s.id,
                    name=s.name,
                    auth_type=s.auth_type,
                    telegram_user_id=s.telegram_user_id,
                    username=s.username,
                    phone=s.phone,
                    first_name=s.first_name,
                    last_name=s.last_name,
                    is_bot=s.is_bot,
                    is_active=s.is_active,
                    is_connected=s.id in self._clients and await self._clients[s.id].is_connected(),
                    created_at=s.created_at,
                    last_used_at=s.last_used_at,
                )
                for s in sessions
            ]
    
    async def get_session(self, session_id: int) -> Optional[SessionInfo]:
        """Get a specific session by ID."""
        async with get_db() as db:
            result = await db.execute(
                select(SessionModel).where(SessionModel.id == session_id)
            )
            s = result.scalar_one_or_none()
            if not s:
                return None
            
            return SessionInfo(
                id=s.id,
                name=s.name,
                auth_type=s.auth_type,
                telegram_user_id=s.telegram_user_id,
                username=s.username,
                phone=s.phone,
                first_name=s.first_name,
                last_name=s.last_name,
                is_bot=s.is_bot,
                is_active=s.is_active,
                is_connected=s.id in self._clients,
                created_at=s.created_at,
                last_used_at=s.last_used_at,
            )
    
    async def remove_session(self, session_id: int) -> bool:
        """Remove a session and disconnect if active."""
        # Disconnect if connected
        if session_id in self._clients:
            await self._clients[session_id].disconnect()
            del self._clients[session_id]
        
        # Remove from database
        async with get_db() as db:
            result = await db.execute(
                select(SessionModel).where(SessionModel.id == session_id)
            )
            session = result.scalar_one_or_none()
            if session:
                await db.delete(session)
                return True
        return False
    
    # ==================== Phone + OTP Auth ====================
    
    async def request_code(self, phone: str, name: str = None) -> CodeRequest:
        """
        Request OTP code for phone number authentication.
        
        Args:
            phone: Phone number with country code (e.g., +1234567890)
            name: Optional name for this session
            
        Returns:
            CodeRequest with phone_code_hash needed for verification
        """
        # Create a temporary client
        client = get_client()
        await client.connect()
        
        # Request code
        phone_code_hash = await client.send_code_request(phone)
        
        # Store pending auth state
        self._pending_auth[phone] = {
            'client': client,
            'phone_code_hash': phone_code_hash,
            'name': name or f"Account {phone[-4:]}",
            'phone': phone,
        }
        
        return CodeRequest(
            phone_code_hash=phone_code_hash,
            phone=phone,
        )
    
    async def verify_code(
        self, 
        phone: str, 
        code: str, 
        password: str = None
    ) -> SessionInfo:
        """
        Verify OTP code and complete authentication.
        
        Args:
            phone: Phone number used in request_code
            code: OTP code received via Telegram
            password: 2FA password if enabled
            
        Returns:
            SessionInfo for the newly authenticated session
        """
        if phone not in self._pending_auth:
            raise ValueError("No pending authentication for this phone. Call request_code first.")
        
        auth_state = self._pending_auth[phone]
        client = auth_state['client']
        
        try:
            # Sign in
            user = await client.sign_in(
                phone,
                code,
                auth_state['phone_code_hash'],
                password=password,
            )
            
            # Export session string
            session_string = await client.export_session_string()
            
            # Save to database
            async with get_db() as db:
                session = SessionModel(
                    name=auth_state['name'],
                    auth_type='phone_code',
                    session_data_encrypted=encrypt_data(session_string),
                    api_id=settings.telegram_api_id,
                    api_hash=settings.telegram_api_hash,
                    telegram_user_id=user.id,
                    username=user.username,
                    phone=phone,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    is_bot=user.is_bot,
                    is_active=True,
                    is_connected=True,
                    last_used_at=datetime.utcnow(),
                )
                db.add(session)
                await db.flush()
                session_id = session.id
            
            # Cache the client
            self._clients[session_id] = client
            self._active_session_id = session_id
            
            # Clean up pending auth
            del self._pending_auth[phone]
            
            return await self.get_session(session_id)
            
        except Exception as e:
            # Disconnect on failure
            await client.disconnect()
            raise
    
    # ==================== Session String Import ====================
    
    async def import_session_string(
        self, 
        session_string: str, 
        name: str = None
    ) -> SessionInfo:
        """
        Import an existing session string.
        
        Args:
            session_string: Telethon session string
            name: Optional name for this session
            
        Returns:
            SessionInfo for the imported session
        """
        # Create client with session
        client = get_client(session=session_string)
        await client.connect()
        
        if not await client._client.is_user_authorized():
            await client.disconnect()
            raise ValueError("Session string is invalid or expired")
        
        # Get user info
        user = await client.get_me()
        
        # Save to database
        async with get_db() as db:
            session = SessionModel(
                name=name or f"Imported {user.username or user.first_name}",
                auth_type='session_string',
                session_data_encrypted=encrypt_data(session_string),
                api_id=settings.telegram_api_id,
                api_hash=settings.telegram_api_hash,
                telegram_user_id=user.id,
                username=user.username,
                phone=user.phone,
                first_name=user.first_name,
                last_name=user.last_name,
                is_bot=user.is_bot,
                is_active=True,
                is_connected=True,
                last_used_at=datetime.utcnow(),
            )
            db.add(session)
            await db.flush()
            session_id = session.id
        
        # Cache the client
        self._clients[session_id] = client
        self._active_session_id = session_id
        
        return await self.get_session(session_id)
    
    # ==================== Session Export ====================
    
    async def export_session_string(self, session_id: int) -> str:
        """Export a session as a Telethon-compatible string."""
        # Get from cache if connected
        if session_id in self._clients:
            return await self._clients[session_id].export_session_string()
        
        # Otherwise get from database
        async with get_db() as db:
            result = await db.execute(
                select(SessionModel).where(SessionModel.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                raise ValueError(f"Session {session_id} not found")
            
            return decrypt_data(session.session_data_encrypted)
    
    # ==================== Client Management ====================
    
    async def get_client(self, session_id: int = None) -> TelegramClient:
        """
        Get a connected Telegram client for a session.
        
        Args:
            session_id: Session ID, or None for active session
            
        Returns:
            Connected TelegramClient
        """
        if session_id is None:
            session_id = self._active_session_id
        
        if session_id is None:
            raise ValueError("No active session. Connect to an account first.")
        
        # Return cached client if available
        if session_id in self._clients:
            client = self._clients[session_id]
            if await client.is_connected():
                return client
        
        # Load and connect
        async with get_db() as db:
            result = await db.execute(
                select(SessionModel).where(SessionModel.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                raise ValueError(f"Session {session_id} not found")
            
            # Decrypt session string
            session_string = decrypt_data(session.session_data_encrypted)
            
            # Create and connect client
            client = get_client(session=session_string)
            await client.connect()
            
            # Update last used
            session.last_used_at = datetime.utcnow()
            session.is_connected = True
            
            # Cache
            self._clients[session_id] = client
            
            return client
    
    async def switch_session(self, session_id: int) -> SessionInfo:
        """Switch the active session."""
        # Verify session exists
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Connect if not already
        await self.get_client(session_id)
        
        # Set as active
        self._active_session_id = session_id
        
        return session
    
    @property
    def active_session_id(self) -> Optional[int]:
        """Get the current active session ID."""
        return self._active_session_id
    
    async def disconnect_all(self) -> None:
        """Disconnect all active clients."""
        for session_id, client in self._clients.items():
            try:
                await client.disconnect()
            except Exception:
                pass
        self._clients.clear()
        self._active_session_id = None


# Global session manager instance
session_manager = SessionManager()
