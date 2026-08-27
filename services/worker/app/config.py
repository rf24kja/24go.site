"""Worker configuration and shared constants."""
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://app_user:secure_password@postgres:5432/app_db")
REDIS_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "")

# Account warmup limits per stage
WARMUP_LIMITS = {
    1: 0,     # Stage 1: passive, no commercial actions
    2: 5,     # Stage 2: soft engagement
    3: 20,    # Stage 3: production
}

# Cooldown duration after flood wait (hours)
COOLDOWN_HOURS = 4

# Target qualification thresholds
MIN_MEMBERS_TELEGRAM = 500
MIN_MEMBERS_VK = 1000
MIN_ENGAGEMENT_RATE = 1.5  # percent
MAX_SPAM_POSTS_PCT = 70.0
MAX_INACTIVE_DAYS = 14
