"""
User Model

Stores information about Telegram users discovered across all monitored chats.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Text, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class User(Base):
    """
    Telegram user profile storage.
    
    Collects user data from all monitored chats and accounts.
    Supports cross-account analysis.
    """
    
    __tablename__ = "users"
    
    # Primary key - Telegram user ID (globally unique)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    
    # Basic info
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Profile photo
    photo_file_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    photo_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Account flags
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    is_scam: Mapped[bool] = mapped_column(Boolean, default=False)
    is_fake: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Analysis results
    fake_score: Mapped[float] = mapped_column(Float, default=0.0)
    personality_analysis: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Activity tracking
    first_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Which of our accounts discovered this user
    discovered_by_session_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # History tracking (JSON arrays)
    username_history: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    name_history: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}')>"
