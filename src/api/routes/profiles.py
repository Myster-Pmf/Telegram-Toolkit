"""
User Profiles Routes

API endpoints for user profiling and analytics.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from src.core.database import get_db
from src.models.user_profiles import UserProfile, UserSighting, UserActivity, UserConnection
from src.services.profile_service import ProfileService, RiskAnalyzer
from src.telegram.session_manager import session_manager

router = APIRouter()


# Response Models
class ProfileResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    bio: Optional[str]
    photo_path: Optional[str]
    is_premium: bool
    is_verified: bool
    is_bot: bool
    is_deleted: bool
    first_seen: datetime
    last_seen: datetime
    total_messages: int
    total_chats: int
    risk_score: float
    risk_factors: Optional[List[str]]
    notes: Optional[str]
    tags: Optional[List[str]]
    is_pinned: bool

    class Config:
        from_attributes = True


class ProfileListResponse(BaseModel):
    profiles: List[ProfileResponse]
    total: int
    page: int
    page_size: int


class ActivityPatternResponse(BaseModel):
    hourly_activity: List[int]  # 24 hours
    daily_activity: List[int]   # 7 days
    total_messages: int
    avg_message_length: float
    peak_hour: Optional[int]
    peak_day: Optional[str]


class ChatSightingResponse(BaseModel):
    chat_id: int
    chat_title: Optional[str]
    chat_type: Optional[str]
    is_admin: bool
    is_owner: bool
    message_count: int
    first_seen: Optional[str]
    last_seen: Optional[str]


class ConnectionResponse(BaseModel):
    user_id: int
    username: Optional[str]
    name: Optional[str]
    photo_path: Optional[str]
    interaction_count: int
    reply_count: int
    chat_id: int
    chat_title: Optional[str]
    last_interaction: Optional[str]


class UpdateNotesRequest(BaseModel):
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class ScanResultResponse(BaseModel):
    profiles_created: int
    profiles_updated: int
    sightings_recorded: int


# Endpoints

@router.get("/", response_model=ProfileListResponse)
async def list_profiles(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1),
    search: Optional[str] = None,
    min_risk: Optional[float] = Query(None, ge=0.0, le=1.0),
    sort_by: str = Query("last_seen", regex="^(last_seen|risk_score|total_messages|first_seen)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
):
    """
    List all known user profiles with filtering and pagination.
    """
    async with get_db() as db:
        query = select(UserProfile)
        
        # Apply search filter
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    UserProfile.username.ilike(search_pattern),
                    UserProfile.first_name.ilike(search_pattern),
                    UserProfile.last_name.ilike(search_pattern),
                    UserProfile.phone.ilike(search_pattern),
                )
            )
        
        # Apply risk filter
        if min_risk is not None:
            query = query.where(UserProfile.risk_score >= min_risk)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply sorting (Pinned users always come first)
        query = query.order_by(UserProfile.is_pinned.desc())
        
        sort_column = getattr(UserProfile, sort_by)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        result = await db.execute(query)
        profiles = result.scalars().all()
        
        return ProfileListResponse(
            profiles=[ProfileResponse.model_validate(p) for p in profiles],
            total=total,
            page=page,
            page_size=page_size,
        )


@router.get("/stats")
async def get_profile_stats():
    """Get overall profile statistics."""
    async with get_db() as db:
        total = await db.execute(select(func.count(UserProfile.id)))
        high_risk = await db.execute(
            select(func.count(UserProfile.id)).where(UserProfile.risk_score >= 0.5)
        )
        premium = await db.execute(
            select(func.count(UserProfile.id)).where(UserProfile.is_premium == True)
        )
        bots = await db.execute(
            select(func.count(UserProfile.id)).where(UserProfile.is_bot == True)
        )
        
        return {
            "total_profiles": total.scalar(),
            "high_risk_count": high_risk.scalar(),
            "premium_count": premium.scalar(),
            "bot_count": bots.scalar(),
        }


@router.get("/{telegram_id}", response_model=ProfileResponse)
async def get_profile(telegram_id: int):
    """Get detailed profile for a user."""
    async with get_db() as db:
        result = await db.execute(
            select(UserProfile).where(UserProfile.telegram_id == telegram_id)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return ProfileResponse.model_validate(profile)


@router.get("/{telegram_id}/activity", response_model=ActivityPatternResponse)
async def get_activity_patterns(telegram_id: int):
    """Get activity pattern analysis for a user."""
    async with get_db() as db:
        # Get profile ID
        result = await db.execute(
            select(UserProfile.id).where(UserProfile.telegram_id == telegram_id)
        )
        profile_id = result.scalar_one_or_none()
        
        if not profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        patterns = await ProfileService.get_activity_patterns(db, profile_id)
        return ActivityPatternResponse(**patterns)


@router.get("/{telegram_id}/chats", response_model=List[ChatSightingResponse])
async def get_user_chats(telegram_id: int):
    """Get all chats where this user appears."""
    async with get_db() as db:
        # Get profile ID
        result = await db.execute(
            select(UserProfile.id).where(UserProfile.telegram_id == telegram_id)
        )
        profile_id = result.scalar_one_or_none()
        
        if not profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        chats = await ProfileService.get_user_chats(db, profile_id)
        return [ChatSightingResponse(**c) for c in chats]


@router.get("/{telegram_id}/connections", response_model=List[ConnectionResponse])
async def get_connections(telegram_id: int, limit: int = Query(50, ge=1, le=200)):
    """Get users this person interacts with most."""
    async with get_db() as db:
        connections = await ProfileService.get_connections(db, telegram_id, limit)
        return [ConnectionResponse(**c) for c in connections]


@router.put("/{telegram_id}/notes", response_model=ProfileResponse)
async def update_notes(telegram_id: int, request: UpdateNotesRequest):
    """Update notes and tags for a user profile."""
    async with get_db() as db:
        result = await db.execute(
            select(UserProfile).where(UserProfile.telegram_id == telegram_id)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        if request.notes is not None:
            profile.notes = request.notes
        if request.tags is not None:
            profile.tags = request.tags
        
        profile.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(profile)
        
        return ProfileResponse.model_validate(profile)


@router.post("/{telegram_id}/analyze", response_model=ProfileResponse)
async def analyze_profile(telegram_id: int):
    """Re-analyze a profile and update risk score."""
    async with get_db() as db:
        result = await db.execute(
            select(UserProfile).where(UserProfile.telegram_id == telegram_id)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        profile = await RiskAnalyzer.analyze_and_update(db, profile)
        return ProfileResponse.model_validate(profile)


@router.post("/{telegram_id}/pin")
async def toggle_pin(telegram_id: int):
    """Toggle the pinned status of a user profile."""
    async with get_db() as db:
        result = await db.execute(
            select(UserProfile).where(UserProfile.telegram_id == telegram_id)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        profile.is_pinned = not profile.is_pinned
        await db.commit()
        
        return {"telegram_id": telegram_id, "is_pinned": profile.is_pinned}


@router.post("/scan/{chat_id}", response_model=ScanResultResponse)
async def scan_chat_members(chat_id: int, background_tasks: BackgroundTasks):
    """
    Scan all members of a chat and build/update their profiles.
    """
    try:
        client = await session_manager.get_client()
        
        # Get chat members
        members = await client.get_chat_members(chat_id, limit=500)
        chat_info = await client.get_chat(chat_id)
        
        profiles_created = 0
        profiles_updated = 0
        sightings_recorded = 0
        
        async with get_db() as db:
            for member in members:
                # Check if profile exists
                result = await db.execute(
                    select(UserProfile).where(UserProfile.telegram_id == member.id)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    profiles_updated += 1
                else:
                    profiles_created += 1
                
                # Create/update profile
                profile = await ProfileService.get_or_create_profile(
                    db,
                    telegram_id=member.id,
                    username=member.username,
                    first_name=member.first_name,
                    last_name=member.last_name,
                    is_bot=member.is_bot,
                    is_premium=getattr(member, 'is_premium', False),
                    is_verified=getattr(member, 'is_verified', False),
                )
                
                # Record sighting
                await ProfileService.record_sighting(
                    db,
                    profile_id=profile.id,
                    chat_id=chat_id,
                    chat_title=chat_info.title if chat_info else None,
                    chat_type=chat_info.chat_type if chat_info else None,
                )
                sightings_recorded += 1
                
                # Analyze risk
                await RiskAnalyzer.analyze_and_update(db, profile)
        
        return ScanResultResponse(
            profiles_created=profiles_created,
            profiles_updated=profiles_updated,
            sightings_recorded=sightings_recorded,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


@router.get("/duplicates/find")
async def find_duplicate_accounts(
    min_similarity: float = Query(0.7, ge=0.0, le=1.0),
):
    """
    Find potential duplicate accounts (same person, different accounts).
    
    Matches by similar names, shared phone numbers, etc.
    """
    async with get_db() as db:
        # Get all profiles with phone numbers
        result = await db.execute(
            select(UserProfile).where(UserProfile.phone.isnot(None))
        )
        profiles_with_phone = result.scalars().all()
        
        # Group by phone
        phone_groups = {}
        for p in profiles_with_phone:
            if p.phone:
                if p.phone not in phone_groups:
                    phone_groups[p.phone] = []
                phone_groups[p.phone].append({
                    "telegram_id": p.telegram_id,
                    "username": p.username,
                    "name": f"{p.first_name or ''} {p.last_name or ''}".strip(),
                })
        
        # Find duplicates (same phone, multiple accounts)
        duplicates = []
        for phone, accounts in phone_groups.items():
            if len(accounts) > 1:
                duplicates.append({
                    "match_type": "phone",
                    "match_value": phone[-4:].rjust(len(phone), '*'),  # Mask most of phone
                    "accounts": accounts,
                })
        
        return {
            "duplicates": duplicates,
            "total_found": len(duplicates),
        }
