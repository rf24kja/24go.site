#!/usr/bin/env python3
"""Offline review→draft admission, never publication. See statejnik_admit_review.md."""
import argparse
import fcntl
import hashlib
import json
from pathlib import Path
import re
import sys

# Import only the safe evidence/parser modules, never publish.py or its env loader.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/statejnik/tools'))
from _cms24go import PublicationError, atomic_write, canonical_json, editorial_gate, payload_for, with_fields
from final_review import parse_frontmatter


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise PublicationError(message)


def artifact(root, item):
    path = (root / item['path']).resolve()
    require(path.is_relative_to(root.resolve()), 'QA artifact escapes proof directory')
    data = path.read_bytes()
    require(bool(data) and sha(data) == item['sha256'], 'QA artifact hash mismatch')
    return data


def check_proof(draft, config, proof_path, payload, acceptance):
    raw = proof_path.read_bytes()
    proof = json.loads(raw)
    renderer = Path(config['qa']['admission']['renderer_path'])
    require(renderer.is_absolute(), 'renderer_path must be absolute')
    pins = dict(acceptance_sha256=acceptance, payload_sha256=sha(canonical_json(payload)),
                renderer_sha256=sha(renderer.read_bytes()))
    require(proof['version'] == 1 and proof['slug'] == payload['slug'], 'Wrong QA proof article/version')
    require(all(proof.get(k) == v for k, v in pins.items()), 'Stale QA proof pins')
    require(proof['render']['passed'] is True, 'Rendering did not pass')
    cases = proof['cases']
    require(len(cases) == 4, 'Exactly four article browser cases required')
    expected = {(locale, device) for locale in ('ru', 'en') for device in ('desktop', 'mobile')}
    seen = set()
    for case in cases:
        identity = case['locale'], case['device']
        require(identity in expected and identity not in seen, 'Wrong/duplicate browser case')
        seen.add(identity)
        width, client, scroll = (case[k] for k in ('viewport_width', 'client_width', 'scroll_width'))
        require(all(type(n) is int and n > 0 for n in (width, client, scroll)), 'Invalid browser dimensions')
        require((320 <= width <= 600) if identity[1] == 'mobile' else width >= 1000, 'Wrong device viewport')
        require(client <= width and scroll <= client and type(case['h1_count']) is int and case['h1_count'] == 1,
                'Article overflow or heading failure')
        artifacts = case['artifacts']
        browser = json.loads(artifact(proof_path.parent, artifacts['browser']))
        require(browser.get('browser') in ('chromium', 'firefox', 'webkit')
                and isinstance(browser.get('url'), str) and browser['url'].startswith(('http://', 'https://', 'file://')),
                'Missing actual browser capture metadata')
        measurement_keys = ('locale', 'device', 'viewport_width', 'client_width', 'scroll_width', 'h1_count')
        require(all(browser.get(k) == case[k] for k in measurement_keys), 'Browser measurements disagree')
        require(all(browser.get(k + '_sha256') == artifacts[k]['sha256'] for k in ('html', 'screenshot', 'manifest')),
                'Browser capture artifact mismatch')
        html = artifact(proof_path.parent, artifacts['html'])
        image = artifact(proof_path.parent, artifacts['screenshot'])
        require(b'<html' in html.lower() and image.startswith(b'\x89PNG\r\n\x1a\n'), 'Invalid preview/image artifact')
        manifest = json.loads(artifact(proof_path.parent, artifacts['manifest']))
        require(manifest == dict(pins, slug=payload['slug'], locale=identity[0]), 'Preview manifest mismatch')
    return sha(raw)


def validate(draft, config, proof):
    cfg = config['publishing']['platforms']['24go']
    require(cfg.get('enabled') is True and cfg.get('auth_mode') == 'local_backend', 'Publication not explicitly enabled for local backend')
    require(cfg.get('api_base_url') == 'https://api.24go.site/api/v1/blog'
            and cfg.get('site_url') == 'https://www.24go.site', 'Wrong publication scope')
    paths = [draft, draft.with_name('draft.en.md')]
    raw = [p.read_bytes() for p in paths]
    texts = [b.decode('utf-8') for b in raw]
    metas = [parse_frontmatter(t)[0] for t in texts]
    slug = draft.parent.name
    require(draft.name == 'draft.md' and re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug), 'Wrong draft path/slug')
    require(all(m.get('target_site') == '24go.site' and m.get('slug') == slug for m in metas), 'Wrong locale scope/slug')
    require([m.get('locale') for m in metas] == ['ru', 'en'], 'Explicit matching RU/EN locales required')
    statuses = [m.get('status') for m in metas]
    require(statuses in (['review', 'review'], ['draft', 'draft']), 'Only matched review or admitted draft pairs allowed')
    payload = payload_for(slug, *texts, parse_frontmatter)
    acceptance = editorial_gate(draft, payload, config['qa']['final_review'], parse_frontmatter)
    proof_sha = check_proof(draft, config, proof, payload, acceptance)
    if statuses == ['draft', 'draft']:
        require(all(m.get('admission_acceptance_sha256') == acceptance and m.get('admission_proof_sha256') == proof_sha
                    for m in metas), 'Draft was not admitted with current evidence')
    return paths, raw, texts, payload, acceptance, proof_sha, statuses


def admit(draft, config, proof, dry_run=False):
    draft, proof = Path(draft).resolve(), Path(proof).resolve()
    # Same per-article exclusion boundary as CMS publication/final review.
    with (draft.parent / '.24go-publish.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        initial = validate(draft, config, proof)
        paths, raw, texts, payload, acceptance, proof_sha, statuses = initial
        require(validate(draft, config, proof) == initial, 'Evidence changed during admission')
        if dry_run:
            return 'validated'
        if statuses == ['draft', 'draft']:
            return 'already-admitted'
        fields = dict(status='draft', admission_acceptance_sha256=acceptance, admission_proof_sha256=proof_sha)
        updated = [with_fields(t, fields) for t in texts]
        require(payload_for(payload['slug'], *updated, parse_frontmatter) == payload, 'Operational update changed payload')
        # EN first: the publisher discovers RU draft.md. A failed partial write leaves
        # RU in review; mixed statuses are rejected, never silently repaired.
        for index in (1, 0):
            require(all(p.read_bytes() == b for p, b in zip(paths, raw)), 'Concurrent draft mutation')
            require(editorial_gate(draft, payload, config['qa']['final_review'], parse_frontmatter) == acceptance
                    and check_proof(draft, config, proof, payload, acceptance) == proof_sha, 'Evidence changed before write')
            require(all(p.read_bytes() == b for p, b in zip(paths, raw)), 'Concurrent mutation during evidence recheck')
            atomic_write(paths[index], updated[index])
            raw[index] = updated[index].encode()
        try:
            require(all(p.read_bytes() == b for p, b in zip(paths, raw)), 'Admission readback mismatch')
            validate(draft, config, proof)
        except (OSError, ValueError, KeyError, TypeError):
            # Never overwrite a concurrent external edit. Under the shared lock,
            # revoke our own RU admission before propagating failed validation.
            if draft.read_bytes() == raw[0]:
                atomic_write(draft, texts[0])
            raise
        return 'admitted'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path)
    parser.add_argument('--proof', type=Path)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('draft', type=Path)
    args = parser.parse_args()
    try:
        from _config import load_config
        config = load_config(str(args.config))
        print(admit(args.draft, config, args.proof or args.draft.parent / 'qa-proof.json', args.dry_run))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print('Admission refused: ' + str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
