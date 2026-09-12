"""Telegram Client Factory — shared Telethon client management.

Provides encrypted session storage, client lifecycle, and connection tracking.
Used by Listener, Poster, Comment Scraper, and Warmup workers.

Architecture:
- Session strings stored in DB (encrypted via Fernet)
- Clients cached in-memory per account_id (one process)
- Connection status tracked in Redis for monitoring
- Per-account proxy support: 1 proxy = 1 account permanently
"""
import asyncio
import json
import logging
import os
import re
import time
from urllib.parse import urlparse

import asyncpg
import redis

log = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────
DATABASE_URL = os.environ["DATABASE_URL"]
DATABASE_URL = DATABASE_URL.replace("+asyncpg", "")
TG_API_ID = int(os.getenv("TG_API_ID", "0"))
TG_API_HASH = os.getenv("TG_API_HASH", "")
SESSION_DIR = os.getenv("SESSION_DIR", "/app/sessions")

# ── Redis for status tracking ────────────────────────────────────────────
_redis = None

def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(
            os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
            decode_responses=True,
        )
    return _redis

# ── Encryption helpers (standalone, no backend dependency) ────────────────
_fernet = None

def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet
    encryption_key = os.getenv("ENCRYPTION_KEY", "")
    if not encryption_key:
        raise RuntimeError(
            "ENCRYPTION_KEY not set — Telegram sessions will be stored unencrypted! "
            "Set ENCRYPTION_KEY in your .env file."
        )
    try:
        import base64, hashlib
        from cryptography.fernet import Fernet
        key = hashlib.sha256(encryption_key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key)
        _fernet = Fernet(fernet_key)
        return _fernet
    except ImportError:
        raise RuntimeError("cryptography package not installed — cannot encrypt sessions")

def _encrypt(plaintext: str) -> str:
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode() if f else plaintext

def _decrypt(ciphertext: str) -> str:
    f = _get_fernet()
    if f is None:
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        return ciphertext

# ── Client Cache ─────────────────────────────────────────────────────────
# ponytail: in-memory cache of TelegramClient per account_id.
# One process = one client per account. If multi-worker, use Redis lock.
_clients: dict = {}  # account_id -> TelegramClient
_loops: dict = {}    # account_id -> event loop


def _ensure_session_dir():
    os.makedirs(SESSION_DIR, exist_ok=True)


# ── DB Session Storage ───────────────────────────────────────────────────

async def save_session(account_id: str, session_string: str):
    """Save encrypted Telethon session string to DB."""
    encrypted = _encrypt(session_string)
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # Upsert: insert or update
        existing = await conn.fetchrow(
            "SELECT id FROM account_sessions WHERE account_id = $1",
            _uuid(account_id),
        )
        if existing:
            await conn.execute(
                "UPDATE account_sessions SET session_data = $1, updated_at = NOW() WHERE account_id = $2",
                encrypted, _uuid(account_id),
            )
        else:
            await conn.execute(
                """INSERT INTO account_sessions (id, account_id, session_data, created_at, updated_at)
                   VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())""",
                _uuid(account_id), encrypted,
            )
        log.info(f"Session saved for account {account_id}")
    finally:
        await conn.close()


async def load_session(account_id: str) -> str | None:
    """Load and decrypt session string from DB. Returns None if not found."""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            "SELECT session_data FROM account_sessions WHERE account_id = $1",
            _uuid(account_id),
        )
        if row is None:
            return None
        return _decrypt(row["session_data"])
    finally:
        await conn.close()


async def delete_session(account_id: str):
    """Delete session from DB."""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            "DELETE FROM account_sessions WHERE account_id = $1",
            _uuid(account_id),
        )
        log.info(f"Session deleted for account {account_id}")
    finally:
        await conn.close()


# ── Proxy Resolution ─────────────────────────────────────────────────

