"""Minimal Celery producer — sends tasks to worker queues.

No task definitions here, only broker config for send_task().
"""
import os
from celery import Celery

celery = Celery(
    "leadgen_worker",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
)

celery.conf.broker_connection_retry_on_startup = True

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.tasks.listener.*": {"queue": "listener"},
        "app.tasks.vk_listener.*": {"queue": "listener"},
        "app.tasks.max_listener.*": {"queue": "listener"},
        "app.tasks.group_scanner.*": {"queue": "scanner"},
        "app.tasks.vk_group_scanner.*": {"queue": "scanner"},
    },
)
