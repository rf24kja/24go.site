"""VKontakte API client — session management and API calls.

Ponytail: uses vk_api library for both User and Group API.
Session stored encrypted in account_sessions table (same as Telegram).
Anti-ban: integrated rate limiting and account rotation.
"""
import asyncio
import hashlib
import base64
import logging
import os
import random
import threading
import time
from typing import Optional

import asyncpg

from .config import DATABASE_URL, REDIS_URL, WARMUP_LIMITS
from .anti_ban import get_rate_limiter, get_account_rotation, get_warmup_manager

log = logging.getLogger(__name__)

# ponytail: session cache with TTL + max size + threading lock
_vk_sessions: dict = {}  # key → (session, created_at)
_VK_SESSION_TTL = 3600  # 1 hour
_VK_SESSION_MAX = 100
_session_lock = threading.Lock()


def _cache_get(key: str):
    with _session_lock:
        entry = _vk_sessions.get(key)
        if entry is None:
            return None
        session, ts = entry
        if time.time() - ts > _VK_SESSION_TTL:
            _vk_sessions.pop(key, None)
            return None
        return session


def _cache_put(key: str, session):
    with _session_lock:
        if len(_vk_sessions) >= _VK_SESSION_MAX:
            oldest = min(_vk_sessions, key=lambda k: _vk_sessions[k][1])
            _vk_sessions.pop(oldest, None)
        _vk_sessions[key] = (session, time.time())


def _cache_invalidate(key: str):
    with _session_lock:
        _vk_sessions.pop(key, None)
        _vk_sessions.pop(f"group_{key}", None)

VK_RATE_LIMITS = {
    "messages": {"max_per_hour": 30, "max_per_day": 300},
    "wall_post": {"max_per_hour": 10, "max_per_day": 50},
    "comment": {"max_per_hour": 50, "max_per_day": 500},
}


# ── Encryption ──────────────────────────────────────────────────────────

