"""
Sessions Routes

Manage multiple Telegram sessions/accounts.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from src.telegram.session_manager import session_manager, SessionInfo

router = APIRouter()


class SessionResponse(BaseModel):
    """Session information response."""
    id: int
    name: str
    auth_type: str
    telegram_user_id: Optional[int]
    username: Optional[str]
    phone: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    is_bot: bool
    is_active: bool
    is_connected: bool
    created_at: datetime
    last_used_at: Optional[datetime]


class SessionExportResponse(BaseModel):
    """Response for session export."""
    session_id: int
    session_string: str


class SwitchSessionRequest(BaseModel):
    """Request to switch active session."""
    session_id: int


def session_to_response(session: SessionInfo) -> SessionResponse:
    """Convert SessionInfo to API response."""
    return SessionResponse(
        id=session.id,
        name=session.name,
        auth_type=session.auth_type,
        telegram_user_id=session.telegram_user_id,
        username=session.username,
        phone=session.phone,
        first_name=session.first_name,
        last_name=session.last_name,
        is_bot=session.is_bot,
        is_active=session.is_active,
        is_connected=session.is_connected,
        created_at=session.created_at,
        last_used_at=session.last_used_at,
    )


@router.get("/", response_model=List[SessionResponse])
async def list_sessions():
    """
    List all stored sessions/accounts.
    
    Returns all configured Telegram accounts with their connection status.
    """
    sessions = await session_manager.list_sessions()
    return [session_to_response(s) for s in sessions]


@router.get("/active", response_model=Optional[SessionResponse])
async def get_active_session():
    """Get the currently active session."""
    session_id = session_manager.active_session_id
    if not session_id:
        return None
    
    session = await session_manager.get_session(session_id)
    return session_to_response(session) if session else None


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int):
    """Get a specific session by ID."""
    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_to_response(session)


@router.post("/switch", response_model=SessionResponse)
async def switch_session(request: SwitchSessionRequest):
    """
    Switch the active session.
    
    Changes which account is currently active for operations.
    """
    try:
        session = await session_manager.switch_session(request.session_id)
        return session_to_response(session)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to switch session: {str(e)}")


@router.delete("/{session_id}")
async def delete_session(session_id: int):
    """
    Remove a session.
    
    Disconnects and removes the account from the toolkit.
    """
    success = await session_manager.remove_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "message": "Session removed"}


@router.get("/{session_id}/export", response_model=SessionExportResponse)
async def export_session(session_id: int):
    """
    Export session as a Telethon string.
    
    ⚠️ Keep this secure! Anyone with this string can access the account.
    """
    try:
        session_string = await session_manager.export_session_string(session_id)
        return SessionExportResponse(
            session_id=session_id,
            session_string=session_string,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/{session_id}/connect")
async def connect_session(session_id: int):
    """Connect/reconnect a session."""
    try:
        await session_manager.get_client(session_id)
        return {"success": True, "message": "Session connected"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")
