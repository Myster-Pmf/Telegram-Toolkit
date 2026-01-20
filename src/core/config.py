"""
Configuration Management

Loads settings from environment variables and config files.
Supports multiple database backends and LLM providers.
"""

from pathlib import Path
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    # Application
    app_name: str = Field(default="Telegram Toolkit", alias="APP_NAME")
    app_version: str = "0.1.0"
    app_env: Literal["development", "production"] = Field(
        default="development", alias="APP_ENV"
    )
    debug: bool = Field(default=True, alias="DEBUG")
    secret_key: str = Field(default="change-me-in-production", alias="SECRET_KEY")
    
    # Telegram API
    telegram_api_id: int | None = Field(default=None, alias="TELEGRAM_API_ID")
    telegram_api_hash: str | None = Field(default=None, alias="TELEGRAM_API_HASH")
    
    # Database - Primary
    database_type: Literal["sqlite", "turso", "postgresql"] = Field(
        default="sqlite", alias="DATABASE_TYPE"
    )
    database_path: str = Field(default="./data/telegram_toolkit.db", alias="DATABASE_PATH")
    turso_database_url: str | None = Field(default=None, alias="TURSO_DATABASE_URL")
    turso_auth_token: str | None = Field(default=None, alias="TURSO_AUTH_TOKEN")
    postgres_url: str | None = Field(default=None, alias="POSTGRES_URL")
    
    # Database - Backup
    backup_enabled: bool = Field(default=False, alias="BACKUP_ENABLED")
    backup_database_type: Literal["sqlite", "turso", "postgresql"] | None = Field(
        default=None, alias="BACKUP_DATABASE_TYPE"
    )
    backup_database_url: str | None = Field(default=None, alias="BACKUP_DATABASE_URL")
    backup_sync_mode: Literal["realtime", "scheduled"] = Field(
        default="scheduled", alias="BACKUP_SYNC_MODE"
    )
    backup_sync_interval: str = Field(default="1h", alias="BACKUP_SYNC_INTERVAL")
    
    # LLM
    llm_provider: Literal["gemini", "openai_compatible"] = Field(
        default="gemini", alias="LLM_PROVIDER"
    )
    llm_api_key: str | None = Field(default=None, alias="LLM_API_KEY")
    llm_endpoint: str = Field(
        default="https://api.openai.com/v1", alias="LLM_ENDPOINT"
    )
    llm_model: str = Field(default="gemini-2.0-flash", alias="LLM_MODEL")
    translation_target_language: str = Field(
        default="English", alias="TRANSLATION_TARGET_LANGUAGE"
    )
    
    # Web Server
    host: str = Field(default="127.0.0.1", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    
    # Encryption
    encryption_key: str | None = Field(default=None, alias="ENCRYPTION_KEY")
    
    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    
    # Paths
    @property
    def data_dir(self) -> Path:
        """Get data directory path."""
        path = Path("./data")
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    @property
    def media_dir(self) -> Path:
        """Get media storage directory."""
        path = self.data_dir / "media"
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    @property
    def archives_dir(self) -> Path:
        """Get archives directory."""
        path = self.data_dir / "archives"
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    @property
    def sessions_dir(self) -> Path:
        """Get sessions directory."""
        path = self.data_dir / "sessions"
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def get_database_url(self) -> str:
        """Get the primary database URL based on type."""
        if self.database_type == "sqlite":
            # Ensure parent directory exists
            db_path = Path(self.database_path)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite+aiosqlite:///{db_path}"
        elif self.database_type == "postgresql":
            if not self.postgres_url:
                raise ValueError("POSTGRES_URL is required for PostgreSQL database")
            # Convert to async URL
            url = self.postgres_url
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        elif self.database_type == "turso":
            if not self.turso_database_url:
                raise ValueError("TURSO_DATABASE_URL is required for Turso database")
            # Turso uses libsql, we'll handle this specially
            return self.turso_database_url
        else:
            raise ValueError(f"Unknown database type: {self.database_type}")


# Global settings instance
settings = Settings()
