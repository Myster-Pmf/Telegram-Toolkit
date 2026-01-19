"""
Message Model

Stores messages from monitored chats with edit history.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Text, Integer, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Message(Base):
    """
    Telegram message storage.
    
    Stores message content, media references, and tracks edits/deletions.
    """
    
    __tablename__ = "messages"
    
    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Telegram message ID (unique within a chat)
    telegram_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    
    # Chat reference
    chat_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("chats.id"), nullable=False, index=True
    )
    
    # Sender
    sender_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    
    # Content
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    text_translated: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Formatting entities (bold, links, etc.)
    entities: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # Reply/Forward info
    reply_to_msg_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    forward_from_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    forward_from_chat_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    forward_from_msg_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Media (if any)
    has_media: Mapped[bool] = mapped_column(Boolean, default=False)
    media_type: Mapped[Optional[str]] = mapped_column(
        String(50), 
        nullable=True,
        comment="photo, video, document, voice, audio, sticker, animation"
    )
    
    # Engagement
    views: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    forwards: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reactions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Edit/Delete tracking
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    edit_history: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, comment="Array of previous versions with timestamps"
    )
    
    # Timestamps
    sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    
    # Which session captured this
    session_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sessions.id"), nullable=True
    )
    
    def __repr__(self) -> str:
        preview = self.text[:50] + "..." if self.text and len(self.text) > 50 else self.text
        return f"<Message(id={self.id}, chat_id={self.chat_id}, text='{preview}')>"
