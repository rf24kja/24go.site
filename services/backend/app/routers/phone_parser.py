"""WhatsApp integration — account connection, group parsing, contact management."""
import asyncio
import csv
import io
import json
import logging
import os
import random
import uuid
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contact, WaAccount, WaGroup, User, WaAccountStatus
from app.rate_limiter import get_redis as get_redis_client

VALID_WA_STATUSES = {s.value for s in WaAccountStatus}
from app.schemas import WaConnectRequest, WaParseRequest, WaAccountResponse, WaGroupResponse
from app.security import get_current_user

router = APIRouter(prefix="/api/v1", tags=["whatsapp"])

log = logging.getLogger(__name__)

WASIDECAR_URL = "http://wa-sidecar:3100"
SIDECAR_TIMEOUT = 30  # ponytail: 30s as per spec, increase for parse if needed
SIDECAR_API_KEY = os.getenv("SIDECAR_API_KEY", "")


def _sidecar_client(timeout=SIDECAR_TIMEOUT) -> httpx.AsyncClient:
    # ponytail: fail-closed auth — sidecar 503s without the key, forcing config
    headers = {"X-Sidecar-Key": SIDECAR_API_KEY} if SIDECAR_API_KEY else {}
    return httpx.AsyncClient(timeout=timeout, headers=headers)


# ── WhatsApp Accounts ─────────────────────────────────────────────────

