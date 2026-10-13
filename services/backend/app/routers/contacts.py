"""Cross-platform contact management — check platforms, refresh, export.

ponytail: list/bulk-tag live in phone_parser.py (registered first wins).
This module keeps only the endpoints unique to it.
"""
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contact, User
from app.security import get_current_user
from app.services.platform_checker import check_telegram, check_vkontakte, check_whatsapp, normalize_phone

router = APIRouter(prefix="/api/v1", tags=["contacts"])



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
        tg = await check_telegram(norm)
        vk = await check_vkontakte(norm)
        wa = await check_whatsapp(norm)
        contact.has_tg = bool(tg.get("exists", False))
        if wa.get("wa_id"):
            contact.wa_jid = wa["wa_id"]
        # ponytail: no has_vk column on Contact — VK presence lives in tags
        tags = set(contact.tags or [])
        if vk.get("exists", False):
            tags.add("has_vk")
        else:
            tags.discard("has_vk")
        contact.tags = sorted(tags)
        updated += 1
    await db.commit()
    return {"updated": updated}




