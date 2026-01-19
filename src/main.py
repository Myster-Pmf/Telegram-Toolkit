"""
Telegram Toolkit - Main Entry Point

Starts the FastAPI web server and initializes all services.
"""

import uvicorn
from src.core.config import settings


def main():
    """Run the application."""
    # Run server with import string for reload support
    uvicorn.run(
        "src.api.app:app",  # Use import string for reload support
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()
