"""Celery CLI entrypoint: celery -A yt_celery:celery worker/beat.
Import deliberately fails closed unless dedicated runtime mounts are injected.
"""
from yt_worker import create_worker

celery = create_worker()
