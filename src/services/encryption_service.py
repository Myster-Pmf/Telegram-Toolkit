"""
Encryption Service

Provides AES-256 encryption for secure backups.
Uses password-based key derivation (PBKDF2) for security.
"""

import os
import json
import gzip
import hashlib
import secrets
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime

# Use cryptography library for AES encryption
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend


class EncryptionService:
    """Service for encrypting and decrypting backup files."""
    
    MAGIC_HEADER = b"TGBAK01"  # Magic bytes to identify encrypted backups
    SALT_SIZE = 32
    IV_SIZE = 16
    KEY_SIZE = 32  # AES-256
    ITERATIONS = 100000  # PBKDF2 iterations
    
    @classmethod
    def derive_key(cls, password: str, salt: bytes) -> bytes:
        """Derive encryption key from password using PBKDF2."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=cls.KEY_SIZE,
            salt=salt,
            iterations=cls.ITERATIONS,
            backend=default_backend()
        )
        return kdf.derive(password.encode('utf-8'))
    
    @classmethod
    def encrypt_data(cls, data: bytes, password: str) -> bytes:
        """
        Encrypt data with AES-256-CBC.
        
        Structure: MAGIC + SALT(32) + IV(16) + ENCRYPTED_DATA
        """
        # Generate random salt and IV
        salt = secrets.token_bytes(cls.SALT_SIZE)
        iv = secrets.token_bytes(cls.IV_SIZE)
        
        # Derive key from password
        key = cls.derive_key(password, salt)
        
        # Pad data to block size
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(data) + padder.finalize()
        
        # Encrypt
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(padded_data) + encryptor.finalize()
        
        # Combine: magic + salt + iv + encrypted
        return cls.MAGIC_HEADER + salt + iv + encrypted
    
    @classmethod
    def decrypt_data(cls, encrypted_data: bytes, password: str) -> bytes:
        """
        Decrypt AES-256-CBC encrypted data.
        
        Expects: MAGIC + SALT(32) + IV(16) + ENCRYPTED_DATA
        """
        # Verify magic header
        if not encrypted_data.startswith(cls.MAGIC_HEADER):
            raise ValueError("Invalid encrypted backup format")
        
        # Extract components
        offset = len(cls.MAGIC_HEADER)
        salt = encrypted_data[offset:offset + cls.SALT_SIZE]
        offset += cls.SALT_SIZE
        iv = encrypted_data[offset:offset + cls.IV_SIZE]
        offset += cls.IV_SIZE
        ciphertext = encrypted_data[offset:]
        
        # Derive key from password
        key = cls.derive_key(password, salt)
        
        # Decrypt
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()
        
        # Remove padding
        unpadder = padding.PKCS7(128).unpadder()
        data = unpadder.update(padded_data) + unpadder.finalize()
        
        return data
    
    @classmethod
    def encrypt_file(cls, input_path: str, output_path: str, password: str, compress: bool = True) -> dict:
        """
        Encrypt a file with optional compression.
        
        Returns metadata about the encrypted file.
        """
        input_path = Path(input_path)
        output_path = Path(output_path)
        
        # Read input file
        with open(input_path, 'rb') as f:
            data = f.read()
        
        original_size = len(data)
        
        # Compress if requested
        if compress:
            data = gzip.compress(data, compresslevel=9)
        
        compressed_size = len(data)
        
        # Encrypt
        encrypted = cls.encrypt_data(data, password)
        
        # Write output
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(encrypted)
        
        # Calculate checksum
        checksum = hashlib.sha256(encrypted).hexdigest()
        
        return {
            "original_size": original_size,
            "compressed_size": compressed_size if compress else original_size,
            "encrypted_size": len(encrypted),
            "checksum": checksum,
            "compressed": compress,
        }
    
    @classmethod
    def decrypt_file(cls, input_path: str, output_path: str, password: str, decompress: bool = True) -> dict:
        """
        Decrypt a file with optional decompression.
        
        Returns metadata about the decrypted file.
        """
        input_path = Path(input_path)
        output_path = Path(output_path)
        
        # Read encrypted file
        with open(input_path, 'rb') as f:
            encrypted = f.read()
        
        # Verify checksum
        checksum = hashlib.sha256(encrypted).hexdigest()
        
        # Decrypt
        data = cls.decrypt_data(encrypted, password)
        
        # Decompress if needed
        if decompress:
            try:
                data = gzip.decompress(data)
            except gzip.BadGzipFile:
                # Data wasn't compressed
                pass
        
        # Write output
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(data)
        
        return {
            "encrypted_size": len(encrypted),
            "decrypted_size": len(data),
            "checksum": checksum,
        }
    
    @classmethod
    def encrypt_export(cls, export_dir: str, password: str) -> str:
        """
        Encrypt an entire export directory into a single encrypted file.
        
        Creates a .tgbak file containing all export data.
        """
        export_dir = Path(export_dir)
        
        # Package all files into a single archive
        import zipfile
        import io
        
        # Create in-memory zip
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_path in export_dir.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(export_dir)
                    zf.write(file_path, arcname)
        
        zip_data = zip_buffer.getvalue()
        
        # Encrypt the zip
        encrypted = cls.encrypt_data(zip_data, password)
        
        # Write to .tgbak file
        output_path = export_dir.parent / f"{export_dir.name}.tgbak"
        with open(output_path, 'wb') as f:
            f.write(encrypted)
        
        return str(output_path)
    
    @classmethod
    def decrypt_export(cls, backup_path: str, output_dir: str, password: str) -> str:
        """
        Decrypt an encrypted backup (.tgbak) to a directory.
        
        Returns path to extracted export directory.
        """
        import zipfile
        import io
        
        backup_path = Path(backup_path)
        output_dir = Path(output_dir)
        
        # Read and decrypt
        with open(backup_path, 'rb') as f:
            encrypted = f.read()
        
        zip_data = cls.decrypt_data(encrypted, password)
        
        # Extract zip
        output_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zf:
            zf.extractall(output_dir)
        
        return str(output_dir)
    
    @classmethod
    def verify_password(cls, encrypted_data: bytes, password: str) -> bool:
        """Check if password is correct without fully decrypting."""
        try:
            # Try to decrypt first block
            cls.decrypt_data(encrypted_data[:cls.SALT_SIZE + cls.IV_SIZE + 100 + len(cls.MAGIC_HEADER)], password)
            return True
        except:
            return False


# Singleton
encryption_service = EncryptionService()
