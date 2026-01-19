"""
Event Model

Logs all tracked events (username changes, joins, leaves, edits, etc.)
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Text, Integer, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Event(Base):
    """
    Event log storage.
    
    Tracks all observable changes and activities.
    """
    
    __tablename__ = "events"
    
    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Event type
    event_type: Mapped[str] = mapped_column(
        String(100), 
        nullable=False,
        index=True,
        comment="username_change, name_change, bio_change, photo_change, join, leave, message_edit, message_delete, status_online, status_offline"
    )
    
    # Related entities (nullable - depends on event type)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    chat_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("chats.id"), nullable=True, index=True
    )
    message_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("messages.id"), nullable=True
    )
    
    # Change details
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Additional context (named extra_data to avoid SQLAlchemy reserved 'metadata')
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Which session observed this
    session_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sessions.id"), nullable=True
    )
    
    # Timestamps
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<Event(id={self.id}, type='{self.event_type}', user_id={self.user_id})>"
