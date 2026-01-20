"""
Media Routes

Stream and download media files from Telegram.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import io

from src.telegram.session_manager import session_manager

router = APIRouter()


@router.get("/stream/{chat_id}/{message_id}")
async def stream_media(
    chat_id: int,
    message_id: int,
    session_id: Optional[int] = None,
):
    """
    Stream media from a specific message.
    Downloads on-demand from Telegram and streams to client.
    """
    try:
        client = await session_manager.get_client(session_id)
        raw_client = client.raw_client
        
        # Get the message
        message = await raw_client.get_messages(chat_id, ids=message_id)
        if not message or not message.media:
            raise HTTPException(status_code=404, detail="Media not found")
        
        # Determine content type
        content_type = "application/octet-stream"
        if message.video:
            content_type = getattr(message.video, 'mime_type', 'video/mp4') or 'video/mp4'
        elif message.document:
            content_type = getattr(message.document, 'mime_type', 'application/octet-stream') or 'application/octet-stream'
        elif message.photo:
            content_type = "image/jpeg"
        
        # Stream the file
        async def generate():
            async for chunk in raw_client.iter_download(message.media):
                yield chunk
        
        return StreamingResponse(
            generate(),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=media_{message_id}",
                "Accept-Ranges": "bytes",
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream media: {str(e)}")


@router.get("/download/{chat_id}/{message_id}")
async def download_media(
    chat_id: int,
    message_id: int,
    session_id: Optional[int] = None,
):
    """
    Download media from a specific message.
    Forces download (Content-Disposition: attachment).
    """
    try:
        client = await session_manager.get_client(session_id)
        raw_client = client.raw_client
        
        # Get the message
        message = await raw_client.get_messages(chat_id, ids=message_id)
        if not message or not message.media:
            raise HTTPException(status_code=404, detail="Media not found")
        
        # Determine filename and content type
        filename = f"media_{message_id}"
        content_type = "application/octet-stream"
        
        if message.video:
            content_type = getattr(message.video, 'mime_type', 'video/mp4') or 'video/mp4'
            # Try to get filename from attributes
            for attr in getattr(message.video, 'attributes', []):
                if hasattr(attr, 'file_name') and attr.file_name:
                    filename = attr.file_name
                    break
            if filename == f"media_{message_id}":
                filename = f"video_{message_id}.mp4"
        elif message.document:
            content_type = getattr(message.document, 'mime_type', 'application/octet-stream') or 'application/octet-stream'
            for attr in getattr(message.document, 'attributes', []):
                if hasattr(attr, 'file_name') and attr.file_name:
                    filename = attr.file_name
                    break
        elif message.photo:
            content_type = "image/jpeg"
            filename = f"photo_{message_id}.jpg"
        
        # Stream the file with download disposition
        async def generate():
            async for chunk in raw_client.iter_download(message.media):
                yield chunk
        
        return StreamingResponse(
            generate(),
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\"",
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download media: {str(e)}")
