"""Celery application with 5 queues + Beat scheduler."""
import os
from celery import Celery
from celery.schedules import crontab

celery = Celery(
    "leadgen_worker",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.tasks.parser.*": {"queue": "parser"},
        "app.tasks.poster.*": {"queue": "poster"},
        "app.tasks.warmup.*": {"queue": "warmup"},
        "app.tasks.listener.*": {"queue": "listener"},
        "app.tasks.comment_scraper.*": {"queue": "parser"},
        "app.tasks.group_scanner.*": {"queue": "listener"},
        "app.tasks.vk_listener.*": {"queue": "listener"},
        "app.tasks.vk_poster.*": {"queue": "poster"},
        "app.tasks.vk_comment_scraper.*": {"queue": "parser"},
        "app.tasks.vk_group_scanner.*": {"queue": "listener"},
        "app.tasks.billing.*": {"queue": "billing"},
    },
    # ── Periodic Task Schedule (Celery Beat) ──────────────────────────
    beat_schedule={
        "daily-account-warmup-trigger": {
            "task": "app.tasks.warmup.trigger_daily_warmup",
            "schedule": crontab(hour=8, minute=0),
            "options": {"queue": "warmup"},
        },
        "reset-daily-account-limits": {
            "task": "app.tasks.billing.reset_daily_limits",
            "schedule": crontab(hour=0, minute=0),
            "options": {"queue": "billing"},
        },
        "periodic-target-discovery": {
            "task": "app.tasks.parser.periodic_discovery",
            "schedule": crontab(minute=0, hour="*/6"),
            "options": {"queue": "parser"},
        },
        "periodic-campaign-post": {
            "task": "app.tasks.poster.periodic_campaign_post",
            "schedule": crontab(minute="*/5"),
            "options": {"queue": "poster"},
        },
        "daily-lead-summary-emails": {
            "task": "app.tasks.billing.daily_summary_emails",
            "schedule": crontab(hour=9, minute=0),
            "options": {"queue": "billing"},
        },
    },
)

celery.autodiscover_tasks(["app.tasks"])
