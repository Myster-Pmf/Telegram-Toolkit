"""
Chat Model

Stores information about chats, channels, and groups.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Text, Integer, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Chat(Base):
    """
    Telegram chat/channel/group storage.
    
    Stores metadata and monitoring settings for each chat.
    """
    
    __tablename__ = "chats"
    
    # Primary key - Telegram chat ID
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    
    # Chat type
    chat_type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        comment="private, group, supergroup, channel"
    )
    
    # Basic info
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # For private chats - the other user
    peer_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Group/Channel info
    member_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Photo
    photo_file_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    photo_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Monitoring settings
    is_monitored: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_download_media: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_translate: Mapped[bool] = mapped_column(Boolean, default=False)
    translate_to: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    
    # Which of our sessions has access to this chat
    session_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sessions.id"), nullable=True
    )
    
    # Statistics
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<Chat(id={self.id}, title='{self.title}', type='{self.chat_type}')>"
