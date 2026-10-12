"""Balance management for TgStat API queries."""
import logging
import os
import uuid

import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, SearchQueryLog
from app.schemas import BalanceResponse, TopUpRequest, TopUpResponse, QueryLogResponse
from app.security import get_current_user
from app.balance import get_or_create_balance

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/balance", tags=["balance"])

# Stripe config
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.24go.site")


# Balance helpers are in app.balance — imported above


@router.get("", response_model=BalanceResponse)
async def get_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current balance for tenant."""
    balance = await get_or_create_balance(current_user.tenant_id, db)
    return BalanceResponse(
        balance_kopeks=balance.balance_kopeks,
        balance_rub=balance.balance_kopeks / 100,
        total_spent_kopeks=balance.total_spent_kopeks,
        total_queries=balance.total_queries,
    )


@router.post("/topup", response_model=TopUpResponse)
async def topup_balance(
    body: TopUpRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create Stripe checkout session for balance top-up."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(500, "Stripe not configured")

    stripe.api_key = STRIPE_SECRET_KEY

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "rub",
                    "product_data": {
                        "name": "24GO Баланс — пополнение на %d₽" % (body.amount_kopeks // 100),
                    },
                    "unit_amount": body.amount_kopeks,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{FRONTEND_URL}/billing?topup=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/billing?topup=cancelled",
            metadata={
                "tenant_id": str(current_user.tenant_id),
                "user_id": str(current_user.id),
                "amount_kopeks": body.amount_kopeks,
            },
        )
        return TopUpResponse(
            checkout_url=session.url,
            session_id=session.id,
        )
    except Exception as e:
        log.error(f"Stripe checkout failed: {e}")
        raise HTTPException(500, f"Payment error: {e}")


@router.get("/history", response_model=list[QueryLogResponse])
async def get_balance_history(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get query history for tenant."""
    result = await db.execute(
        select(SearchQueryLog)
        .where(SearchQueryLog.tenant_id == current_user.tenant_id)
        .order_by(SearchQueryLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


# ── Stripe Webhook ──────────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(
    request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook for balance top-up."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET:
        log.warning("Stripe webhook secret not configured")
        return {"status": "ignored"}

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        tenant_id = session["metadata"]["tenant_id"]
        amount_kopeks = int(session["metadata"]["amount_kopeks"])

        # Credit balance — atomic increment to prevent race conditions
        await db.execute(
            """INSERT INTO user_balances (id, tenant_id, balance_kopeks, total_spent_kopeks, total_queries)
               VALUES (gen_random_uuid(), $1, $2, 0, 0)
               ON CONFLICT (tenant_id) DO UPDATE SET balance_kopeks = user_balances.balance_kopeks + $2""",
            uuid.UUID(tenant_id), amount_kopeks,
        )
        await db.commit()
        log.info(f"Credited {amount_kopeks} kopeks to tenant {tenant_id}")

    return {"status": "ok"}
