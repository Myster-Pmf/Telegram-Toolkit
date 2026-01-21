"""
Export Service

Handles exporting chats to various formats (JSON, HTML, TXT).
Stores media in separate folder with references in export file.
Supports optional AES-256 encryption for secure backups.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from src.core.config import settings
from src.telegram.session_manager import session_manager


class ExportService:
    """Service for exporting chats to various formats."""
    
    def __init__(self):
        self.exports_dir = Path(settings.data_dir) / "exports"
        self.exports_dir.mkdir(parents=True, exist_ok=True)
    
    async def export_chat(
        self,
        chat_id: int,
        format: str = "json",  # json, html, txt
        include_media: bool = True,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: Optional[int] = None,
        encrypt: bool = False,
        password: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Export a chat to the specified format.
        
        Args:
            encrypt: If True, create encrypted .tgbak backup
            password: Password for encryption (required if encrypt=True)
        
        Returns dict with export_id, file_path, and status.
        """
        if encrypt and not password:
            raise ValueError("Password required for encrypted export")
        
        client = await session_manager.get_client()
        
        # Create export directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_id = f"{abs(chat_id)}_{timestamp}"
        export_dir = self.exports_dir / export_id
        export_dir.mkdir(parents=True, exist_ok=True)
        
        # Create media subdirectory
        media_dir = export_dir / "media"
        if include_media:
            media_dir.mkdir(exist_ok=True)
        
        # Get chat info
        chat_info = await client.get_chat(chat_id)
        
        # Get participants (if possible)
        participants = []
        try:
            members = await client.get_chat_members(chat_id, limit=500)
            for member in members:
                participant = {
                    "id": str(member.id),
                    "username": member.username,
                    "firstName": member.first_name,
                    "lastName": member.last_name,
                    "phone": getattr(member, 'phone', None),
                    "isBot": member.is_bot,
                    "photo": None,  # Could be enhanced to include photo info
                }
                participants.append(participant)
        except Exception as e:
            print(f"Could not fetch participants: {e}")
        
        # Get messages
        messages_data = []
        pinned_ids = []
        
        # Fetch messages in batches
        all_messages = await client.get_messages(
            chat_id,
            limit=limit or 10000,
            download_media=False,  # We'll handle media separately
        )
        
        for msg in all_messages:
            # Apply date filters
            if date_from and msg.date < date_from:
                continue
            if date_to and msg.date > date_to:
                continue
            
            # Track pinned messages
            if getattr(msg, 'is_pinned', False):
                pinned_ids.append(msg.id)
            
            # Build message data
            message_data = {
                "id": msg.id,
                "date": int(msg.date.timestamp()) if msg.date else None,
                "editDate": int(msg.edit_date.timestamp()) if getattr(msg, 'edit_date', None) else None,
                "senderId": str(msg.sender_id) if msg.sender_id else str(chat_id),
                "sender": {
                    "id": str(msg.sender_id) if msg.sender_id else str(chat_id),
                    "username": getattr(msg, 'sender_username', None),
                    "firstName": getattr(msg, 'sender_first_name', None),
                    "lastName": getattr(msg, 'sender_last_name', None),
                    "isBot": getattr(msg, 'sender_is_bot', False),
                },
                "text": msg.text or "",
                "rawText": msg.text or "",
                "entities": [],  # Could parse formatting entities
                "hasMedia": msg.has_media,
                "media": None,
                "views": getattr(msg, 'views', None),
                "forwards": getattr(msg, 'forwards', 0),
                "reactions": None,
                "replyToMessageId": msg.reply_to if msg.reply_to else None,
                "forwardedFrom": None,  # Could parse forward info
                "isPinned": getattr(msg, 'is_pinned', False),
                "isPost": getattr(msg, 'is_post', False),
                "isSilent": getattr(msg, 'is_silent', False),
                "isEdited": getattr(msg, 'edit_date', None) is not None,
            }
            
            # Handle media
            if msg.has_media and include_media:
                media_info = await self._process_media(
                    client, msg, media_dir, export_id
                )
                if media_info:
                    message_data["media"] = media_info
            
            messages_data.append(message_data)
        
        # Build export data
        export_data = {
            "chatId": str(chat_id),
            "exportedAt": datetime.utcnow().isoformat() + "Z",
            "exportVersion": "2.0",
            "channel": {
                "id": str(abs(chat_id)),
                "title": chat_info.title if chat_info else "Unknown",
                "username": chat_info.username if chat_info else None,
                "about": getattr(chat_info, 'about', None) if chat_info else None,
                "participantsCount": len(participants) if participants else None,
                "isChannel": chat_info.chat_type == "channel" if chat_info else False,
                "isGroup": chat_info.chat_type in ["group", "supergroup"] if chat_info else False,
                "createdAt": None,  # Not easily available
                "photo": {},
            },
            "participants": participants,
            "participantCount": len(participants),
            "messageCount": len(messages_data),
            "pinnedMessageIds": pinned_ids,
            "messages": messages_data,
        }
        
        # Save based on format
        if format == "json":
            output_path = export_dir / "export.json"
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
        elif format == "html":
            output_path = export_dir / "export.html"
            html_content = self._generate_html(export_data)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(html_content)
        elif format == "txt":
            output_path = export_dir / "export.txt"
            txt_content = self._generate_txt(export_data)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(txt_content)
        else:
            output_path = export_dir / "export.json"
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
        
        # Encrypt if requested
        encrypted_path = None
        if encrypt and password:
            from src.services.encryption_service import EncryptionService
            encrypted_path = EncryptionService.encrypt_export(str(export_dir), password)
        
        return {
            "export_id": export_id,
            "file_path": str(output_path),
            "encrypted_path": encrypted_path,
            "is_encrypted": encrypt,
            "media_dir": str(media_dir) if include_media else None,
            "message_count": len(messages_data),
            "participant_count": len(participants),
            "format": format,
        }
    
    async def _process_media(
        self,
        client,
        message,
        media_dir: Path,
        export_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Download media and return metadata."""
        try:
            # Determine media type and info
            media_type = "unknown"
            filename = None
            mime_type = None
            size = None
            width = None
            height = None
            duration = None
            
            if hasattr(message, 'photo') and message.photo:
                media_type = "photo"
                filename = f"photo_{message.id}.jpg"
            elif hasattr(message, 'video') and message.video:
                media_type = "video"
                filename = getattr(message.video, 'file_name', f"video_{message.id}.mp4")
                mime_type = getattr(message.video, 'mime_type', 'video/mp4')
                size = getattr(message.video, 'size', None)
                width = getattr(message.video, 'width', None)
                height = getattr(message.video, 'height', None)
                duration = getattr(message.video, 'duration', None)
            elif hasattr(message, 'document') and message.document:
                media_type = "document"
                filename = getattr(message.document, 'file_name', f"file_{message.id}")
                mime_type = getattr(message.document, 'mime_type', 'application/octet-stream')
                size = getattr(message.document, 'size', None)
            elif hasattr(message, 'audio') and message.audio:
                media_type = "audio"
                filename = getattr(message.audio, 'file_name', f"audio_{message.id}.mp3")
                mime_type = getattr(message.audio, 'mime_type', 'audio/mpeg')
                duration = getattr(message.audio, 'duration', None)
            elif hasattr(message, 'voice') and message.voice:
                media_type = "voice"
                filename = f"voice_{message.id}.ogg"
                mime_type = "audio/ogg"
                duration = getattr(message.voice, 'duration', None)
            elif hasattr(message, 'sticker') and message.sticker:
                media_type = "sticker"
                filename = f"sticker_{message.id}.webp"
            else:
                return None
            
            # Download media
            media_path = media_dir / filename
            try:
                await client.download_media(message, str(media_path))
                
                # Get actual file size
                if media_path.exists():
                    size = media_path.stat().st_size
            except Exception as e:
                print(f"Failed to download media for message {message.id}: {e}")
                # Return metadata without downloaded file
                pass
            
            return {
                "type": media_type,
                "filename": filename,
                "localPath": f"media/{filename}",
                "mimeType": mime_type,
                "size": size,
                "width": width,
                "height": height,
                "duration": duration,
                "thumbnail": None,
                "fileId": str(getattr(message, 'media_id', message.id)),
            }
            
        except Exception as e:
            print(f"Error processing media: {e}")
            return None
    
    def _generate_html(self, export_data: Dict[str, Any]) -> str:
        """Generate HTML export with styled chat view."""
        channel = export_data.get("channel", {})
        messages = export_data.get("messages", [])
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{channel.get('title', 'Chat Export')}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419; color: #e7e9ea; line-height: 1.5;
        }}
        .header {{
            background: #1a1f26; padding: 20px; border-bottom: 1px solid #2f3336;
            position: sticky; top: 0; z-index: 100;
        }}
        .header h1 {{ font-size: 1.5rem; margin-bottom: 5px; }}
        .header .meta {{ color: #71767b; font-size: 0.875rem; }}
        .messages {{ max-width: 800px; margin: 0 auto; padding: 20px; }}
        .message {{
            background: #1a1f26; border-radius: 12px; padding: 16px;
            margin-bottom: 12px; border: 1px solid #2f3336;
        }}
        .message .sender {{ color: #1d9bf0; font-weight: 600; margin-bottom: 4px; }}
        .message .text {{ white-space: pre-wrap; }}
        .message .time {{ color: #71767b; font-size: 0.75rem; margin-top: 8px; }}
        .message .media {{ margin-top: 10px; }}
        .message .media img {{ max-width: 100%; border-radius: 8px; }}
        .message .media video {{ max-width: 100%; border-radius: 8px; }}
        .message .media .file {{
            background: #2f3336; padding: 10px; border-radius: 8px;
            display: flex; align-items: center; gap: 10px;
        }}
        .pinned {{ border-color: #1d9bf0; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{channel.get('title', 'Chat Export')}</h1>
        <div class="meta">
            Exported: {export_data.get('exportedAt', '')} | 
            Messages: {export_data.get('messageCount', 0)} |
            Participants: {export_data.get('participantCount', 0)}
        </div>
    </div>
    <div class="messages">
"""
        
        for msg in messages:
            date_str = ""
            if msg.get("date"):
                date_str = datetime.fromtimestamp(msg["date"]).strftime("%Y-%m-%d %H:%M")
            
            sender = msg.get("sender", {})
            sender_name = sender.get("firstName") or sender.get("username") or "Unknown"
            
            pinned_class = "pinned" if msg.get("isPinned") else ""
            
            html += f"""
        <div class="message {pinned_class}">
            <div class="sender">{sender_name}</div>
            <div class="text">{msg.get('text', '')}</div>
"""
            
            # Add media
            media = msg.get("media")
            if media:
                media_type = media.get("type", "")
                local_path = media.get("localPath", "")
                
                if media_type == "photo":
                    html += f'            <div class="media"><img src="{local_path}" alt="Photo"></div>\n'
                elif media_type == "video":
                    html += f'            <div class="media"><video src="{local_path}" controls></video></div>\n'
                else:
                    html += f'            <div class="media"><div class="file">📎 {media.get("filename", "File")}</div></div>\n'
            
            html += f"""            <div class="time">{date_str}</div>
        </div>
"""
        
        html += """
    </div>
</body>
</html>"""
        
        return html
    
    def _generate_txt(self, export_data: Dict[str, Any]) -> str:
        """Generate plain text transcript."""
        channel = export_data.get("channel", {})
        messages = export_data.get("messages", [])
        
        lines = [
            f"Chat Export: {channel.get('title', 'Unknown')}",
            f"Exported: {export_data.get('exportedAt', '')}",
            f"Messages: {export_data.get('messageCount', 0)}",
            "=" * 60,
            "",
        ]
        
        for msg in messages:
            date_str = ""
            if msg.get("date"):
                date_str = datetime.fromtimestamp(msg["date"]).strftime("%Y-%m-%d %H:%M")
            
            sender = msg.get("sender", {})
            sender_name = sender.get("firstName") or sender.get("username") or "Unknown"
            
            lines.append(f"[{date_str}] {sender_name}:")
            if msg.get("text"):
                lines.append(msg["text"])
            if msg.get("media"):
                lines.append(f"[Media: {msg['media'].get('type', 'file')}]")
            lines.append("")
        
        return "\n".join(lines)


# Singleton instance
export_service = ExportService()
