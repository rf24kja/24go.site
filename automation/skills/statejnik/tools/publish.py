#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publish.py — адаптер публикации (Этапы 9 и 12 методологии statejnik).

Поддерживаемые адаптеры:
  manual     - сохраняет черновик в published/ (в коробке)
  devto      - публикация в DEV Community через API
  telegraph  - публикация в Telegraph
  blogger    - публикация в Blogger/Blogspot (через Google API)
  multi      - публикация на первичную площадку (24go/dev24.pro)
  syndicate  - репост на dev.to + Telegraph + Blogger с backlink через 24ч
  24go       - verified bilingual BlogPost publication to the configured 24go CMS

Использование:
  python3 tools/publish.py --adapter devto --slug my-post --status published work/my-post/draft.md
  python3 tools/publish.py --adapter multi --slug my-post --status published work/my-post/draft.md
  python3 tools/publish.py --adapter syndicate --slug my-post --status published work/my-post/draft.md

Коды выхода: 0 - опубликовано; 1 - адаптер требует настройки; 2 - ошибка ввода.
"""
import argparse
import json
import os
import re
import sys
import tempfile
import urllib.parse
import urllib.request
from urllib.error import HTTPError

# --- Load .env ---
ENV_PATH = os.path.expanduser("~/.hermes/.env")
def load_env(path=ENV_PATH):
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k] = v  # .env is authoritative, not setdefault

load_env()

# --- Config loader ---
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from _telegraph_nodes import html_to_telegraph_nodes, telegraph_content
try:
    from _config import find_config, load_config, get as cfg_get
except ImportError:
    cfg_get = lambda cfg, path, default=None: default
    find_config = lambda: None
    load_config = lambda path: {}

ADAPTERS = ("manual", "wordpress", "ghost", "notion", "devto", "telegraph", "telegraph-setup", "blogger", "multi", "syndicate", "24go")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_json(url, method="GET", data=None, headers=None, timeout=30, allow_redirects=True):
    """HTTP fetcher returning (status_code, parsed_json_or_raw)."""
    h = headers or {}
    body = None
    if data is not None:
        if isinstance(data, (dict, list)):
            body = json.dumps(data).encode()
            h["Content-Type"] = "application/json"
        elif isinstance(data, bytes):
            body = data
            if "Content-Type" not in h:
                h["Content-Type"] = "application/json"
        else:
            body = data.encode()
            h["Content-Type"] = "application/json"
    h.setdefault("User-Agent", "Dev24Pro-Publisher/1.0")
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        open_url = urllib.request.urlopen if allow_redirects else urllib.request.build_opener(_NoRedirect()).open
        with open_url(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def parse_frontmatter(text):
    """Parse YAML frontmatter from markdown. Returns (meta_dict, body_str)."""
    meta = {}
    body = text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            head = text[3:end]
            body = text[end + 4:]
            for line in head.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip().strip('"').strip("'")
    return meta, body


def markdown_to_html_simple(md):
    """Basic escaped markdown with links, lists and fenced/inline code."""
    from html import escape
    output = []
    list_tag = None
    code = None

    def inline(text):
        parts = re.split(r'(`[^`]+`|\[[^\]]+\]\([^)]+\))', text)
        rendered = []
        for part in parts:
            match = re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', part)
            if part.startswith('`') and part.endswith('`'):
                rendered.append('<code>' + escape(part[1:-1]) + '</code>')
            elif match:
                rendered.append('<a href="' + escape(match[2], quote=True) + '">' + escape(match[1]) + '</a>')
            else:
                rendered.append(escape(part))
        return ''.join(rendered)

    for line in md.splitlines():
        if line.startswith('```'):
            if list_tag:
                output.append(f'</{list_tag}>')
                list_tag = None
            if code is None:
                code = []
            else:
                output.append('<pre><code>' + escape('\n'.join(code)) + '</code></pre>')
                code = None
            continue
        if code is not None:
            code.append(line)
            continue
        item = re.match(r'^\s*(?:([-*]) |(\d+)\. )(.*)$', line)
        next_list = ('ol' if item[2] else 'ul') if item else None
        if list_tag != next_list:
            if list_tag:
                output.append(f'</{list_tag}>')
            if next_list:
                output.append(f'<{next_list}>')
            list_tag = next_list
        if item:
            output.append('<li>' + inline(item[3]) + '</li>')
        elif line.strip() == '---':
            output.append('<hr>')
        elif line.strip():
            heading = re.match(r'^(#{1,6}) (.*)$', line)
            tag = f'h{len(heading[1])}' if heading else 'p'
            output.append(f'<{tag}>' + inline(heading[2] if heading else line) + f'</{tag}>')
    if list_tag:
        output.append(f'</{list_tag}>')
    if code is not None:
        output.append('<pre><code>' + escape('\n'.join(code)) + '</code></pre>')
    return ''.join(output)


def set_frontmatter_status(text, status):
    """Установить status в YAML frontmatter."""
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            head = text[3:end]
            bod = text[end + 4:]
            if re.search(r"^status:", head, re.M):
                head = re.sub(r"^status:.*$", f"status: {status}", head, flags=re.M)
            else:
                head = head.rstrip() + f"\nstatus: {status}\n"
            return f"---{head}\n---{bod}"
    return f"---\nstatus: {status}\n---\n\n{text}"


# ==================== 24go adapter ====================
def publish_24go(slug, status, draft_path):
    """Publish a bilingual BlogPost, fail closed until exact CMS readback."""
    from _cms24go import publish
    config = load_config(find_config())
    return publish(slug, status, draft_path, config, fetch_json, parse_frontmatter)


# ==================== manual adapter ====================
def publish_manual(slug, status, draft_path):
    text = open(draft_path, encoding="utf-8").read()
    out_dir = "published"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{slug}.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(set_frontmatter_status(text, status))
    print(f"✅ manual: статья сохранена -> {out_path} (status={status})")
    return 0


# ==================== dev.to adapter ====================
def publish_devto(slug, status, draft_path):
    """Публикация в DEV Community через API."""
    devto_key = os.environ.get("DEV_TO_API_KEY")
    if not devto_key:
        print("❌ DEV_TO_API_KEY не найден в .env")
        return 1

    text = open(draft_path, encoding="utf-8").read()
    meta, body = parse_frontmatter(text)

    # Idempotency: skip if already published on dev.to
    if "devto_url" in meta:
        print(f"✅ dev.to уже опубликован: {meta['devto_url']}")
        return 0

    title = meta.get("title", slug.replace("-", " ").title())
    tags_str = meta.get("tags", "telegram,marketing,saastra")
    tags = [t.strip() for t in tags_str.split(",")] if tags_str else []

    article = {
        "title": title,
        "body_markdown": body.strip(),
        "tags": tags,
        "published": status == "published",
        "status": "published" if status == "published" else "draft",
    }

    code, resp = fetch_json(
        "https://dev.to/api/articles",
        method="POST",
        data={"article": article},
        headers={
            "api-key": devto_key,
            "Accept": "application/vnd.forem.api-v1+json",
        },
    )

    if code in (200, 201) and isinstance(resp, dict) and "url" in resp:
        canonical_url = resp.get("url", "")
        print(f"✅ dev.to опубликовано: {canonical_url}")
        # Save dev.to URL back to frontmatter (as devto_url to avoid
        # overwriting canonical_url set by the 24go adapter)
        text = set_frontmatter_status(text, status)
        if "devto_url:" not in text:
            text = text.replace(
                f"status: {status}",
                f"status: {status}\ndevto_url: {canonical_url}",
            )
        with open(draft_path, "w", encoding="utf-8") as f:
            f.write(text)
        return 0
    else:
        print(f"❌ dev.to ошибка ({code}): {resp}")
        return 1


# ==================== Telegraph adapter ====================
def publish_telegraph(slug, status, draft_path):
    """Публикация в Telegraph."""
    token = os.environ.get("TELEGRA_PH_TOKEN")
    if not token:
        print("❌ TELEGRA_PH_TOKEN не найден в .env. Запустите: python3 publish.py --adapter telegraph-setup")
        return 1

    with open(draft_path, encoding="utf-8") as source:
        text = source.read()
    meta, body = parse_frontmatter(text)

    # Idempotency: skip if already published on Telegraph
    if "telegraph_url" in meta:
        print(f"✅ Telegraph уже опубликован: {meta['telegraph_url']}")
        return 0

    title = meta.get("title", slug.replace("-", " ").title())
    try:
        content = telegraph_content(body, meta.get("canonical_url", ""), markdown_to_html_simple)
    except ValueError as exc:
        print(f"❌ Telegraph: {exc}")
        return 1

    params = {
        "access_token": token,
        "title": title,
        "content": content,
        "author_name": "Dev24Pro",
        "return_content": "false",
    }
    # Use POST with form-encoded body instead of GET query string.
    # GET with long content URLs (4000+ chars) gets 400 Bad Request from nginx.
    form_body = urllib.parse.urlencode(params).encode()
    code, resp = fetch_json(
        "https://api.telegra.ph/createPage",
        method="POST",
        data=form_body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    if code == 200 and resp.get("ok"):
        url = f"https://telegra.ph/{resp['result']['path']}"
        print(f"✅ Telegraph опубликовано: {url}")
        text = set_frontmatter_status(text, status)
        if "telegraph_url:" not in text:
            text = text.replace(
                f"status: {status}",
                f"status: {status}\ntelegraph_url: {url}",
            )
        with open(draft_path, "w", encoding="utf-8") as f:
            f.write(text)
        return 0
    else:
        print(f"❌ Telegraph ошибка ({code}): {resp}")
        return 1


def telegraph_setup():
    """Создать Telegraph аккаунт и вывести auth_url для активации в браузере."""
    params = {"short_name": "dev24pro", "author_name": "Dev24Pro"}
    query = urllib.parse.urlencode(params)
    code, resp = fetch_json(f"https://api.telegra.ph/createAccount?{query}")

    if code == 200 and resp.get("ok"):
        token = resp["result"]["access_token"]
        auth_url = resp["result"]["auth_url"]

        env_path = os.path.expanduser("~/.hermes/.env")
        with open(env_path, "r") as f:
            lines = f.readlines()
        found = False
        new_lines = []
        for line in lines:
            if line.strip().startswith("TELEGRA_PH_TOKEN="):
                new_lines.append(f"TELEGRA_PH_TOKEN={token}\n")
                new_lines.append(f"TELEGRA_PH_AUTH_URL={auth_url}\n")
                found = True
            elif line.strip().startswith("TELEGRA_PH_AUTH_URL="):
                continue
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(f"TELEGRA_PH_TOKEN={token}\n")
            new_lines.append(f"TELEGRA_PH_AUTH_URL={auth_url}\n")
        with open(env_path, "w") as f:
            f.writelines(new_lines)

        print(f"✅ Telegraph аккаунт создан и активирован!")
        print(f"   Токен: ...{token[-8:]} (сохранён в .env как TELEGRA_PH_TOKEN)")
        print(f"   📝 Автор: {resp['result'].get('author_name', 'Dev24Pro')}")
        return 0
    else:
        print(f"❌ Ошибка создания аккаунта: {code} {resp}")
        return 1


# ==================== Blogger adapter ====================
def _refresh_blogger_token():
    """Attempt to refresh the Blogger access token. Returns new token or None."""
    refresh_token = os.environ.get("BLOGGER_REFRESH_TOKEN") or os.environ.get("GOOGLE_REFRESH_TOKEN")
    client_id = os.environ.get("BLOGGER_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("BLOGGER_CLIENT_SECRET") or os.environ.get("GOOGLE_CLIENT_SECRET")
    if not all([refresh_token, client_id, client_secret]):
        return None
    import urllib.request as _urlreq
    from urllib.parse import urlencode as _urlenc
    token_data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    body = _urlenc(token_data).encode()
    req = _urlreq.Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with _urlreq.urlopen(req, timeout=15) as resp:
            tokens = json.loads(resp.read().decode())
        return tokens.get("access_token")
    except Exception:
        return None


def publish_blogger(slug, status, draft_path):
    """Публикация в Blogger/Blogspot через Google OAuth2 API.

    Strategy: try existing access_token first; only refresh if the token is
    missing or expired (HTTP 401). Falls back to GOOGLE_* credentials.
    """
    import urllib.request as _urlreq

    client_id = os.environ.get("BLOGGER_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("BLOGGER_CLIENT_SECRET") or os.environ.get("GOOGLE_CLIENT_SECRET")
    blog_id = os.environ.get("BLOGGER_BLOG_ID")
    access_token = os.environ.get("BLOGGER_ACCESS_TOKEN") or os.environ.get("GOOGLE_ACCESS_TOKEN")

    if not all([client_id, client_secret]):
        print("❌ Blogger OAuth2 не настроен.")
        print("   Запустите: python3 ~/.hermes/scripts/blogger_setup.py")
        return 1

    # Try existing access_token; refresh only if missing
    if not access_token:
        access_token = _refresh_blogger_token()
        if not access_token:
            print("❌ Нет access_token и refresh не удался.")
            print("   Запустите: python3 ~/.hermes/scripts/blogger_setup.py")
            return 1

    # Build HTML post
    text = open(draft_path, encoding="utf-8").read()
    meta, body_md = parse_frontmatter(text)

    # Idempotency: skip if already published on Blogger
    if "blogger_url" in meta:
        print(f"✅ Blogger уже опубликован: {meta['blogger_url']}")
        return 0

    title = meta.get("title", slug.replace("-", " ").title())
    content_html = markdown_to_html_simple(body_md)

    # Resolve blog_id if not set
    if not blog_id:
        req2 = _urlreq.Request(
            "https://www.googleapis.com/blogger/v3/blogs/byurl?url=https://dev24pro.blogspot.com",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        try:
            with _urlreq.urlopen(req2, timeout=10) as resp2:
                blog_info = json.loads(resp2.read().decode())
                blog_id = blog_info.get("id", "")
        except Exception as e:
            print(f"❌ Не удалось найти blog_id: {e}")
            return 1

    # Publish
    post_data = {"title": title, "content": content_html}
    code, resp = fetch_json(
        f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts",
        method="POST",
        data=post_data,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if code in (200, 201) and isinstance(resp, dict):
        url = resp.get("url", "")
        print(f"✅ Blogger опубликовано: {url}")
        text = set_frontmatter_status(text, status)
        if "blogger_url:" not in text:
            text = text.replace(
                f"status: {status}",
                f"status: {status}\nblogger_url: {url}",
            )
        with open(draft_path, "w", encoding="utf-8") as f:
            f.write(text)
        return 0

    # If 401 (token expired), try refresh and retry
    if code == 401:
        new_token = _refresh_blogger_token()
        if new_token:
            code, resp = fetch_json(
                f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts",
                method="POST",
                data=post_data,
                headers={"Authorization": f"Bearer {new_token}"},
            )
            if code in (200, 201) and isinstance(resp, dict):
                url = resp.get("url", "")
                print(f"✅ Blogger опубликовано (после refresh): {url}")
                text = set_frontmatter_status(text, status)
                if "blogger_url:" not in text:
                    text = text.replace(
                        f"status: {status}",
                        f"status: {status}\nblogger_url: {url}",
                    )
                with open(draft_path, "w", encoding="utf-8") as f:
                    f.write(text)
                return 0

    print(f"❌ Blogger ошибка ({code}): {resp}")
    return 1


# ==================== multi adapter ====================
def publish_multi(slug, status, draft_path):
    """Публикация на все платформы: 24go (dev24.pro) + dev.to + Telegraph + Blogger.

    Publisher Agent: публикует оригинал на все площадки, сохраняет canonical_url
    и platform-specific URLs (devto_url, telegraph_url, blogger_url) в frontmatter.

    Порядок: 24go (canonical + bilingual local save) → dev.to → Telegraph → Blogger → manual.
    Каждый адаптер читает draft.md заново, поэтому последовательность безопасна:
    поправки в frontmatter от предыдущего адаптера видны следующему.
    """
    results = {}

    # 1. Primary: 24go (dev24.pro) — canonical local save + bilingual published files
    ok = publish_24go(slug, status, draft_path) == 0
    results["24go"] = "ok" if ok else "failed"
    if not ok:
        print("❌ Primary CMS/editorial gate failed; no secondary publication or local published export")
        return 1

    # 2. dev.to (DEV Community через Forem API)
    ok = publish_devto(slug, status, draft_path) == 0
    results["devto"] = "ok" if ok else "failed"

    # 3. Telegraph
    ok = publish_telegraph(slug, status, draft_path) == 0
    results["telegraph"] = "ok" if ok else "failed"

    # 4. Blogger (OAuth2)
    ok = publish_blogger(slug, status, draft_path) == 0
    results["blogger"] = "ok" if ok else "failed"

    # 5. Manual local save (flat copy в published/<slug>.md)
    ok = publish_manual(slug, status, draft_path) == 0
    results["manual"] = "ok" if ok else "failed"

    print(f"\n📊 Результаты публикации:")
    for plat, result in results.items():
        icon = "✅" if result != "failed" else "❌"
        print(f"  {icon} {plat}: {result}")
    return 0 if all(r != "failed" for r in results.values()) else 1


# ==================== syndicate adapter ====================
def _syndication_request(*args, **kwargs):
    """Record transport failures without discarding other successful attempts."""
    try:
        code, response = fetch_json(*args, **kwargs)
    except OSError:
        return 0, {"error": "transport failure"}
    return code, response if isinstance(response, dict) else {}


def _record_syndication_url(draft_path, results, platform, url):
    """Checkpoint each confirmed URL before the next remote publication."""
    parsed = urllib.parse.urlsplit(url) if isinstance(url, str) else None
    if not parsed or parsed.scheme not in ("http", "https") or not parsed.netloc:
        results[platform] = "failed"
        print(f"❌ {platform}: ответ не содержит URL публикации")
        return
    with open(draft_path, encoding="utf-8") as f:
        text = f.read()
    end = text.find("\n---", 3)
    head, tail = text[:end], text[end:]
    key = f"{platform}_url"
    field = f"{key}: {url}"
    if re.search(rf"^{key}:.*$", head, re.M):
        head = re.sub(rf"^{key}:.*$", lambda match: field, head, flags=re.M)
    else:
        head = head.rstrip() + "\n" + field
    with open(draft_path, "w", encoding="utf-8") as f:
        f.write(head + tail)
    results[platform] = url
    print(f"✅ Syndicate {platform}: {url}")


def publish_syndicate(slug, status, draft_path):
    """Репост статьи на площадки с ссылкой на оригинал.

    Второй агент: через 24ч после публикации оригинала читает canonical URLs
    из frontmatter и создаёт кросспосты с обратной ссылкой.
    """
    with open(draft_path, encoding="utf-8") as source:
        text = source.read()
    meta, body = parse_frontmatter(text)

    original_urls = {}
    for key in ["canonical_url", "canonical_url_en", "telegraph_url", "devto_url"]:
        if key in meta:
            original_urls[key] = meta[key]

    if not original_urls:
        print("❌ Нет оригинальных URL в frontmatter. Сначала опубликуйте статью (--adapter 24go или --adapter multi).")
        return 2

    results = {}

    original_link = meta.get("canonical_url") or meta.get("devto_url") or meta.get("telegraph_url")
    original_link_en = meta.get("canonical_url_en") or meta.get("devto_en_url", "")

    # Read EN version body if available
    work_dir = os.path.dirname(draft_path)
    en_draft_path = os.path.join(work_dir, "draft.en.md")
    en_body = body
    en_meta = {}
    if original_link_en and os.path.exists(en_draft_path):
        with open(en_draft_path, encoding="utf-8") as source:
            en_text = source.read()
        en_meta, en_body = parse_frontmatter(en_text)
    en_title = en_meta.get("title") or meta.get("title_en") or meta.get("title", slug.replace("-", " ").title())

    syndicate_note_en = ""
    syndicate_note = (
        f"\n\n---\n*Эта статья также опубликована на других платформах. "
        f"Оригинал: [{meta.get('title', slug)}]({original_link})*\n"
    )
    syndicate_body = body.strip() + syndicate_note

    # Build EN syndicate body (for bilingual syndication)
    syndicate_note_en = (
        f"\n\n---\n*This article was also published on other platforms. "
        f"Original: [{en_title}]({original_link_en})*\n"
    )
    syndicate_body_en = en_body.strip() + syndicate_note_en

    # Explicit opt-outs override credentials; absent flags retain credential-based opt-in.
    cfg = load_config(find_config())
    enabled = {
        plat: cfg_get(cfg, f"publishing.platforms.{plat}.enabled", None)
        for plat in ("devto", "telegraph", "blogger")
    }
    devto_key = os.environ.get("DEV_TO_API_KEY") if enabled["devto"] is not False else None
    token = os.environ.get("TELEGRA_PH_TOKEN") if enabled["telegraph"] is not False else None
    blog_id = os.environ.get("BLOGGER_BLOG_ID", "") if enabled["blogger"] is not False else ""
    for plat, credential in (("devto", devto_key), ("telegraph", token), ("blogger", blog_id)):
        if enabled[plat] is True and not credential and not meta.get(f"{plat}_url"):
            results[plat] = "failed"
            print(f"❌ {plat}: площадка включена, но учётные данные отсутствуют")

    # --- dev.to ---
    if enabled["devto"] is not False and meta.get("devto_url"):
        print(f"✅ dev.to уже опубликован: {meta['devto_url']}")
        results["devto"] = meta["devto_url"]
    elif devto_key:
        tags_str = meta.get("tags", "telegram,marketing,saastra")
        tags = [t.strip() for t in tags_str.split(",")] if tags_str else []
        article = {
            "title": meta.get("title", slug.replace("-", " ").title()) + " [перекрёстная публикация]",
            "body_markdown": syndicate_body,
            "canonical_url": original_link,
            "tags": (tags + ["syndicated"])[:4],  # dev.to limit: 4 tags max
            "published": True,
            "status": "published",
        }
        code, resp = _syndication_request(
            "https://dev.to/api/articles",
            method="POST",
            data={"article": article},
            headers={
                "api-key": devto_key,
                "Accept": "application/vnd.forem.api-v1+json",
            },
        )
        if code in (200, 201):
            _record_syndication_url(draft_path, results, "devto", resp.get("url"))
        else:
            results["devto"] = "failed"
            print(f"❌ Syndicate dev.to ({code}): {resp}")
    else:
        print("⚠️  DEV_TO_API_KEY не найден — пропуск dev.to")

    # --- dev.to (EN version) ---
    if enabled["devto"] is not False and meta.get("devto_en_url"):
        print(f"✅ dev.to (EN) уже опубликован: {meta['devto_en_url']}")
        results["devto_en"] = meta["devto_en_url"]
    elif devto_key and original_link_en:
        en_tags_str = meta.get("tags", "telegram,marketing,saastra")
        en_tags = [t.strip() for t in en_tags_str.split(",")] if en_tags_str else []
        article_en = {
            "title": en_title + " [cross-post]",
            "body_markdown": syndicate_body_en,
            "canonical_url": original_link_en,
            "tags": (en_tags + ["syndicated"])[:4],
            "published": True,
            "status": "published",
        }
        code, resp = _syndication_request(
            "https://dev.to/api/articles",
            method="POST",
            data={"article": article_en},
            headers={
                "api-key": devto_key,
                "Accept": "application/vnd.forem.api-v1+json",
            },
        )
        if code in (200, 201):
            _record_syndication_url(draft_path, results, "devto_en", resp.get("url"))
        else:
            results["devto_en"] = "failed"
            print(f"❌ Syndicate dev.to EN ({code}): {resp}")
    elif enabled["devto"] is not False and original_link_en and (
        enabled["devto"] is True or meta.get("devto_url")
    ):
        results["devto_en"] = "failed"
        print("❌ dev.to EN: отсутствует DEV_TO_API_KEY")

    # --- Telegraph ---
    if enabled["telegraph"] is not False and meta.get("telegraph_url"):
        print(f"✅ Telegraph уже опубликован: {meta['telegraph_url']}")
        results["telegraph"] = meta["telegraph_url"]
    elif token:
        try:
            content = telegraph_content(body, original_link, markdown_to_html_simple)
        except ValueError as exc:
            print(f"❌ Telegraph: {exc}")
            return 1
        params = {
            "access_token": token,
            "title": meta.get("title", slug.replace("-", " ").title()) + " (копия)",
            "content": content,
            "author_name": "Dev24Pro",
        }
        # POST with form-encoded body instead of GET query string.
        # GET with long content URLs (4000+ chars) gets 400 Bad Request from nginx.
        form_body = urllib.parse.urlencode(params).encode()
        code, resp = _syndication_request(
            "https://api.telegra.ph/createPage",
            method="POST",
            data=form_body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if code == 200 and resp.get("ok") and resp.get("result", {}).get("path"):
            url = f"https://telegra.ph/{resp['result']['path']}"
            _record_syndication_url(draft_path, results, "telegraph", url)
        else:
            results["telegraph"] = "failed"
            print(f"❌ Syndicate Telegraph ({code}): {resp}")
    # --- Blogger ---
    if enabled["blogger"] is not False and meta.get("blogger_url"):
        print(f"✅ Blogger уже опубликован: {meta['blogger_url']}")
        results["blogger"] = meta["blogger_url"]
    elif blog_id:
        import urllib.request as _urlreq
        access_token = os.environ.get("BLOGGER_ACCESS_TOKEN") or os.environ.get("GOOGLE_ACCESS_TOKEN")
        if not access_token:
            access_token = _refresh_blogger_token()
        if access_token:
            post_data = {
                "title": meta.get("title", slug.replace("-", " ").title()) + " [перекрёстная публикация]",
                "content": markdown_to_html_simple(syndicate_body),
            }
            code, resp = _syndication_request(
                f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts",
                method="POST",
                data=post_data,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if code in (200, 201) and isinstance(resp, dict):
                url = resp.get("url", "")
                _record_syndication_url(draft_path, results, "blogger", url)
            else:
                # Try refresh on 401
                if code == 401:
                    new_token = _refresh_blogger_token()
                    if new_token:
                        code, resp = _syndication_request(
                            f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts",
                            method="POST",
                            data=post_data,
                            headers={"Authorization": f"Bearer {new_token}"},
                        )
                        if code in (200, 201) and isinstance(resp, dict):
                            url = resp.get("url", "")
                            _record_syndication_url(draft_path, results, "blogger", url)
                        else:
                            results["blogger"] = "failed"
                            print(f"❌ Syndicate Blogger ({code}): {resp}")
                    else:
                        results["blogger"] = "failed"
                        print("❌ Syndicate Blogger: refresh не удался")
                else:
                    results["blogger"] = "failed"
                    print(f"❌ Syndicate Blogger ({code}): {resp}")
        else:
            results["blogger"] = "failed"
            print("❌ Syndicate Blogger: нет access_token")
    else:
        print("⚠️  BLOGGER_BLOG_ID не задан — пропуск Blogger")

    if not results:
        print("❌ Нет доступных площадок для синдикации: проверьте настройки и учётные данные.")
        return 1
    if any(v == "failed" for v in results.values()):
        return 1
    # Only this adapter knows whether all selected targets completed.
    with open(draft_path, encoding="utf-8") as source:
        current = source.read()
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", current, re.S)
    if not match:
        return 1
    head = match.group(1)
    if re.search(r"^syndicated:.*$", head, re.M):
        head = re.sub(r"^syndicated:.*$", "syndicated: true", head, flags=re.M)
    else:
        head += "\nsyndicated: true"
    updated = current[:match.start(1)] + head + current[match.end(1):]
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=os.path.dirname(os.path.abspath(draft_path)), delete=False) as target:
            temporary = target.name
            target.write(updated)
        os.chmod(temporary, os.stat(draft_path).st_mode & 0o777)
        os.replace(temporary, draft_path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)
    return 0


# ==================== CLI ====================
def main():
    p = argparse.ArgumentParser(
        description="Адаптер публикации для statejnik. "
                    "Поддерживает: manual, devto, telegraph, blogger, multi, syndicate, 24go",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--adapter", required=True,
                   choices=ADAPTERS, help="способ публикации")
    p.add_argument("--slug", required=True, help="slug статьи")
    p.add_argument("--status", default="draft",
                   choices=("draft", "published"), help="статус")
    p.add_argument("draft", nargs="?", help="путь к черновику (.md)")
    args = p.parse_args()

    if args.adapter == "telegraph-setup":
        sys.exit(telegraph_setup())

    if not args.draft or not os.path.isfile(args.draft):
        sys.stderr.write(f"нет файла: {args.draft}\n")
        sys.exit(2)

    adapters = {
        "manual": publish_manual,
        "devto": publish_devto,
        "telegraph": publish_telegraph,
        "blogger": publish_blogger,
        "multi": publish_multi,
        "syndicate": publish_syndicate,
        "24go": publish_24go,
    }

    fn = adapters[args.adapter]
    sys.exit(fn(args.slug, args.status, args.draft))


if __name__ == "__main__":
    main()
