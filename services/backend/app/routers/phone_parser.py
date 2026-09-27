"""WhatsApp integration — account connection, group parsing, contact management."""
import csv
import io
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contact, WaAccount, WaGroup, User
from app.schemas import WaConnectRequest, WaParseRequest, WaAccountResponse, WaGroupResponse
from app.security import get_current_user

router = APIRouter(prefix="/api/v1", tags=["whatsapp"])

WASIDECAR_URL = "http://wa-sidecar:3100"
SIDECAR_TIMEOUT = 30  # ponytail: 30s as per spec, increase for parse if needed


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

    async with httpx.AsyncClient(timeout=SIDECAR_TIMEOUT) as client:
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
    return {"account_id": str(account.id), "qr": data.get("qr"), "pairing_code": data.get("pairing_code")}


@router.get("/wa/qr/{account_id}")
async def wa_qr(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Poll QR code for a connecting account."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with httpx.AsyncClient(timeout=SIDECAR_TIMEOUT) as client:
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
    async with httpx.AsyncClient(timeout=SIDECAR_TIMEOUT) as client:
        resp = await client.get(f"{WASIDECAR_URL}/pairing-code/{account.id}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return resp.json()


@router.get("/wa/status/{account_id}")
async def wa_status(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get connection status for a WhatsApp account."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with httpx.AsyncClient(timeout=SIDECAR_TIMEOUT) as client:
        resp = await client.get(f"{WASIDECAR_URL}/status/{account.id}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    data = resp.json()
    new_status = data.get("status", account.status)
    if new_status != account.status:
        account.status = new_status
        if new_status == "active":
            account.wa_id = data.get("wa_id")
        await db.commit()
    return data


@router.post("/wa/disconnect/{account_id}")
async def wa_disconnect(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect a WhatsApp account."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with httpx.AsyncClient(timeout=SIDECAR_TIMEOUT) as client:
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
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{WASIDECAR_URL}/parse-groups",
            json={
                "accountId": str(account.id),
                "groupLinks": body.group_links,
                "groupIds": body.group_ids,
            },
        )
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    data = resp.json()
    created_contacts = 0
    for member in data.get("members", []):
        phone = member.get("phone")
        if not phone:
            continue
        existing = await db.execute(
            select(Contact).where(
                Contact.tenant_id == current_user.tenant_id,
                Contact.phone == phone,
            )
        )
        if existing.scalar_one_or_none():
            continue
        db.add(Contact(
            tenant_id=current_user.tenant_id,
            phone=phone,
            name=member.get("name"),
            wa_id=member.get("wa_id"),
            is_group=False,
            metadata_={"source_group": member.get("group_id"), "parsed_at": datetime.now(timezone.utc).isoformat()},
        ))
        created_contacts += 1
    for grp in data.get("groups", []):
        existing = await db.execute(
            select(WaGroup).where(
                WaGroup.tenant_id == current_user.tenant_id,
                WaGroup.group_id == grp["group_id"],
            )
        )
        g = existing.scalar_one_or_none()
        if g:
            g.name = grp.get("name", g.name)
            g.members_count = grp.get("members_count", g.members_count)
            g.last_scan_at = datetime.now(timezone.utc)
        else:
            db.add(WaGroup(
                tenant_id=current_user.tenant_id,
                group_id=grp["group_id"],
                name=grp.get("name"),
                members_count=grp.get("members_count", 0),
                last_scan_at=datetime.now(timezone.utc),
            ))
    await db.commit()
    return {
        "created_contacts": created_contacts,
        "groups_updated": len(data.get("groups", [])),
        "total_members": len(data.get("members", [])),
    }


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


@router.get("/wa/my-groups/{account_id}")
async def wa_my_groups(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List groups the account already joined. Pure read, no joins — safest first step."""
    account = await _get_wa_account(db, account_id, current_user.tenant_id)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(f"{WASIDECAR_URL}/my-groups/{account.id}")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return resp.json()


# ── Contacts ──────────────────────────────────────────────────────────

@router.get("/contacts")
async def list_contacts(
    search: str | None = None,
    has_tg: bool | None = None,
    tags: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List contacts with filters."""
    q = select(Contact).where(Contact.tenant_id == current_user.tenant_id)
    if search:
        q = q.where(Contact.phone.ilike(f"%{search}%") | Contact.name.ilike(f"%{search}%"))
    if has_tg is not None:
        if has_tg:
            q = q.where(Contact.metadata_["has_tg"].as_boolean() == True)
        else:
            q = q.where(Contact.metadata_["has_tg"].as_boolean() != True)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        for tag in tag_list:
            q = q.where(Contact.metadata_["tags"].astext.contains(tag))
    if date_from:
        q = q.where(Contact.created_at >= date_from)
    if date_to:
        q = q.where(Contact.created_at <= date_to)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.order_by(Contact.created_at.desc()).limit(limit).offset(offset)
    )
    return {"items": result.scalars().all(), "total": total, "limit": limit, "offset": offset}


@router.get("/contacts/stats")
async def contact_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Contact statistics."""
    base = select(func.count()).where(Contact.tenant_id == current_user.tenant_id)
    total = (await db.execute(base)).scalar() or 0
    with_tg = (await db.execute(
        base.where(Contact.metadata_["has_tg"].as_boolean() == True)
    )).scalar() or 0
    with_viber = (await db.execute(
        base.where(Contact.metadata_["has_viber"].as_boolean() == True)
    )).scalar() or 0
    return {"total": total, "with_tg": with_tg, "with_viber": with_viber}


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
    meta = dict(contact.metadata_ or {})
    if body.tags is not None:
        meta["tags"] = body.tags
    if body.notes is not None:
        meta["notes"] = body.notes
    contact.metadata_ = meta
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
    from app.celery_app import celery_app
    task = celery_app.send_task(
        "tasks.check_tg_phones",
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
        writer.writerow(["phone", "name", "wa_id", "is_group", "tags", "notes", "created_at"])
        for c in contacts:
            meta = c.metadata_ or {}
            writer.writerow([
                c.phone,
                c.name or "",
                c.wa_id or "",
                c.is_group,
                ",".join(meta.get("tags", [])),
                meta.get("notes", ""),
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
        meta = dict(contact.metadata_ or {})
        existing_tags = set(meta.get("tags", []))
        if body.action == "add":
            existing_tags.update(body.tags)
        else:
            existing_tags -= set(body.tags)
        meta["tags"] = sorted(existing_tags)
        contact.metadata_ = meta
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
        meta = dict(contact.metadata_ or {})
        campaigns = meta.get("campaigns", [])
        cid_str = str(body.campaign_id)
        if cid_str not in [str(c) for c in campaigns]:
            campaigns.append(cid_str)
        meta["campaigns"] = campaigns
        contact.metadata_ = meta
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
