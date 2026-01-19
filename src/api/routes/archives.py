"""
Archives Routes

Manage account snapshots and imported chat archives.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

from sqlalchemy import select, desc
from src.core.database import get_db
from src.models import Archive, Session
from src.telegram.session_manager import session_manager

router = APIRouter()


class ArchiveResponse(BaseModel):
    """Archive information response."""
    id: int
    name: str
    description: Optional[str]
    session_id: int
    archive_type: str
    file_path: str
    file_size: Optional[int]
    stats: Optional[dict]
    status: str
    progress: int
    created_at: datetime
    completed_at: Optional[datetime]
    snapshot_at: datetime


class CreateArchiveRequest(BaseModel):
    """Request to create a new archive."""
    session_id: int
    name: str
    description: Optional[str] = None
    archive_type: str = "full"
    include_media: bool = True


@router.get("/", response_model=List[ArchiveResponse])
async def list_archives(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """List all available archives and snapshots."""
    async with get_db() as db:
        query = select(Archive).order_by(desc(Archive.created_at)).offset(offset).limit(limit)
        result = await db.execute(query)
        archives = result.scalars().all()
        
        return [
            ArchiveResponse(
                id=a.id,
                name=a.name,
                description=a.description,
                session_id=a.session_id,
                archive_type=a.archive_type,
                file_path=a.file_path,
                file_size=a.file_size,
                stats=a.stats,
                status=a.status,
                progress=a.progress,
                created_at=a.created_at,
                completed_at=a.completed_at,
                snapshot_at=a.snapshot_at,
            )
            for a in archives
        ]


@router.get("/{archive_id}", response_model=ArchiveResponse)
async def get_archive(archive_id: int):
    """Get details for a specific archive."""
    async with get_db() as db:
        result = await db.execute(select(Archive).where(Archive.id == archive_id))
        archive = result.scalar_one_or_none()
        
        if not archive:
            raise HTTPException(status_code=404, detail="Archive not found")
        
        return ArchiveResponse(
            id=archive.id,
            name=archive.name,
            description=archive.description,
            session_id=archive.session_id,
            archive_type=archive.archive_type,
            file_path=archive.file_path,
            file_size=archive.file_size,
            stats=archive.stats,
            status=archive.status,
            progress=archive.progress,
            created_at=archive.created_at,
            completed_at=archive.completed_at,
            snapshot_at=archive.snapshot_at,
        )


@router.post("/", response_model=ArchiveResponse)
async def create_archive(request: CreateArchiveRequest, background_tasks: BackgroundTasks):
    """
    Start a new account snapshot task.
    
    This creates a background task to export account data.
    """
    async with get_db() as db:
        # Verify session exists
        result = await db.execute(select(Session).where(Session.id == request.session_id))
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        # Create archive entry
        archive = Archive(
            name=request.name,
            description=request.description,
            session_id=request.session_id,
            archive_type=request.archive_type,
            file_path=f"archives/pending_{datetime.now().timestamp()}",
            status="pending",
        )
        db.add(archive)
        await db.commit()
        await db.refresh(archive)
        
        # TODO: Start background task for actual archiving
        # background_tasks.add_task(run_archive_task, archive.id)
        
        return ArchiveResponse(
            id=archive.id,
            name=archive.name,
            description=archive.description,
            session_id=archive.session_id,
            archive_type=archive.archive_type,
            file_path=archive.file_path,
            file_size=archive.file_size,
            stats=archive.stats,
            status=archive.status,
            progress=archive.progress,
            created_at=archive.created_at,
            completed_at=archive.completed_at,
            snapshot_at=archive.snapshot_at,
        )


@router.get("/{archive_id}/chats")
async def list_archived_chats(archive_id: int):
    """
    List chats contained within an archive.
    
    Reads from the archive's internal message storage.
    """
    async with get_db() as db:
        result = await db.execute(select(Archive).where(Archive.id == archive_id))
        archive = result.scalar_one_or_none()
        
        if not archive:
            raise HTTPException(status_code=404, detail="Archive not found")
        
        # TODO: Implement reading chat list from the archive file (JSON/Local DB)
        # For now return mock data that matches the expected immersive view structure
        return [
            {"id": 1, "title": "Archived: BTC Alpha", "type": "channel", "last_message": "Final report on BTC...", "time": "Jan 15", "unread": 0},
            {"id": 2, "title": "Archived: Dev Gossip", "type": "group", "last_message": "Old chat logs...", "time": "Jan 12", "unread": 0},
        ]


@router.get("/{archive_id}/chats/{chat_id}/messages")
async def get_archived_messages(
    archive_id: int, 
    chat_id: int,
    limit: int = 50,
    offset: int = 0
):
    """Get messages from a specific chat within an archive."""
    # TODO: Implement reading messages from the archive file
    return [
        {"id": 1, "sender": "Alice", "text": "This is a message from the past 🕰️", "time": "10:30", "is_own": False},
        {"id": 2, "sender": "Bob", "text": "Everything here is readonly, but looks real.", "time": "10:31", "is_own": False},
        {"id": 3, "sender": "You", "text": "Perfect for reviewing old data.", "time": "10:32", "is_own": True},
    ]


@router.delete("/{archive_id}")
async def delete_archive(archive_id: int):
    """Remove an archive and its associated files."""
    async with get_db() as db:
        result = await db.execute(select(Archive).where(Archive.id == archive_id))
        archive = result.scalar_one_or_none()
        
        if not archive:
            raise HTTPException(status_code=404, detail="Archive not found")
        
        # TODO: Delete actual files from disk
        
        await db.delete(archive)
        await db.commit()
        
        return {"success": True, "message": "Archive deleted"}
