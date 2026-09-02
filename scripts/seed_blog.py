"""Seed 16 SEO-optimized blog articles into the 24GO database.

Usage:
    python scripts/seed_blog.py
    BLOG_EMAIL=rf24krsk@gmail.com BLOG_PASSWORD=yourpass python scripts/seed_blog.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = os.getenv("API_BASE", "https://api.24go.site")
EMAIL = os.getenv("BLOG_EMAIL", "rf24krsk@gmail.com")
PASSWORD = os.getenv("BLOG_PASSWORD", "")


def api(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=60)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:500]


def login():
    if not PASSWORD:
        print("ERROR: Set BLOG_PASSWORD env var.")
        sys.exit(1)
    s, b = api("POST", "/api/v1/auth/login", {"email": EMAIL, "password": PASSWORD})
    if s != 200 or not isinstance(b, dict) or not b.get("access_token"):
        print(f"Login failed: {s} {b}")
        sys.exit(1)
    print(f"Logged in as {EMAIL}")
    return b["access_token"]


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, "blog_articles.json")
    with open(data_path, encoding="utf-8") as f:
        articles = json.load(f)

    token = login()
    created, skipped, errors = 0, 0, 0

    for art in articles:
        payload = {
            "slug": art["slug"],
            "title_en": art["title_en"],
            "title_ru": art["title_ru"],
            "content_en": art["content_en"],
            "content_ru": art["content_ru"],
            "excerpt_en": art["excerpt_en"],
            "excerpt_ru": art["excerpt_ru"],
            "tags": art["tags"],
            "published": True,
            "meta_description_en": art.get("meta_description_en", ""),
            "meta_description_ru": art.get("meta_description_ru", ""),
        }
        s, b = api("POST", "/api/v1/blog/admin", payload, token=token)
        if s == 201:
            created += 1
            print(f"  [OK] {art['slug']}")
        elif s == 400 and "already exists" in str(b):
            skipped += 1
            print(f"  [SKIP] {art['slug']} (exists)")
        else:
            errors += 1
            print(f"  [ERR] {art['slug']}: {s} {b}")

    print(f"\nDone: {created} created, {skipped} skipped, {errors} errors")


if __name__ == "__main__":
    main()
