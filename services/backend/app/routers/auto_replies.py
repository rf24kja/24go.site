"""Auto-replies: keyword matching, AI agent, and rotation modes for incoming DMs."""
import uuid as _uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AutoReply, AutoReplyAnswer, User
from app.security import get_current_user
from app.schemas import AutoReplyCreate, AutoReplyUpdate, AutoReplyAnswerCreate
from app.crypto import encrypt as crypto_encrypt

router = APIRouter(prefix="/api/v1/auto-replies", tags=["auto-replies"])


class BulkAnswerImport(BaseModel):
    text: str  # 1 answer per line


def _to_dict(ar: AutoReply, answers_count: int = 0) -> dict:
    return {
        "id": str(ar.id),
        "name": ar.name,
        "mode": ar.mode,
        "keywords": ar.keywords or "",
        "prompt": ar.prompt or "",
        "model": ar.model or "",
        "is_active": ar.is_active,
        "answers_count": answers_count,
        "created_at": ar.created_at.isoformat() if ar.created_at else None,
    }


def _to_detail(ar: AutoReply) -> dict:
    answers = sorted(ar.answers, key=lambda a: a.sort_order) if ar.answers else []
    return {
        "id": str(ar.id),
        "name": ar.name,
        "mode": ar.mode,
        "keywords": ar.keywords or "",
        "prompt": ar.prompt or "",
        "model": ar.model or "",
        "is_active": ar.is_active,
        "answers": [{"id": str(a.id), "text": a.text, "sort_order": a.sort_order} for a in answers],
        "created_at": ar.created_at.isoformat() if ar.created_at else None,
    }


@router.get("/")
async def list_auto_replies(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoReply).where(AutoReply.tenant_id == current_user.tenant_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(
        q.options(selectinload(AutoReply.answers)).order_by(AutoReply.created_at.desc()).limit(limit).offset(offset)
    )
    items = [_to_detail(ar) for ar in result.scalars().unique().all()]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=dict)
async def create_auto_reply(
    body: AutoReplyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ar = AutoReply(
        id=_uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=body.name,
        mode=body.mode,
        keywords=body.keywords,
        prompt=body.prompt,
        model=body.model,
        api_key_encrypted=crypto_encrypt(body.api_key) if body.api_key else "",
    )
    db.add(ar)
    await db.flush()

    for i, text in enumerate(body.answers):
        db.add(AutoReplyAnswer(id=_uuid.uuid4(), auto_reply_id=ar.id, text=text, sort_order=i))

    await db.commit()
    await db.refresh(ar)
    return _to_dict(ar, len(body.answers))


@router.get("/{auto_reply_id}")
async def get_auto_reply(
    auto_reply_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoReply).where(
        AutoReply.id == _uuid.UUID(auto_reply_id),
        AutoReply.tenant_id == current_user.tenant_id,
    ).options(selectinload(AutoReply.answers))
    result = await db.execute(q)
    ar = result.scalars().unique().one_or_none()
    if not ar:
        raise HTTPException(404, "Auto-reply not found")
    return _to_detail(ar)


@router.put("/{auto_reply_id}", response_model=dict)
async def update_auto_reply(
    auto_reply_id: str,
    body: AutoReplyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoReply).where(
        AutoReply.id == _uuid.UUID(auto_reply_id),
        AutoReply.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    ar = result.scalar_one_or_none()
    if not ar:
        raise HTTPException(404, "Auto-reply not found")

    update_data = body.model_dump(exclude_unset=True)
    if "api_key" in update_data:
        update_data["api_key_encrypted"] = crypto_encrypt(update_data.pop("api_key")) if update_data["api_key"] else ""
        if "api_key_encrypted" in update_data and not update_data["api_key_encrypted"]:
            del update_data["api_key_encrypted"]
    for k, v in update_data.items():
        setattr(ar, k, v)
    ar.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(ar)
    return _to_dict(ar)


@router.delete("/{auto_reply_id}", status_code=204)
async def delete_auto_reply(
    auto_reply_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoReply).where(
        AutoReply.id == _uuid.UUID(auto_reply_id),
        AutoReply.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    ar = result.scalar_one_or_none()
    if not ar:
        raise HTTPException(404, "Auto-reply not found")
    await db.delete(ar)
    await db.commit()


@router.post("/{auto_reply_id}/answers", response_model=dict)
async def add_answer(
    auto_reply_id: str,
    body: AutoReplyAnswerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoReply).where(
        AutoReply.id == _uuid.UUID(auto_reply_id),
        AutoReply.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    ar = result.scalar_one_or_none()
    if not ar:
        raise HTTPException(404, "Auto-reply not found")

    _count_q = select(func.count()).where(AutoReplyAnswer.auto_reply_id == ar.id)
    max_order = (await db.execute(select(func.coalesce(func.max(AutoReplyAnswer.sort_order), 0)).where(AutoReplyAnswer.auto_reply_id == ar.id))).scalar() or 0

    answer = AutoReplyAnswer(
        id=_uuid.uuid4(),
        auto_reply_id=ar.id,
        text=body.text,
        sort_order=max_order + 1,
    )
    db.add(answer)
    await db.commit()
    return {"id": str(answer.id), "text": answer.text, "sort_order": answer.sort_order}


@router.delete("/{auto_reply_id}/answers/{answer_id}", status_code=204)
async def delete_answer(
    auto_reply_id: str,
    answer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoReply).where(
        AutoReply.id == _uuid.UUID(auto_reply_id),
        AutoReply.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    ar = result.scalar_one_or_none()
    if not ar:
        raise HTTPException(404, "Auto-reply not found")

    aq = select(AutoReplyAnswer).where(
        AutoReplyAnswer.id == _uuid.UUID(answer_id),
        AutoReplyAnswer.auto_reply_id == ar.id,
    )
    a_result = await db.execute(aq)
    answer = a_result.scalar_one_or_none()
    if not answer:
        raise HTTPException(404, "Answer not found")
    await db.delete(answer)
    await db.commit()


@router.post("/{auto_reply_id}/import-answers")
async def import_answers(
    auto_reply_id: str,
    body: BulkAnswerImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoReply).where(
        AutoReply.id == _uuid.UUID(auto_reply_id),
        AutoReply.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    ar = result.scalar_one_or_none()
    if not ar:
        raise HTTPException(404, "Auto-reply not found")

    max_order = (await db.execute(select(func.coalesce(func.max(AutoReplyAnswer.sort_order), 0)).where(AutoReplyAnswer.auto_reply_id == ar.id))).scalar() or 0

    imported = 0
    for i, line in enumerate(body.text.splitlines()):
        line = line.strip()
        if not line:
            continue
        db.add(AutoReplyAnswer(
            id=_uuid.uuid4(),
            auto_reply_id=ar.id,
            text=line,
            sort_order=max_order + i + 1,
        ))
        imported += 1

    await db.commit()
    return {"imported": imported}


@router.post("/{auto_reply_id}/toggle", response_model=dict)
async def toggle_auto_reply(
    auto_reply_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoReply).where(
        AutoReply.id == _uuid.UUID(auto_reply_id),
        AutoReply.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    ar = result.scalar_one_or_none()
    if not ar:
        raise HTTPException(404, "Auto-reply not found")

    ar.is_active = not ar.is_active
    ar.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": str(ar.id), "is_active": ar.is_active}
