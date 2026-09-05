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
    # SSRF protection: block internal/private URLs
    from urllib.parse import urlparse
    import ipaddress
    parsed = urlparse(body.url)
    hostname = parsed.hostname or ""
    blocked = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "metadata.google.internal"]
    if hostname in blocked:
        raise HTTPException(400, "Internal URLs are not allowed")
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise HTTPException(400, "Private/internal IPs are not allowed")
    except ValueError:
        if hostname.endswith(".internal") or hostname.endswith(".local"):
            raise HTTPException(400, "Internal domains are not allowed")

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


# ── API Keys ────────────────────────────────────────────────────────

import hashlib
import secrets as _secrets

class ApiKeyCreate(BaseModel):
    name: str

@router.get("/api-keys")
async def list_api_keys(current_user: User = Depends(get_current_user)):
    import asyncpg
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(
            "SELECT id, name, key_preview, created_at, last_used_at, is_active FROM api_keys WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC",
            current_user.tenant_id,
        )
        return {"keys": [dict(r) for r in rows]}
    finally:
        await conn.close()

@router.post("/api-keys")
async def create_api_key(body: ApiKeyCreate, current_user: User = Depends(get_current_user)):
    import asyncpg
    raw_key = f"24go_{_secrets.token_hex(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_preview = raw_key[-8:]
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            "INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, key_preview) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)",
            current_user.tenant_id, current_user.id, body.name, key_hash, key_preview,
        )
    finally:
        await conn.close()
    return {"key": raw_key, "preview": key_preview, "name": body.name}

@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, current_user: User = Depends(get_current_user)):
    import asyncpg
    import uuid
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            "UPDATE api_keys SET is_active = false WHERE id = $1 AND tenant_id = $2",
            uuid.UUID(key_id), current_user.tenant_id,
        )
    finally:
        await conn.close()
    return {"status": "revoked"}


# ── Data Export ──────────────────────────────────────────────────────

@router.get("/export")
async def export_data(current_user: User = Depends(get_current_user)):
    import asyncpg
    import json as _json
    from fastapi.responses import Response
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        tenant_id = current_user.tenant_id
        accounts = await conn.fetch("SELECT account_identifier, status, platform FROM account_pool WHERE tenant_id = $1", tenant_id)
        groups = await conn.fetch("SELECT group_identifier, title, members_count FROM monitored_groups WHERE tenant_id = $1", tenant_id)
        leads = await conn.fetch("SELECT user_handle, intent_score, message_text, created_at FROM leads WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10000", tenant_id)
        campaigns = await conn.fetch("SELECT name, is_active, created_at FROM campaigns WHERE tenant_id = $1", tenant_id)
        settings_row = await conn.fetchrow("SELECT settings FROM tenant_settings WHERE tenant_id = $1", tenant_id)
        export = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "tenant_id": str(tenant_id),
            "accounts": [dict(r) for r in accounts],
            "groups": [dict(r) for r in groups],
            "leads": [dict(r) for r in leads],
            "campaigns": [dict(r) for r in campaigns],
            "settings": _json.loads(settings_row["settings"]) if settings_row else {},
        }
        return Response(
            content=_json.dumps(export, default=str, ensure_ascii=False),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=24go_export_{datetime.now().strftime('%Y%m%d')}.json"},
        )
    finally:
        await conn.close()


# ── Delete Account ──────────────────────────────────────────────────

class DeleteAccountRequest(BaseModel):
    confirm: bool

@router.post("/delete-account")
async def delete_account(body: DeleteAccountRequest, current_user: User = Depends(get_current_user)):
    if not body.confirm:
        return {"error": "Confirmation required"}
    import asyncpg
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        tenant_id = current_user.tenant_id
        for table in ["leads", "account_pool", "monitored_groups", "campaigns", "mailings", "auto_replies", "api_keys"]:
            try:
                await conn.execute(f"DELETE FROM {table} WHERE tenant_id = $1", tenant_id)
            except Exception:
                log.warning(f"Failed to delete from {table} during account deletion")
        await conn.execute("DELETE FROM tenant_settings WHERE tenant_id = $1", tenant_id)
        await conn.execute("UPDATE tenants SET company_name = company_name || ' [DELETED]' WHERE id = $1", tenant_id)
    finally:
        await conn.close()
    return {"status": "deleted"}
