"""
FastAPI Application Factory

Creates and configures the FastAPI application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from src.core.config import settings
from src.api.routes import auth, sessions, chats, users, analytics, archives


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    app = FastAPI(
        title=settings.app_name,
        description="A comprehensive Telegram toolkit for power users",
        version=settings.app_version,
        docs_url="/api/docs" if settings.debug else None,
        redoc_url="/api/redoc" if settings.debug else None,
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else ["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
    app.include_router(chats.router, prefix="/api/chats", tags=["Chats"])
    app.include_router(users.router, prefix="/api/users", tags=["Users"])
    app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
    app.include_router(archives.router, prefix="/api/archives", tags=["Archives"])
    
    # Health check
    @app.get("/api/health")
    async def health_check():
        return {
            "status": "healthy",
            "app": settings.app_name,
            "version": settings.app_version,
        }
    
    # Root redirect
    @app.get("/")
    async def root():
        return {
            "message": f"Welcome to {settings.app_name}",
            "docs": "/api/docs" if settings.debug else None,
            "version": settings.app_version,
        }
    
    return app
