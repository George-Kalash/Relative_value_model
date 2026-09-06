from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="G10_",
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
    )

    app_name: str = "G10 Relative-Value Monitor"
    yfinance_timeout_seconds: float = Field(default=10, gt=0, le=60)
    refresh_seconds: int = Field(default=120, ge=60)
    history_ttl_seconds: int = Field(default=3600, ge=60)
    cache_dir: Path = Path(__file__).resolve().parents[3] / "data" / "cache"
    frontend_dir: Path = Path(__file__).resolve().parents[3] / "frontend" / "dist"


settings = Settings()