def _get_fernet():
    from cryptography.fernet import Fernet
    encryption_key = os.getenv("ENCRYPTION_KEY", "")
    if not encryption_key:
        return None
    key = hashlib.sha256(encryption_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    return Fernet(fernet_key)


def _decrypt(ciphertext: str) -> str:
    f = _get_fernet()
    if f is None:
        log.warning("No ENCRYPTION_KEY set — tokens stored as plaintext")
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        log.error("Decryption failed — wrong ENCRYPTION_KEY or corrupted data")
        return ciphertext


# ── DB Token Loading ────────────────────────────────────────────────────

async def load_vk_token(account_id: str) -> str | None:
    """Load and decrypt VK group token from account_sessions table."""
    conn_url = DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(conn_url)
    try:
        row = await conn.fetchrow(
            "SELECT session_data FROM account_sessions WHERE account_id = $1",
            __import__("uuid").UUID(account_id),
        )
        if row is None:
            return None
        return _decrypt(row["session_data"])
    except Exception as e:
        log.error(f"Failed to load VK token for {account_id}: {e}")
        return None
    finally:
        await conn.close()


# ── Rate Limiting ───────────────────────────────────────────────────────

async def check_rate_limit(account_id: str, action_type: str) -> bool:
    limiter = get_rate_limiter(REDIS_URL)
    limits = VK_RATE_LIMITS.get(action_type, VK_RATE_LIMITS["messages"])
    allowed = await limiter.is_allowed(account_id, action_type, limits)
    if not allowed:
        log.warning(f"Rate limit hit for account {account_id} action {action_type}")
    return allowed


async def wait_for_rate_limit(account_id: str, action_type: str) -> float:
    limiter = get_rate_limiter(REDIS_URL)
    limits = VK_RATE_LIMITS.get(action_type, VK_RATE_LIMITS["messages"])
    return await limiter.wait_if_needed(account_id, action_type, limits)


async def record_action(account_id: str, action_type: str) -> None:
    limiter = get_rate_limiter(REDIS_URL)
    await limiter.record_action(account_id, action_type, {
        "min_delay": int(os.getenv("VK_MIN_DELAY", "15")),
        "max_delay": int(os.getenv("VK_MAX_DELAY", "45")),
    })


async def random_delay() -> None:
    min_delay = int(os.getenv("VK_MIN_DELAY", "15"))
    max_delay = int(os.getenv("VK_MAX_DELAY", "45"))
    delay = random.uniform(min_delay, max_delay)
    log.debug(f"Anti-ban delay: {delay:.1f}s")
    await asyncio.sleep(delay)


# ── Warmup Integration ──────────────────────────────────────────────────

async def check_warmup(account_id: str, action_type: str) -> bool:
    """Check if account warmup allows this action type. Returns True if allowed."""
    warmup = get_warmup_manager(REDIS_URL)
    stage = await warmup.get_stage(account_id)
    if stage >= 4:
        return True  # Fully warmed up

    # Stage-based limits: messages always allowed, wall_post/comment need stage >= 3
    if action_type == "messages":
        return True
    if action_type in ("wall_post", "comment") and stage < 3:
        daily_limit = await warmup.get_daily_limit(account_id, WARMUP_LIMITS)
        # Check if we've hit the warmup daily limit
        limiter = get_rate_limiter(REDIS_URL)
        counts = await limiter.get_counts(account_id, action_type)
        if counts["daily"] >= daily_limit:
            log.warning(f"Warmup limit hit for {account_id}: {counts['daily']}/{daily_limit}")
            return False
    return True


# ── VK Error Handling ───────────────────────────────────────────────────

class VKError(Exception):
    """VK API error with code and optional wait time."""
    def __init__(self, code: int, message: str, wait: int = 0):
        self.code = code
        self.message = message
        self.wait = wait
        super().__init__(f"VK error {code}: {message}")


def _handle_vk_error(error_msg: str) -> VKError:
    """Parse VK API error message and return VKError."""
    # VK errors: {"error":{"error_code":921,"error_msg":"Flood control",...}}
    import re
    code_match = re.search(r"error_code['\"]:\s*(\d+)", str(error_msg))
    wait_match = re.search(r"['\"]wait['\"]:\s*(\d+)", str(error_msg))
    code = int(code_match.group(1)) if code_match else 0
    wait = int(wait_match.group(1)) if wait_match else 0
    return VKError(code, str(error_msg)[:200], wait)


async def handle_flood_wait(vk_error: VKError) -> bool:
    """Handle VK flood wait (error 921). Returns True if we waited and should retry."""
    if vk_error.code == 921 and vk_error.wait > 0:
        log.warning(f"VK flood wait: sleeping {vk_error.wait}s")
        await asyncio.sleep(vk_error.wait)
        return True
    return False


# ── Session Management ──────────────────────────────────────────────────

def _parse_proxy(proxy_url: str | None) -> dict | None:
    """Parse proxy URL into vk_api proxy format. Supports socks5:// and http://."""
    if not proxy_url:
        return None
    # vk_api expects: {"proxy_type": "socks5", "proxy": "host:port", "proxy_user": "...", "proxy_pass": "..."}
    from urllib.parse import urlparse
    p = urlparse(proxy_url)
    proxy_type = "socks5" if p.scheme.startswith("socks") else p.scheme
    result = {
        "proxy_type": proxy_type,
        "proxy": f"{p.hostname}:{p.port or 1080}",
    }
    if p.username:
        result["proxy_user"] = p.username
    if p.password:
        result["proxy_pass"] = p.password
    return result


async def get_vk_group_session(account_id: str, group_token: str,
                                proxy_url: str | None = None) -> Optional[object]:
    """Get or create a VK group session from group_token."""
    import vk_api

    cache_key = f"group_{account_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        proxy = _parse_proxy(proxy_url)
        kwargs = {"token": group_token}
        if proxy:
            kwargs.update(proxy)
        session = vk_api.VkApi(**kwargs)
        _cache_put(cache_key, session)
        log.info(f"VK group session created for account {account_id}")
        return session
    except Exception as e:
        log.error(f"VK group session creation failed: {e}")
        return None


async def get_vk_group_session_for(account_id: str) -> Optional[object]:
    """Load token from DB and create session. Used by tasks that don't have the token passed in."""
    token = await load_vk_token(account_id)
    if not token:
        log.error(f"No VK token found for account {account_id}")
        return None
    # ponytail: proxy not loaded from DB yet. Add when proxy rotation is implemented.
    return await get_vk_group_session(account_id, token)


async def get_vk_user_session(account_id: str, access_token: str) -> Optional[object]:
    import vk_api

    cached = _cache_get(account_id)
    if cached is not None:
        return cached

    try:
        session = vk_api.VkApi(token=access_token)
        _cache_put(account_id, session)
        return session
    except Exception as e:
        log.error(f"VK user session creation failed: {e}")
        return None


def disconnect_vk(account_id: str) -> None:
    _cache_invalidate(account_id)
    log.info(f"VK sessions cleared for account {account_id}")


# ── Token Validation ────────────────────────────────────────────────────

async def validate_vk_token(group_token: str) -> dict:
    """Validate a VK community token. Returns {ok, group_name, group_id, permissions}."""
    import vk_api
    try:
        session = vk_api.VkApi(token=group_token)
        vk = session.get_api()
        # Check which community this token belongs to
        groups = vk.groups.getById()
        if not groups:
            return {"ok": False, "error": "Token does not belong to any community"}
        g = groups[0]
        # Check token permissions
        try:
            perms = vk.groups.getTokenPermissions()
            scopes = [s["name"] for s in perms.get("settings", [])]
        except Exception:
            scopes = []
        return {
            "ok": True,
            "group_id": g["id"],
            "group_name": g["name"],
            "members_count": g.get("members_count", 0),
            "permissions": scopes,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


# ── LongPoll ────────────────────────────────────────────────────────────

def get_longpoll_server(vk_session, group_id: int) -> Optional[dict]:
    """Get Long Poll server for group events (messages, wall posts, comments).

    Uses groups.getLongPollServer — NOT messages.getLongPollServer.
    The messages API only delivers private messages to the community.
    The groups API delivers ALL community events: messages, wall posts, comments, joins.
    """
    try:
        vk = vk_session.get_api()
        server = vk.groups.getLongPollServer(group_id=group_id)
        return {
            "server": server["server"],
            "key": server["key"],
            "ts": server["ts"],
        }
    except Exception as e:
        log.error(f"LongPoll server error: {e}")
        return None
