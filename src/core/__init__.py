"""
Core module - Configuration, database, utilities
"""

from src.core.config import settings
from src.core.database import get_db, init_database

__all__ = ["settings", "get_db", "init_database"]
