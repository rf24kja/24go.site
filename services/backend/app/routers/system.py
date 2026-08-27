"""Internal endpoints: webhook test, DB backup, system info.

These are admin-only endpoints for system maintenance.
"""
import io
import csv
import logging
from datetime import datetime

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.models import User
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/system", tags=["system"])
log = logging.getLogger(__name__)


class WebhookTestRequest(BaseModel):
    url: str
    payload: dict = {}
    secret: str = ""


@router.post("/webhook/test")
async def test_webhook(
    body: WebhookTestRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a test webhook to verify n8n/external integration."""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Admin only")

    import httpx
    import hashlib
    import hmac

    headers = {"Content-Type": "application/json"}
    payload_bytes = str(body.payload).encode()

    if body.secret:
        sig = hmac.new(body.secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
        headers["X-Webhook-Signature"] = f"sha256={sig}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(body.url, json=body.payload, headers=headers)
            return {
                "status": resp.status_code,
                "success": 200 <= resp.status_code < 300,
                "body": resp.text[:500],
            }
    except Exception as e:
        return {"status": 0, "success": False, "error": str(e)}


@router.get("/backup/leads")
async def backup_leads_csv(
    current_user: User = Depends(get_current_user),
):
    """Export all leads as CSV backup (admin only)."""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Admin only")

    url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        rows = await conn.fetch(
            """SELECT user_handle, user_full_name, platform, intent_score, status,
                      geo_tag, message_text, dialog_url, created_at
               FROM leads WHERE tenant_id = $1 ORDER BY created_at""",
            current_user.tenant_id,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["handle", "full_name", "platform", "intent", "status", "geo", "message", "dialog_url", "created_at"])
        for r in rows:
            writer.writerow([
                r["user_handle"], r["user_full_name"] or "", r["platform"],
                r["intent_score"], r["status"], r["geo_tag"] or "",
                (r["message_text"] or "")[:1000], r["dialog_url"] or "",
                r["created_at"].isoformat() if r["created_at"] else "",
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=leads_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"},
        )
    finally:
        await conn.close()


@router.get("/info")
async def system_info(
    current_user: User = Depends(get_current_user),
):
    """Get system info (admin only)."""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Admin only")

    url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        # Count records
        tables = ["leads", "campaigns", "targets", "account_pool", "subscriptions", "audit_log", "scoring_rules"]
        counts = {}
        for table in tables:
            try:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE tenant_id = $1", current_user.tenant_id)
                counts[table] = count
            except Exception:
                counts[table] = 0

        return {
            "tenant_id": str(current_user.tenant_id),
            "record_counts": counts,
            "db_status": "connected",
        }
    finally:
        await conn.close()


@router.post("/seed-demo")
async def seed_demo(
    current_user: User = Depends(get_current_user),
):
    """Seed demo data for the tenant (targets, accounts, campaigns, leads)."""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Admin only")

    url = settings.DATABASE_URL.replace("+asyncpg", "")
    from app.seed import seed_demo_data
    result = await seed_demo_data(url, current_user.tenant_id)
    return result
