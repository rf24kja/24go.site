from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://app_user:secure_password@postgres:5432/app_db"
    DATABASE_URL_SYNC: str = "postgresql://app_user:secure_password@postgres:5432/app_db"
    REDIS_URL: str = "redis://redis:6379/0"

    JWT_SECRET: str = ""  # REQUIRED — app refuses to start without it
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    INTERNAL_API_KEY: str = ""  # Required for /internal/broadcast

    ENCRYPTION_KEY: str = ""

    OPENAI_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""

    N8N_WEBHOOK_URL: str = ""

    # Email notifications
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    NOTIFY_EMAIL: str = ""
    FROM_EMAIL: str = "noreply@24go.site"

    # VKontakte API
    VK_SERVICE_TOKEN: str = ""  # VK community token for group operations
    VK_GROUP_TOKEN: str = ""    # VK group token with messages permission

    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    class Config:
        env_file = ".env"


settings = Settings()
