#!/usr/bin/env python3
"""
run_publisher_agent.py — Агент-издатель (Agent 1)

Следит за черновиками в work/ и доставляет принятую версию в настроенную
CMS 24go через выбранный безопасный транспорт.

Запускается из cron или вручную. Ищет черновики со статусом `draft` в work/*/
draft.md, публикует их, обновляя статус в frontmatter на `published`.

Usage:
  python3 run_publisher_agent.py              # найти и опубликовать черновики
  python3 run_publisher_agent.py --dry-run    # только показать, не публиковать
"""
import os
import sys
import glob
import json
import argparse
import importlib.util
from pathlib import Path
import re
import subprocess
from datetime import datetime

WORK_DIR = os.path.join(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")), "skills", "statejnik")


def find_drafts():
    """Find all draft.md files in work/ with status: draft."""
    pattern = os.path.join(WORK_DIR, "work", "*", "draft.md")
    drafts = []
    for path in sorted(glob.glob(pattern)):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.S)
        if not match:
            continue
        metadata = {}
        for line in match.group(1).splitlines():
            if line.startswith(("status:", "slug:")):
                key, value = line.split(":", 1)
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                metadata[key] = value
        # A mention of status: draft in another field is not queue membership.
        if metadata.get("status") != "draft":
            continue
        slug = metadata.get("slug") or os.path.basename(os.path.dirname(path))
        drafts.append({"path": path, "slug": slug})
    return drafts


def _load_publication_config():
    path = Path(WORK_DIR) / 'config.yaml'
    if not path.exists():
        return {}
    spec = importlib.util.spec_from_file_location('publisher_config', Path(WORK_DIR) / 'tools' / '_config.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.load_config(str(path))


def publish_draft(draft, dry_run=False):
    """Publish a single draft using publish.py --adapter 24go."""
    slug = draft["slug"]
    path = draft["path"]

    if dry_run:
        print(f"  [dry-run] пропущено: {path}")
        return True

    print(f"[{datetime.now().strftime('%H:%M:%S')}] {slug}: публикация через CMS-адаптер 24go...")

    try:
        config = _load_publication_config()
        mode = config.get('publishing', {}).get('platforms', {}).get('24go', {}).get('auth_mode', 'env')
        if mode == 'local_backend':
            cmd = [sys.executable, str(Path(__file__).with_name('statejnik_local_cms.py')),
                   '--config', os.path.join(WORK_DIR, 'config.yaml'), path]
            timeout = 180
        elif mode in ('env', 'environment'):
            cmd = [sys.executable, os.path.join(WORK_DIR, 'tools', 'publish.py'),
                   '--adapter', '24go', '--slug', slug, '--status', 'published', path]
            timeout = 60
        else:
            print('  Неизвестный способ авторизации CMS; публикация заблокирована')
            return False
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except (subprocess.TimeoutExpired, OSError) as exc:
        # A lost response can follow a remote write; leave reconciliation to the adapter.
        print(f"  Ошибка запуска CMS-адаптера: {type(exc).__name__}; доставка не подтверждена")
        return False

    print(f"  stdout: {result.stdout.strip()[-300:]}")
    if result.stderr:
        print(f"  stderr: {result.stderr.strip()[-300:]}")

    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Publisher agent — публикует черновики")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"=== Publisher Agent [{datetime.now().isoformat()}] ===")
    drafts = find_drafts()
    if not drafts:
        print("Нет черновиков для публикации. ✉️")
        return 0

    print(f"Найдено черновиков: {len(drafts)}\n")

    published = 0
    for draft in drafts:
        if publish_draft(draft, args.dry_run):
            published += 1
        print()

    if args.dry_run:
        print(f"Предпросмотр: найдено {len(drafts)}; публикация не выполнялась")
    else:
        print(f"Готово: опубликовано {published}/{len(drafts)}")
    return 0 if published == len(drafts) else 1


if __name__ == "__main__":
    sys.exit(main())
