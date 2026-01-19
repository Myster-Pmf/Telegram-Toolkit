"""
Telegram Client Module

Provides abstraction layer for Telegram operations.
Currently uses Telethon, designed for future TDLib support.
"""

from src.telegram.client import TelegramClient, get_client
from src.telegram.session_manager import SessionManager

__all__ = [
    "TelegramClient",
    "get_client",
    "SessionManager",
]
