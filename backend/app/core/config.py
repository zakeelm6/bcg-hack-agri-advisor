"""Settings, read from environment variables (prefix FA_) and from backend/.env. One place for every tunable value."""
import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FA_", env_file=os.path.join(BACKEND_DIR, ".env"), extra="ignore")

    db: str = os.path.join(BACKEND_DIR, "farm_advisor.db")      # path of the SQLite file (development and demo)
    database_url: str | None = None                              # full SQLAlchemy URL, for example PostgreSQL in production
    static_dir: str = os.path.abspath(os.path.join(BACKEND_DIR, "..", "frontend-legacy"))   # the legacy web app, served at "/" until the React app reaches parity
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"                # comma separated, for the React app in development
    currency: str = "MAD"                                       # shown with the farmer's spending (the app's amounts have no currency of their own)
    max_photo_chars: int = 400_000
    require_device: bool = False                                 # True on a public server: every request must carry a device token (X-Device), else 401
    max_devices: int = Field(5000, ge=1)                         # most phones this server will register
    new_devices_per_minute: int = Field(20, ge=1)                # brake on registering phones (each one creates a field)
    copilot_calls_per_minute: int = Field(30, ge=1)              # brake that protects a paid model key
    voice_calls_per_minute: int = Field(60, ge=1)

    @property
    def sqlalchemy_url(self) -> str:
        return self.database_url or f"sqlite:///{self.db}"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
