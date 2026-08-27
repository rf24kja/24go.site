.agent/BILLING_AND_LIMITS.md
# Specification: Multi-Tenant Billing, Token Metering & Quota Engine (v5.0 Enterprise SaaS)

## 1. System Role & Scope
The Billing & Quota Subsystem (`worker-billing`) is an asynchronous management microservice responsible for tracking platform consumption, enforcing resource limits per subscription tier, calculating API/proxy overheads, metering LLM token usage, and handling SaaS payments via Stripe, YooKassa, and Crypto gateways.

It guarantees multi-tenant operational safety: if a tenant exceeds their plan quotas or runs out of credits, campaign execution is gracefully throttled without interrupting lead qualification or analytics access.

---

## 2. Multi-Tenant Tier & Limits Architecture


+-----------------------------------------------------------------------------------+ | Quota Verification Lifecycle (Per Action) | +-----------------------------------------------------------------------------------+ | v +-----------------------------------------------------------------------------------+ | 1. Intercept Task Trigger (Posting, Scraping, or LLM Execution) | +-----------------------------------------+-----------------------------------------+ | v +-----------------------------------------------------------------------------------+ | 2. Redis Fast Quota Check | | - Verify: Active Subscription Status == 'active' | | - Verify: Monthly Post Volume Used < Monthly Limit | | - Verify: Token Credit Balance > Estimated Task Token Cost | +-----------------------------------------+-----------------------------------------+ | | [Quota Pass] [Quota Exceeded] | | v v +---------------------------------------+ +---------------------------------------+ | Execute Celery Worker Task | | Block Task Execution | | Deduct Quota / Record Metering Log | | Emit 'quota_exceeded' Webhook/UI Alert| +---------------------------------------+ +---------------------------------------+
---

## 3. Subscription Tier Definitions & Resource Allocations

| Feature / Limit | **Starter Plan** | **Pro Plan** | **Enterprise Plan** |
| :--- | :--- | :--- | :--- |
| **Monthly Price** | $149 / month | $399 / month | Custom / $999+ |
| **Active Accounts (Telegram / VK)** | Max 5 accounts | Max 20 accounts | Unlimited |
| **Target Channel Scans** | 100 channels / mo | 500 channels / mo | Unlimited |
| **Published Posts & Comments** | Up to 1,500 / mo | Up to 7,500 / mo | Unlimited / Custom |
| **Included LLM Token Credits** | 1,000,000 tokens | 5,000,000 tokens | Custom Allocation |
| **Dedicated Mobile Proxies** | Shared pool | Dedicated Sticky Proxy | Custom Subnet Pool |
| **CRM & Webhook Integrations** | Webhooks only | AmoCRM + Bitrix24 + Direct API | Full Custom Pipeline |

---

## 4. PostgreSQL Billing DDL & Metering Schema

