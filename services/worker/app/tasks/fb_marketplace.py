"""FB Marketplace search job: Playwright + cookies -> snapshots.

Ported search core from the owner's MarketPlace repo
(C:\\Code\\MarketPlace\\services\\fb_scraper.py): same card selectors and
price parsing, per-tenant cookie sessions instead of a local profile.

Queue: fb. Triggered by POST /fb/marketplace/search (job in Redis).
"""
import asyncio
import json
import logging
import re
import uuid as uuid_mod

from app.celery_app import celery
from app.db_pool import execute

log = logging.getLogger(__name__)


def _parse_price(text: str) -> float | None:
    try:
        num = re.sub(r"[^\d.]", "", (text or "").replace(",", ""))
        return float(num) if num else None
    except (ValueError, AttributeError):
        return None


def _job_key(job_id: str) -> str:
    return f"fb_mp_job:{job_id}"


async def _save(job_id: str, patch: dict) -> None:
    try:
        from app.config import REDIS_URL
        import redis.asyncio as aioredis
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        try:
            raw = await r.get(_job_key(job_id))
            job = json.loads(raw) if raw else {"job_id": job_id}
            job.update(patch)
            from datetime import datetime, timezone
            job["updated_at"] = datetime.now(timezone.utc).isoformat()
            await r.set(_job_key(job_id), json.dumps(job), ex=3600)
        finally:
            await r.aclose()
    except Exception as e:
        log.warning(f"FB marketplace job {job_id}: progress save failed: {e}")


@celery.task(name="app.tasks.fb_marketplace.run_search", queue="fb", max_retries=0)
def run_search(tenant_id: str, account_id: str, job_id: str, params: dict):
    """Run one marketplace search, upsert snapshots, close the job."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_search_async(tenant_id, account_id, job_id, params or {}))
    finally:
        loop.close()


async def _search_async(tenant_id: str, account_id: str, job_id: str, params: dict) -> dict:
    from playwright.async_api import async_playwright
    from app.tasks.fb_monitor import _load_cookies, _storage_state, _logged_in

    await _save(job_id, {"status": "running"})
    found = 0
    errors: list[str] = []
    try:
        cookies = await _load_cookies(account_id)
        if not cookies:
            await _save(job_id, {"status": "failed",
                                 "error": "no FB session — POST /fb/connect first"})
            return {"status": "failed"}

        query = (params.get("query") or "").strip()
        location = (params.get("location") or "").strip()
        min_price = params.get("min_price")
        max_price = params.get("max_price")
        bedrooms = params.get("bedrooms")
        limit = max(1, min(int(params.get("limit") or 20), 50))

        from urllib.parse import quote_plus
        url = (f"https://www.facebook.com/marketplace/{location}/search/"
               f"?query={quote_plus(query)}")
        if bedrooms:
            url += f"&bedrooms={int(bedrooms)}"

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                ctx = await browser.new_context(
                    storage_state=_storage_state(cookies))
                page = await ctx.new_page()
                if not await _logged_in(page):
                    await _save(job_id, {"status": "failed",
                                         "error": "FB session dead — re-paste cookies via /fb-connect"})
                    return {"status": "failed"}
                await page.goto(url, timeout=25000)
                try:
                    await page.wait_for_selector("a[href*='/marketplace/item/']", timeout=15000)
                except Exception:
                    pass
                cards = await page.query_selector_all("a[href*='/marketplace/item/']")
                for c in cards[:limit]:
                    try:
                        txt = await c.inner_text()
                        lines = [x.strip() for x in txt.splitlines() if x.strip()]
                        title = lines[0] if lines else ""
                        price = next((_parse_price(x) for x in lines
                                      if _parse_price(x) is not None), None)
                        link = await c.get_attribute("href") or ""
                        if link.startswith("/"):
                            link = "https://www.facebook.com" + link
                        img_el = await c.query_selector("img")
                        image = await img_el.get_attribute("src") if img_el else ""
                        if min_price is not None and (price is None or price < min_price):
                            continue
                        if max_price is not None and (price is None or price > max_price):
                            continue
                        if not link or not title:
                            continue
                        await execute(
                            """INSERT INTO fb_marketplace_snapshots
                               (tenant_id, query, title, price, link, image, bedrooms)
                               VALUES ($1, $2, $3, $4, $5, $6, $7)
                               ON CONFLICT (tenant_id, query, link) DO UPDATE SET
                                 title = EXCLUDED.title, price = EXCLUDED.price,
                                 image = EXCLUDED.image, last_seen = NOW()""",
                            uuid_mod.UUID(tenant_id), query, title[:500], price,
                            link[:1000], (image or "")[:1000],
                            int(bedrooms) if bedrooms else None,
                        )
                        found += 1
                    except Exception as e:
                        errors.append(str(e)[:120])
                        continue
            finally:
                await browser.close()
        await _save(job_id, {"status": "done", "done": True, "found": found,
                             "errors": errors[:10]})
        return {"status": "done", "found": found}
    except Exception as e:
        log.error(f"FB marketplace search {job_id} failed: {e}")
        await _save(job_id, {"status": "failed", "error": str(e)[:300]})
        return {"status": "failed", "error": str(e)[:200]}
