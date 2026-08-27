"""Parser tasks: target discovery, qualification, DB upsert.

Queue: parser_tasks
Concurrency: Gevent/AsyncIO (100 workers)
Retry: Exponential backoff, 3 retries
Timeout: 300s
"""
import logging
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from celery import shared_task
from sqlalchemy import text

from app.celery_app import celery
from app.locks import acquire_proxy_lock

log = logging.getLogger(__name__)

# ── GEO + Niche search matrix ─────────────────────────────────────────
GEO_KEYWORDS = {
    "Moscow": ["москва", "москвы", "подмосковье"],
    "SPb": ["петербург", "питер", "ленинградская"],
    "Kamchatka": ["камчатка", "петропавловск-камчатский"],
    "Novosibirsk": ["новосибирск", "новосибирской"],
}

NICHE_KEYWORDS = {
    "thailand_travel": ["тайланд", "тайланд", "пхукет", "паттайя", "бали"],
    "phuket_real_estate": ["недвижимость пхукет", "квартира пхукет", "вилла пхукет"],
}


@celery.task(name="app.tasks.parser.discover_targets", bind=True, queue="parser", max_retries=3)
def discover_targets(self, tenant_id: str, geo: str, niche: str, platform: str = "telegram", max_results: int = 50):
    """Scan TG/VK for target groups matching geo + niche.

    Qualification rules (from TASK_PARSER.md):
    - members_count >= 500 (TG) or >= 1000 (VK)
    - ER% >= 1.5%
    - < 70% commercial posts in last 30 days
    - Active in last 14 days
    """
    try:
        log.info(f"discover_targets: tenant={tenant_id} geo={geo} niche={niche} platform={platform}")

        # TODO: Real Telegram/VK API integration in TASK_PARSER.md stage
        # For now, simulate qualified targets
        sample_targets = [
            {
                "target_id_code": f"{niche}_{geo}_{i}",
                "title": f"Sample Target {i} - {geo} {niche}",
                "members_count": 1200 + i * 100,
                "engagement_rate": 2.1 + (i * 0.3),
                "access": "open_comments",
            }
            for i in range(min(3, max_results))
        ]

        return {
            "tenant_id": tenant_id,
            "platform": platform,
            "geo": geo,
            "niche": niche,
            "targets_found": len(sample_targets),
            "status": "completed",
        }

    except Exception as exc:
        log.error(f"discover_targets failed: {exc}")
        raise self.retry(countdown=60 * (2 ** self.request.retries), exc=exc)


@celery.task(name="app.tasks.parser.parse_members", bind=True, queue="parser", max_retries=3)
def parse_members(self, tenant_id: str, target_id: str):
    """Extract member list from a target group/channel."""
    try:
        log.info(f"parse_members: tenant={tenant_id} target={target_id}")
        return {"tenant_id": tenant_id, "target_id": target_id, "members_extracted": 0, "status": "completed"}
    except Exception as exc:
        raise self.retry(countdown=60 * (2 ** self.request.retries), exc=exc)


@celery.task(name="app.tasks.parser.periodic_discovery", queue="parser")
def periodic_discovery():
    """Triggered by Beat every 6 hours. Scans all active tenants' niches."""
    log.info("periodic_discovery: triggered by Beat scheduler")
    # TODO: Query all active tenants and dispatch discover_targets per niche
    return {"status": "triggered"}
