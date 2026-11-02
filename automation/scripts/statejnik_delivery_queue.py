#!/usr/bin/env python3
"""Select an accepted review pair for QA; never admit, publish or call a model."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

HOME = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOME / 'skills/statejnik/tools'))
from _article_length import require_body_lengths
from _cms24go import editorial_gate, payload_for
from _config import load_config
from final_review import parse_frontmatter


def _candidate(folder, paths, texts, metas, config):
    slug = folder.name
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError('Invalid slug')
    dates = []
    for locale, meta in zip(('ru', 'en'), metas):
        if not (meta.get('target_site') == '24go.site' and meta.get('slug') == slug and meta.get('locale') == locale):
            raise ValueError('Wrong pair scope')
        date = datetime.fromisoformat(meta['created_at'].replace('Z', '+00:00'))
        if date.utcoffset() is None:
            raise ValueError('Timezone required')
        dates.append(date.astimezone(timezone.utc))
    payload = payload_for(slug, *texts, parse_frontmatter)
    counts = require_body_lengths(payload)
    acceptance = editorial_gate(paths[0], payload, config['qa']['final_review'], parse_frontmatter)
    if any(path.read_bytes() != text.encode('utf-8') for path, text in zip(paths, texts)):
        raise ValueError('Pair changed during selection')
    return dict(slug=slug, draft=str(paths[0]), created_at=min(dates).isoformat(),
                acceptance_sha256=acceptance, body_characters=counts,
                source_sha256={locale: hashlib.sha256(text.encode()).hexdigest()
                               for locale, text in zip(('ru', 'en'), texts)})


def inspect_queue(work, config):
    cfg = config['publishing']['platforms']['24go']
    if not (cfg.get('enabled') is True and cfg.get('auth_mode') == 'local_backend'
            and cfg.get('api_base_url') == 'https://api.24go.site/api/v1/blog'
            and cfg.get('site_url') == 'https://www.24go.site'):
        raise ValueError('Publication scope is not enabled')
    config['qa']['final_review']
    work = Path(work)
    if work.is_symlink() or not work.is_dir():
        raise ValueError('Invalid work directory')
    eligible, blocked = [], []
    for folder in sorted(work.iterdir()):
        if folder.name.startswith('.') or not folder.is_dir():
            continue
        paths = [folder / 'draft.md', folder / 'draft.en.md']
        if folder.is_symlink() or any(path.is_symlink() for path in paths):
            blocked.append(dict(slug=folder.name, reason='unsafe_path'))
            continue
        if not any(path.exists() for path in paths):
            continue
        if not all(path.is_file() for path in paths):
            blocked.append(dict(slug=folder.name, reason='incomplete_pair'))
            continue
        try:
            texts = [path.read_bytes().decode('utf-8') for path in paths]
            metas = [parse_frontmatter(text)[0] for text in texts]
            if all(meta.get('status') == 'published' for meta in metas):
                continue
            if all(meta.get('target_site') and meta['target_site'] != '24go.site' for meta in metas):
                continue
            if not all(meta.get('status') == 'review' for meta in metas):
                blocked.append(dict(slug=folder.name, reason='not_review_pair'))
                continue
            candidate = _candidate(folder, paths, texts, metas, config)
            eligible.append(candidate)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            # Never serialize exception bodies, article text, credentials or model responses.
            blocked.append(dict(slug=folder.name, reason='editorial_gate_failed', error_type=type(exc).__name__))
    eligible.sort(key=lambda item: (item['created_at'], item['slug']))
    return dict(selection_only=True, selected=eligible[0] if eligible else None,
                eligible=eligible, blocked=blocked,
                eligible_count=len(eligible), blocked_count=len(blocked))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=HOME / 'skills/statejnik/config.yaml')
    parser.add_argument('--work-dir', type=Path, default=HOME / 'skills/statejnik/work')
    args = parser.parse_args()
    try:
        result = inspect_queue(args.work_dir, load_config(str(args.config)))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps(dict(selection_only=True, selected=None, status='blocked', error_type=type(exc).__name__)))
        return 2
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
