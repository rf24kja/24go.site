"""Cross-platform contact checker — Telegram, VKontakte, WhatsApp."""
import re
import httpx


TIMEOUT = 30  # ponytail: 30s as per global constraint


def normalize_phone(phone: str) -> str:
    """Normalize phone to E.164 format: +79001234567."""
    digits = re.sub(r"[^\d]", "", phone)
    if not digits.startswith("7") and len(digits) == 10:
        digits = "7" + digits
    return "+" + digits


async def check_telegram(phone: str) -> dict:
    """Bot API cannot resolve arbitrary phone numbers via getContact."""
    return {"exists": None, "phone": normalize_phone(phone), "error": "phone_lookup_unsupported"}


async def check_vkontakte(phone: str) -> dict:
    """Text-search matches are not verified phone-number identities."""
    return {"exists": None, "phone": normalize_phone(phone), "error": "phone_lookup_unsupported"}


async def check_whatsapp(phone: str, account_id: str | None = None) -> dict:
    """Use an owned connected account; transport failures are not absence."""
    import os
    norm = normalize_phone(phone)
    unknown = {"exists": None, "phone": norm, "wa_id": None}
    if not account_id:
        return {**unknown, "error": "account_not_connected"}
    key = os.getenv("SIDECAR_API_KEY", "")
    if not key:
        return {**unknown, "error": "sidecar_not_configured"}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers={"X-Sidecar-Key": key}) as client:
            resp = await client.post("http://wa-sidecar:3100/check-whatsapp",
                                     json={"accountId": account_id, "numbers": [norm]})
            if resp.status_code != 200:
                return {**unknown, "error": "sidecar_unavailable"}
            rows = resp.json().get("results", [])
            row = next((r for r in rows if r.get("phone") == norm), None)
            if not row or row.get("error") or not isinstance(row.get("exists"), bool):
                return {**unknown, "error": "check_failed"}
            exists = row["exists"]
            return {"exists": exists, "phone": norm,
                    "wa_id": norm[1:] + "@s.whatsapp.net" if exists else None}
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        return {**unknown, "error": "check_failed"}
