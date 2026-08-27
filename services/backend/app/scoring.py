"""Lead scoring rules: configurable thresholds per tenant.

Allows tenants to customize how leads are classified (HOT/WARM/COLD/SPAM)
based on keyword matching and confidence thresholds.
"""
import logging
import uuid

import asyncpg

log = logging.getLogger(__name__)

DDL = """
CREATE TABLE IF NOT EXISTS scoring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    intent VARCHAR(20) NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    min_confidence FLOAT NOT NULL DEFAULT 0.5,
    priority INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_rules_tenant ON scoring_rules(tenant_id);
"""

DEFAULT_RULES = [
    {"name": "Buy signals", "intent": "HOT", "keywords": ["купить", "цена", "сколько стоит", "buy", "price", "how much", "заказать", "order"], "min_confidence": 0.6, "priority": 10},
    {"name": "Interest signals", "intent": "WARM", "keywords": ["интересно", "расскажи", "подробнее", "interested", "tell me more", "как работает", "how does it work"], "min_confidence": 0.5, "priority": 5},
    {"name": "Spam signals", "intent": "SPAM", "keywords": ["casino", "crypto", "earn money", "заработать", "бесплатно", "free", "click here", "нажми"], "min_confidence": 0.4, "priority": 8},
]


async def init_scoring_rules(url: str):
    """Create scoring_rules table and seed defaults for new tenants."""
    conn = await asyncpg.connect(url)
    try:
        await conn.execute(DDL)
    finally:
        await conn.close()


async def get_rules(url: str, tenant_id: str | uuid.UUID) -> list[dict]:
    """Get active scoring rules for a tenant, ordered by priority desc."""
    conn = await asyncpg.connect(url)
    try:
        rows = await conn.fetch(
            """SELECT id, name, intent, keywords, min_confidence, priority, is_active
               FROM scoring_rules WHERE tenant_id = $1 AND is_active = true
               ORDER BY priority DESC, created_at""",
            uuid.UUID(str(tenant_id)),
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def create_rule(url: str, tenant_id: str, name: str, intent: str, keywords: list[str], min_confidence: float, priority: int) -> dict:
    """Create a new scoring rule."""
    conn = await asyncpg.connect(url)
    try:
        row = await conn.fetchrow(
            """INSERT INTO scoring_rules (tenant_id, name, intent, keywords, min_confidence, priority)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, intent, keywords, min_confidence, priority, is_active""",
            uuid.UUID(tenant_id), name, intent, keywords, min_confidence, priority,
        )
        return dict(row)
    finally:
        await conn.close()


async def delete_rule(url: str, tenant_id: str, rule_id: str) -> bool:
    """Soft-delete a scoring rule."""
    conn = await asyncpg.connect(url)
    try:
        result = await conn.execute(
            "UPDATE scoring_rules SET is_active = false WHERE id = $1 AND tenant_id = $2",
            uuid.UUID(rule_id), uuid.UUID(tenant_id),
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()


def classify_with_rules(text: str, rules: list[dict]) -> tuple[str, float]:
    """Classify text using custom rules. Returns (intent, confidence).

    Falls back to keyword heuristic if no rules match.
    """
    text_lower = text.lower()

    for rule in rules:
        keywords = rule.get("keywords", [])
        if isinstance(keywords, str):
            # asyncpg returns arrays as Python lists, but handle string edge case
            keywords = keywords.strip("{}").split(",")

        matches = sum(1 for kw in keywords if kw.strip().lower() in text_lower)
        if matches > 0:
            confidence = min(0.5 + matches * 0.15, 1.0)
            if confidence >= rule.get("min_confidence", 0.5):
                return rule["intent"], confidence

    # Fallback: basic keyword heuristic
    hot_words = ["купить", "buy", "price", "цена", "заказать", "order"]
    warm_words = ["интересно", "interested", "tell me", "расскажи"]
    spam_words = ["casino", "crypto", "free", "бесплатно"]

    hot_matches = sum(1 for w in hot_words if w in text_lower)
    warm_matches = sum(1 for w in warm_words if w in text_lower)
    spam_matches = sum(1 for w in spam_words if w in text_lower)

    if spam_matches > 0:
        return "SPAM", 0.4 + spam_matches * 0.1
    if hot_matches > 0:
        return "HOT", 0.5 + hot_matches * 0.15
    if warm_matches > 0:
        return "WARM", 0.4 + warm_matches * 0.1

    return "COLD", 0.3
