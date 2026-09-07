"""Public tools API — group analysis, no auth required."""
import re
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
        from app.telegram_client import get_client, disconnect_client

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
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch group info: {str(e)[:200]}")


async def _get_analysis_client():
    """Get a connected Telethon client for public group analysis."""
    import os
    import asyncpg

    db_url = os.getenv("DATABASE_URL", "postgresql://app_user:secure_password@postgres:5432/app_db")
    db_url = db_url.replace("+asyncpg", "")

    conn = await asyncpg.connect(db_url)
    try:
        row = await conn.fetchrow(
            "SELECT id::text FROM account_pool WHERE status = 'active' LIMIT 1"
        )
        if not row:
            return None
    finally:
        await conn.close()

    from app.telegram_client import get_client
    return await get_client(row["id"])
