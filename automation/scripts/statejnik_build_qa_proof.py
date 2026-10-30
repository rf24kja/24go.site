#!/usr/bin/env python3
"""Package existing real SSR/browser evidence; does not approve, admit or publish."""
import argparse
import hashlib
import json
from pathlib import Path
import sys


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def package(draft, renderer):
    root = draft.resolve().parent
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/statejnik/tools'))
    from _article_length import require_body_lengths
    from _cms24go import payload_for
    from final_review import parse_frontmatter
    payload = payload_for(root.name, draft.read_text(encoding='utf-8'),
                          draft.with_name('draft.en.md').read_text(encoding='utf-8'), parse_frontmatter)
    require_body_lengths(payload)
    review = root / 'final-review'
    preview = review / 'local-preview'
    result = json.loads((preview / 'result.json').read_text())
    cases = json.loads((preview / 'browser-cases.json').read_text())
    pins = dict(acceptance_sha256=sha((review / 'acceptance.json').read_bytes()),
                payload_sha256=result['payloadSha256'], renderer_sha256=sha(renderer.read_bytes()))
    if result['publication'] is not False or result['acceptanceSha256'] != pins['acceptance_sha256'] or result['rendererSha256'] != pins['renderer_sha256']:
        raise ValueError('Stale SSR evidence')
    if {(r['locale'], r['ssr'], r['metadata']) for r in result['results']} != {('ru', 'passed', 'passed'), ('en', 'passed', 'passed')}:
        raise ValueError('Both real locale render results are required')
    if len(cases) != 4 or {(r['locale'], r['device']) for r in cases} != {(locale, device) for locale in ('ru', 'en') for device in ('desktop', 'mobile')}:
        raise ValueError('Four unique captured browser cases required')
    prepared = []
    for case in cases:
        if case['acceptance_sha256'] != pins['acceptance_sha256'] or case['renderer_sha256'] != pins['renderer_sha256']:
            raise ValueError('Stale browser evidence')
        files = {}
        for kind, field in [('html', 'preview'), ('screenshot', 'screenshot')]:
            path = (review / case[field + '_path']).resolve()
            if not path.is_relative_to(review.resolve()):
                raise ValueError('Browser artifact escapes review directory')
            raw = path.read_bytes()
            if not raw or sha(raw) != case[field + '_sha256']:
                raise ValueError('Captured artifact changed')
            files[kind] = dict(path=str(path.relative_to(root)), sha256=sha(raw))
        measurement = {key: case[key] for key in ('locale', 'device', 'viewport_width', 'client_width', 'scroll_width', 'h1_count')}
        manifest = dict(pins, slug=root.name, locale=case['locale'])
        prepared.append((case, files, measurement, manifest))
    directory = preview / 'proof'
    directory.mkdir(mode=0o700, exist_ok=True)
    proof_cases = []
    for case, files, measurement, manifest in prepared:
        name = case['locale'] + '-' + case['device']
        path = directory / (name + '-manifest.json')
        path.write_bytes(encoded(manifest))
        files['manifest'] = dict(path=str(path.relative_to(root)), sha256=sha(path.read_bytes()))
        browser = dict(case, **{key + '_sha256': files[key]['sha256'] for key in ('html', 'screenshot', 'manifest')})
        path = directory / (name + '-browser.json')
        path.write_bytes(encoded(browser))
        files['browser'] = dict(path=str(path.relative_to(root)), sha256=sha(path.read_bytes()))
        proof_cases.append(dict(measurement, artifacts=files))
    proof = dict(version=1, slug=root.name, **pins, render={'passed': True}, cases=proof_cases)
    output = root / 'qa-proof.json'
    temporary = root / '.qa-proof.json.tmp'
    temporary.write_bytes(encoded(proof))
    temporary.chmod(0o600)
    temporary.replace(output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--renderer', required=True, type=Path)
    parser.add_argument('draft', type=Path)
    args = parser.parse_args()
    try:
        print(package(args.draft, args.renderer))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print('QA packaging refused: ' + type(error).__name__, file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
