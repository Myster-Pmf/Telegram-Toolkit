"""
User Profile Models

Database models for user profiling and analytics.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional, List

from src.core.database import Base


class UserProfile(Base):
    """
    Aggregated user profile across all encounters.
    
    Stores comprehensive data about a Telegram user collected
    from various chats and interactions.
    """
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(Integer, unique=True, nullable=False, index=True)
    
    # Basic info
    username = Column(String(255), nullable=True, index=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    bio = Column(Text, nullable=True)
    photo_path = Column(String(500), nullable=True)
    
    # Status flags
    is_premium = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_bot = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    is_scam = Column(Boolean, default=False)
    is_fake = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    
    # Analytics
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    total_messages = Column(Integer, default=0)
    total_chats = Column(Integer, default=0)
    
    # Risk assessment
    risk_score = Column(Float, default=0.0)  # 0.0 to 1.0
    risk_factors = Column(JSON, nullable=True)  # List of contributing factors
    
    # User-added metadata
    notes = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)  # List of string tags
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    sightings = relationship("UserSighting", back_populates="profile", cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="profile", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<UserProfile {self.telegram_id}: {self.username or self.first_name}>"


class UserSighting(Base):
    """
    Record of a user being seen in a specific chat.
    
    Tracks where and when we've encountered this user.
    """
    __tablename__ = "user_sightings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("user_profiles.id"), nullable=False, index=True)
    
    chat_id = Column(Integer, nullable=False, index=True)
    chat_title = Column(String(255), nullable=True)
    chat_type = Column(String(50), nullable=True)  # private, group, supergroup, channel
    
    # Role in chat
    is_admin = Column(Boolean, default=False)
    is_owner = Column(Boolean, default=False)
    
    # Stats in this chat
    message_count = Column(Integer, default=0)
    first_message = Column(DateTime, nullable=True)
    last_message = Column(DateTime, nullable=True)
    
    # Timestamps
    first_seen_in_chat = Column(DateTime, default=datetime.utcnow)
    last_seen_in_chat = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    profile = relationship("UserProfile", back_populates="sightings")
    
    def __repr__(self):
        return f"<UserSighting {self.profile_id} in {self.chat_id}>"


class UserActivity(Base):
    """
    Hourly activity aggregation for pattern analysis.
    
    Stores message counts per hour for activity heatmaps.
    """
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("user_profiles.id"), nullable=False, index=True)
    
    # Time bucket
    date = Column(DateTime, nullable=False)  # Date only (no time)
    hour = Column(Integer, nullable=False)   # 0-23
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    
    # Activity counts
    message_count = Column(Integer, default=0)
    avg_message_length = Column(Float, default=0.0)
    
    # Relationship
    profile = relationship("UserProfile", back_populates="activities")
    
    def __repr__(self):
        return f"<UserActivity {self.profile_id} @ {self.date} {self.hour}:00>"


class UserConnection(Base):
    """
    Relationship between two users based on interactions.
    
    Tracks who interacts with whom and how often.
    """
    __tablename__ = "user_connections"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # The two users (user_a_id < user_b_id to avoid duplicates)
    user_a_id = Column(Integer, nullable=False, index=True)
    user_b_id = Column(Integer, nullable=False, index=True)
    
    # Where they interact
    chat_id = Column(Integer, nullable=False)
    chat_title = Column(String(255), nullable=True)
    
    # Interaction strength
    interaction_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)  # Direct replies to each other
    mention_count = Column(Integer, default=0)  # @mentions
    
    # Timestamps
    first_interaction = Column(DateTime, default=datetime.utcnow)
    last_interaction = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<UserConnection {self.user_a_id} <-> {self.user_b_id}>"
