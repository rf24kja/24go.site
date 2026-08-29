"""VKontakte API client — session management and API calls.

Ponytail: uses vk_api library for both User and Group API.
Session stored encrypted in account_sessions table (same as Telegram).
"""
import asyncio
import logging
import os
from typing import Optional

log = logging.getLogger(__name__)

# Cache: account_id → vk_session
_vk_sessions: dict = {}


async def get_vk_user_session(account_id: str, access_token: str) -> Optional[object]:
    """Get or create a VK user session from access_token."""
    import vk_api

    if account_id in _vk_sessions:
        return _vk_sessions[account_id]

    try:
        session = vk_api.VkApi(token=access_token)
        _vk_sessions[account_id] = session
        log.info(f"VK user session created for account {account_id}")
        return session
    except Exception as e:
        log.error(f"VK session creation failed: {e}")
        return None


async def get_vk_group_session(account_id: str, group_token: str) -> Optional[object]:
    """Get or create a VK group session from group_token."""
    import vk_api

    cache_key = f"group_{account_id}"
    if cache_key in _vk_sessions:
        return _vk_sessions[cache_key]

    try:
        session = vk_api.VkApi(token=group_token)
        _vk_sessions[cache_key] = session
        log.info(f"VK group session created for account {account_id}")
        return session
    except Exception as e:
        log.error(f"VK group session creation failed: {e}")
        return None


def disconnect_vk(account_id: str) -> None:
    """Remove cached VK sessions for an account."""
    _vk_sessions.pop(account_id, None)
    _vk_sessions.pop(f"group_{account_id}", None)
    log.info(f"VK sessions cleared for account {account_id}")


async def send_code_request_vk(phone: str) -> dict:
    """Initiate VK OAuth — returns validation_hash for code confirmation.

    Note: VK OAuth is browser-based. For API-only flow, we use
    service_token or community token instead.
    Returns: { status: "use_community_token", message: "..." }
    """
    # VK doesn't support phone-based API auth like Telegram.
    # Users must create a community and add a bot, or use service token.
    return {
        "status": "use_community_token",
        "message": (
            "VKontakte uses community (group) tokens for bot operations. "
            "Create a VK community, add a bot in settings, and paste the "
            "community access token. This token allows: reading messages, "
            "posting to the community wall, reading wall comments."
        ),
    }


def get_longpoll_server(vk_session, group_id: int) -> Optional[dict]:
    """Get Long Poll server for listening to group messages."""
    try:
        vk = vk_session.get_api()
        server = vk.messages.getLongPollServer(group_id=group_id)
        return {
            "server": server["server"],
            "key": server["key"],
            "ts": server["ts"],
        }
    except Exception as e:
        log.error(f"LongPoll server error: {e}")
        return None
