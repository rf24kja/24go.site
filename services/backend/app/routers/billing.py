"""Billing endpoints: subscription management, Stripe checkout, webhooks, usage.

Stripe SDK is optional — checkout/webhook endpoints work with mock in dev.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timedelta

import asyncpg
import httpx
import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app import db_pool
from app.database import get_db
from app.models import User
from app.quota import PLAN_LIMITS, get_plan_limits
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

log = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
YOOKASSA_SECRET_KEY = os.getenv("YOOKASSA_SECRET_KEY", "")
YOOKASSA_SHOP_ID = os.getenv("YOOKASSA_SHOP_ID", "")


# ── Schemas ───────────────────────────────────────────────────────────

class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    monthly_posts_limit: int
    monthly_posts_used: int
    token_credits_balance: int
    current_period_end: str


class CheckoutRequest(BaseModel):
    plan: str = Field(..., pattern="^(starter|pro|enterprise)$")
    provider: str = Field(default="stripe", pattern="^(stripe|yookassa)$")


class CheckoutResponse(BaseModel):
    checkout_url: str
    provider: str


class UsageSummary(BaseModel):
    total_tokens_used: int
    total_cost_usd: float
    posts_used: int
    posts_limit: int
    tokens_balance: int
    plan: str


class CancelResponse(BaseModel):
    status: str
    plan: str


# ── Subscription Management ───────────────────────────────────────────

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current subscription details for the tenant."""
    from app.billing_models import Subscription
    result = await db.execute(
        select(Subscription).where(Subscription.tenant_id == current_user.tenant_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        # Auto-create trial subscription if missing
        from datetime import timezone as _tz
        sub = Subscription(
            tenant_id=current_user.tenant_id,
            plan="trial",
            status="active",
            current_period_start=datetime.now(_tz.utc),
            current_period_end=datetime.now(_tz.utc) + timedelta(days=14),
            monthly_posts_limit=PLAN_LIMITS["trial"]["monthly_posts_limit"],
            token_credits_balance=PLAN_LIMITS["trial"]["token_credits_balance"],
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return SubscriptionResponse(
        plan=sub.plan.value if hasattr(sub.plan, "value") else sub.plan,
        status=sub.status,
        monthly_posts_limit=sub.monthly_posts_limit,
        monthly_posts_used=sub.monthly_posts_used,
        token_credits_balance=sub.token_credits_balance,
        current_period_end=sub.current_period_end.isoformat(),
    )


@router.post("/cancel", response_model=CancelResponse)
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel current subscription. Stripe subscriptions are deleted via Stripe API."""
    from app.billing_models import Subscription
    result = await db.execute(
        select(Subscription).where(Subscription.tenant_id == current_user.tenant_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "No active subscription")
    plan = sub.plan.value if hasattr(sub.plan, "value") else sub.plan
    if plan == "trial":
        raise HTTPException(400, "Cannot cancel trial subscription")

    # Cancel on Stripe if configured
    if STRIPE_SECRET_KEY:
        stripe.api_key = STRIPE_SECRET_KEY
        try:
            # Look up Stripe customer by tenant_id in metadata
            customers = stripe.Customer.list(metadata={"tenant_id": str(current_user.tenant_id)}, limit=1)
            if customers.data:
                subs = stripe.Subscription.list(customer=customers.data[0].id, status="active", limit=1)
                if subs.data:
                    stripe.Subscription.delete(subs.data[0].id)
        except Exception as e:
            log.warning(f"Stripe cancel failed: {e}")

    sub.status = "cancelled"
    await db.commit()
    log.info(f"Subscription cancelled: tenant={current_user.tenant_id}")
    return CancelResponse(status="cancelled", plan=plan)


@router.get("/usage", response_model=UsageSummary)
async def get_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get usage summary for the current billing period."""
    from app.billing_models import Subscription, UsageLog
    from sqlalchemy import func

    sub_result = await db.execute(
        select(Subscription).where(Subscription.tenant_id == current_user.tenant_id)
    )
    sub = sub_result.scalar_one_or_none()
    if not sub:
        # Return zero usage for new tenants
        return UsageSummary(
            total_tokens_used=0, total_cost_usd=0.0,
            posts_used=0, posts_limit=PLAN_LIMITS["trial"]["monthly_posts_limit"],
            tokens_balance=PLAN_LIMITS["trial"]["token_credits_balance"],
            plan="trial",
        )

    # Aggregate usage for current period
    usage_result = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.quantity_used), 0).label("total_tokens"),
            func.coalesce(func.sum(UsageLog.estimated_cost_usd), 0).label("total_cost"),
        ).where(
            UsageLog.tenant_id == current_user.tenant_id,
            UsageLog.created_at >= sub.current_period_start,
        )
    )
    usage = usage_result.one()

    return UsageSummary(
        total_tokens_used=int(usage.total_tokens),
        total_cost_usd=float(usage.total_cost),
        posts_used=sub.monthly_posts_used,
        posts_limit=sub.monthly_posts_limit,
        tokens_balance=sub.token_credits_balance,
        plan=sub.plan.value if hasattr(sub.plan, "value") else sub.plan,
    )


