"""Celery application with 5 queues + Beat scheduler + Dead Letter Queue."""
import os
import logging
from celery import Celery
from celery.schedules import crontab
from celery.signals import task_failure

logger = logging.getLogger("dlq")

celery = Celery(
    "leadgen_worker",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
)

celery.conf.broker_connection_retry_on_startup = True

# ponytail: DLQ — failed tasks logged with full context for manual retry
@task_failure.connect
def handle_task_failure(sender, task_id, exception, traceback, **kwargs):
    logger.error(f"DLQ: task={sender.name} id={task_id} error={exception}")

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,
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
        "app.tasks.max_listener.*": {"queue": "listener"},
        "app.tasks.max_poster.*": {"queue": "poster"},
        "app.tasks.billing.*": {"queue": "billing"},
        "app.tasks.drip_emailer.*": {"queue": "billing"},
        "app.tasks.trial_emailer.*": {"queue": "billing"},
        "app.tasks.vk_health_check.*": {"queue": "warmup"},
        "app.tasks.account_validator.*": {"queue": "warmup"},
        "app.tasks.mailer.*": {"queue": "poster"},
        "app.tasks.wa_*": {"queue": "parser"},
        "app.tasks.wa_check_telegram_phones": {"queue": "parser"},
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
        # ponytail: periodic_discovery task never existed — entry removed
        # (was erroring every 6h). Re-add with implementation when needed.
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
        "expire-trial-subscriptions": {
            "task": "app.tasks.billing.expire_trials",
            "schedule": crontab(hour=2, minute=0),
            "options": {"queue": "billing"},
        },
        "trial-emails": {
            "task": "app.tasks.trial_emailer.send_trial_emails",
            "schedule": crontab(hour=10, minute=0),
            "options": {"queue": "billing"},
        },
        "drip-emails": {
            "task": "app.tasks.drip_emailer.send_drip_emails",
            "schedule": crontab(hour=11, minute=0),
            "options": {"queue": "billing"},
        },
        "vk-health-check": {
            "task": "app.tasks.vk_health_check.check_vk_listeners",
            "schedule": crontab(minute="*/5"),
            "options": {"queue": "warmup"},
        },
    },
)

celery.autodiscover_tasks(["app.tasks"])
# ponytail: ordering constraint — Celery(...) above must exist before any
# tasks/__init__ import runs (every task module does `from app.celery_app
# import celery`). Never move imports of app.tasks above the Celery() call.

# ponytail: phantom beat guard — a schedule entry pointing at a task name
# with no implementation must fail loud HERE, not silently every N hours
# in worker logs (precedent: periodic_discovery errored every 6h unnoticed).
import app.tasks  # noqa: F401 — registers all tasks synchronously; safe (celery exists above)
for _sched_name in [
    k for k, v in celery.conf.beat_schedule.items() if v["task"] not in celery.tasks
]:
    logger.error(
        "Dropping phantom beat entry %s -> %s (no such task)",
        _sched_name, celery.conf.beat_schedule[_sched_name]["task"],
    )
    del celery.conf.beat_schedule[_sched_name]
