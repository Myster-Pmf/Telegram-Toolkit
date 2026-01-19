"""
Archive Model

Stores full account snapshots/archives for later viewing.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Text, Integer, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Archive(Base):
    """
    Account archive/snapshot storage.
    
    Stores metadata about full account archives that can be restored/viewed.
    Actual data is stored in separate archive files.
    """
    
    __tablename__ = "archives"
    
    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Archive name/description
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Which session this archive is for
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sessions.id"), nullable=False
    )
    
    # Archive type
    archive_type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        default="full",
        comment="full, chats_only, media_only, selective"
    )
    
    # Archive file location
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Archive contents summary
    stats: Mapped[Optional[dict]] = mapped_column(
        JSON, 
        nullable=True,
        comment="Contains counts: chats, messages, media, users"
    )
    
    # What's included
    included_chat_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # Encryption
    is_encrypted: Mapped[bool] = mapped_column(default=False)
    
    # Status
    status: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        default="pending",
        comment="pending, in_progress, completed, failed"
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Progress (0-100)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Archive point in time
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False,
        comment="The point in time this archive represents"
    )
    
    def __repr__(self) -> str:
        return f"<Archive(id={self.id}, name='{self.name}', status='{self.status}')>"