# ── Stripe Checkout ───────────────────────────────────────────────────

@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a payment checkout session (Stripe or YooKassa)."""
    limits = get_plan_limits(body.plan)

    if body.provider == "stripe":
        url = await _create_stripe_checkout(
            tenant_id=str(current_user.tenant_id),
            plan=body.plan,
            price_usd=_plan_price(body.plan),
            email=current_user.email,
        )
        return CheckoutResponse(checkout_url=url, provider="stripe")

    elif body.provider == "yookassa":
        url = await _create_yookassa_checkout(
            tenant_id=str(current_user.tenant_id),
            plan=body.plan,
            price_usd=_plan_price(body.plan),
        )
        return CheckoutResponse(checkout_url=url, provider="yookassa")

    raise HTTPException(400, "Unknown provider")


def _plan_price(plan: str) -> int:
    """Return monthly price in USD cents."""
    return {"starter": 2500, "pro": 7500, "enterprise": 30000}.get(plan, 2500)


async def _create_stripe_checkout(tenant_id: str, plan: str, price_usd: int, email: str) -> str:
    """Create Stripe Checkout Session and return the URL."""
    if not STRIPE_SECRET_KEY or STRIPE_SECRET_KEY.startswith("sk_test_..."):
        # Mock mode — return a fake checkout URL
        log.warning("Stripe not configured — returning mock checkout URL")
        return f"https://checkout.stripe.com/mock?plan={plan}&tenant={tenant_id}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            auth=(STRIPE_SECRET_KEY, ""),
            data={
                "mode": "subscription",
                "customer_email": email,
                "success_url": f"{os.getenv('APP_URL', 'http://localhost:3000')}/billing?success=true",
                "cancel_url": f"{os.getenv('APP_URL', 'http://localhost:3000')}/billing?canceled=true",
                "metadata[tenant_id]": tenant_id,
                "metadata[plan_tier]": plan,
                "line_items[0][price_data][currency]": "usd",
                "line_items[0][price_data][unit_amount]": price_usd,
                "line_items[0][price_data][product_data][name]": f"24GO {plan.title()} Plan",
                "line_items[0][price_data][recurring][interval]": "month",
                "line_items[0][quantity]": "1",
            },
        )
        resp.raise_for_status()
        return resp.json()["url"]


async def _create_yookassa_checkout(tenant_id: str, plan: str, price_usd: int) -> str:
    """Create YooKassa payment and return the confirmation URL."""
    if not YOOKASSA_SECRET_KEY or YOOKASSA_SHOP_ID == "...":
        log.warning("YooKassa not configured — returning mock checkout URL")
        return f"https://yookassa.ru/mock?plan={plan}&tenant={tenant_id}"

    import base64
    auth = base64.b64encode(f"{YOOKASSA_SHOP_ID}:{YOOKASSA_SECRET_KEY}".encode()).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.yookassa.ru/v3/payments",
            headers={
                "Authorization": f"Basic {auth}",
                "Idempotence-Key": str(uuid.uuid4()),
                "Content-Type": "application/json",
            },
            json={
                "amount": {"value": f"{price_usd / 100:.2f}", "currency": "USD"},
                "confirmation": {"type": "redirect", "return_url": f"{os.getenv('APP_URL', 'http://localhost:3000')}/billing"},
                "capture": True,
                "description": f"GeneratorAD {plan.title()} Plan",
                "metadata": {"tenant_id": tenant_id, "plan_tier": plan},
            },
        )
        resp.raise_for_status()
        return resp.json()["confirmation"]["confirmation_url"]


# ── Webhook Handlers ──────────────────────────────────────────────────

@router.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events (payment_intent.succeeded, etc.)."""
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not STRIPE_WEBHOOK_SECRET or not STRIPE_WEBHOOK_SECRET.startswith("whsec_"):
        log.warning("STRIPE_WEBHOOK_SECRET not configured — returning 200 to avoid Stripe retry storm")
        return {"status": "ignored", "reason": "webhook_not_configured"}

    stripe.api_key = STRIPE_SECRET_KEY
    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        log.error("Stripe webhook: invalid payload")
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError:
        log.error("Stripe webhook: invalid signature")
        raise HTTPException(400, "Invalid signature")

    event_type = event.get("type", "")
    log.info(f"Stripe webhook: {event_type}")

    if event_type == "checkout.session.completed":
        data = event["data"]["object"]
        tenant_id = data.get("metadata", {}).get("tenant_id")
        plan_tier = data.get("metadata", {}).get("plan_tier", "starter")
        amount = (data.get("amount_total") or 0) / 100
        provider_tx_id = data.get("id", "")

        await _process_payment(
            tenant_id=tenant_id,
            plan_tier=plan_tier,
            amount_usd=amount,
            provider="stripe",
            provider_tx_id=provider_tx_id,
        )

    elif event_type == "invoice.payment_succeeded":
        # Subscription renewal — extend period
        data = event["data"]["object"]
        subscription_id = data.get("subscription")
        customer_id = data.get("customer")
        if subscription_id:
            await _extend_subscription(customer_id, subscription_id)
        log.info(f"Stripe invoice.payment_succeeded: sub={subscription_id}")

    elif event_type == "invoice.payment_failed":
        # Dunning — log warning, let Stripe handle retry
        data = event["data"]["object"]
        customer_id = data.get("customer")
        attempt = data.get("attempt_count", 0)
        log.warning(f"Stripe payment failed: customer={customer_id} attempt={attempt}")

    elif event_type == "customer.subscription.deleted":
        # Cancellation — deactivate subscription
        data = event["data"]["object"]
        subscription_id = data.get("id")
        customer_id = data.get("customer")
        if subscription_id:
            await _deactivate_subscription(customer_id, subscription_id)
        log.info(f"Stripe subscription deleted: sub={subscription_id}")

    return {"status": "ok"}


