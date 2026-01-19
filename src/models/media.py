"""
Media Model

Stores downloaded media files with metadata.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Integer, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Media(Base):
    """
    Media file storage.
    
    Tracks downloaded media with metadata and optional encryption.
    """
    
    __tablename__ = "media"
    
    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Reference to message
    message_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("messages.id"), nullable=True
    )
    
    # Telegram file reference
    file_id: Mapped[str] = mapped_column(String(255), nullable=False)
    file_unique_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Media type
    media_type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        comment="photo, video, document, voice, audio, sticker, animation, video_note"
    )
    
    # File info
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Dimensions (for images/videos)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Thumbnail
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Encryption
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Download status
    is_downloaded: Mapped[bool] = mapped_column(Boolean, default=False)
    download_error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Additional metadata (named extra_data to avoid conflict with SQLAlchemy's reserved 'metadata')
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    downloaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    def __repr__(self) -> str:
        return f"<Media(id={self.id}, type='{self.media_type}', file='{self.file_name}')>"
