"""Cross-platform contact management — list, check platforms, bulk-tag, export."""
import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contact, User
from app.security import get_current_user
from app.services.platform_checker import check_telegram, check_vkontakte, check_whatsapp, normalize_phone

router = APIRouter(prefix="/api/v1", tags=["contacts"])


# ── GET /contacts ─────────────────────────────────────────────────────

@router.get("/contacts")
async def list_contacts(
    phone: str | None = None,
    platform: str | None = None,
    country: str | None = None,
    tags: str | None = None,
    quality: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Contact).where(Contact.tenant_id == current_user.tenant_id)
    if phone:
        q = q.where(Contact.phone.ilike(f"%{phone}%"))
    if tags:
        for tag in [t.strip() for t in tags.split(",")]:
            q = q.where(Contact.metadata_["tags"].astext.contains(tag))
    if platform:
        q = q.where(Contact.metadata_[f"platform_{platform}"].as_boolean() == True)
    if country:
        q = q.where(Contact.metadata_["country"].astext == country)
    if quality:
        q = q.where(Contact.metadata_["quality"].astext == quality)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    result = await db.execute(q.order_by(Contact.created_at.desc()).limit(limit).offset(offset))
    return {"items": result.scalars().all(), "total": total, "limit": limit, "offset": offset}


# ── POST /contacts/check-platforms ────────────────────────────────────

class CheckPlatformsRequest(BaseModel):
    phones: list[str] = Field(..., min_length=1, max_length=500)


@router.post("/contacts/check-platforms")
async def check_platforms(
    body: CheckPlatformsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []
    for phone in body.phones:
        norm = normalize_phone(phone)
        tg = await check_telegram(norm)
        vk = await check_vkontakte(norm)
        wa = await check_whatsapp(norm)
        results.append({"phone": norm, "telegram": tg, "vkontakte": vk, "whatsapp": wa})
    return {"results": results}


# ── POST /contacts/refresh-platforms ───────────────────────────────────

class RefreshPlatformsRequest(BaseModel):
    contact_ids: list[UUID] = Field(..., min_length=1, max_length=200)


@router.post("/contacts/refresh-platforms")
async def refresh_platforms(
    body: RefreshPlatformsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = 0
    for cid in body.contact_ids:
        result = await db.execute(
            select(Contact).where(Contact.id == cid, Contact.tenant_id == current_user.tenant_id)
        )
        contact = result.scalar_one_or_none()
        if not contact:
            continue
        norm = normalize_phone(contact.phone)
        meta = dict(contact.metadata_ or {})
        tg = await check_telegram(norm)
        vk = await check_vkontakte(norm)
        wa = await check_whatsapp(norm)
        meta["has_tg"] = tg.get("exists", False)
        meta["has_vk"] = vk.get("exists", False)
        meta["has_wa"] = wa.get("exists", False)
        if wa.get("wa_id"):
            meta["wa_id"] = wa["wa_id"]
        contact.metadata_ = meta
        updated += 1
    await db.commit()
    return {"updated": updated}


# ── POST /contacts/bulk-tag ───────────────────────────────────────────

class BulkTagRequest(BaseModel):
    contact_ids: list[UUID] = Field(..., min_length=1)
    tags: list[str] = Field(..., min_length=1)
    action: str = Field(default="add", pattern="^(add|remove)$")


@router.post("/contacts/bulk-tag")
async def bulk_tag(
    body: BulkTagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = 0
    for cid in body.contact_ids:
        result = await db.execute(
            select(Contact).where(Contact.id == cid, Contact.tenant_id == current_user.tenant_id)
        )
        contact = result.scalar_one_or_none()
        if not contact:
            continue
        meta = dict(contact.metadata_ or {})
        existing = set(meta.get("tags", []))
        if body.action == "add":
            existing.update(body.tags)
        else:
            existing -= set(body.tags)
        meta["tags"] = sorted(existing)
        contact.metadata_ = meta
        updated += 1
    await db.commit()
    return {"updated": updated}


# ── GET /contacts/export ──────────────────────────────────────────────

@router.get("/contacts/export")
async def export_contacts(
    phone: str | None = None,
    platform: str | None = None,
    tags: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Contact).where(Contact.tenant_id == current_user.tenant_id)
    if phone:
        q = q.where(Contact.phone.ilike(f"%{phone}%"))
    if tags:
        for tag in [t.strip() for t in tags.split(",")]:
            q = q.where(Contact.metadata_["tags"].astext.contains(tag))
    if platform:
        q = q.where(Contact.metadata_[f"platform_{platform}"].as_boolean() == True)

    result = await db.execute(q.order_by(Contact.created_at.desc()))
    contacts = result.scalars().all()

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["phone", "name", "wa_id", "has_tg", "has_vk", "has_wa", "tags", "country", "quality", "created_at"])
        for c in contacts:
            meta = c.metadata_ or {}
            writer.writerow([
                c.phone,
                c.name or "",
                c.wa_id or "",
                meta.get("has_tg", False),
                meta.get("has_vk", False),
                meta.get("has_wa", False),
                ",".join(meta.get("tags", [])),
                meta.get("country", ""),
                meta.get("quality", ""),
                c.created_at.isoformat() if c.created_at else "",
            ])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(generate(), media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=contacts.csv"
    })