@router.post("/wa/connect")
async def wa_connect(
    body: WaConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initiate QR or pairing-code connection via wa-sidecar."""
    account = WaAccount(
        tenant_id=current_user.tenant_id,
        phone_number=body.phone_number,
        status="warming_up",
    )
    db.add(account)
    await db.flush()  # get account.id without committing

    async with _sidecar_client() as client:
        resp = await client.post(
            f"{WASIDECAR_URL}/connect",
            json={
                "accountId": str(account.id),
                "phoneNumber": body.phone_number,
                "method": body.method,
            },
        )
    if resp.status_code != 200:
        await db.rollback()
        raise HTTPException(resp.status_code, resp.text)
    await db.commit()
    await db.refresh(account)
    data = resp.json()
    return {"account_id": str(account.id), "qr": data.get("qr"), "pairing_code": data.get("pairing_code") or data.get("code")}


@router.get("/wa/qr/{account_id}")
@router.get("/accounts/{account_id}/whatsapp/qr")  # ponytail: compat for pre-redesign frontend bundles
async def wa_qr(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Poll QR code for a connecting account."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with _sidecar_client() as client:
        resp = await client.get(f"{WASIDECAR_URL}/qr/{account.id}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return resp.json()


@router.get("/wa/pairing-code/{account_id}")
async def wa_pairing_code(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get pairing code for phone-number-based connection."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with _sidecar_client() as client:
        resp = await client.get(f"{WASIDECAR_URL}/pairing-code/{account.id}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return resp.json()


@router.get("/wa/status/{account_id}")
@router.get("/accounts/{account_id}/whatsapp/status")  # ponytail: compat for pre-redesign frontend bundles
async def wa_status(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get connection status for a WhatsApp account."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with _sidecar_client() as client:
        resp = await client.get(f"{WASIDECAR_URL}/status/{account.id}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    data = resp.json()
    new_status = data.get("status", account.status)
    # ponytail: persist only known statuses, sidecar may send others
    if new_status in VALID_WA_STATUSES and new_status != account.status:
        account.status = new_status
        if new_status == "connected":
            account.wa_id = data.get("wa_id") or data.get("phone")
        await db.commit()
    return data


@router.post("/wa/disconnect/{account_id}")
@router.post("/accounts/{account_id}/whatsapp/disconnect")  # ponytail: compat for pre-redesign frontend bundles
async def wa_disconnect(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect a WhatsApp account."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with _sidecar_client() as client:
        resp = await client.post(f"{WASIDECAR_URL}/disconnect/{account.id}")
    if resp.status_code not in (200, 404):
        raise HTTPException(resp.status_code, resp.text)
    account.status = "paused"
    await db.commit()
    return {"status": "disconnected"}


@router.get("/wa/accounts")
async def wa_list_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List WhatsApp accounts for tenant."""
    result = await db.execute(
        select(WaAccount).where(WaAccount.tenant_id == current_user.tenant_id)
    )
    accounts = result.scalars().all()
    return {"items": [WaAccountResponse.model_validate(a) for a in accounts]}


@router.delete("/wa/accounts/{account_id}")
async def wa_remove_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a WhatsApp account."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    await db.delete(account)
    await db.commit()
    return {"deleted": True}


# ── Group Parsing ─────────────────────────────────────────────────────

@router.post("/wa/parse")
async def wa_parse_groups(
    body: WaParseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse WhatsApp groups via wa-sidecar, upsert contacts."""
    account = await _get_wa_account(db, body.account_id, current_user.tenant_id)
    if not body.group_links and not body.group_ids:
        raise HTTPException(400, "Provide group_links or group_ids (max 5)")
    async with _sidecar_client(timeout=120) as client:
        resp = await client.post(
            f"{WASIDECAR_URL}/parse-groups",
            json={
                "accountId": str(account.id),
                "groupLinks": body.group_links,
                "groupIds": body.group_ids,
                "leave": body.leave,
            },
        )
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return await _store_parse_result(db, current_user.tenant_id, resp.json())


async def _store_parse_result(db, tenant_id, data: dict) -> dict:
    """Upsert contacts + groups from a sidecar parse response. Shared by sync/async paths."""
    created_contacts = 0
    group_names = {g["group_id"]: g.get("name", "") for g in data.get("groups", [])}
    for member in data.get("members", []):
        phone = member.get("phone")
        if not phone:
            continue
        existing = await db.execute(
            select(Contact).where(
                Contact.tenant_id == tenant_id,
                Contact.phone == phone,
            )
        )
        if existing.scalar_one_or_none():
            continue
        db.add(Contact(
            tenant_id=tenant_id,
            phone=phone,
            name=member.get("name"),
            wa_jid=member.get("wa_id"),
            wa_group_jid=member.get("group_id"),
            wa_group_source=group_names.get(member.get("group_id", ""), ""),
            wa_parsed_at=datetime.now(timezone.utc),
            tags=["whatsapp"],
        ))
        created_contacts += 1
    for grp in data.get("groups", []):
        existing = await db.execute(
            select(WaGroup).where(
                WaGroup.tenant_id == tenant_id,
                WaGroup.group_id == grp["group_id"],
            )
        )
        g = existing.scalar_one_or_none()
        if g:
            g.name = grp.get("name", g.name)
            g.members_count = grp.get("members_count", g.members_count)
            g.reachable_count = grp.get("reachable_count", grp.get("members_count", 0))
            g.last_scan_at = datetime.now(timezone.utc)
        else:
            db.add(WaGroup(
                tenant_id=tenant_id,
                group_id=grp["group_id"],
                name=grp.get("name"),
                members_count=grp.get("members_count", 0),
                reachable_count=grp.get("reachable_count", grp.get("members_count", 0)),
                last_scan_at=datetime.now(timezone.utc),
            ))
    await db.commit()
    return {
        "created_contacts": created_contacts,
        "groups_updated": len(data.get("groups", [])),
        "total_members": len(data.get("members", [])),
    }


@router.post("/wa/parse-async", status_code=202)
async def wa_parse_async(
    body: WaParseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start background parse job. Returns immediately with job_id.

    ponytail: a 5-group parse holds HTTP ~3 min (anti-ban sleeps) — the
    request returns in ms, progress is polled via /wa/parse-status/{job_id}.
    """
    account = await _get_wa_account(db, body.account_id, current_user.tenant_id)
    account_id = account.id
    links = (body.group_links or [])[:5]
    ids = (body.group_ids or [])[:5]
    if not links and not ids:
        raise HTTPException(400, "Provide group_links or group_ids (max 5)")
    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "tenant_id": str(current_user.tenant_id),
        "account_id": str(account_id),
        "status": "queued",
        "total_groups": len(links) + len(ids),
        "done_groups": 0,
        "created_contacts": 0,
        "error": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        r = await get_redis_client()
        await r.set(f"wa_parse_job:{job_id}", json.dumps(job), ex=3600)
    except Exception as e:
        raise HTTPException(503, f"Job queue unavailable: {type(e).__name__}")
    asyncio.create_task(_run_parse_job(
        job_id, str(current_user.tenant_id), str(account_id),
        links, ids, body.leave,
    ))
    return {"job_id": job_id, "status": "queued", "total_groups": job["total_groups"]}


async def _run_parse_job(job_id: str, tenant_id: str, account_id: str,
                         links: list, ids: list, leave: bool):
    """Background worker: one sidecar call per group, progress in Redis."""
    from app.database import async_session

    async def save(patch: dict):
        try:
            r = await get_redis_client()
            raw = await r.get(f"wa_parse_job:{job_id}")
            job = json.loads(raw) if raw else {"job_id": job_id}
            job.update(patch)
            job["updated_at"] = datetime.now(timezone.utc).isoformat()
            await r.set(f"wa_parse_job:{job_id}", json.dumps(job), ex=3600)
        except Exception as e:
            log.warning(f"parse job {job_id}: progress save failed: {e}")

    targets = [("link", x) for x in links] + [("id", x) for x in ids]
    created_total = 0
    errors: list[str] = []
    try:
        await save({"status": "running"})
        async with async_session() as db:
            for i, (kind, target) in enumerate(targets):
                # Ownership may have changed since enqueue or the previous group.
                await _get_wa_account(db, UUID(account_id), UUID(tenant_id))
                payload: dict = {"accountId": account_id, "leave": leave,
                                 "groupLinks": [], "groupIds": []}
                if kind == "link":
                    payload["groupLinks"] = [target]
                else:
                    payload["groupIds"] = [target]
                try:
                    async with _sidecar_client(timeout=120) as client:
                        resp = await client.post(f"{WASIDECAR_URL}/parse-groups", json=payload)
                except Exception as e:
                    # ponytail: sidecar unreachable is a per-group error, not a job crash
                    errors.append(f"{target}: sidecar unreachable ({str(e)[:120]})")
                    await save({"done_groups": i + 1, "created_contacts": created_total, "errors": errors})
                    continue
                if resp.status_code != 200:
                    # ponytail: used to be log-only — job ended "done" with 0
                    # contacts and the UI toasted success. Now surfaced.
                    errors.append(f"{target}: sidecar {resp.status_code} {resp.text[:150]}")
                else:
                    summary = await _store_parse_result(db, _uuid.UUID(tenant_id), resp.json())
                    created_total += summary.get("created_contacts", 0)
                await save({"done_groups": i + 1, "created_contacts": created_total, "errors": errors})
                if i < len(targets) - 1:
                    # ponytail: pacing lives here now (single-group sidecar calls don't sleep)
                    await asyncio.sleep(15 + random.random() * 30)
        await save({"status": "done", "created_contacts": created_total, "errors": errors})
    except Exception as e:
        log.error(f"parse job {job_id} failed: {e}")
        await save({"status": "failed", "error": str(e)[:300]})


@router.get("/wa/parse-status/{job_id}")
async def wa_parse_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    """Poll background parse progress. Tenant-scoped."""
    try:
        r = await get_redis_client()
        raw = await r.get(f"wa_parse_job:{job_id}")
    except Exception:
        raise HTTPException(503, "Job queue unavailable")
    if not raw:
        raise HTTPException(404, "Unknown or expired job")
    job = json.loads(raw)
    if job.get("tenant_id") != str(current_user.tenant_id):
        raise HTTPException(404, "Unknown or expired job")
    # ponytail: stale running jobs (dead worker) surface as failed, not stuck
    if job.get("status") == "running":
        try:
            updated = datetime.fromisoformat(job.get("updated_at", ""))
            if (datetime.now(timezone.utc) - updated).total_seconds() > 600:
                job["status"] = "failed"
                job["error"] = "worker died mid-parse (stale 10 min)"
        except Exception:
            pass
    return job


@router.get("/wa/groups")
async def wa_list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List parsed WhatsApp groups."""
    result = await db.execute(
        select(WaGroup).where(WaGroup.tenant_id == current_user.tenant_id)
    )
    groups = result.scalars().all()
    return {"items": [WaGroupResponse.model_validate(g) for g in groups]}


@router.get("/wa/known-groups/{account_id}")
async def wa_known_groups(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Groups learned from history sync + live messages. Fallback when the list call fails."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with _sidecar_client(timeout=60) as client:
        resp = await client.get(f"{WASIDECAR_URL}/known-groups/{account.id}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return resp.json()


@router.get("/wa/my-groups/{account_id}")
async def wa_my_groups(    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List groups the account already joined. Pure read, no joins — safest first step."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with _sidecar_client(timeout=200) as client:
        resp = await client.get(f"{WASIDECAR_URL}/my-groups/{account.id}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return resp.json()


# ── Contacts ──────────────────────────────────────────────────────────

@router.get("/contacts")
async def list_contacts(
    search: str | None = None,
    platform: str | None = Query(default=None, pattern="^(telegram|vkontakte|whatsapp|viber)$"),
    page: int | None = Query(default=None, ge=0),
    has_tg: bool | None = None,
    tags: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List contacts with filters."""
    q = select(Contact).where(Contact.tenant_id == current_user.tenant_id)
    if page is not None:
        offset = page * limit
    if platform == "telegram":
        q = q.where(Contact.has_tg == True)
    elif platform == "viber":
        q = q.where(Contact.has_viber == True)
    elif platform == "whatsapp":
        q = q.where(Contact.wa_jid.isnot(None), Contact.wa_jid != "")
    elif platform == "vkontakte":
        q = q.where(Contact.tags.contains(["has_vk"]))
    if search:
        q = q.where(Contact.phone.ilike(f"%{search}%") | Contact.name.ilike(f"%{search}%"))
    if has_tg is not None:
        # ponytail: real boolean column (Contact has no metadata_ JSONB)
        if has_tg:
            q = q.where(Contact.has_tg == True)
        else:
            q = q.where(Contact.has_tg != True)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        for tag in tag_list:
            # ponytail: tags is a JSONB array — @> containment, not text search
            # (Contact has no .astext on this column; that 500'd every filtered call)
            q = q.where(Contact.tags.contains([tag]))
    if date_from:
        q = q.where(Contact.created_at >= date_from)
    if date_to:
        q = q.where(Contact.created_at <= date_to)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(Contact.created_at.desc()).limit(limit).offset(offset)
    )
    from app.services.contact_contract import contact_payload
    return {"items": [contact_payload(c) for c in result.scalars().all()], "total": total, "limit": limit, "offset": offset}


@router.get("/contacts/stats")
async def contact_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Contact statistics."""
    base = select(func.count()).where(Contact.tenant_id == current_user.tenant_id)
    total = (await db.execute(base)).scalar() or 0
    with_tg = (await db.execute(
        base.where(Contact.has_tg == True)
    )).scalar() or 0
    with_viber = (await db.execute(
        base.where(Contact.has_viber == True)
    )).scalar() or 0
    with_wa = (await db.execute(
        base.where(Contact.wa_jid.isnot(None), Contact.wa_jid != "")
    )).scalar() or 0
    with_vk = (await db.execute(
        base.where(Contact.tags.contains(["has_vk"]))
    )).scalar() or 0
    return {"total": total, "with_tg": with_tg, "with_viber": with_viber,
            "telegram": with_tg, "viber": with_viber, "whatsapp": with_wa, "vkontakte": with_vk}


@router.get("/contacts/export")
async def export_contacts_get(
    phone: str | None = None,
    platform: str | None = Query(default=None, pattern="^(telegram|vkontakte|whatsapp|viber)$"),
    tags: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """CSV export with optional filters. Lives ABOVE /{contact_id} on purpose:
    ponytail: FastAPI matches in registration order — /{contact_id} would
    swallow 'export' and 422 on UUID parse (found by tests, 2026-10)."""
    q = select(Contact).where(Contact.tenant_id == current_user.tenant_id)
    if phone:
        q = q.where(Contact.phone.ilike(f"%{phone}%"))
    if search:
        q = q.where(Contact.phone.ilike(f"%{search}%") | Contact.name.ilike(f"%{search}%"))
    if platform == "whatsapp":
        q = q.where(Contact.wa_jid.isnot(None), Contact.wa_jid != "")
    elif platform == "vkontakte":
        q = q.where(Contact.tags.contains(["has_vk"]))
    if tags:
        for tag in [t.strip() for t in tags.split(",")]:
            q = q.where(Contact.tags.contains([tag]))
    if platform == "telegram":
        q = q.where(Contact.has_tg == True)
    elif platform == "viber":
        q = q.where(Contact.has_viber == True)

    result = await db.execute(q.order_by(Contact.created_at.desc()))
    contacts = result.scalars().all()

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["phone", "name", "wa_jid", "has_tg", "has_viber", "tags", "notes", "created_at"])
        for c in contacts:
            writer.writerow([
                c.phone,
                c.name or "",
                c.wa_jid or "",
                c.has_tg or False,
                c.has_viber or False,
                ",".join(c.tags or []),
                c.notes or "",
                c.created_at.isoformat() if c.created_at else "",
            ])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(generate(), media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=contacts.csv"
    })


@router.get("/contacts/{contact_id}")
async def get_contact(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get contact detail."""
    return await _get_contact(db, contact_id, current_user.tenant_id)


class ContactUpdateRequest(BaseModel):
    tags: list[str] | None = None
    notes: str | None = None


@router.put("/contacts/{contact_id}")
async def update_contact(
    contact_id: UUID,
    body: ContactUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update contact tags/notes."""
    contact = await _get_contact(db, contact_id, current_user.tenant_id)
    if body.tags is not None:
        contact.tags = body.tags
    if body.notes is not None:
        contact.notes = body.notes
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a contact."""
    contact = await _get_contact(db, contact_id, current_user.tenant_id)
    await db.delete(contact)
    await db.commit()
    return {"deleted": True}


class CheckTgRequest(BaseModel):
    phones: list[str] = Field(..., min_length=1, max_length=1000)


@router.post("/contacts/check-tg")
async def check_tg(
    body: CheckTgRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispatch Celery task to check phones against Telegram."""
    from app.celery_app import celery
    task = celery.send_task(
        # ponytail: full task path — short "tasks.check_tg_phones" never
        # matched the worker registration and dispatched into the void
        "app.tasks.wa_check_telegram_phones",
        args=[str(current_user.tenant_id), body.phones],
    )
    return {"task_id": task.id, "status": "dispatched"}


@router.post("/contacts/export")
async def export_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """CSV export of contacts."""
    result = await db.execute(
        select(Contact).where(Contact.tenant_id == current_user.tenant_id).order_by(Contact.created_at.desc())
    )
    contacts = result.scalars().all()

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["phone", "name", "wa_jid", "has_tg", "has_viber", "tags", "notes", "created_at"])
        for c in contacts:
            writer.writerow([
                c.phone,
                c.name or "",
                c.wa_jid or "",
                c.has_tg or False,
                c.has_viber or False,
                ",".join(c.tags or []),
                c.notes or "",
                c.created_at.isoformat() if c.created_at else "",
            ])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(generate(), media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=contacts.csv"
    })


class BulkTagRequest(BaseModel):
    contact_ids: list[UUID]
    tags: list[str]
    action: str = Field(default="add", pattern="^(add|remove)$")


@router.post("/contacts/bulk-tag")
async def bulk_tag(
    body: BulkTagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk add/remove tags on contacts."""
    updated = 0
    for cid in body.contact_ids:
        contact = await _get_contact(db, cid, current_user.tenant_id)
        existing_tags = set(contact.tags or [])
        if body.action == "add":
            existing_tags.update(body.tags)
        else:
            existing_tags -= set(body.tags)
        contact.tags = sorted(existing_tags)
        updated += 1
    await db.commit()
    return {"updated": updated}


class AssignCampaignRequest(BaseModel):
    contact_ids: list[UUID]
    campaign_id: UUID


@router.post("/contacts/assign-campaign")
async def assign_campaign(
    body: AssignCampaignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assign contacts to a campaign/mailing."""
    updated = 0
    for cid in body.contact_ids:
        contact = await _get_contact(db, cid, current_user.tenant_id)
        # ponytail: single FK column is the honest mapping (no metadata_ JSONB on Contact)
        contact.last_mailing_campaign_id = body.campaign_id
        updated += 1
    await db.commit()
    return {"updated": updated, "campaign_id": str(body.campaign_id)}


# ── Helpers ───────────────────────────────────────────────────────────

async def _get_wa_account(db: AsyncSession, account_id: UUID, tenant_id: UUID) -> WaAccount:
    result = await db.execute(
        select(WaAccount).where(WaAccount.id == account_id, WaAccount.tenant_id == tenant_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "WA account not found")
    return account


async def _get_contact(db: AsyncSession, contact_id: UUID, tenant_id: UUID) -> Contact:
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.tenant_id == tenant_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    return contact


class WaTextRequest(BaseModel):
    account_id: UUID
    recipient: str = Field(pattern=r'^\+[1-9]\d{7,14}$', max_length=16)
    text: str = Field(min_length=1, max_length=2000)
    confirmed: bool


@router.post('/wa/send-text')
async def wa_send_text(body: WaTextRequest, db: AsyncSession = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    """One explicitly confirmed text; no campaign, queue, retries or delivery claim."""
    if body.confirmed is not True or not body.text.strip():
        raise HTTPException(422, 'confirmation_and_text_required')
    account = await _get_wa_account(db, body.account_id, current_user.tenant_id)
    status = getattr(account.status, 'value', account.status)
    if status != 'connected' or not account.is_active:
        raise HTTPException(409, 'account_not_connected')
    unknown = {'status': 'unknown', 'code': 'ack_unknown_do_not_retry'}
    try:
        async with _sidecar_client(timeout=15) as client:
            response = await client.post(f'{WASIDECAR_URL}/send-text', json={
                'accountId': str(account.id), 'tenantId': str(current_user.tenant_id),
                'recipient': body.recipient, 'text': body.text, 'confirmed': True,
            })
        if response.status_code != 200:
            return unknown
        data = response.json()
        if not isinstance(data, dict):
            return unknown
        if data.get('status') == 'accepted' and isinstance(data.get('message_id'), str) and 0 < len(data['message_id']) <= 128:
            return {'status': 'accepted', 'code': 'server_ack_not_delivery', 'message_id': data['message_id']}
        if data.get('status') == 'failed' and data.get('code') in {
            'invalid_input', 'account_binding', 'disconnected', 'send_locked', 'provider_rejected'
        }:
            return {'status': 'failed', 'code': data['code']}
        return unknown
    except (httpx.HTTPError, ValueError, TypeError):
        return unknown
