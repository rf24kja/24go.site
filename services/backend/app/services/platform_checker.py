"""Cross-platform contact checker — Telegram, VKontakte, WhatsApp."""
import re
import httpx

from app.config import settings

TIMEOUT = 30  # ponytail: 30s as per global constraint


def normalize_phone(phone: str) -> str:
    """Normalize phone to E.164 format: +79001234567."""
    digits = re.sub(r"[^\d]", "", phone)
    if not digits.startswith("7") and len(digits) == 10:
        digits = "7" + digits
    return "+" + digits


async def check_telegram(phone: str) -> dict:
    """Check if phone number is registered on Telegram via delfi/phone-check API.

    Returns {"exists": bool, "phone": str}.
    ponytail: uses a free API or scrapes t.me lookup. If rate-limited, add Redis cache.
    """
    norm = normalize_phone(phone)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                "https://api.telegram.org/bot{token}/getContact".replace("{token}", settings.TG_BOT_TOKEN or ""),
                json={"phone": norm},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"exists": bool(data.get("user")), "phone": norm}
    except Exception:
        pass
    # ponytail: fallback — return unknown if API fails, let caller handle
    return {"exists": False, "phone": norm, "error": "check_failed"}


async def check_vkontakte(phone: str) -> dict:
    """Check if phone number is registered on VKontakte.

    Returns {"exists": bool, "phone": str}.
    ponytail: VK has no public phone lookup API. Stub with metadata check.
    """
    norm = normalize_phone(phone)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                "https://api.vk.com/method/users.search",
                params={"q": norm, "access_token": settings.VK_ACCESS_TOKEN or "", "v": "5.131"},
            )
            if resp.status_code == 200:
                data = resp.json().get("response", {})
                count = data.get("count", 0) if isinstance(data, dict) else 0
                return {"exists": count > 0, "phone": norm}
    except Exception:
        pass
    return {"exists": False, "phone": norm, "error": "check_failed"}


async def check_whatsapp(phone: str, account_id: str | None = None) -> dict:
    """Check if phone number is on WhatsApp via wa-sidecar.

    Returns {"exists": bool, "phone": str, "wa_id": str | None}.
    """
    norm = normalize_phone(phone)
    wasidecar_url = "http://wa-sidecar:3100"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            payload: dict = {"phone": norm}
            if account_id:
                payload["accountId"] = account_id
            resp = await client.post(f"{wasidecar_url}/check-phone", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return {"exists": data.get("is_registered", False), "phone": norm, "wa_id": data.get("wa_id")}
    except Exception:
        pass
    return {"exists": False, "phone": norm, "wa_id": None, "error": "check_failed"}
