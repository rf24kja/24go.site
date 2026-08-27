"""Scoring rules API: manage lead classification rules."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.database import get_db
from app.models import User
from app.security import get_current_user
from app.scoring import get_rules, create_rule, delete_rule

router = APIRouter(prefix="/api/v1/scoring", tags=["scoring"])


class ScoringRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    intent: str = Field(..., pattern="^(HOT|WARM|COLD|SPAM)$")
    keywords: list[str] = Field(..., min_length=1)
    min_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    priority: int = Field(default=0, ge=0, le=100)


@router.get("/rules")
async def list_rules(
    current_user: User = Depends(get_current_user),
):
    """Get active scoring rules for the tenant."""
    url = settings.DATABASE_URL.replace("+asyncpg", "")
    rules = await get_rules(url, current_user.tenant_id)
    for r in rules:
        r["id"] = str(r["id"])
    return rules


@router.post("/rules", status_code=201)
async def create_scoring_rule(
    body: ScoringRuleCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Create a new scoring rule."""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Only admins can manage scoring rules")

    url = settings.DATABASE_URL.replace("+asyncpg", "")
    rule = await create_rule(
        url=url,
        tenant_id=str(current_user.tenant_id),
        name=body.name,
        intent=body.intent,
        keywords=body.keywords,
        min_confidence=body.min_confidence,
        priority=body.priority,
    )
    rule["id"] = str(rule["id"])

    await log_event(
        url=url, tenant_id=current_user.tenant_id,
        action="created", entity_type="scoring_rule",
        new_value={"name": body.name, "intent": body.intent},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return rule


@router.delete("/rules/{rule_id}")
async def delete_scoring_rule(
    rule_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Delete a scoring rule."""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Only admins can manage scoring rules")

    url = settings.DATABASE_URL.replace("+asyncpg", "")
    deleted = await delete_rule(url, str(current_user.tenant_id), rule_id)
    if not deleted:
        raise HTTPException(404, "Rule not found")

    await log_event(
        url=url, tenant_id=current_user.tenant_id,
        action="deleted", entity_type="scoring_rule",
        entity_id=rule_id,
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return {"status": "ok"}
