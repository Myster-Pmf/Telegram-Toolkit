"""
Clone Service

Handles cloning chats/channels to new destinations.
Supports three modes:
1. Forward Mode - Re-posts content (no forward metadata)
2. Re-upload Mode - Downloads media and uploads fresh
3. Encrypted Mode - Encrypts content before sending (appears as garbage in other apps)
"""

import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any, Callable
from pathlib import Path
import tempfile
import os

from src.core.config import settings
from src.telegram.session_manager import session_manager


class CloneProgress:
    """Track clone operation progress."""
    
    def __init__(self, total: int):
        self.total = total
        self.current = 0
        self.status = "starting"
        self.errors: List[str] = []
        self.started_at = datetime.utcnow()
        self.completed_at: Optional[datetime] = None
    
    def update(self, current: int, status: str = None):
        self.current = current
        if status:
            self.status = status
    
    def add_error(self, error: str):
        self.errors.append(error)
    
    def complete(self):
        self.status = "completed"
        self.completed_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total,
            "current": self.current,
            "percentage": round((self.current / self.total) * 100, 1) if self.total > 0 else 0,
            "status": self.status,
            "errors": self.errors[-10:],  # Last 10 errors
            "error_count": len(self.errors),
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class CloneService:
    """Service for cloning chats/channels."""
    
    # Store active clone operations
    _operations: Dict[str, CloneProgress] = {}
    
    @classmethod
    async def clone_chat(
        cls,
        source_chat_id: int,
        target_chat_id: int,
        mode: str = "reupload",  # "forward", "reupload", or "encrypted"
        include_media: bool = True,
        include_pinned: bool = True,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        delay_seconds: float = 1.0,
        encryption_password: Optional[str] = None,  # Required for encrypted mode
        on_progress: Optional[Callable[[CloneProgress], None]] = None,
    ) -> Dict[str, Any]:
        """
        Clone messages from source chat to target chat.
        
        Modes:
        - "forward": Re-post text (no forward metadata)
        - "reupload": Download and upload media fresh
        - "encrypted": Encrypt text/media before sending (appears as garbage in other apps)
        
        For encrypted mode, provide encryption_password. Messages will look like:
        🔒[encrypted_base64_data] in other Telegram clients.
        """
        if mode == "encrypted" and not encryption_password:
            raise ValueError("encryption_password required for encrypted mode")
        
        client = await session_manager.get_client()
        temp_dir = tempfile.mkdtemp(prefix="tg_clone_")
        
        try:
            print(f"Fetching messages from {source_chat_id}...")
            messages = await client.get_messages(
                source_chat_id,
                limit=10000,
                download_media=False,
            )
            
            # Filter by date
            if date_from or date_to:
                filtered = []
                for msg in messages:
                    if date_from and msg.date < date_from:
                        continue
                    if date_to and msg.date > date_to:
                        continue
                    filtered.append(msg)
                messages = filtered
            
            messages = list(reversed(messages))
            
            progress = CloneProgress(len(messages))
            operation_id = f"{source_chat_id}_to_{target_chat_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            cls._operations[operation_id] = progress
            
            cloned_count = 0
            skipped_count = 0
            
            # Register encryption key if using encrypted mode
            if mode == "encrypted":
                from src.services.message_encryption import EncryptedChatRegistry
                EncryptedChatRegistry.register_key(target_chat_id, encryption_password)
            
            for i, msg in enumerate(messages):
                try:
                    progress.update(i + 1, f"Cloning message {i + 1}/{len(messages)}")
                    if on_progress:
                        on_progress(progress)
                    
                    if not msg.text and not msg.has_media:
                        skipped_count += 1
                        continue
                    
                    if mode == "forward":
                        await cls._clone_forward_mode(client, msg, target_chat_id, include_media)
                    elif mode == "encrypted":
                        await cls._clone_encrypted_mode(
                            client, msg, target_chat_id, include_media, 
                            encryption_password, temp_dir
                        )
                    else:
                        await cls._clone_reupload_mode(client, msg, target_chat_id, include_media, temp_dir)
                    
                    cloned_count += 1
                    await asyncio.sleep(delay_seconds)
                    
                except Exception as e:
                    progress.add_error(f"Message {msg.id}: {str(e)}")
                    print(f"Error cloning message {msg.id}: {e}")
            
            progress.complete()
            
            return {
                "operation_id": operation_id,
                "source_chat_id": source_chat_id,
                "target_chat_id": target_chat_id,
                "mode": mode,
                "is_encrypted": mode == "encrypted",
                "total_messages": len(messages),
                "cloned_count": cloned_count,
                "skipped_count": skipped_count,
                "error_count": len(progress.errors),
                "status": "completed",
            }
            
        finally:
            import shutil
            try:
                shutil.rmtree(temp_dir)
            except:
                pass
    
    @classmethod
    async def _clone_forward_mode(cls, client, message, target_chat_id: int, include_media: bool):
        """Re-posts text without forward metadata."""
        text = message.text or ""
        
        if message.has_media and include_media:
            await cls._send_with_media(client, message, target_chat_id, text)
        elif text:
            await client.send_message(target_chat_id, text)
    
    @classmethod
    async def _clone_reupload_mode(cls, client, message, target_chat_id: int, include_media: bool, temp_dir: str):
        """Downloads media and uploads fresh."""
        text = message.text or ""
        
        if message.has_media and include_media:
            await cls._send_with_media(client, message, target_chat_id, text, temp_dir)
        elif text:
            await client.send_message(target_chat_id, text)
    
    @classmethod
    async def _clone_encrypted_mode(
        cls, client, message, target_chat_id: int, 
        include_media: bool, password: str, temp_dir: str
    ):
        """
        Encrypts content before sending.
        Text becomes: 🔒[base64_encrypted_data]
        Media files are encrypted before upload.
        """
        from src.services.message_encryption import MessageEncryption
        
        text = message.text or ""
        
        # Encrypt text
        encrypted_text = ""
        if text:
            encrypted_text = MessageEncryption.encrypt_text(text, password, target_chat_id)
        
        if message.has_media and include_media:
            await cls._send_encrypted_media(
                client, message, target_chat_id, encrypted_text, password, temp_dir
            )
        elif encrypted_text:
            await client.send_message(target_chat_id, encrypted_text)
    
    @classmethod
    async def _send_with_media(cls, client, message, target_chat_id: int, caption: str, temp_dir: str = None):
        """Download media and send to target."""
        if temp_dir is None:
            temp_dir = tempfile.gettempdir()
        
        temp_path = os.path.join(temp_dir, f"media_{message.id}")
        
        try:
            downloaded = await client.download_media(message, temp_path)
            
            if downloaded and os.path.exists(downloaded):
                await client.send_file(target_chat_id, downloaded, caption=caption)
                os.remove(downloaded)
            elif caption:
                await client.send_message(target_chat_id, caption)
                
        except Exception as e:
            print(f"Error sending media: {e}")
            if caption:
                await client.send_message(target_chat_id, caption)
    
    @classmethod
    async def _send_encrypted_media(
        cls, client, message, target_chat_id: int, 
        encrypted_caption: str, password: str, temp_dir: str
    ):
        """Download, encrypt, and send media."""
        from src.services.message_encryption import MessageEncryption
        
        temp_path = os.path.join(temp_dir, f"media_{message.id}")
        
        try:
            downloaded = await client.download_media(message, temp_path)
            
            if downloaded and os.path.exists(downloaded):
                # Read and encrypt file
                with open(downloaded, 'rb') as f:
                    file_data = f.read()
                
                encrypted_data, encrypted_filename = MessageEncryption.encrypt_file(
                    file_data, password, target_chat_id
                )
                
                # Write encrypted file
                encrypted_path = os.path.join(temp_dir, encrypted_filename)
                with open(encrypted_path, 'wb') as f:
                    f.write(encrypted_data)
                
                # Send encrypted file
                await client.send_file(
                    target_chat_id, 
                    encrypted_path, 
                    caption=encrypted_caption
                )
                
                # Cleanup
                os.remove(downloaded)
                os.remove(encrypted_path)
            elif encrypted_caption:
                await client.send_message(target_chat_id, encrypted_caption)
                
        except Exception as e:
            print(f"Error sending encrypted media: {e}")
            if encrypted_caption:
                await client.send_message(target_chat_id, encrypted_caption)
    
    @classmethod
    def get_progress(cls, operation_id: str) -> Optional[CloneProgress]:
        return cls._operations.get(operation_id)
    
    @classmethod
    def list_operations(cls) -> List[Dict[str, Any]]:
        return [
            {"operation_id": op_id, **progress.to_dict()}
            for op_id, progress in cls._operations.items()
        ]


clone_service = CloneService()

