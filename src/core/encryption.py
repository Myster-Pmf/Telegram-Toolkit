"""
Encryption Utilities

Provides encryption/decryption for sensitive data at rest.
Uses Fernet (AES-128-CBC) for symmetric encryption.
"""

import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from src.core.config import settings


def _get_fernet() -> Fernet:
    """Get Fernet instance with configured key."""
    key = settings.encryption_key
    
    if not key:
        # Generate a deterministic key from secret_key if encryption_key not set
        # In production, ENCRYPTION_KEY should be set explicitly
        salt = b'telegram-toolkit-salt'  # Static salt for consistency
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(
            kdf.derive(settings.secret_key.encode())
        )
    else:
        # Ensure key is bytes and properly formatted
        if isinstance(key, str):
            key = key.encode()
        # If not already base64, derive it
        try:
            Fernet(key)
        except Exception:
            salt = b'telegram-toolkit-salt'
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(key))
    
    return Fernet(key)


def encrypt_data(data: str) -> bytes:
    """
    Encrypt a string and return encrypted bytes.
    
    Args:
        data: String data to encrypt
        
    Returns:
        Encrypted bytes
    """
    f = _get_fernet()
    return f.encrypt(data.encode())


def decrypt_data(encrypted_data: bytes) -> str:
    """
    Decrypt bytes and return original string.
    
    Args:
        encrypted_data: Encrypted bytes
        
    Returns:
        Decrypted string
    """
    f = _get_fernet()
    return f.decrypt(encrypted_data).decode()


def encrypt_file(file_path: str, output_path: str = None) -> str:
    """
    Encrypt a file.
    
    Args:
        file_path: Path to file to encrypt
        output_path: Output path (defaults to file_path + .enc)
        
    Returns:
        Path to encrypted file
    """
    if output_path is None:
        output_path = file_path + '.enc'
    
    f = _get_fernet()
    
    with open(file_path, 'rb') as file:
        data = file.read()
    
    encrypted = f.encrypt(data)
    
    with open(output_path, 'wb') as file:
        file.write(encrypted)
    
    return output_path


def decrypt_file(encrypted_path: str, output_path: str = None) -> str:
    """
    Decrypt a file.
    
    Args:
        encrypted_path: Path to encrypted file
        output_path: Output path (defaults to removing .enc extension)
        
    Returns:
        Path to decrypted file
    """
    if output_path is None:
        if encrypted_path.endswith('.enc'):
            output_path = encrypted_path[:-4]
        else:
            output_path = encrypted_path + '.dec'
    
    f = _get_fernet()
    
    with open(encrypted_path, 'rb') as file:
        encrypted = file.read()
    
    decrypted = f.decrypt(encrypted)
    
    with open(output_path, 'wb') as file:
        file.write(decrypted)
    
    return output_path


def generate_encryption_key() -> str:
    """
    Generate a new random encryption key.
    
    Returns:
        Base64-encoded encryption key suitable for ENCRYPTION_KEY env var
    """
    return Fernet.generate_key().decode()
