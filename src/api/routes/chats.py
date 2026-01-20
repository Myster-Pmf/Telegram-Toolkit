"""
Chats Routes

Access and manage Telegram chats, groups, and channels.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, File, Form, UploadFile
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
    photo_path: Optional[str] = None
    unread_count: int = 0
    last_message: Optional[str] = None
    last_message_date: Optional[datetime] = None


class MessageResponse(BaseModel):
    """Message response."""
    id: int
    chat_id: int
    sender_id: Optional[int]
    sender_name: Optional[str] = None
    sender_photo: Optional[str] = None
    text: Optional[str]
    date: datetime
    reply_to_msg_id: Optional[int]
    has_media: bool
    media_type: Optional[str]
    media_path: Optional[str] = None
    media_metadata: Optional[dict] = None  # file_name, file_size, duration, width, height
    is_outgoing: bool = False


class MemberResponse(BaseModel):
    """Chat member information."""
    id: int
    first_name: Optional[str]
    last_name: Optional[str]
    username: Optional[str]
    phone: Optional[str]
    photo_path: Optional[str] = None
    status: Optional[str] = None  # admin, member, restricted, etc.


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
                # TODO: Populate these fields from dialog object when available
                photo_path=getattr(d, 'photo_path', None),
                unread_count=getattr(d, 'unread_count', 0),
                last_message=getattr(d, 'last_message', None),
                last_message_date=getattr(d, 'last_message_date', None),
            )
            for d in dialogs
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chats: {str(e)}")


@router.get("/{chat_id}/photo")
async def get_chat_photo(
    chat_id: int,
    session_id: Optional[int] = None,
):
    """Get a chat's profile photo (for lazy loading)."""
    try:
        client = await session_manager.get_client(session_id)
        entity = await client.raw_client.get_entity(chat_id)
        photo_path = await client.download_profile_photo(entity)
        return {"photo_path": photo_path}
    except Exception as e:
        return {"photo_path": None}


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
            photo_path=getattr(chat, 'photo_path', None),
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
    min_id: int = Query(default=0),  # Added for infinite scroll (fetching newer)
    max_id: int = Query(default=0),  # Added for infinite scroll (fetching older)
    session_id: Optional[int] = None,
):
    """
    Get messages from a chat.
    
    Args:
        chat_id: Chat to get messages from
        limit: Maximum number of messages
        offset_id: Offset for pagination
        min_id: Minimum message ID (for fetching newer messages)
        max_id: Maximum message ID (for fetching older messages)
        session_id: Specific session to use
    """
    try:
        client = await session_manager.get_client(session_id)
        messages = await client.get_messages(
            chat_id,
            limit=limit,
            offset_id=offset_id,
            min_id=min_id,
            max_id=max_id,
            download_media=True,  # Download media for better UX
        )
        
        return [
            MessageResponse(
                id=m.id,
                chat_id=m.chat_id,
                sender_id=m.sender_id,
                sender_name=getattr(m, 'sender_name', None),
                sender_photo=getattr(m, 'sender_photo', None),
                text=m.text,
                date=m.date,
                reply_to_msg_id=m.reply_to_msg_id,
                has_media=m.has_media,
                media_type=m.media_type,
                media_path=getattr(m, 'media_path', None),
                media_metadata=getattr(m, 'media_metadata', None),
                is_outgoing=getattr(m, 'is_outgoing', False),
            )
            for m in messages
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")


@router.get("/{chat_id}/members", response_model=List[MemberResponse])
async def get_members(
    chat_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session_id: Optional[int] = None,
):
    """
    Get members of a chat.
    """
    try:
        client = await session_manager.get_client(session_id)
        # Check if client has get_chat_members method
        if not hasattr(client, 'get_chat_members'):
             raise HTTPException(status_code=501, detail="Client does not support fetching members")
             
        members = await client.get_chat_members(chat_id, limit=limit, offset=offset)
        
        return [
            MemberResponse(
                id=m.id,
                first_name=m.first_name,
                last_name=m.last_name,
                username=m.username,
                phone=m.phone,
                photo_path=getattr(m, 'photo_path', None),
                status=getattr(m, 'status', None),
            )
            for m in members
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get members: {str(e)}")


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


class SendMessageRequest(BaseModel):
    """Request to send a message."""
    text: str
    reply_to: Optional[int] = None


@router.post("/{chat_id}/send", response_model=MessageResponse)
async def send_message(
    chat_id: int,
    request: SendMessageRequest,
    session_id: Optional[int] = None,
):
    """
    Send a message to a chat.
    """
    try:
        client = await session_manager.get_client(session_id)
        message = await client.send_message(
            chat_id,
            text=request.text,
            reply_to=request.reply_to,
        )
        
        return MessageResponse(
            id=message.id,
            chat_id=message.chat_id,
            sender_id=message.sender_id,
            sender_name=getattr(message, 'sender_name', None),
            sender_photo=getattr(message, 'sender_photo', None),
            text=message.text,
            date=message.date,
            reply_to_msg_id=message.reply_to_msg_id,
            has_media=message.has_media,
            media_type=message.media_type,
            media_path=getattr(message, 'media_path', None),
            media_metadata=getattr(message, 'media_metadata', None),
            is_outgoing=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")


@router.post("/{chat_id}/send-media")
async def send_media(
    chat_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    session_id: Optional[int] = None,
):
    """
    Send a media file (image, video, document) to a chat.
    """
    import tempfile
    import os
    
    try:
        client = await session_manager.get_client(session_id)
        
        # Save uploaded file to temp location
        suffix = os.path.splitext(file.filename)[1] if file.filename else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Send file via Telethon
            message = await client.send_file(
                chat_id,
                file=tmp_path,
                caption=caption,
            )
            
            return {
                "success": True,
                "message_id": message.id,
                "chat_id": message.chat_id,
                "caption": caption,
                "file_name": file.filename,
            }
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send media: {str(e)}")
