"""Tenant settings API: GET all, GET section, PUT section, POST reset, webhook test."""
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.security import get_current_user
from app.tenant_settings import DEFAULTS, get_settings, get_section, upsert_settings, reset_section
from app.config import settings as app_settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

DATABASE_URL = app_settings.DATABASE_URL.replace("+asyncpg", "")


class SettingsUpdate(BaseModel):
    settings: dict


@router.get("/")
async def list_settings(
    current_user: User = Depends(get_current_user),
):
    """Get all settings for the current tenant (merged with defaults)."""
    cfg = await get_settings(DATABASE_URL, str(current_user.tenant_id))
    return {"settings": cfg, "defaults": DEFAULTS}


@router.get("/{section}")
async def get_settings_section(
    section: str,
    current_user: User = Depends(get_current_user),
):
    """Get a single section (llm, warmup, posting, notifications, groups)."""
    if section not in DEFAULTS:
        return {"error": f"Unknown section: {section}", "available": list(DEFAULTS.keys())}
    cfg = await get_section(DATABASE_URL, str(current_user.tenant_id), section)
    return {"section": section, "settings": cfg, "defaults": DEFAULTS.get(section, {})}


@router.put("/{section}")
async def update_settings_section(
    section: str,
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update a single section. Merges with existing (deep merge)."""
    if section not in DEFAULTS:
        return {"error": f"Unknown section: {section}", "available": list(DEFAULTS.keys())}

    # Wrap in section key if not already
    update = body.settings
    if section not in update:
        update = {section: update}

    merged = await upsert_settings(DATABASE_URL, str(current_user.tenant_id), update)
    return {"section": section, "settings": merged.get(section, {}), "status": "saved"}


@router.post("/reset/{section}")
async def reset_settings_section(
    section: str,
    current_user: User = Depends(get_current_user),
):
    """Reset a section to defaults."""
    if section not in DEFAULTS:
        return {"error": f"Unknown section: {section}", "available": list(DEFAULTS.keys())}

    merged = await reset_section(DATABASE_URL, str(current_user.tenant_id), section)
    return {"section": section, "settings": merged.get(section, {}), "status": "reset_to_defaults"}


# ── Webhook test ──────────────────────────────────────────────────────

class TestWebhookRequest(BaseModel):
    url: str


@router.post("/webhooks/test")
async def test_webhook(
    body: TestWebhookRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a test webhook to the given URL."""
    test_payload = {
        "event": "webhook.test",
        "tenant_id": str(current_user.tenant_id),
        "data": {"message": "This is a test webhook from 24GO"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(body.url, json=test_payload)
            return {"status_code": resp.status_code, "success": 200 <= resp.status_code < 300}
    except Exception as e:
        return {"status_code": 0, "success": False, "error": str(e)}
