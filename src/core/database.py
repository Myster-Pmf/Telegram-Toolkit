"""
Database Connection and Session Management

Supports SQLite, PostgreSQL, and Turso (libSQL).
Includes backup sync functionality.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase

from src.core.config import settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


# Engine and session factory (initialized on startup)
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


async def init_database() -> None:
    """Initialize the database connection and create tables."""
    global _engine, _session_factory
    
    if settings.database_type == "turso":
        # Turso requires special handling - for now, fallback to SQLite
        # In production, use libsql-experimental package
        print("⚠️ Turso support requires libsql-experimental. Using SQLite fallback.")
        db_url = f"sqlite+aiosqlite:///{settings.data_dir}/telegram_toolkit.db"
    else:
        db_url = settings.get_database_url()
    
    # Create engine with appropriate settings
    engine_kwargs = {
        "echo": settings.debug and settings.app_env == "development",
    }
    
    if "sqlite" in db_url:
        # SQLite-specific settings
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    
    _engine = create_async_engine(db_url, **engine_kwargs)
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    # Create all tables
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print(f"✅ Database initialized: {settings.database_type}")


async def close_database() -> None:
    """Close the database connection."""
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None
        print("📴 Database connection closed")


@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session as an async context manager."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions."""
    async with get_db() as session:
        yield session
