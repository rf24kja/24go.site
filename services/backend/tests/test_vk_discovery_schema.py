"""Fresh-migration contract; run only with the isolated test PostgreSQL fixture."""
from uuid import uuid4

import asyncpg
import pytest

from app.config import settings


@pytest.mark.asyncio
async def test_discovery_schema_enforces_tenant_identity_and_positive_user():
    conn = await asyncpg.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
    tenant_id = uuid4()
    try:
        await conn.execute(
            "INSERT INTO tenants (id, company_name, plan, is_active, created_at, updated_at) "
            "VALUES ($1, 'VK schema fixture', 'trial', true, now(), now())", tenant_id,
        )
        await conn.execute(
            "INSERT INTO tenant_vk_discovery_credentials "
            "(tenant_id, token_ciphertext, vk_user_id) VALUES ($1, $2, 42)",
            tenant_id, "synthetic-ciphertext-not-a-credential",
        )
        assert await conn.fetchval(
            "SELECT updated_at IS NOT NULL FROM tenant_vk_discovery_credentials WHERE tenant_id=$1",
            tenant_id,
        )
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute(
                "INSERT INTO tenant_vk_discovery_credentials VALUES ($1, 'synthetic', 43, now())",
                tenant_id,
            )
        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute(
                "UPDATE tenant_vk_discovery_credentials SET vk_user_id=0 WHERE tenant_id=$1",
                tenant_id,
            )
        with pytest.raises(asyncpg.ForeignKeyViolationError):
            await conn.execute(
                "INSERT INTO tenant_vk_discovery_credentials VALUES ($1, 'synthetic', 44, now())",
                uuid4(),
            )
        await conn.execute("DELETE FROM tenants WHERE id=$1", tenant_id)
        assert await conn.fetchval(
            "SELECT count(*) FROM tenant_vk_discovery_credentials WHERE tenant_id=$1", tenant_id,
        ) == 0
    finally:
        await conn.close()
