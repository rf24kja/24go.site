from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/no_such_db"
    DATABASE_URL_SYNC: str = "postgresql://user:password@localhost:5432/no_such_db"
    REDIS_URL: str = "redis://redis:6379/0"

    JWT_SECRET: str = ""  # REQUIRED — app refuses to start without it
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    INTERNAL_API_KEY: str = ""  # Required for /internal/broadcast

    ENCRYPTION_KEY: str = ""

    OPENAI_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    LLM_TIMEOUT: int = 15  # seconds

    N8N_WEBHOOK_URL: str = ""

    # Email notifications
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    NOTIFY_EMAIL: str = ""
    FROM_EMAIL: str = "noreply@24go.site"

    # Telegram Bot
    BOT_TOKEN: str = ""
    OWNER_CHAT_ID: int = 0
    VK_SERVICE_TOKEN: str = ""  # VK community token for group operations
    VK_GROUP_TOKEN: str = ""    # VK group token with messages permission

    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # Pagination
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 200

    # YooKassa
    YOOKASSA_SECRET_KEY: str = ""
    YOOKASSA_SHOP_ID: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

# Startup guards for critical secrets
if not settings.ENCRYPTION_KEY:
    import logging
    logging.getLogger(__name__).warning(
        "ENCRYPTION_KEY not set — Telegram session data stored unencrypted! "
        "Set ENCRYPTION_KEY in .env for production."
    )
