"""Facebook groups monitor: Playwright + per-tenant cookie sessions -> leads.

Scraping core ported from the owner's MarketPlace repo
(C:\\Code\\MarketPlace\\services\\fb_group_monitor.py): feed content lives
in POST GraphQL response bodies (DOM articles are empty), so responses are
intercepted and stories parsed. Auth differs: headless Chromium with
cookies from account_sessions instead of a local persistent profile.

Queue: fb. Beat: every 15 min (see celery_app).
"""
import asyncio
import hashlib
import json
import logging
import re
import uuid as uuid_mod

from celery import shared_task

from app.celery_app import celery
from app.db_pool import fetch, fetchrow, execute

log = logging.getLogger(__name__)

LIMIT_PER_GROUP = 10
TOTAL_NEW_CAP = 60


# ── GraphQL story parsing (ported, same owner) ────────────────────────

def parse_graphql_stories(body: bytes) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()

    def _story(d: dict) -> None:
        msg = d.get("message")
        if not isinstance(msg, dict):
            return
        text = msg.get("text")
        if not isinstance(text, str) or not text.strip():
            return
        if not (d.get("post_id") or d.get("permalink_url") or d.get("url")):
            return
        pid, link = _parse_story_pid(d)
        if pid is None:
            pid = "h" + hashlib.md5(text[:300].encode()).hexdigest()[:16]
            link = ""
        gid = ""
        try:
            tg = d.get("target_group")
            if isinstance(tg, dict) and re.fullmatch(r"\d+", str(tg.get("id") or "")):
                gid = str(tg["id"])
        except Exception:
            gid = ""
        if pid in seen:
            return
        seen.add(pid)
        author = ""
        try:
            actors = d.get("actors")
            if isinstance(actors, list) and actors and isinstance(actors[0], dict):
                author = actors[0].get("name") or ""
        except Exception:
            author = ""
        out.append({"post_id": pid, "content": text.strip()[:4000],
                    "author": author or "", "link": link, "gid": gid})

    def _walk(x) -> None:
        if isinstance(x, dict):
            _story(x)
            for v in x.values():
                _walk(v)
        elif isinstance(x, list):
            for v in x:
                _walk(v)

    try:
        text = body.decode("utf-8", errors="replace") if isinstance(body, bytes) else str(body)
    except Exception:
        return []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            _walk(json.loads(line))
        except Exception:
            continue
    return out


def _good_pid(v) -> str | None:
    s = str(v or "")
    return s if re.fullmatch(r"\d{14,}", s) else None


def _parse_story_pid(d: dict) -> tuple[str | None, str]:
    pid = _good_pid(d.get("post_id"))
    link = str(d.get("permalink_url") or "")
    if pid and (not link or pid in link):
        return pid, link
    m = re.search(r"/(?:permalink|posts)/(\d{14,})/", link)
    if m:
        return m.group(1), link
    blob = str(d.get("url") or "")
    m = re.search(r"(?:story_fbid|fbid)=(\d{14,})", blob)
    if m:
        return m.group(1), link
    return None, ""


# ── Session helpers ───────────────────────────────────────────────────

async def _load_cookies(account_id: str) -> dict | None:
    """Decrypt stored FB cookies for an account. None if missing/broken."""
    row = await fetchrow(
        "SELECT session_data FROM account_sessions WHERE account_id = $1",
        uuid_mod.UUID(account_id),
    )
    if not row:
        return None
    try:
        from app.telegram_client import _decrypt
        data = json.loads(_decrypt(row["session_data"]))
        if data.get("c_user") and data.get("xs"):
            return data
    except Exception as e:
        log.warning(f"FB cookies undecryptable for {account_id}: {e}")
    return None


def _storage_state(cookies: dict) -> dict:
    # ponytail: persistent profiles need a display; cookies inject headless.
    # Re-paste via /fb-connect when FB expires the session.
    return {"cookies": [
        {"name": "c_user", "value": cookies["c_user"],
         "domain": ".facebook.com", "path": "/"},
        {"name": "xs", "value": cookies["xs"],
         "domain": ".facebook.com", "path": "/"},
    ]}


async def _mark_status(account_id: str, status: str) -> None:
    try:
        await execute("UPDATE account_pool SET status = $1 WHERE id = $2",
                      status, uuid_mod.UUID(account_id))
    except Exception as e:
        log.warning(f"FB status update failed: {e}")


async def _logged_in(page) -> bool:
    try:
        await page.goto("https://www.facebook.com/", timeout=20000)
        await page.wait_for_timeout(3000)
        # login form present == session dead
        return await page.query_selector('input[name="email"]') is None
    except Exception:
        return False


