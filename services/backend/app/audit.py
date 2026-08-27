"""Audit log: tracks who changed what and when.

Automatically logs lead status changes, campaign edits, and billing events.
"""
import logging
import uuid
from datetime import datetime

import asyncpg

log = logging.getLogger(__name__)

# ponytail: sync connection for audit writes. Use async queue if throughput matters.

DDL = """
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
"""


async def init_audit_table(url: str):
    """Create audit_log table if not exists."""
    conn = await asyncpg.connect(url)
    try:
        await conn.execute(DDL)
    finally:
        await conn.close()


async def log_event(
    url: str,
    tenant_id: str | uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: str | uuid.UUID | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    user_id: str | uuid.UUID | None = None,
    ip_address: str | None = None,
):
    """Write an audit log entry."""
    conn = await asyncpg.connect(url)
    try:
        await conn.execute(
            """INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)""",
            uuid.UUID(str(tenant_id)),
            uuid.UUID(str(user_id)) if user_id else None,
            action,
            entity_type,
            uuid.UUID(str(entity_id)) if entity_id else None,
            str(old_value) if old_value else None,
            str(new_value) if new_value else None,
            ip_address,
        )
    except Exception as e:
        log.error(f"Audit log write failed: {e}")
    finally:
        await conn.close()


async def get_audit_log(
    url: str,
    tenant_id: str | uuid.UUID,
    entity_type: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Read recent audit entries for a tenant."""
    conn = await asyncpg.connect(url)
    try:
        if entity_type:
            rows = await conn.fetch(
                """SELECT id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at
                   FROM audit_log WHERE tenant_id = $1 AND entity_type = $2
                   ORDER BY created_at DESC LIMIT $3""",
                uuid.UUID(str(tenant_id)), entity_type, limit,
            )
        else:
            rows = await conn.fetch(
                """SELECT id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at
                   FROM audit_log WHERE tenant_id = $1
                   ORDER BY created_at DESC LIMIT $2""",
                uuid.UUID(str(tenant_id)), limit,
            )
        return [dict(r) for r in rows]
    finally:
        await conn.close()
