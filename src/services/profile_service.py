"""
Profile Service

Handles user profile building, aggregation, and analysis.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_, or_
from sqlalchemy.orm import selectinload
import re

from src.models.user_profiles import UserProfile, UserSighting, UserActivity, UserConnection
from src.core.database import get_db_session


class ProfileService:
    """Service for managing user profiles."""
    
    @staticmethod
    async def get_or_create_profile(
        db: AsyncSession,
        telegram_id: int,
        **user_data
    ) -> UserProfile:
        """Get existing profile or create new one."""
        result = await db.execute(
            select(UserProfile).where(UserProfile.telegram_id == telegram_id)
        )
        profile = result.scalar_one_or_none()
        
        if profile:
            # Update with new data
            for key, value in user_data.items():
                if value is not None and hasattr(profile, key):
                    setattr(profile, key, value)
            profile.last_seen = datetime.utcnow()
            profile.updated_at = datetime.utcnow()
        else:
            # Create new profile
            profile = UserProfile(
                telegram_id=telegram_id,
                **user_data,
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow(),
            )
            db.add(profile)
        
        await db.commit()
        await db.refresh(profile)
        return profile
    
    @staticmethod
    async def record_sighting(
        db: AsyncSession,
        profile_id: int,
        chat_id: int,
        chat_title: str = None,
        chat_type: str = None,
        is_admin: bool = False,
        is_owner: bool = False,
    ) -> UserSighting:
        """Record that a user was seen in a chat."""
        result = await db.execute(
            select(UserSighting).where(
                and_(
                    UserSighting.profile_id == profile_id,
                    UserSighting.chat_id == chat_id
                )
            )
        )
        sighting = result.scalar_one_or_none()
        
        now = datetime.utcnow()
        
        if sighting:
            sighting.last_seen_in_chat = now
            sighting.chat_title = chat_title or sighting.chat_title
            sighting.is_admin = is_admin
            sighting.is_owner = is_owner
        else:
            sighting = UserSighting(
                profile_id=profile_id,
                chat_id=chat_id,
                chat_title=chat_title,
                chat_type=chat_type,
                is_admin=is_admin,
                is_owner=is_owner,
                first_seen_in_chat=now,
                last_seen_in_chat=now,
            )
            db.add(sighting)
        
        await db.commit()
        return sighting
    
    @staticmethod
    async def record_message(
        db: AsyncSession,
        profile_id: int,
        chat_id: int,
        message_date: datetime,
        message_length: int = 0,
    ):
        """Record a message for activity tracking."""
        # Update sighting message count
        result = await db.execute(
            select(UserSighting).where(
                and_(
                    UserSighting.profile_id == profile_id,
                    UserSighting.chat_id == chat_id
                )
            )
        )
        sighting = result.scalar_one_or_none()
        
        if sighting:
            sighting.message_count += 1
            sighting.last_message = message_date
            if not sighting.first_message:
                sighting.first_message = message_date
        
        # Update profile total
        await db.execute(
            update(UserProfile)
            .where(UserProfile.id == profile_id)
            .values(
                total_messages=UserProfile.total_messages + 1,
                last_seen=message_date
            )
        )
        
        # Record hourly activity
        hour = message_date.hour
        day_of_week = message_date.weekday()
        date_only = message_date.replace(hour=0, minute=0, second=0, microsecond=0)
        
        result = await db.execute(
            select(UserActivity).where(
                and_(
                    UserActivity.profile_id == profile_id,
                    UserActivity.date == date_only,
                    UserActivity.hour == hour
                )
            )
        )
        activity = result.scalar_one_or_none()
        
        if activity:
            # Update running average
            total = activity.message_count * activity.avg_message_length
            activity.message_count += 1
            activity.avg_message_length = (total + message_length) / activity.message_count
        else:
            activity = UserActivity(
                profile_id=profile_id,
                date=date_only,
                hour=hour,
                day_of_week=day_of_week,
                message_count=1,
                avg_message_length=float(message_length),
            )
            db.add(activity)
        
        await db.commit()
    
    @staticmethod
    async def get_activity_patterns(
        db: AsyncSession,
        profile_id: int,
    ) -> Dict[str, Any]:
        """Get activity pattern analysis for a user."""
        # Get all activities for this user
        result = await db.execute(
            select(UserActivity).where(UserActivity.profile_id == profile_id)
        )
        activities = result.scalars().all()
        
        # Aggregate by hour (0-23)
        hourly = [0] * 24
        for a in activities:
            hourly[a.hour] += a.message_count
        
        # Aggregate by day of week (0-6, Mon-Sun)
        daily = [0] * 7
        for a in activities:
            daily[a.day_of_week] += a.message_count
        
        # Calculate averages
        total_messages = sum(a.message_count for a in activities)
        total_length = sum(a.message_count * a.avg_message_length for a in activities)
        avg_length = total_length / total_messages if total_messages > 0 else 0
        
        # Find peak hours
        peak_hour = hourly.index(max(hourly)) if any(hourly) else None
        peak_day = daily.index(max(daily)) if any(daily) else None
        
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        return {
            "hourly_activity": hourly,
            "daily_activity": daily,
            "total_messages": total_messages,
            "avg_message_length": round(avg_length, 1),
            "peak_hour": peak_hour,
            "peak_day": days[peak_day] if peak_day is not None else None,
        }
    
    @staticmethod
    async def get_user_chats(
        db: AsyncSession,
        profile_id: int,
    ) -> List[Dict[str, Any]]:
        """Get all chats where this user appears."""
        result = await db.execute(
            select(UserSighting)
            .where(UserSighting.profile_id == profile_id)
            .order_by(UserSighting.message_count.desc())
        )
        sightings = result.scalars().all()
        
        return [
            {
                "chat_id": s.chat_id,
                "chat_title": s.chat_title,
                "chat_type": s.chat_type,
                "is_admin": s.is_admin,
                "is_owner": s.is_owner,
                "message_count": s.message_count,
                "first_seen": s.first_seen_in_chat.isoformat() if s.first_seen_in_chat else None,
                "last_seen": s.last_seen_in_chat.isoformat() if s.last_seen_in_chat else None,
            }
            for s in sightings
        ]
    
    @staticmethod
    async def get_connections(
        db: AsyncSession,
        user_telegram_id: int,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get users this person interacts with most."""
        result = await db.execute(
            select(UserConnection).where(
                or_(
                    UserConnection.user_a_id == user_telegram_id,
                    UserConnection.user_b_id == user_telegram_id
                )
            ).order_by(UserConnection.interaction_count.desc()).limit(limit)
        )
        connections = result.scalars().all()
        
        results = []
        for c in connections:
            other_id = c.user_b_id if c.user_a_id == user_telegram_id else c.user_a_id
            
            # Get the other user's profile
            profile_result = await db.execute(
                select(UserProfile).where(UserProfile.telegram_id == other_id)
            )
            other_profile = profile_result.scalar_one_or_none()
            
            results.append({
                "user_id": other_id,
                "username": other_profile.username if other_profile else None,
                "name": f"{other_profile.first_name or ''} {other_profile.last_name or ''}".strip() if other_profile else None,
                "photo_path": other_profile.photo_path if other_profile else None,
                "interaction_count": c.interaction_count,
                "reply_count": c.reply_count,
                "chat_id": c.chat_id,
                "chat_title": c.chat_title,
                "last_interaction": c.last_interaction.isoformat() if c.last_interaction else None,
            })
        
        return results