async def _scrape_group(page, url: str, limit: int) -> list[dict]:
    bodies: list[bytes] = []

    async def _on_resp(r) -> None:
        try:
            if r.request.method == "POST" and "graphql" in r.url and r.status == 200:
                bodies.append(await r.body())
        except Exception:
            pass

    page.on("response", _on_resp)
    try:
        await page.goto(url, timeout=20000)
        await page.wait_for_timeout(4000)
        for _ in range(2):
            await page.evaluate("window.scrollBy(0, 4000)")
            await page.wait_for_timeout(2000)
    finally:
        try:
            page.remove_listener("response", _on_resp)
        except Exception:
            pass

    out, seen = [], set()
    for b in bodies:
        for st in parse_graphql_stories(b):
            if len(out) >= limit or st["post_id"] in seen:
                continue
            seen.add(st["post_id"])
            link = st.get("link", "") or ""
            pid_ok = re.fullmatch(r"\d{14,}", st["post_id"] or "")
            gid_ok = re.fullmatch(r"\d+", st.get("gid", "") or "")
            if pid_ok and gid_ok:
                link = f"https://www.facebook.com/groups/{st['gid']}/posts/{st['post_id']}/"
            elif pid_ok:
                link = f"https://www.facebook.com/{st['post_id']}/"
            else:
                link = ""
            out.append({"post_id": st["post_id"], "author": st.get("author", ""),
                        "content": st.get("content", ""), "link": link})
    return out


# ── Celery task ───────────────────────────────────────────────────────

@celery.task(name="app.tasks.fb_monitor.scan_groups", queue="fb", max_retries=0)
def scan_groups():
    """Beat every 15 min: scan tracked FB groups -> leads (platform=facebook)."""
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_scan_async())
    finally:
        loop.close()


async def _scan_async() -> dict:
    from playwright.async_api import async_playwright
    from app.lead_pipeline import process_incoming_message

    accounts = await fetch(
        "SELECT id, tenant_id, account_identifier FROM account_pool "
        "WHERE platform = 'facebook' AND status IN ('active', 'warming_up')"
    )
    if not accounts:
        return {"status": "no_accounts"}

    scanned, created = 0, 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for acc in accounts:
                tenant_id, account_id = str(acc["tenant_id"]), str(acc["id"])
                cookies = await _load_cookies(account_id)
                if not cookies:
                    log.warning(f"FB {account_id}: no session, skipping")
                    continue
                try:
                    ctx = await browser.new_context(
                        storage_state=_storage_state(cookies))
                    page = await ctx.new_page()
                except Exception as e:
                    log.warning(f"FB {account_id}: browser failed: {e}")
                    continue
                try:
                    if not await _logged_in(page):
                        log.warning(f"FB {account_id}: session dead, pausing "
                                    f"(re-paste cookies via /fb-connect)")
                        await _mark_status(account_id, "paused")
                        await ctx.close()
                        continue
                    groups = await fetch(
                        "SELECT id, group_identifier, title FROM monitored_groups "
                        "WHERE tenant_id = $1 AND platform = 'facebook' AND is_active = true",
                        uuid_mod.UUID(tenant_id),
                    )
                    existing = await fetch(
                        "SELECT dialog_url FROM leads WHERE tenant_id = $1 "
                        "AND platform = 'facebook' AND dialog_url <> ''",
                        uuid_mod.UUID(tenant_id),
                    )
                    seen_links = {r["dialog_url"] for r in existing}
                    for g in groups:
                        try:
                            posts = await _scrape_group(
                                page, g["group_identifier"], LIMIT_PER_GROUP)
                        except Exception as e:
                            log.warning(f"FB group {g['group_identifier']}: {e}")
                            continue
                        scanned += 1
                        for post in posts:
                            if len(post["content"]) < 3:
                                continue
                            link = post["link"]
                            if link and link in seen_links:
                                continue
                            handle = (post["author"] or "").strip() or f"fb:{post['post_id']}"
                            try:
                                await process_incoming_message(
                                    tenant_id=tenant_id,
                                    platform="facebook",
                                    target_id=None,
                                    account_id=account_id,
                                    user_handle=handle[:255],
                                    user_full_name=(post["author"] or "")[:255],
                                    message_text=post["content"],
                                    geo_tag="",
                                    source="group",
                                    source_url=link,
                                )
                                created += 1
                                if link:
                                    seen_links.add(link)
                            except Exception as e:
                                log.warning(f"FB lead ingest failed: {e}")
                        try:
                            await execute(
                                "UPDATE monitored_groups SET last_scan_at = NOW(), "
                                "status = 'idle' WHERE id = $1",
                                g["id"],
                            )
                        except Exception:
                            pass
                finally:
                    await ctx.close()
        finally:
            await browser.close()
    return {"status": "ok", "groups_scanned": scanned, "leads_processed": created}