```sql
-- 1. Tenant Subscriptions & Quotas
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan tenant_plan_type NOT NULL DEFAULT 'trial',
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled'
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    monthly_posts_limit INT NOT NULL DEFAULT 500,
    monthly_posts_used INT NOT NULL DEFAULT 0,
    token_credits_balance INT NOT NULL DEFAULT 200000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_subscription UNIQUE (tenant_id)
);

-- 2. Granular Token & Infrastructure Metering Logs
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL, -- 'llm_rewrite', 'llm_qualification', 'proxy_traffic', 'captcha'
    quantity_used INT NOT NULL,         -- Number of tokens, bytes, or solve count
    estimated_cost_usd NUMERIC(10, 6) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,  -- Contains model_name, task_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Billing Transactions & Invoices
CREATE TABLE billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount_usd NUMERIC(10, 2) NOT NULL,
    payment_provider VARCHAR(50) NOT NULL, -- 'stripe', 'yookassa', 'cryptomus'
    provider_transaction_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL,           -- 'succeeded', 'pending', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Fast Quota Verification
CREATE INDEX idx_usage_logs_tenant_date ON usage_logs(tenant_id, created_at DESC);
CREATE INDEX idx_subscriptions_lookup ON subscriptions(tenant_id, status);

5. Token Metering & Cost Accounting Engine
Every call to external APIs (DeepSeek, OpenAI, CapMonster, Mobile Proxy Rotators) MUST log exact usage metrics to ensure accurate cost tracking and margin protection.
Unit Cost Basis Table (Internal Valuation)
Cost_{LLM} = \left( \frac{\text{Prompt Tokens} \times 0.14}{1,000,000} \right) + \left( \frac{\text{Completion Tokens} \times 0.28}{1,000,000} \right)
Python Metering Decorator Protocol
import time
from functools import wraps

def meter_llm_usage(service_type: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            tenant_id = kwargs.get('tenant_id')
            start_time = time.time()
            
            # Execute LLM API Call
            response, prompt_tokens, completion_tokens = await func(*args, **kwargs)
            
            total_tokens = prompt_tokens + completion_tokens
            cost_usd = ((prompt_tokens * 0.14) + (completion_tokens * 0.28)) / 1_000_000
            
            # Asynchronously Record Usage Log in PostgreSQL
            async with get_db_session() as db:
                await db.execute(
                    text("""
                        INSERT INTO usage_logs (tenant_id, service_type, quantity_used, estimated_cost_usd, metadata)
                        VALUES (:tenant_id, :service_type, :quantity_used, :cost_usd, :metadata)
                    """),
                    {
                        "tenant_id": tenant_id,
                        "service_type": service_type,
                        "quantity_used": total_tokens,
                        "cost_usd": cost_usd,
                        "metadata": json.dumps({"prompt": prompt_tokens, "completion": completion_tokens})
                    }
                )
                
                # Deduct token credits balance
                await db.execute(
                    text("""
                        UPDATE subscriptions 
                        SET token_credits_balance = token_credits_balance - :total_tokens
                        WHERE tenant_id = :tenant_id
                    """),
                    {"tenant_id": tenant_id, "total_tokens": total_tokens}
                )
            
            return response
        return wrapper
    return decorator

6. Payment Gateway Webhook Interceptor Standard
When a user upgrades or renews their subscription, the system processes webhook callbacks via POST /api/v1/billing/webhook/:provider.
Payment Processing Logic (Stripe / YooKassa / Crypto)
@router.post("/billing/webhook/{provider}")
async def handle_payment_webhook(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    
    # 1. Verify Signature & Extract Event Parameters
    tenant_id = payload['data']['object']['metadata']['tenant_id']
    amount_usd = payload['data']['object']['amount'] / 100.0
    provider_tx_id = payload['data']['object']['id']
    plan_tier = payload['data']['object']['metadata']['plan_tier']
    
    # 2. Record Billing Transaction
    await db.execute(
        text("""
            INSERT INTO billing_transactions (tenant_id, amount_usd, payment_provider, provider_transaction_id, status)
            VALUES (:tenant_id, :provider, :amount_usd, :tx_id, 'succeeded')
        """),
        {"tenant_id": tenant_id, "provider": provider, "amount_usd": amount_usd, "tx_id": provider_tx_id}
    )
    
    # 3. Renew Subscription Period & Update Quotas
    await db.execute(
        text("""
            UPDATE subscriptions SET 
                plan = :plan_tier,
                status = 'active',
                current_period_start = NOW(),
                current_period_end = NOW() + INTERVAL '1 month',
                monthly_posts_used = 0,
                token_credits_balance = token_credits_balance + :bonus_tokens
            WHERE tenant_id = :tenant_id
        """),
        {
            "tenant_id": tenant_id, 
            "plan_tier": plan_tier,
            "bonus_tokens": 5_000_000 if plan_tier == 'pro' else 1_000_000
        }
    )
    
    return {"status": "success"}