class RiskAnalyzer:
    """Analyzes user profiles for potential fake/spam accounts."""
    
    @staticmethod
    def calculate_risk_score(profile: UserProfile) -> tuple[float, List[str]]:
        """
        Calculate risk score for a user profile.
        
        Returns (score, factors) where score is 0.0 to 1.0
        and factors is a list of contributing reasons.
        """
        score = 0.0
        factors = []
        
        # No profile photo
        if not profile.photo_path:
            score += 0.12
            factors.append("No profile photo")
        
        # No bio
        if not profile.bio:
            score += 0.08
            factors.append("No bio")
        
        # Random-looking username
        if profile.username:
            if RiskAnalyzer._is_random_username(profile.username):
                score += 0.18
                factors.append("Random-looking username")
        else:
            score += 0.05
            factors.append("No username")
        
        # New account with low activity
        if profile.first_seen and profile.total_messages < 5:
            days_active = (datetime.utcnow() - profile.first_seen).days
            if days_active < 30:
                score += 0.15
                factors.append("New account with low activity")
        
        # Very few chats
        if profile.total_chats == 1:
            score += 0.10
            factors.append("Only seen in one chat")
        
        # Marked as scam or fake by Telegram
        if profile.is_scam:
            score += 0.40
            factors.append("Marked as scam by Telegram")
        if profile.is_fake:
            score += 0.40
            factors.append("Marked as fake by Telegram")
        
        # Deleted account
        if profile.is_deleted:
            score += 0.25
            factors.append("Account deleted")
        
        # Positive factors (reduce risk)
        if profile.is_premium:
            score -= 0.25
            factors.append("Premium account (trusted)")
        
        if profile.is_verified:
            score -= 0.30
            factors.append("Verified account (trusted)")
        
        # Clamp to 0-1 range
        score = max(0.0, min(1.0, score))
        
        return round(score, 2), factors
    
    @staticmethod
    def _is_random_username(username: str) -> bool:
        """Check if username looks randomly generated."""
        if not username:
            return False
        
        # Check for patterns that suggest random generation
        
        # High ratio of numbers
        num_digits = sum(c.isdigit() for c in username)
        if num_digits > len(username) * 0.4:
            return True
        
        # Ends with many random digits (like user12345678)
        if re.search(r'\d{5,}$', username):
            return True
        
        # Contains long sequences of consonants (no vowels)
        consonant_sequence = re.findall(r'[bcdfghjklmnpqrstvwxyz]{5,}', username.lower())
        if consonant_sequence:
            return True
        
        # Very short with numbers
        if len(username) < 6 and any(c.isdigit() for c in username):
            return True
        
        return False
    
    @staticmethod
    async def analyze_and_update(db: AsyncSession, profile: UserProfile) -> UserProfile:
        """Analyze a profile and update its risk score."""
        score, factors = RiskAnalyzer.calculate_risk_score(profile)
        
        profile.risk_score = score
        profile.risk_factors = factors
        profile.updated_at = datetime.utcnow()
        
        await db.commit()
        return profile
