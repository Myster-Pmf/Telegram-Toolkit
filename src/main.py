"""
Telegram Toolkit - Main Entry Point

Starts the FastAPI web server and initializes all services.
"""

import asyncio
import uvicorn
from src.core.config import settings
from src.core.database import init_database
from src.api.app import create_app


async def startup():
    """Initialize application on startup."""
    # Initialize database
    await init_database()
    print(f"🚀 Telegram Toolkit v{settings.app_version} starting...")
    print(f"📊 Database: {settings.database_type}")
    print(f"🌐 Server: http://{settings.host}:{settings.port}")


def main():
    """Run the application."""
    # Create FastAPI app
    app = create_app()
    
    # Add startup event
    @app.on_event("startup")
    async def on_startup():
        await startup()
    
    # Run server
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()
