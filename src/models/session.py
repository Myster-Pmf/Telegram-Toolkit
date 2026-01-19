"""
Session Model

Stores Telegram account sessions for multi-account support.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, LargeBinary, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Session(Base):
    """
    Telegram session/account storage.
    
    Supports multiple accounts with different authentication methods.
    Session data is encrypted at rest.
    """
    
    __tablename__ = "sessions"
    
    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # User-defined name for this session
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Authentication type
    auth_type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        comment="phone_code, qr_code, session_string, session_file, bot_token"
    )
    
    # Encrypted session data (Telethon session string or equivalent)
    session_data_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=True)
    
    # Telegram API credentials (per-session, can override global)
    api_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    api_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Account info (populated after successful login)
    telegram_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Status
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Notes/description
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    def __repr__(self) -> str:
        return f"<Session(id={self.id}, name='{self.name}', username='{self.username}')>"
