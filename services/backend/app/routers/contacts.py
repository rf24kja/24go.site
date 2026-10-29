"""Contact platform checks; list and bulk tagging live in phone_parser."""
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contact, User, WaAccount
from app.security import get_current_user
from app.services.platform_checker import check_telegram, check_vkontakte, check_whatsapp, normalize_phone

router = APIRouter(prefix="/api/v1", tags=["contacts"])


async def _connected_wa_account(db, tenant_id):
    result = await db.execute(select(WaAccount).where(
        WaAccount.tenant_id == tenant_id,
        WaAccount.is_active == True,
        WaAccount.status == "connected",
    ).order_by(WaAccount.created_at).limit(1))
    account = result.scalar_one_or_none()
    return str(account.id) if account else None


class CheckPlatformsRequest(BaseModel):
    phones: list[str] = Field(..., min_length=1, max_length=500)


@router.post("/contacts/check-platforms")
async def check_platforms(
    body: CheckPlatformsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account_id = await _connected_wa_account(db, current_user.tenant_id)
    results = []
    for phone in body.phones:
        norm = normalize_phone(phone)
        tg = await check_telegram(norm)
        vk = await check_vkontakte(norm)
        wa = await check_whatsapp(norm, account_id)
        results.append({"phone": norm, "telegram": tg, "vkontakte": vk, "whatsapp": wa})
    return {"results": results}


class RefreshPlatformsRequest(BaseModel):
    contact_ids: list[UUID] = Field(..., min_length=1, max_length=200)


@router.post("/contacts/refresh-platforms")
async def refresh_platforms(
    body: RefreshPlatformsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account_id = await _connected_wa_account(db, current_user.tenant_id)
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
        wa = await check_whatsapp(norm, account_id)
        if isinstance(tg.get("exists"), bool):
            contact.has_tg = tg["exists"]
        if isinstance(wa.get("exists"), bool):
            contact.wa_jid = wa.get("wa_id") if wa["exists"] else None
        tags = set(contact.tags or [])
        if vk.get("exists") is True:
            tags.add("has_vk")
        elif vk.get("exists") is False:
            tags.discard("has_vk")
        contact.tags = sorted(tags)
        updated += 1
    await db.commit()
    return {"updated": updated}
