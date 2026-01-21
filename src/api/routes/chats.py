"""
Chats Routes

Access and manage Telegram chats, groups, and channels.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from src.telegram.session_manager import session_manager
from src.services.export_service import export_service
from src.services.clone_service import CloneService

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


# ============================================================================
# EXPORT ENDPOINTS
# ============================================================================

class ExportRequest(BaseModel):
    format: str = "json"  # json, html, txt
    include_media: bool = True
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    limit: Optional[int] = None
    encrypt: bool = False
    password: Optional[str] = None


@router.post("/{chat_id}/export")
async def export_chat(
    chat_id: int,
    request: ExportRequest,
    background_tasks: BackgroundTasks,
):
    """
    Export a chat to JSON, HTML, or TXT format.
    
    Set encrypt=true and provide password for AES-256 encrypted backup (.tgbak).
    Media files are stored in a separate folder (or bundled in encrypted backup).
    """
    try:
        result = await export_service.export_chat(
            chat_id=chat_id,
            format=request.format,
            include_media=request.include_media,
            date_from=request.date_from,
            date_to=request.date_to,
            limit=request.limit,
            encrypt=request.encrypt,
            password=request.password,
        )
        
        return {
            "success": True,
            "export_id": result["export_id"],
            "file_path": result["file_path"],
            "encrypted_path": result.get("encrypted_path"),
            "is_encrypted": result.get("is_encrypted", False),
            "media_dir": result["media_dir"],
            "message_count": result["message_count"],
            "participant_count": result["participant_count"],
            "format": result["format"],
            "download_url": f"/api/chats/exports/{result['export_id']}/download",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/exports/{export_id}/download")
async def download_export(export_id: str):
    """Download an export file."""
    import os
    from pathlib import Path
    from src.core.config import settings
    
    exports_dir = Path(settings.data_dir) / "exports"
    
    # Check for encrypted backup first
    encrypted_path = exports_dir / f"{export_id}.tgbak"
    if encrypted_path.exists():
        return FileResponse(
            path=str(encrypted_path),
            filename=f"{export_id}.tgbak",
            media_type="application/octet-stream",
        )
    
    # Look for regular export file
    export_dir = exports_dir / export_id
    for ext in ["json", "html", "txt"]:
        file_path = export_dir / f"export.{ext}"
        if file_path.exists():
            return FileResponse(
                path=str(file_path),
                filename=f"export_{export_id}.{ext}",
                media_type="application/octet-stream",
            )
    
    raise HTTPException(status_code=404, detail="Export not found")


class ImportRequest(BaseModel):
    password: str


@router.post("/imports/decrypt")
async def decrypt_import(
    file: UploadFile = File(...),
    password: str = Form(...),
):
    """
    Decrypt an encrypted backup file (.tgbak).
    
    Returns the decrypted export data.
    """
    import tempfile
    import json
    from pathlib import Path
    from src.core.config import settings
    from src.services.encryption_service import EncryptionService
    
    try:
        # Save uploaded file
        content = await file.read()
        
        # Create output directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        import_id = f"import_{timestamp}"
        output_dir = Path(settings.data_dir) / "exports" / import_id
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Write encrypted file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tgbak") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Decrypt
            EncryptionService.decrypt_export(tmp_path, str(output_dir), password)
            
            # Read the export.json to return data
            export_json = output_dir / "export.json"
            if export_json.exists():
                with open(export_json, "r", encoding="utf-8") as f:
                    export_data = json.load(f)
                
                return {
                    "success": True,
                    "import_id": import_id,
                    "message_count": export_data.get("messageCount", 0),
                    "participant_count": export_data.get("participantCount", 0),
                    "channel": export_data.get("channel", {}),
                    "output_dir": str(output_dir),
                }
            else:
                return {
                    "success": True,
                    "import_id": import_id,
                    "output_dir": str(output_dir),
                    "message": "Decrypted but no export.json found",
                }
        finally:
            # Clean up temp file
            import os
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Decryption failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


# ============================================================================
# CLONE ENDPOINTS
# ============================================================================

class CloneRequest(BaseModel):
    target_chat_id: int
    mode: str = "reupload"  # "forward", "reupload", or "encrypted"
    include_media: bool = True
    include_pinned: bool = True
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    delay_seconds: float = 1.0
    encryption_password: Optional[str] = None  # Required for encrypted mode


@router.post("/{chat_id}/clone")
async def clone_chat(
    chat_id: int,
    request: CloneRequest,
    background_tasks: BackgroundTasks,
):
    """
    Clone a chat/channel to another destination.
    
    Three modes available:
    - "forward": Re-posts text content (no forward metadata)
    - "reupload": Downloads media and uploads fresh (completely clean)
    - "encrypted": Encrypts content before sending (appears as garbage in other apps!)
    
    For encrypted mode, provide encryption_password. Messages will appear as:
    🔒[encrypted_base64_data] in other Telegram clients but decrypt normally in this app.
    """
    try:
        if request.mode == "encrypted" and not request.encryption_password:
            raise ValueError("encryption_password required for encrypted mode")
        
        result = await CloneService.clone_chat(
            source_chat_id=chat_id,
            target_chat_id=request.target_chat_id,
            mode=request.mode,
            include_media=request.include_media,
            include_pinned=request.include_pinned,
            date_from=request.date_from,
            date_to=request.date_to,
            delay_seconds=request.delay_seconds,
            encryption_password=request.encryption_password,
        )
        
        return {
            "success": True,
            **result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clone failed: {str(e)}")


# ============================================================================
# ENCRYPTION KEY MANAGEMENT
# ============================================================================

class RegisterKeyRequest(BaseModel):
    password: str


@router.post("/{chat_id}/encryption/register")
async def register_encryption_key(chat_id: int, request: RegisterKeyRequest):
    """
    Register an encryption key for a chat.
    
    This allows the app to decrypt messages from encrypted chats.
    """
    from src.services.message_encryption import EncryptedChatRegistry
    EncryptedChatRegistry.register_key(chat_id, request.password)
    return {"success": True, "chat_id": chat_id, "message": "Encryption key registered"}


@router.delete("/{chat_id}/encryption/key")
async def remove_encryption_key(chat_id: int):
    """Remove encryption key for a chat."""
    from src.services.message_encryption import EncryptedChatRegistry
    EncryptedChatRegistry.remove_key(chat_id)
    return {"success": True, "chat_id": chat_id}


@router.get("/encryption/chats")
async def list_encrypted_chats():
    """List all chats with registered encryption keys."""
    from src.services.message_encryption import EncryptedChatRegistry
    return {
        "encrypted_chats": EncryptedChatRegistry.list_encrypted_chats(),
    }


class DecryptTextRequest(BaseModel):
    text: str
    password: str


@router.post("/{chat_id}/decrypt-text")
async def decrypt_text(chat_id: int, request: DecryptTextRequest):
    """Decrypt a single encrypted message text."""
    from src.services.message_encryption import MessageEncryption
    
    if not MessageEncryption.is_encrypted(request.text):
        return {"decrypted": request.text, "was_encrypted": False}
    
    decrypted = MessageEncryption.decrypt_text(request.text, request.password, chat_id)
    return {"decrypted": decrypted, "was_encrypted": True}


@router.get("/clone/operations")
async def list_clone_operations():
    """List all clone operations and their progress."""
    return {
        "operations": CloneService.list_operations(),
    }


@router.get("/clone/operations/{operation_id}")
async def get_clone_progress(operation_id: str):
    """Get progress of a specific clone operation."""
    progress = CloneService.get_progress(operation_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    return {
        "operation_id": operation_id,
        **progress.to_dict(),
    }


# ============================================================================
# BULK OPERATIONS
# ============================================================================

class BulkDeleteRequest(BaseModel):
    message_ids: List[int]


class BulkForwardRequest(BaseModel):
    message_ids: List[int]
    target_chat_id: int


@router.post("/{chat_id}/bulk/delete")
async def bulk_delete_messages(chat_id: int, request: BulkDeleteRequest):
    """Delete multiple messages at once."""
    try:
        client = await session_manager.get_client()
        
        deleted_count = 0
        errors = []
        
        for msg_id in request.message_ids:
            try:
                await client.delete_messages(chat_id, [msg_id])
                deleted_count += 1
            except Exception as e:
                errors.append(f"Message {msg_id}: {str(e)}")
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "error_count": len(errors),
            "errors": errors[:10],  # First 10 errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk delete failed: {str(e)}")


@router.post("/{chat_id}/bulk/forward")
async def bulk_forward_messages(chat_id: int, request: BulkForwardRequest):
    """Forward multiple messages to another chat."""
    try:
        client = await session_manager.get_client()
        
        forwarded_count = 0
        errors = []
        
        for msg_id in request.message_ids:
            try:
                await client.forward_messages(
                    request.target_chat_id,
                    chat_id,
                    [msg_id],
                )
                forwarded_count += 1
            except Exception as e:
                errors.append(f"Message {msg_id}: {str(e)}")
        
        return {
            "success": True,
            "forwarded_count": forwarded_count,
            "error_count": len(errors),
            "errors": errors[:10],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk forward failed: {str(e)}")

