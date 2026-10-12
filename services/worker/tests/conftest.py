"""Worker test env (dummy values, no live services touched)."""
import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db"
)
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/1")
os.environ.setdefault("ENCRYPTION_KEY", "test-encryption-key-for-pytest-only")
