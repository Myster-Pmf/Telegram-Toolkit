"""
E2E Encryption for Telegram Messages

Encrypts messages before sending to Telegram so they appear as garbage
in regular Telegram clients but can be decrypted in this app.
"""

import base64
import json
import hashlib
import secrets
from typing import Optional, Tuple, Dict, Any
from datetime import datetime

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend


class MessageEncryption:
    """
    Encrypt/decrypt messages for Telegram storage.
    
    Encrypted messages have format:
    🔒[BASE64_ENCRYPTED_DATA]
    
    This prefix makes it clear the message is encrypted.
    """
    
    ENCRYPTED_PREFIX = "🔒"
    ENCRYPTED_MEDIA_PREFIX = "🔐"  # For encrypted file names
    KEY_SIZE = 32  # AES-256
    IV_SIZE = 16
    
    @classmethod
    def derive_key(cls, password: str, chat_id: int) -> bytes:
        """Derive a key from password + chat_id for per-chat encryption."""
        # Use chat_id as part of salt for unique keys per chat
        salt = f"tg_e2e_{chat_id}".encode('utf-8')
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=cls.KEY_SIZE,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return kdf.derive(password.encode('utf-8'))
    
    @classmethod
    def encrypt_text(cls, text: str, password: str, chat_id: int) -> str:
        """
        Encrypt text message for storage on Telegram.
        
        Returns: 🔒[base64_encrypted_data]
        """
        if not text:
            return text
        
        key = cls.derive_key(password, chat_id)
        iv = secrets.token_bytes(cls.IV_SIZE)
        
        # Pad and encrypt
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(text.encode('utf-8')) + padder.finalize()
        
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(padded_data) + encryptor.finalize()
        
        # Combine IV + encrypted and base64 encode
        combined = iv + encrypted
        encoded = base64.b64encode(combined).decode('ascii')
        
        return f"{cls.ENCRYPTED_PREFIX}{encoded}"
    
    @classmethod
    def decrypt_text(cls, encrypted_text: str, password: str, chat_id: int) -> str:
        """
        Decrypt text message from Telegram.
        
        Expects: 🔒[base64_encrypted_data]
        Returns: Original plaintext
        """
        if not encrypted_text or not encrypted_text.startswith(cls.ENCRYPTED_PREFIX):
            return encrypted_text  # Not encrypted, return as-is
        
        try:
            # Remove prefix and decode
            encoded = encrypted_text[len(cls.ENCRYPTED_PREFIX):]
            combined = base64.b64decode(encoded)
            
            # Extract IV and ciphertext
            iv = combined[:cls.IV_SIZE]
            ciphertext = combined[cls.IV_SIZE:]
            
            # Derive key and decrypt
            key = cls.derive_key(password, chat_id)
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            padded_data = decryptor.update(ciphertext) + decryptor.finalize()
            
            # Remove padding
            unpadder = padding.PKCS7(128).unpadder()
            data = unpadder.update(padded_data) + unpadder.finalize()
            
            return data.decode('utf-8')
        except Exception as e:
            # Failed to decrypt - wrong password or corrupted
            return f"[Encrypted - Decryption failed: {str(e)}]"
    
    @classmethod
    def is_encrypted(cls, text: str) -> bool:
        """Check if text is encrypted."""
        return text and text.startswith(cls.ENCRYPTED_PREFIX)
    
    @classmethod
    def encrypt_file(cls, file_data: bytes, password: str, chat_id: int) -> Tuple[bytes, str]:
        """
        Encrypt file data for Telegram storage.
        
        Returns: (encrypted_data, encrypted_filename_hint)
        """
        key = cls.derive_key(password, chat_id)
        iv = secrets.token_bytes(cls.IV_SIZE)
        
        # Pad and encrypt
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(file_data) + padder.finalize()
        
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(padded_data) + encryptor.finalize()
        
        # Prepend IV to encrypted data
        encrypted_with_iv = iv + encrypted
        
        # Generate encrypted filename hint
        file_id = secrets.token_hex(8)
        encrypted_filename = f"{cls.ENCRYPTED_MEDIA_PREFIX}{file_id}.enc"
        
        return encrypted_with_iv, encrypted_filename
    
    @classmethod
    def decrypt_file(cls, encrypted_data: bytes, password: str, chat_id: int) -> bytes:
        """
        Decrypt file data from Telegram.
        
        Expects: IV(16) + ENCRYPTED_DATA
        Returns: Original file data
        """
        try:
            # Extract IV and ciphertext
            iv = encrypted_data[:cls.IV_SIZE]
            ciphertext = encrypted_data[cls.IV_SIZE:]
            
            # Derive key and decrypt
            key = cls.derive_key(password, chat_id)
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            padded_data = decryptor.update(ciphertext) + decryptor.finalize()
            
            # Remove padding
            unpadder = padding.PKCS7(128).unpadder()
            data = unpadder.update(padded_data) + unpadder.finalize()
            
            return data
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")


# Store encryption keys for chats
class EncryptedChatRegistry:
    """
    Store and manage encryption keys for encrypted chats.
    
    Keys are stored in memory and can be persisted to database.
    """
    
    _keys: Dict[int, str] = {}  # chat_id -> password
    
    @classmethod
    def register_key(cls, chat_id: int, password: str):
        """Register encryption key for a chat."""
        cls._keys[chat_id] = password
    
    @classmethod
    def get_key(cls, chat_id: int) -> Optional[str]:
        """Get encryption key for a chat."""
        return cls._keys.get(chat_id)
    
    @classmethod
    def remove_key(cls, chat_id: int):
        """Remove encryption key for a chat."""
        cls._keys.pop(chat_id, None)
    
    @classmethod
    def is_encrypted_chat(cls, chat_id: int) -> bool:
        """Check if chat has encryption key registered."""
        return chat_id in cls._keys
    
    @classmethod
    def list_encrypted_chats(cls) -> list:
        """List all chat IDs with registered keys."""
        return list(cls._keys.keys())


# Convenience singleton
message_encryption = MessageEncryption()
chat_registry = EncryptedChatRegistry()
