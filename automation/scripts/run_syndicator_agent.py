#!/usr/bin/env python3
"""
run_syndicator_agent.py — Агент-синдикатор (Agent 2)

Через 24 часа после публикации оригинала на dev24.pro (primary),
читает canonical URL из frontmatter и репостит статью на площадки
(dev.to, Telegraph, Blogger) с обратной ссылкой на оригинал.

Ищет черновики со статусом `published`, но без `syndicated: true`.

Usage:
  python3 run_syndicator_agent.py              # найти и синдикать
  python3 run_syndicator_agent.py --dry-run    # только показать
"""
import os
import sys
import glob
import json
import argparse
import re
import subprocess
from datetime import datetime, timedelta, timezone

WORK_DIR = os.path.expanduser("~/.hermes/skills/statejnik")
SYNDICATE_AFTER_HOURS = 24  # из config.yaml publishing.syndicate_after_hours


def parse_frontmatter(text):
    meta = {}
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.S)
    if match:
        head = match.group(1)
        for line in head.splitlines():
            if line.startswith((" ", "\t")):
                continue
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip().strip('"').strip("'")
        # A draft's creation time must not shorten the post-publication delay.
        if "published_at" in meta:
            try:
                published = datetime.fromisoformat(meta["published_at"].replace("Z", "+00:00"))
                if published.tzinfo is not None:
                    meta["_published_at"] = published.astimezone(timezone.utc)
            except ValueError:
                pass
    return meta


def find_published_not_syndicated():
    """Find drafts published but not yet syndicated (older than 24h)."""
    pattern = os.path.join(WORK_DIR, "work", "*", "draft.md")
    candidates = []
    now = datetime.now(timezone.utc)

    for path in sorted(glob.glob(pattern)):
        with open(path, encoding="utf-8") as f:
            text = f.read()

        if text.startswith("---"):
            match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.S)
            if match:
                meta = parse_frontmatter(text)
                if meta.get("status") != "published":
                    continue

                # Check if already syndicated
                if meta.get("syndicated", "").lower() == "true":
                    continue

                # Check if canonical_url exists (must be published somewhere first)
                if "canonical_url" not in meta and "telegraph_url" not in meta:
                    continue

                # Check age — only syndicate after N hours
                published = meta.get("_published_at")
                if published is None:
                    print(f"  {meta.get('slug', os.path.basename(path))}: пропущено — нет корректного published_at с часовым поясом")
                    continue
                age_hours = (now - published).total_seconds() / 3600
                if age_hours < SYNDICATE_AFTER_HOURS:
                    skip = SYNDICATE_AFTER_HOURS - age_hours
                    print(f"  {meta.get('slug', os.path.basename(path))}: ждёт {skip:.0f}ч до синдикации")
                    continue

                slug = meta.get("slug") or os.path.basename(os.path.dirname(path))
                candidates.append({"path": path, "slug": slug, "meta": meta})

    return candidates


def syndicate_draft(draft, dry_run=False):
    """Run syndication via publish.py --adapter syndicate."""
    slug = draft["slug"]
    path = draft["path"]

    print(f"[{datetime.now().strftime('%H:%M:%S')}] {slug}: синдикация на площадки...")

    if dry_run:
        print(f"  [dry-run] пропущено: {path}")
        return True

    cmd = [
        sys.executable,
        os.path.join(WORK_DIR, "tools", "publish.py"),
        "--adapter", "syndicate",
        "--slug", slug,
        "--status", "published",
        path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except (subprocess.TimeoutExpired, OSError) as exc:
        print(f"  Ошибка запуска адаптера синдикации: {type(exc).__name__}; доставка не подтверждена")
        return False
    print(f"  stdout: {result.stdout.strip()[-300:]}")
    if result.stderr:
        print(f"  stderr: {result.stderr.strip()[-300:]}")

    if result.returncode == 0:
        with open(path, encoding="utf-8") as f:
            text = f.read()
        if parse_frontmatter(text).get("syndicated", "").lower() != "true":
            print("  Доставка не подтверждена: адаптер не сохранил syndicated: true")
            return False
        print("  Подтверждён checkpoint адаптера syndicated: true")

    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Syndicator agent — кросспост через 24ч")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"=== Syndicator Agent [{datetime.now().isoformat()}] ===")
    drafts = find_published_not_syndicated()
    if not drafts:
        print("Нет черновиков для синдикации. 📭")
        return 0

    print(f"Найдено черновиков для синдикации: {len(drafts)}\n")

    syndicated = 0
    for draft in drafts:
        if syndicate_draft(draft, args.dry_run):
            syndicated += 1
        print()

    if args.dry_run:
        print(f"Предпросмотр: найдено {len(drafts)}; синдикация не выполнялась")
    else:
        print(f"Готово: синдицировано {syndicated}/{len(drafts)}")
    return 0 if syndicated == len(drafts) else 1


if __name__ == "__main__":
    sys.exit(main())
