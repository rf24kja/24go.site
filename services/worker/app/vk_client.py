"""VKontakte API client — session management and API calls.

Ponytail: uses vk_api library for both User and Group API.
Session stored encrypted in account_sessions table (same as Telegram).
Anti-ban: integrated rate limiting and account rotation.
"""
import asyncio
import logging
import os
import random
from typing import Optional

from .config import settings
from .anti_ban import get_rate_limiter, get_account_rotation, get_warmup_manager

log = logging.getLogger(__name__)

# Cache: account_id → vk_session
_vk_sessions: dict = {}

VK_RATE_LIMITS = {
    "messages": {"max_per_hour": 30, "max_per_day": 300},
    "wall_post": {"max_per_hour": 10, "max_per_day": 50},
    "comment": {"max_per_hour": 50, "max_per_day": 500},
}


async def check_rate_limit(account_id: str, action_type: str) -> bool:
    """Check if account can perform this action."""
    limiter = get_rate_limiter(settings.REDIS_URL)
    limits = VK_RATE_LIMITS.get(action_type, VK_RATE_LIMITS["messages"])
    allowed = await limiter.is_allowed(account_id, action_type, limits)
    if not allowed:
        log.warning(f"Rate limit hit for account {account_id} action {action_type}")
    return allowed


async def wait_for_rate_limit(account_id: str, action_type: str) -> float:
    """Wait until rate limit allows the action."""
    limiter = get_rate_limiter(settings.REDIS_URL)
    limits = VK_RATE_LIMITS.get(action_type, VK_RATE_LIMITS["messages"])
    return await limiter.wait_if_needed(account_id, action_type, limits)


async def record_action(account_id: str, action_type: str) -> None:
    """Record that an action was performed."""
    limiter = get_rate_limiter(settings.REDIS_URL)
    await limiter.record_action(account_id, action_type, {
        "min_delay": int(os.getenv("VK_MIN_DELAY", "15")),
        "max_delay": int(os.getenv("VK_MAX_DELAY", "45")),
    })


async def random_delay() -> None:
    """Sleep for a random duration between actions."""
    min_delay = int(os.getenv("VK_MIN_DELAY", "15"))
    max_delay = int(os.getenv("VK_MAX_DELAY", "45"))
    delay = random.uniform(min_delay, max_delay)
    log.debug(f"Anti-ban delay: {delay:.1f}s")
    await asyncio.sleep(delay)


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
