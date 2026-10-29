"""Purpose-separated VK discovery credentials; never campaign accounts."""
from uuid import UUID
import asyncpg
import httpx
from fastapi import HTTPException
from pydantic import BaseModel, SecretStr, Field
from app.config import settings
from app.crypto import encrypt, decrypt, is_encrypted

class DiscoveryConnect(BaseModel):
    access_token: SecretStr = Field(min_length=1, max_length=4096)

async def _vk_call(method: str, token: str, **params):
    # VK accepts form POST: secrets never enter query strings or SDK exception logs.
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post('https://api.vk.com/method/' + method,
                data={'access_token': token, 'v': '5.199', **params})
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, detail={'code': 'vk_unavailable'}) from None

async def connect(tenant_id, body: DiscoveryConnect):
    if not is_encrypted():
        raise HTTPException(503, detail={'code': 'vk_encryption_unavailable'})
    token = body.access_token.get_secret_value().strip()
    if not token or any(c.isspace() for c in token) or any(c in token for c in '?&#/'):
        raise HTTPException(422, detail={'code': 'vk_token_only'})
    profile = await _vk_call('account.getProfileInfo', token)
    user_id = (profile.get('response') or {}).get('id')
    if not isinstance(user_id, int) or user_id <= 0 or profile.get('error'):
        raise HTTPException(422, detail={'code': 'vk_user_token_required'})
    # Identity alone does not establish that this application may call groups.search.
    probe = await _vk_call('groups.search', token, q='24go', count=1)
    if 'error' in probe or not isinstance(probe.get('response', {}).get('items'), list):
        raise HTTPException(422, detail={'code': 'vk_search_permission_required'})
    conn = await asyncpg.connect(settings.DATABASE_URL.replace('+asyncpg', ''))
    try:
        await conn.execute('''INSERT INTO tenant_vk_discovery_credentials (tenant_id, token_ciphertext, vk_user_id)
            VALUES ($1, $2, $3) ON CONFLICT (tenant_id) DO UPDATE
            SET token_ciphertext = EXCLUDED.token_ciphertext, vk_user_id = EXCLUDED.vk_user_id,
                updated_at = NOW()''', UUID(str(tenant_id)), encrypt(token), user_id)
    finally:
        await conn.close()
    return {'connected': True, 'user_id': user_id, 'purpose': 'discovery'}

async def credential(tenant_id, *, remove=False, secret=False):
    conn = await asyncpg.connect(settings.DATABASE_URL.replace('+asyncpg', ''))
    try:
        if remove:
            await conn.execute('DELETE FROM tenant_vk_discovery_credentials WHERE tenant_id = $1', UUID(str(tenant_id)))
            return {'connected': False, 'purpose': 'discovery'}
        row = await conn.fetchrow('SELECT token_ciphertext, vk_user_id FROM tenant_vk_discovery_credentials WHERE tenant_id = $1', UUID(str(tenant_id)))
    finally:
        await conn.close()
    if secret:
        if not row:
            raise HTTPException(409, detail={'code': 'vk_discovery_not_connected'})
        if not is_encrypted():
            raise HTTPException(503, detail={'code': 'vk_encryption_unavailable'})
        try:
            return decrypt(row['token_ciphertext'])
        except ValueError:
            raise HTTPException(409, detail={'code': 'vk_reconnect_required'}) from None
    return {'connected': bool(row), 'user_id': row['vk_user_id'] if row else None, 'purpose': 'discovery'}
