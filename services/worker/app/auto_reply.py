"""Auto-reply to leads: AI-generated (HOT) or template (WARM)."""
import asyncio
import logging
import os
import random
import re
import time

import httpx
import redis

log = logging.getLogger(__name__)

INTENT_PRIORITY = {"HOT": 3, "WARM": 2, "COLD": 1, "SPAM": 0}

_LLM_ENDPOINTS = {
    "openrouter": {"url": "https://openrouter.ai/api/v1/chat/completions"},
    "deepseek": {"url": "https://api.deepseek.com/v1/chat/completions"},
    "openai": {"url": "https://api.openai.com/v1/chat/completions"},
}


def _get_rate_limit_redis() -> redis.Redis:
    return redis.Redis.from_url(
        os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
        decode_responses=True,
    )


def _check_and_increment_rate_limit(tenant_id: str, max_per_hour: int) -> bool:
    """Check rate limit using Redis sorted set. Returns True if allowed."""
    r = _get_rate_limit_redis()
    key = f"auto_reply_rate:{tenant_id}"
    now = time.time()
    hour_ago = now - 3600
    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, hour_ago)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, 3600)
    results = pipe.execute()
    count = results[2]
    return count <= max_per_hour


def _is_within_work_hours(start_hour: int, end_hour: int, timezone_str: str = "UTC") -> bool:
    """Check if current time is within work hours for the given timezone."""
    from datetime import datetime
    try:
        import pytz
        tz = pytz.timezone(timezone_str)
    except Exception:
        from datetime import timezone
        tz = timezone.utc
    now = datetime.now(tz).hour
    if start_hour <= end_hour:
        return start_hour <= now < end_hour
    return now >= start_hour or now < end_hour


async def _generate_ai_reply(
    message_text: str,
    reply_prompt: str,
    ai_config: dict,
) -> str | None:
    """Call LLM to generate a unique reply based on the lead's message."""
    api_key = ai_config.get("llm_api_key") or os.getenv("OPENROUTER_API_KEY", "")
    model = ai_config.get("llm_model", "deepseek-chat")
    provider = ai_config.get("llm_provider", "auto")
    temperature = ai_config.get("reply_temperature", 0.7)
    max_tokens = ai_config.get("reply_max_tokens", 500)

    if not api_key:
        log.debug("No LLM API key for AI reply generation")
        return None

    if provider in ("auto", "openrouter"):
        url = _LLM_ENDPOINTS["openrouter"]["url"]
        if not api_key:
            url = _LLM_ENDPOINTS.get(provider, _LLM_ENDPOINTS["deepseek"])["url"]
    elif provider in _LLM_ENDPOINTS:
        url = _LLM_ENDPOINTS[provider]["url"]
    else:
        url = _LLM_ENDPOINTS["deepseek"]["url"]

    user_msg = (
        f"Сообщение клиента: {message_text}\n\n"
        f"Сгенерируй ответ клиенту. Только текст ответа, без кавычек и форматирования."
    )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5, read=20)) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": reply_prompt},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            resp.raise_for_status()
            reply = resp.json()["choices"][0]["message"]["content"].strip()
            reply = re.sub(r"^```\w*\s*", "", reply)
            reply = re.sub(r"\s*```$", "", reply)
            return reply.strip() or None
    except Exception as e:
        log.warning(f"AI reply generation failed: {e}")
        return None


async def send_auto_reply(
    account_id: str,
    tenant_id: str,
    user_handle: str,
    intent: str,
    message_text: str,
    ai_config: dict,
):
    """Send an auto-reply based on ai_auto_reply config."""
    if not ai_config.get("reply_enabled"):
        return

    platform = "telegram"
    channels = ai_config.get("channels", {})
    if not channels.get(platform, True):
        return

    start = ai_config.get("work_hours_start", 9)
    end = ai_config.get("work_hours_end", 21)
    tz = ai_config.get("timezone", "UTC")
    if not _is_within_work_hours(start, end, tz):
        log.debug(f"Outside work hours ({start}-{end} {tz}), skipping auto-reply")
        return

    blacklist = ai_config.get("blacklist_usernames", "")
    if blacklist and user_handle.lower() in [u.strip().lower() for u in blacklist.split(",") if u.strip()]:
        return

    ai_reply_for = ai_config.get("ai_reply_for", "HOT")
    template_reply_for = ai_config.get("template_reply_for", "WARM")
    priority = INTENT_PRIORITY.get(intent, 0)

    use_ai = ai_reply_for != "OFF" and priority >= INTENT_PRIORITY.get(ai_reply_for, 3)
    use_template = template_reply_for != "OFF" and priority >= INTENT_PRIORITY.get(template_reply_for, 2)

    if not use_ai and not use_template:
        return

    max_per_hour = ai_config.get("max_replies_per_hour", 10)
    if not _check_and_increment_rate_limit(tenant_id, max_per_hour):
        log.warning(f"Auto-reply rate limit reached for tenant {tenant_id}")
        return

    delay = ai_config.get("reply_delay_seconds", 5)
    await asyncio.sleep(delay)

    reply_text = None
    if use_ai:
        reply_text = await _generate_ai_reply(
            message_text, ai_config.get("reply_prompt", ""), ai_config,
        )
    if not reply_text and use_template:
        templates = ai_config.get("templates", [])
        if templates:
            mode = ai_config.get("reply_mode", "random")
            if mode == "cyclic":
                idx_key = f"reply_idx_{tenant_id}"
                idx = getattr(send_auto_reply, '_idx', {}).get(idx_key, 0)
                reply_text = templates[idx % len(templates)]
                if not hasattr(send_auto_reply, '_idx'):
                    send_auto_reply._idx = {}
                send_auto_reply._idx[idx_key] = idx + 1
            else:
                reply_text = random.choice(templates)

    if not reply_text:
        return

    try:
        from app.telegram_client import get_client
        client = await get_client(account_id)
        if not client:
            log.warning(f"No Telegram client for account {account_id}")
            return

        if user_handle.startswith("@"):
            entity = await client.get_entity(user_handle[1:])
        else:
            entity = await client.get_entity(int(user_handle))

        if entity:
            await client.send_message(entity, reply_text)
            log.info(f"Auto-reply sent to {user_handle} for tenant {tenant_id} "
                     f"({'AI' if use_ai else 'template'})")
        else:
            log.warning(f"Could not resolve entity for {user_handle}")

    except Exception as e:
        log.warning(f"Auto-reply failed for {user_handle}: {e}")
