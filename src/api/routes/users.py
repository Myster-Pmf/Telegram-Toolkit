"""
Users Routes

Access and analyze Telegram user profiles.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from sqlalchemy import select
from src.core.database import get_db
from src.models.user import User
from src.telegram.session_manager import session_manager

router = APIRouter()


class UserResponse(BaseModel):
    """User profile response."""
    id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    bio: Optional[str]
    is_bot: bool
    is_premium: bool
    is_verified: bool


class UserProfileResponse(BaseModel):
    """Extended user profile from database."""
    id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    bio: Optional[str]
    is_bot: bool
    is_verified: bool
    is_premium: bool
    is_pinned: bool
    fake_score: float
    message_count: int
    first_seen_at: Optional[datetime]
    last_seen_at: Optional[datetime]
    last_message_at: Optional[datetime]


@router.get("/lookup/{user_id}", response_model=UserResponse)
async def lookup_user(
    user_id: int,
    session_id: Optional[int] = None,
):
    """
    Lookup a user directly from Telegram.
    
    Gets real-time information about a user by their ID.
    """
    try:
        client = await session_manager.get_client(session_id)
        user = await client.get_user(user_id)
        
        return UserResponse(
            id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            bio=None,  # Bio requires additional API call
            is_bot=user.is_bot,
            is_premium=user.is_premium,
            is_verified=user.is_verified,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to lookup user: {str(e)}")


@router.get("/", response_model=List[UserProfileResponse])
async def list_known_users(
    limit: int = Query(default=100, ge=1),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = None,
):
    """
    List known users from the database.
    
    Returns users that have been seen in monitored chats.
    """
    async with get_db() as db:
        query = (
            select(User)
            .order_by(User.is_pinned.desc())
            .order_by(User.last_seen_at.desc().nulls_last())
        )
        
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                (User.username.ilike(search_pattern)) |
                (User.first_name.ilike(search_pattern)) |
                (User.last_name.ilike(search_pattern))
            )
        
        query = query.offset(offset).limit(limit)
        result = await db.execute(query)
        users = result.scalars().all()
        
        return [
            UserProfileResponse(
                id=u.id,
                username=u.username,
                first_name=u.first_name,
                last_name=u.last_name,
                phone=u.phone,
                bio=u.bio,
                is_bot=u.is_bot,
                is_verified=u.is_verified,
                is_premium=u.is_premium,
                is_pinned=u.is_pinned,
                fake_score=u.fake_score,
                message_count=u.message_count,
                first_seen_at=u.first_seen_at,
                last_seen_at=u.last_seen_at,
                last_message_at=u.last_message_at,
            )
            for u in users
        ]


@router.post("/{user_id}/pin")
async def toggle_user_pin(user_id: int):
    """Toggle a user's pinned status."""
    async with get_db() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        user.is_pinned = not user.is_pinned
        await db.commit()
        
        return {"id": user.id, "is_pinned": user.is_pinned}


@router.get("/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(user_id: int):
    """
    Get a user's profile from the database.
    
    Returns stored information and analysis for a user.
    """
    async with get_db() as db:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found in database")
        
        return UserProfileResponse(
            id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            bio=user.bio,
            is_bot=user.is_bot,
            is_verified=user.is_verified,
            is_premium=user.is_premium,
            is_pinned=user.is_pinned,
            fake_score=user.fake_score,
            message_count=user.message_count,
            first_seen_at=user.first_seen_at,
            last_seen_at=user.last_seen_at,
            last_message_at=user.last_message_at,
        )
