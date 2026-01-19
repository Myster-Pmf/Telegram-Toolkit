"""
Chats Routes

Access and manage Telegram chats, groups, and channels.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from src.telegram.session_manager import session_manager

router = APIRouter()


class ChatResponse(BaseModel):
    """Chat information response."""
    id: int
    title: Optional[str]
    username: Optional[str]
    chat_type: str  # private, group, supergroup, channel
    member_count: Optional[int]


class MessageResponse(BaseModel):
    """Message response."""
    id: int
    chat_id: int
    sender_id: Optional[int]
    text: Optional[str]
    date: datetime
    reply_to_msg_id: Optional[int]
    has_media: bool
    media_type: Optional[str]


class CloneChatRequest(BaseModel):
    """Request to clone a chat's content."""
    target_account_id: int
    destination_chat: str
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    include_media: bool = True
    preserve_formatting: bool = True
    rewrite_persona: Optional[str] = None


class ExportChatRequest(BaseModel):
    """Request to export a chat's content."""
    format: str = "json"  # json, html, txt, csv
    keywords: Optional[str] = None
    from_id: Optional[int] = None
    min_views: Optional[int] = None
    include_media: bool = True


@router.get("/", response_model=List[ChatResponse])
async def list_chats(
    limit: int = Query(default=100, ge=1, le=500),
    session_id: Optional[int] = None,
):
    """
    List all dialogs (chats, groups, channels) for the active account.
    
    Args:
        limit: Maximum number of chats to return
        session_id: Specific session to use (optional, uses active if not provided)
    """
    try:
        client = await session_manager.get_client(session_id)
        dialogs = await client.get_dialogs(limit=limit)
        
        return [
            ChatResponse(
                id=d.id,
                title=d.title,
                username=d.username,
                chat_type=d.chat_type,
                member_count=d.member_count,
            )
            for d in dialogs
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chats: {str(e)}")


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: int,
    session_id: Optional[int] = None,
):
    """Get information about a specific chat."""
    try:
        client = await session_manager.get_client(session_id)
        chat = await client.get_chat(chat_id)
        
        return ChatResponse(
            id=chat.id,
            title=chat.title,
            username=chat.username,
            chat_type=chat.chat_type,
            member_count=chat.member_count,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chat: {str(e)}")


@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    chat_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    offset_id: int = Query(default=0),
    session_id: Optional[int] = None,
):
    """
    Get messages from a chat.
    
    Args:
        chat_id: Chat to get messages from
        limit: Maximum number of messages
        offset_id: Get messages older than this message ID
        session_id: Specific session to use
    """
    try:
        client = await session_manager.get_client(session_id)
        messages = await client.get_messages(
            chat_id,
            limit=limit,
            offset_id=offset_id,
        )
        
        return [
            MessageResponse(
                id=m.id,
                chat_id=m.chat_id,
                sender_id=m.sender_id,
                text=m.text,
                date=m.date,
                reply_to_msg_id=m.reply_to_msg_id,
                has_media=m.has_media,
                media_type=m.media_type,
            )
            for m in messages
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")


@router.post("/{chat_id}/clone")
async def clone_chat(
    chat_id: int,
    request: CloneChatRequest,
    background_tasks: BackgroundTasks,
    session_id: Optional[int] = None,
):
    """
    Start a background task to clone a chat or channel.
    """
    # TODO: Verify source and destination
    # TODO: Start cloning background task
    return {
        "success": True, 
        "message": "Cloning task started",
        "task_id": f"clone_{chat_id}_{datetime.now().timestamp()}"
    }


@router.post("/{chat_id}/export")
async def export_chat(
    chat_id: int,
    request: ExportChatRequest,
    background_tasks: BackgroundTasks,
    session_id: Optional[int] = None,
):
    """
    Start a background task to selectively export chat content.
    """
    # TODO: Start export background task that results in an Archive entry
    return {
        "success": True,
        "message": "Export task started",
        "task_id": f"export_{chat_id}_{datetime.now().timestamp()}"
    }