async def _resolve_proxy(account_id: str) -> tuple | None:
    """Look up proxy for this account from DB.

    Returns Telethon-compatible proxy tuple or None.
    Format: (socks_type, host, port, rdns, username, password)
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            """SELECT p.proxy_url
               FROM account_pool a
               JOIN proxies p ON a.proxy_id = p.id
               WHERE a.id = $1 AND p.is_active = true""",
            _uuid(account_id),
        )
        if not row:
            return None
        return _parse_proxy_url(row["proxy_url"])
    except Exception as e:
        log.warning(f"Proxy lookup failed for {account_id}: {e}")
        return None
    finally:
        await conn.close()


def _parse_proxy_url(url: str) -> tuple | None:
    """Parse socks5://user:pass@host:port into Telethon proxy tuple.

    Supports: socks5://, socks4://, http://
    """
    if not url:
        return None
    try:
        import socks
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        host = parsed.hostname
        port = parsed.port or 1080
        username = parsed.username or None
        password = parsed.password or None
        rdns = True  # resolve DNS through proxy

        if scheme == "socks5":
            return (socks.SOCKS5, host, port, rdns, username, password)
        elif scheme == "socks4":
            return (socks.SOCKS4, host, port, username, password)
        elif scheme in ("http", "https"):
            return (socks.HTTP, host, port, rdns, username, password)
        else:
            log.warning(f"Unsupported proxy scheme: {scheme}")
            return None
    except ImportError:
        log.error("pysocks not installed — cannot use proxies. pip install pysocks")
        return None
    except Exception as e:
        log.error(f"Failed to parse proxy URL: {e}")
        return None


# ── Client Lifecycle ─────────────────────────────────────────────────────

async def create_client(phone: str, api_id: int = None, api_hash: str = None):
    """Create a new Telethon client and initiate authorization.

    Returns: (client, code_request_result)
    Call client.sign_in(phone, code) after user provides the code.
    """
    from telethon import TelegramClient

    api_id = api_id or TG_API_ID
    api_hash = api_hash or TG_API_HASH

    if not api_id or not api_hash:
        raise ValueError("TG_API_ID and TG_API_HASH must be set")

    _ensure_session_dir()
    session_name = os.path.join(SESSION_DIR, f"new_{phone}")
    client = TelegramClient(session_name, api_id, api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        await client.send_code_request(phone)
        log.info(f"Code request sent to {phone}")
        return client, "code_sent"

    # Already authorized (shouldn't happen for new, but handle gracefully)
    session_string = client.session.save()
    await client.disconnect()
    return client, session_string


async def complete_auth(phone: str, code: str, client=None):
    """Complete Telegram authorization with the verification code.

    Returns: session_string on success, raises on failure.
    """
    if client is None:
        raise ValueError("Client not provided — call create_client first")

    try:
        await client.sign_in(phone, code)
    except Exception as e:
        log.error(f"Auth failed for {phone}: {e}")
        await client.disconnect()
        raise

    session_string = client.session.save()
    await client.disconnect()
    log.info(f"Authorization completed for {phone}")
    return session_string


async def get_client(account_id: str):
    """Get or create a TelegramClient from stored session.

    Returns connected client, or None if no session exists.
    Uses per-account proxy if assigned (1 proxy = 1 account permanently).
    """
    from telethon import TelegramClient

    # Check cache first
    if account_id in _clients:
        client = _clients[account_id]
        if client.is_connected():
            return client
        else:
            # Stale entry, remove
            del _clients[account_id]

    # Load session from DB
    session_string = await load_session(account_id)
    if not session_string:
        log.warning(f"No session for account {account_id}")
        return None

    _ensure_session_dir()

    # Resolve proxy for this account
    proxy = await _resolve_proxy(account_id)

    # Import session from string
    from telethon.sessions import StringSession
    client = TelegramClient(
        StringSession(session_string),
        TG_API_ID,
        TG_API_HASH,
        proxy=proxy,  # None = direct, tuple = socks proxy
    )

    try:
        await client.connect()
        if not await client.is_user_authorized():
            log.warning(f"Session expired for account {account_id}")
            await client.disconnect()
            return None

        _clients[account_id] = client
        _set_status(account_id, "online")
        proxy_info = f" via proxy" if proxy else ""
        log.info(f"Client connected for account {account_id}{proxy_info}")
        return client
    except Exception as e:
        log.error(f"Failed to connect client for {account_id}: {e}")
        _set_status(account_id, "error")
        return None


async def disconnect_client(account_id: str):
    """Gracefully disconnect and remove cached client."""
    client = _clients.pop(account_id, None)
    if client and client.is_connected():
        await client.disconnect()
        log.info(f"Client disconnected for account {account_id}")
    _set_status(account_id, "offline")


# ── Status Tracking ──────────────────────────────────────────────────────

STATUS_TTL = 300  # 5 minutes

def _set_status(account_id: str, status: str):
    """Track connection status in Redis."""
    r = _get_redis()
    r.setex(
        f"tg_status:{account_id}",
        STATUS_TTL,
        json.dumps({
            "status": status,
            "updated_at": time.time(),
        }),
    )


def get_status(account_id: str) -> dict:
    """Get current connection status from Redis."""
    r = _get_redis()
    raw = r.get(f"tg_status:{account_id}")
    if raw:
        return json.loads(raw)
    return {"status": "unknown", "updated_at": 0}


def get_all_statuses() -> dict[str, dict]:
    """Get status for all accounts with active sessions."""
    r = _get_redis()
    keys = []
    cursor = 0
    while True:
        cursor, batch = r.scan(cursor, match="tg_status:*", count=100)
        keys.extend(batch)
        if cursor == 0:
            break
    statuses = {}
    for key in keys:
        raw = r.get(key)
        if raw is None:
            continue
        account_id = key.split(":", 1)[1]
        try:
            statuses[account_id] = json.loads(raw)
        except json.JSONDecodeError:
            continue
    return statuses


def heartbeat(account_id: str):
    """Renew status TTL. Call from long-running tasks."""
    _set_status(account_id, "online")


# ── Helpers ──────────────────────────────────────────────────────────────

def _uuid(val: str):
    """Convert string to UUID for asyncpg."""
    import uuid
    return uuid.UUID(val)
