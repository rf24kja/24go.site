"""Public tools API — group analysis, no auth required."""
import re
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db_pool

router = APIRouter(prefix="/api/v1/tools", tags=["tools"])


class GroupAnalysisRequest(BaseModel):
    url: str


def _extract_group_identifier(url: str) -> str:
    """Extract group username or invite hash from a Telegram URL."""
    url = url.strip()

    # Direct username: @groupname or groupname
    if url.startswith("@"):
        return url[1:]
    if re.match(r"^[a-zA-Z0-9_]{5,}$", url) and not url.startswith("http"):
        return url

    # https://t.me/username or https://t.me/joinchat/HASH
    parsed = urlparse(url)
    if parsed.hostname in ("t.me", "telegram.me", "telegram.dog"):
        path = parsed.path.strip("/")
        if path.startswith("joinchat/"):
            return path.split("/", 1)[1]
        return path

    raise ValueError("Invalid Telegram URL. Use https://t.me/username or @username")


@router.post("/analyze-group")
async def analyze_group(body: GroupAnalysisRequest):
    """Analyze a public Telegram group. Returns public info only."""
    try:
        identifier = _extract_group_identifier(body.url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        # Use a shared client for public group analysis (no tenant needed)
        # ponytail: use first available account for public group lookups
        client = await _get_analysis_client()
        if not client:
            raise HTTPException(503, "Analysis service temporarily unavailable")

        try:
            entity = await client.get_entity(identifier)

            # Get full info for member count
            from telethon.tl.functions.channels import GetFullChannelRequest
            from telethon.tl.types import Chat, Channel

            if isinstance(entity, (Chat, Channel)):
                try:
                    full = await client(GetFullChannelRequest(entity))
                    members = full.full_chat.participants_count or 0
                except Exception:
                    members = 0
            else:
                members = 0

            return {
                "name": getattr(entity, "username", None) or str(identifier),
                "title": getattr(entity, "title", str(identifier)),
                "description": getattr(entity, "about", "") or "",
                "members_count": members,
                "is_private": getattr(entity, "megagroup", False) is False and not getattr(entity, "username", None),
                "username": getattr(entity, "username", None),
            }
        finally:
            pass  # don't disconnect shared client

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "Failed to fetch group info")


_analysis_client = None


async def _get_analysis_client():
    """Get a connected Telethon client for public group analysis.

    ponytail: single shared client for all public lookups, reuses DB pool.
    """
    global _analysis_client
    if _analysis_client and _analysis_client.is_connected():
        return _analysis_client

    import os
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from app.crypto import decrypt as crypto_decrypt

    tg_id = int(os.environ.get("TG_API_ID", "0"))
    tg_hash = os.environ.get("TG_API_HASH", "")
    if not tg_id or not tg_hash:
        return None

    async with db_pool.connection() as conn:
        row = await conn.fetchrow(
            """SELECT s.session_data
               FROM account_sessions s
               JOIN account_pool p ON p.id = s.account_id
               WHERE p.status = 'active'
               LIMIT 1"""
        )
        if not row:
            return None
        session_string = crypto_decrypt(row["session_data"])

    if not session_string:
        return None

    client = TelegramClient(StringSession(session_string), tg_id, tg_hash)
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        return None

    _analysis_client = client
    return client