@router.post("/webhook/yookassa")
async def yookassa_webhook(request: Request):
    """Handle YooKassa webhook events.

    YooKassa doesn't use HMAC — we verify by calling back to YooKassa API
    to confirm the payment status matches what was received.
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    if not body or "object" not in body:
        return JSONResponse(status_code=400, content={"error": "Invalid payload"})

    obj = body.get("object", {})
    if not obj.get("id") or not obj.get("status"):
        return JSONResponse(status_code=400, content={"error": "Missing required fields"})

    valid_statuses = {"succeeded", "cancelled", "waiting_for_capture", "pending", "canceled"}
    if obj["status"] not in valid_statuses:
        return {"status": "ignored"}

    try:
        value = float(obj.get("amount", {}).get("value", 0))
        if value <= 0:
            return JSONResponse(status_code=400, content={"error": "Invalid amount"})
    except (TypeError, ValueError):
        return JSONResponse(status_code=400, content={"error": "Invalid amount format"})

    event_type = body.get("event", "")
    log.info(f"YooKassa webhook: {event_type}")

    # Verify payment by calling YooKassa API (prevent forged webhooks)
    provider_tx_id = obj.get("id", "")
    if YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY and provider_tx_id:
        try:
            import base64, urllib.request
            auth_str = base64.b64encode(
                f"{YOOKASSA_SHOP_ID}:{YOOKASSA_SECRET_KEY}".encode()
            ).decode()
            req = urllib.request.Request(
                f"https://api.yookassa.ru/v3/payments/{provider_tx_id}",
                headers={"Authorization": f"Basic {auth_str}", "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                verified = json.loads(resp.read())
                if verified.get("status") != obj.get("status"):
                    log.warning(
                        f"YooKassa webhook status mismatch: got {obj.get('status')} but API says {verified.get('status')}"
                    )
                    return {"status": "ignored"}
        except Exception as e:
            log.warning(f"YooKassa API verification failed: {type(e).__name__}: {e}")
            return JSONResponse(status_code=502, content={"error": "Verification failed"})
    else:
        log.error("YooKassa webhook received but credentials not configured — rejecting")
        return JSONResponse(status_code=500, content={"error": "YooKassa not configured"})

    # Validate required fields
    tenant_id = obj.get("metadata", {}).get("tenant_id")
    if not tenant_id:
        log.warning("YooKassa webhook missing tenant_id — skipping")
        return {"status": "ignored"}

    # Idempotency: check if we already processed this payment
    if provider_tx_id:
        async with db_pool.connection() as conn:
            exists = await conn.fetchval(
                "SELECT 1 FROM billing_transactions WHERE provider_transaction_id = $1",
                provider_tx_id,
            )
            if exists:
                log.info(f"YooKassa webhook duplicate: {provider_tx_id}")
                return {"status": "already_processed"}

    if event_type == "payment.succeeded":
        plan_tier = obj.get("metadata", {}).get("plan_tier", "starter")
        amount = float(obj.get("amount", {}).get("value", 0))

        await _process_payment(
            tenant_id=tenant_id,
            plan_tier=plan_tier,
            amount_usd=amount,
            provider="yookassa",
            provider_tx_id=provider_tx_id,
        )

    return {"status": "ok"}


async def _process_payment(
    tenant_id: str,
    plan_tier: str,
    amount_usd: float,
    provider: str,
    provider_tx_id: str,
):
    """Record payment and upgrade subscription."""
    if not tenant_id:
        log.warning("Webhook missing tenant_id — skipping")
        return

    async with db_pool.connection() as conn:
        tenant_uuid = uuid.UUID(tenant_id)

        await conn.execute(
            """INSERT INTO billing_transactions (id, tenant_id, amount_usd, payment_provider, provider_transaction_id, status)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, 'succeeded')
               ON CONFLICT (provider_transaction_id) DO NOTHING""",
            tenant_uuid, amount_usd, provider, provider_tx_id,
        )

        limits = get_plan_limits(plan_tier)
        await conn.execute(
            """INSERT INTO subscriptions (id, tenant_id, plan, status, current_period_start, current_period_end,
                monthly_posts_used, monthly_posts_limit, token_credits_balance)
               VALUES (gen_random_uuid(), $4, $1::tenant_plan_type, 'active', NOW(), NOW() + INTERVAL '1 month',
                0, $2, $3)
               ON CONFLICT (tenant_id) DO UPDATE SET
                plan = $1::tenant_plan_type,
                status = 'active',
                current_period_start = NOW(),
                current_period_end = NOW() + INTERVAL '1 month',
                monthly_posts_used = 0,
                monthly_posts_limit = $2,
                token_credits_balance = $3""",
            plan_tier,
            limits["monthly_posts_limit"],
            limits["token_credits_balance"],
            tenant_uuid,
        )

        log.info(f"Payment processed: tenant={tenant_id} plan={plan_tier} amount=${amount_usd}")


async def _extend_subscription(customer_id: str | None, subscription_id: str):
    """Extend subscription period on successful renewal."""
    async with db_pool.connection() as conn:
        row = await conn.fetchrow(
            """SELECT tenant_id FROM subscriptions WHERE id::text = $1 LIMIT 1""",
            subscription_id,
        )
        if not row:
            log.warning(f"extend_subscription: no subscription found for {subscription_id}")
            return
        await conn.execute(
            """UPDATE subscriptions SET status = 'active',
                current_period_start = NOW(),
                current_period_end = NOW() + INTERVAL '1 month',
                monthly_posts_used = 0
               WHERE tenant_id = $1""",
            row["tenant_id"],
        )
        log.info(f"Subscription extended: tenant={row['tenant_id']}")


async def _deactivate_subscription(customer_id: str | None, subscription_id: str):
    """Deactivate subscription on cancellation."""
    async with db_pool.connection() as conn:
        row = await conn.fetchrow(
            "SELECT tenant_id FROM subscriptions WHERE id::text = $1 LIMIT 1",
            subscription_id,
        )
        if not row:
            log.warning(f"deactivate_subscription: no subscription found for {subscription_id}")
            return
        await conn.execute(
            "UPDATE subscriptions SET status = 'cancelled' WHERE tenant_id = $1",
            row["tenant_id"],
        )
        log.info(f"Subscription deactivated: tenant={row['tenant_id']}")
