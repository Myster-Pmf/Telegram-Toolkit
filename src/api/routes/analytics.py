"""
Analytics Routes

Cross-account analysis and statistics.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

from sqlalchemy import select, func
from src.core.database import get_db
from src.models.user import User
from src.models.chat import Chat
from src.models.message import Message
from src.models.session import Session
from src.models.event import Event
from src.telegram.session_manager import session_manager

router = APIRouter()


class OverviewStats(BaseModel):
    """Overview statistics."""
    total_sessions: int
    active_sessions: int
    total_chats: int
    total_users: int
    total_messages: int
    total_events: int
    storage_usage_mb: float


class CrossAccountUser(BaseModel):
    """User found across multiple accounts."""
    user_id: int
    username: Optional[str]
    first_name: Optional[str]
    seen_in_sessions: List[int]
    shared_chats: int
    total_messages: int


@router.get("/overview", response_model=OverviewStats)
async def get_overview():
    """
    Get overview statistics across all accounts.
    """
    async with get_db() as db:
        # Count sessions
        sessions_result = await db.execute(select(func.count(Session.id)))
        total_sessions = sessions_result.scalar() or 0
        
        active_sessions_list = await session_manager.list_sessions()
        active_sessions = len([s for s in active_sessions_list if s.is_connected])
        
        # Count chats
        chats_result = await db.execute(select(func.count(Chat.id)))
        total_chats = chats_result.scalar() or 0
        
        # Count users
        users_result = await db.execute(select(func.count(User.id)))
        total_users = users_result.scalar() or 0
        
        # Count messages
        messages_result = await db.execute(select(func.count(Message.id)))
        total_messages = messages_result.scalar() or 0

        # Count events
        events_result = await db.execute(select(func.count(Event.id)))
        total_events = events_result.scalar() or 0
        
        # Calculation for storage (rough estimate)
        storage_usage_mb = 120.4 # Placeholder
        
        return OverviewStats(
            total_sessions=total_sessions,
            active_sessions=active_sessions,
            total_chats=total_chats,
            total_users=total_users,
            total_messages=total_messages,
            total_events=total_events,
            storage_usage_mb=storage_usage_mb,
        )


@router.get("/cross-account/users", response_model=List[CrossAccountUser])
async def get_cross_account_users(
    min_sessions: int = Query(default=2, ge=2),
    limit: int = Query(default=50, ge=1, le=200),
):
    """
    Find users that appear across multiple accounts.
    
    Useful for identifying users present in multiple of your accounts.
    """
    async with get_db() as db:
        # Find users seen by multiple sessions
        result = await db.execute(
            select(User)
            .where(User.discovered_by_session_ids.isnot(None))
            .limit(limit)
        )
        users = result.scalars().all()
        
        cross_users = []
        for user in users:
            session_ids = user.discovered_by_session_ids or []
            if len(session_ids) >= min_sessions:
                cross_users.append(CrossAccountUser(
                    user_id=user.id,
                    username=user.username,
                    first_name=user.first_name,
                    seen_in_sessions=session_ids,
                    shared_chats=0,  # TODO: Calculate actual shared chats
                    total_messages=user.message_count,
                ))
        
        return cross_users


@router.get("/activity/recent")
async def get_recent_activity(
    limit: int = Query(default=10, ge=1, le=100),
):
    """
    Get recent activity events across all sessions.
    """
    async with get_db() as db:
        # Fetch recent events
        result = await db.execute(
            select(Event)
            .order_by(Event.occurred_at.desc())
            .limit(limit)
        )
        events = result.scalars().all()
        
        # Also fetch recent messages as "activity"
        result_msg = await db.execute(
            select(Message)
            .order_by(Message.sent_at.desc())
            .limit(limit)
        )
        messages = result_msg.scalars().all()
        
        # Combine and sort
        activity = []
        for ev in events:
            activity.append({
                "id": f"ev_{ev.id}",
                "type": ev.event_type,
                "title": ev.event_type.replace("_", " ").title(),
                "desc": f"Observed in session {ev.session_id}",
                "time": ev.occurred_at.isoformat(),
                "icon": "activity"
            })
            
        for msg in messages:
            activity.append({
                "id": f"msg_{msg.id}",
                "type": "message",
                "title": "New Message captured",
                "desc": (msg.text[:50] + "...") if msg.text and len(msg.text) > 50 else (msg.text or "Media message"),
                "time": msg.sent_at.isoformat(),
                "icon": "message"
            })
            
        # Sort by time desc
        activity.sort(key=lambda x: x["time"], reverse=True)
        return activity[:limit]


@router.get("/activity/history")
async def get_activity_history(
    days: int = Query(default=7, ge=1, le=30),
):
    """
    Get message volume history for charts.
    """
    # Group messages by day
    # This is a bit complex in SQLite/Postgres across dialects, 
    # but let's do a simple count for the last N days.
    async with get_db() as db:
        # Mocking for now as complex grouping is dialect-dependent
        # In a real app we'd use func.date() or similar
        return [
            {"date": "2026-01-15", "count": 120},
            {"date": "2026-01-16", "count": 150},
            {"date": "2026-01-17", "count": 110},
            {"date": "2026-01-18", "count": 230},
            {"date": "2026-01-19", "count": 190},
            {"date": "2026-01-20", "count": 250},
            {"date": "2026-01-21", "count": 310},
        ]


@router.get("/activity/{session_id}")
async def get_session_activity(
    session_id: int,
    days: int = Query(default=7, ge=1, le=90),
):
    """
    Get activity statistics for a specific session.
    
    Returns message counts and activity patterns.
    """
    # TODO: Implement activity statistics
    # This would aggregate messages by day/hour
    return {
        "session_id": session_id,
        "period_days": days,
        "message_count": 0,
        "active_chats": 0,
        "hourly_distribution": {},
        "daily_distribution": {},
    }
