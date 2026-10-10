"""MAX messenger Bot API client.

Base: https://platform-api2.max.ru (TLS: Russian Trusted Root CA).
Auth: Authorization: <bot_token> header. Rate limit: 30 rps platform-wide.
Token stored encrypted in account_sessions (same as VK).
Docs: https://dev.max.ru/docs-api
"""
import hashlib
import logging
import os

import httpx

log = logging.getLogger(__name__)

MAX_API = "https://platform-api2.max.ru"


def _verify_bundle():
    """TLS bundle with Russian Trusted Root CA. Falls back to system certs."""
    for candidate in (
        os.getenv("MAX_CA_BUNDLE", ""),
        "/app/certs/ru-bundle.pem",
        "certs/ru-bundle.pem",
    ):
        if candidate and os.path.isfile(candidate):
            return candidate
    return True


def _fernet():
    from cryptography.fernet import Fernet

    encryption_key = os.getenv("ENCRYPTION_KEY", "")
    if not encryption_key:
        return None
    key = hashlib.sha256(encryption_key.encode()).digest()
    import base64

    return Fernet(base64.urlsafe_b64encode(key))


def _decrypt(ciphertext: str) -> str:
    f = _fernet()
    if f is None:
        return ciphertext
    return f.decrypt(ciphertext.encode()).decode()


async def load_max_token(account_id: str) -> str | None:
    """Load and decrypt MAX bot token from account_sessions table."""
    import uuid
    from app.db_pool import fetchrow

    try:
        aid = uuid.UUID(account_id)
    except ValueError:
        return None
    row = await fetchrow(
        "SELECT session_data FROM account_sessions WHERE account_id = $1",
        aid,
    )
    if not row:
        return None
    return _decrypt(row["session_data"])


def max_client(token: str, timeout: int = 30) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=MAX_API,
        headers={"Authorization": token},
        timeout=timeout,
        verify=_verify_bundle(),
    )


async def api_get_me(token: str) -> dict | None:
    """Validate token. Returns bot info or None."""
    try:
        async with max_client(token) as client:
            resp = await client.get("/me")
    except Exception as e:
        log.warning(f"max /me failed: {e}")
        return None
    if resp.status_code != 200:
        return None
    try:
        return resp.json()
    except Exception:
        return None


async def send_message(token: str, chat_id: str | None = None,
                       user_id: str | None = None, text: str = "") -> dict:
    """Send text message. Returns parsed JSON or error dict."""
    params = {}
    if chat_id:
        params["chat_id"] = chat_id
    elif user_id:
        params["user_id"] = user_id
    else:
        return {"error": "chat_id or user_id required"}
    async with max_client(token) as client:
        resp = await client.post("/messages", params=params, json={"text": text[:4000]})
    if resp.status_code != 200:
        return {"error": f"max_{resp.status_code}", "body": resp.text[:200]}
    try:
        return resp.json()
    except Exception:
        return {"ok": True}


async def get_updates(token: str, marker: int | None = None,
                      timeout: int = 30) -> tuple[list, int | None]:
    """Long-poll updates. Returns (updates, next_marker). Defensive parsing."""
    params: dict = {"timeout": timeout}
    if marker is not None:
        params["marker"] = marker
    try:
        async with max_client(token, timeout=timeout + 10) as client:
            resp = await client.get("/updates", params=params)
    except Exception as e:
        log.debug(f"max updates poll failed: {e}")
        return [], marker
    if resp.status_code != 200:
        log.debug(f"max updates status {resp.status_code}")
        return [], marker
    try:
        data = resp.json()
    except Exception:
        return [], marker
    if isinstance(data, dict):
        updates = data.get("updates") or data.get("items") or []
        # ponytail: explicit null from server must not rewind the marker
        next_marker = data.get("marker") or data.get("next_marker") or marker
        return updates if isinstance(updates, list) else [], next_marker
    if isinstance(data, list):
        return data, marker
    return [], marker
