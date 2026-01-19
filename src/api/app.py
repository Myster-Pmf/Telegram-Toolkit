"""
FastAPI Application Factory

Creates and configures the FastAPI application.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.core.database import init_database
from src.api.routes import auth, sessions, chats, users, analytics, archives


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    await init_database()
    print(f"🚀 Telegram Toolkit v{settings.app_version} starting...")
    print(f"📊 Database: {settings.database_type}")
    print(f"🌐 Server: http://{settings.host}:{settings.port}")
    
    yield
    
    # Shutdown
    print("👋 Telegram Toolkit shutting down...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    application = FastAPI(
        title=settings.app_name,
        description="A comprehensive Telegram toolkit for power users",
        version=settings.app_version,
        docs_url="/api/docs" if settings.debug else None,
        redoc_url="/api/redoc" if settings.debug else None,
        lifespan=lifespan,
    )
    
    # CORS middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else ["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    application.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    application.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
    application.include_router(chats.router, prefix="/api/chats", tags=["Chats"])
    application.include_router(users.router, prefix="/api/users", tags=["Users"])
    application.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
    application.include_router(archives.router, prefix="/api/archives", tags=["Archives"])
    
    # Health check
    @application.get("/api/health")
    async def health_check():
        return {
            "status": "healthy",
            "app": settings.app_name,
            "version": settings.app_version,
        }
    
    # Root redirect
    @application.get("/")
    async def root():
        return {
            "message": f"Welcome to {settings.app_name}",
            "docs": "/api/docs" if settings.debug else None,
            "version": settings.app_version,
        }
    
    return application


# Create the app instance at module level for uvicorn
app = create_app()
