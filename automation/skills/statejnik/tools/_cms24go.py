"""24go BlogPost transport. No success before editorial and CMS readback gates."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from datetime import datetime, timezone
from urllib.parse import urlsplit
from uuid import UUID


class PublicationError(ValueError):
    pass


def canonical_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def payload_for(slug, ru_text, en_text, parse):
    ru, ru_body = parse(ru_text)
    en, en_body = parse(en_text)
    if not all((ru.get('title'), en.get('title'), ru_body.strip(), en_body.strip())):
        raise PublicationError('Both locales require title and content')
    raw_tags = ru.get('tags', '')
    if raw_tags.startswith('['):
        try:
            tags = json.loads(raw_tags)
        except ValueError:
            tags = [t.strip().strip('\"\'') for t in raw_tags[1:-1].split(',') if t.strip()]
    else:
        tags = [t.strip() for t in raw_tags.split(',') if t.strip()]
    if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
        raise PublicationError('Invalid tags')
    data = dict(slug=slug, tags=tags, og_image_url=ru.get('image', ''))
    for locale, meta, body in [('ru', ru, ru_body), ('en', en, en_body)]:
        description = meta.get('meta_description', meta.get('description', ''))
        data.update({f'title_{locale}': meta['title'], f'content_{locale}': body.strip(),
                     f'excerpt_{locale}': meta.get('excerpt', description),
                     f'meta_description_{locale}': description})
    return data


def editorial_gate(draft, payload, qa, parse):
    """Validate on-disk evidence, not an approved flag. Return pinned index digest."""
    from _article_length import require_body_lengths
    metas = [parse(p.read_text(encoding='utf-8'))[0] for p in
             (draft, draft.with_name('draft.en.md')) if p.exists()]
    if any(m.get('target_site') == '24go.site' for m in metas):
        try:
            require_body_lengths(payload)
        except ValueError as error:
            raise PublicationError(str(error)) from error
    root = draft.parent / 'final-review'
    raw = (root / 'acceptance.json').read_bytes()
    index = json.loads(raw)
    if index['version'] not in (1, 2) or Path(index['source_path']).resolve() != draft.resolve():
        raise PublicationError('Wrong acceptance source/version')
    UUID(index['run_id'])
    if index['author_model'] != qa['author_model'] or qa['editor_model'] == qa['author_model']:
        raise PublicationError('Independent editor model required')
    age = float(qa['max_age_hours'])
    if not 0 < age <= 24:
        raise PublicationError('Review freshness must be at most 24 hours')
    files = index['files']
    artifacts = {}
    keys = ('original_ru', 'original_en', 'candidate_ru', 'candidate_en', 'final_ru', 'final_en',
            'payload', 'brief', 'claims', 'diagnostics_before', 'diagnostics_after',
            'editor_prompt', 'editor_response', 'verifier_prompt', 'verifier_response')
    for key in keys:
        path = (root / files[key]['path']).resolve()
        if not path.is_relative_to(root.resolve()):
            raise PublicationError('Review evidence escapes review directory')
        data = path.read_bytes()
        if not data or hashlib.sha256(data).hexdigest() != files[key]['sha256']:
            raise PublicationError('Review evidence hash mismatch')
        artifacts[key] = data.decode('utf-8')
    if artifacts['payload'].encode() != canonical_json(payload):
        raise PublicationError('Accepted payload differs from current draft')
    if payload_for(payload['slug'], artifacts['final_ru'], artifacts['final_en'], parse) != payload:
        raise PublicationError('Accepted final differs from import payload')
    editor = json.loads(artifacts['editor_response'])
    if index['version'] == 2:
        from _editor_patches import apply_editor_edits
        reconstructed = apply_editor_edits({loc: artifacts['original_' + loc] for loc in ('ru', 'en')}, editor)
    else:
        reconstructed = {loc: editor['candidate_' + loc] for loc in ('ru', 'en')}
    for locale in ('ru', 'en'):
        if not (reconstructed[locale] == artifacts['candidate_' + locale] == artifacts['final_' + locale]):
            raise PublicationError('Candidate/final differs from editor response')
    shared = {k: artifacts[k] for k in ('original_ru', 'original_en', 'brief', 'claims',
                                      'diagnostics_before', 'diagnostics_after')}
    expected_editor = dict({k: v for k, v in shared.items() if k != 'diagnostics_after'},
                           author_history=False, tools=[])
    expected_verifier = dict(shared, final_ru=artifacts['final_ru'], final_en=artifacts['final_en'],
                             author_history=False, tools=[])
    if json.loads(artifacts['editor_prompt']) != expected_editor:
        raise PublicationError('Unexpected editor input')
    if json.loads(artifacts['verifier_prompt']) != expected_verifier:
        raise PublicationError('Verifier did not receive exact final and independent evidence')
    if json.loads(artifacts['verifier_response']) != {'verdict': 'accept', 'blockers': []}:
        raise PublicationError('Verifier did not accept')
    receipts = index['receipts']
    now = datetime.now(timezone.utc)
    intervals = []
    for role in ('editor', 'verifier'):
        receipt = receipts[role]
        if (not receipt['provider'] or receipt['status'] != 'completed'
                or receipt['requested_model'] != qa[role + '_model']
                or receipt['actual_model'] != qa[role + '_model']
                or receipt['fresh_context'] is not True or receipt['tools'] != []):
            raise PublicationError('Invalid model receipt')
        for kind in ('prompt', 'response'):
            if receipt[kind + '_sha256'] != files[role + '_' + kind]['sha256']:
                raise PublicationError('Receipt does not match saved evidence')
        start, end = (datetime.fromisoformat(receipt[k]) for k in ('started_at', 'finished_at'))
        if not start.tzinfo or not end.tzinfo or not start <= end <= now:
            raise PublicationError('Invalid review timestamps')
        if (now - start).total_seconds() > age * 3600:
            raise PublicationError('Review expired')
        intervals.append((start, end))
    if intervals[0][1] > intervals[1][0]:
        raise PublicationError('Verifier ran before editor finished')
    for key in ('context_id', 'process_id', 'request_id'):
        if not receipts['editor'][key] or not receipts['verifier'][key] or receipts['editor'][key] == receipts['verifier'][key]:
            raise PublicationError('Separate fresh review processes/contexts required')
    return hashlib.sha256(raw).hexdigest()


def settings(config):
    cfg = config.get('publishing', {}).get('platforms', {}).get('24go', {})
    if cfg.get('enabled') is not True:
        raise PublicationError('24go must be explicitly enabled')
    api = cfg['api_base_url'].rstrip('/')
    site = cfg['site_url'].rstrip('/')
    parsed = urlsplit(api)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or not parsed.path.endswith('/api/v1/blog')):
        raise PublicationError('api_base_url must be an HTTPS Blog API endpoint')
    if site not in ('https://24go.site', 'https://www.24go.site'):
        raise PublicationError('site_url must be the canonical 24go.site origin')
    env = cfg['token_env']
    if not isinstance(env, str) or not re.fullmatch(r'[A-Z][A-Z0-9_]*', env):
        raise PublicationError('token_env must name the owner JWT environment variable')
    token = os.environ.get(env, '').strip()
    if not token or '\n' in token or '\r' in token:
        raise PublicationError('Owner Bearer token missing; no login or key fallback')
    return api, site, {'Authorization': 'Bearer ' + token}


def snapshot(api, headers, request, slug):
    """Admin API has no GET-by-id: scan every page, rejecting ambiguous slugs."""
    offset = 0
    matches = []
    while True:
        code, response = request(f'{api}/admin/list?limit=100&offset={offset}', headers=dict(headers))
        if code != 200 or not isinstance(response, dict):
            raise PublicationError('Owner CMS listing failed')
        items, total = response['items'], response['total']
        if not isinstance(items, list) or type(total) is not int or total < 0:
            raise PublicationError('Invalid CMS pagination')
        matches.extend(p for p in items if p['slug'] == slug)
        offset += len(items)
        if offset >= total:
            break
        if not items or offset > 100000:
            raise PublicationError('Incomplete CMS pagination')
    if len(matches) > 1:
        raise PublicationError('Ambiguous CMS slug')
    return matches[0] if matches else None


def require_record(record, payload, published=None, post_id=None):
    if not isinstance(record, dict) or any(record.get(k) != v for k, v in payload.items()):
        raise PublicationError('CMS editorial record mismatch/collision; refusing overwrite')
    UUID(record['id'])
    if type(record.get('published')) is not bool:
        raise PublicationError('CMS publication state absent')
    if published is not None and record['published'] is not published:
        raise PublicationError('CMS publication state mismatch')
    if post_id is not None and record['id'] != post_id:
        raise PublicationError('CMS identity changed')


def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as handle:
        name = handle.name
        try:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        except BaseException:
            os.unlink(name)
            raise
    os.replace(name, path)


def with_fields(text, fields):
    end = text.find('\n---', 3) if text.startswith('---\n') else -1
    if end == -1:
        raise PublicationError('Draft requires YAML frontmatter')
    head, tail = text[:end], text[end:]
    for key, value in fields.items():
        field = f'{key}: {value}'
        pattern = rf'^{re.escape(key)}:.*$'
        head = re.sub(pattern, lambda _: field, head, flags=re.M) if re.search(pattern, head, re.M) else head.rstrip() + '\n' + field
    return head + tail


def publish_locked(slug, draft, config, transport, parse, native_auth=None):
    def request(*args, **kwargs):
        return transport(*args, **kwargs, allow_redirects=False)

    if native_auth is None:
        api, site, headers = settings(config)
    else:
        from statejnik_local_cms import scope
        cfg = scope(config)
        if cfg.get('enabled') is not True:
            raise PublicationError('Publication disabled')
        api, site = cfg['api_base_url'], cfg['site_url']
        headers = {'Authorization': 'Bearer ' + native_auth}
    en = draft.with_name('draft.en.md')
    text, en_text = draft.read_text(encoding='utf-8'), en.read_text(encoding='utf-8')
    payload = payload_for(slug, text, en_text, parse)
    from _article_length import require_body_lengths
    try:
        require_body_lengths(payload)
    except ValueError as error:
        raise PublicationError(str(error)) from error
    qa = config['qa']['final_review']
    acceptance = editorial_gate(draft, payload, qa, parse)
    record = snapshot(api, headers, request, slug)
    if record is None:
        # Stage unpublished first. A lost POST response is recovered by slug on next run.
        code, record = request(api + '/admin', method='POST',
                               data=dict(payload, published=False), headers=dict(headers))
        if code != 201:
            raise PublicationError('CMS draft create failed; retry will reconcile slug')
        require_record(record, payload, published=False)
    require_record(record, payload)
    post_id = record['id']
    for _ in range(2):
        current = snapshot(api, headers, request, slug)
        require_record(current, payload, post_id=post_id)
        if current != record:
            raise PublicationError('Remote snapshot changed before publication')
        # Pin the same accepted version and detect concurrent local edits.
        if (draft.read_text(encoding='utf-8') != text or en.read_text(encoding='utf-8') != en_text
                or editorial_gate(draft, payload, qa, parse) != acceptance):
            raise PublicationError('Local accepted version changed')
    if not record['published']:
        code, result = request(api + '/admin/' + post_id, method='PUT',
                               data=dict(payload, published=True), headers=dict(headers))
        if code != 200:
            raise PublicationError('CMS publication failed; retry will reconcile exact record')
        require_record(result, payload, published=True, post_id=post_id)
    record = snapshot(api, headers, request, slug)
    require_record(record, payload, published=True, post_id=post_id)
    for locale in ('ru', 'en'):
        code, public = request(f'{api}/{slug}?locale={locale}')
        expected = {k: payload[k] for k in ('slug', 'tags', 'og_image_url')}
        expected.update({k: payload[f'{k}_{locale}'] for k in ('title', 'content', 'excerpt', 'meta_description')})
        if code != 200 or not isinstance(public, dict) or any(public.get(k) != v for k, v in expected.items()):
            raise PublicationError('Exact public CMS readback failed (not HTML status alone)')
    if (draft.read_text(encoding='utf-8') != text or en.read_text(encoding='utf-8') != en_text
            or editorial_gate(draft, payload, qa, parse) != acceptance):
        raise PublicationError('Local accepted version changed during CMS readback')
    # Publish time is first verified observation, not stale local-only metadata or draft creation.
    meta, _ = parse(text)
    same = meta.get('cms_24go_id') == post_id and meta.get('cms_24go_acceptance_sha256') == acceptance
    published_at = meta.get('published_at') if same else datetime.now(timezone.utc).isoformat()
    common = dict(status='published', cms_24go_id=post_id, cms_24go_acceptance_sha256=acceptance,
                  published_at=published_at)
    ru_url = f'{site}/blog/{slug}?locale=ru'
    en_url = f'{site}/blog/{slug}?locale=en'
    ru_final = with_fields(text, dict(common, canonical_url=ru_url, canonical_url_en=en_url))
    en_final = with_fields(en_text, dict(common, canonical_url=en_url))
    atomic_write(Path('published/ru') / (slug + '.md'), ru_final)
    atomic_write(Path('published/en') / (slug + '.md'), en_final)
    atomic_write(en, en_final)
    atomic_write(draft, ru_final)
    print(f'✅ 24go: verified CMS record {post_id}; RU {ru_url}; EN {en_url}')
    return 0


def publish(slug, status, draft_path, config, request, parse, native_auth=None):
    try:
        if status != 'published' or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or len(slug) > 255:
            raise PublicationError('24go requires published status and a valid unchanged slug')
        # Lock across retries from local scheduler processes, never concurrent blind POSTs.
        draft = Path(draft_path).resolve()
        with (draft.parent / '.24go-publish.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return publish_locked(slug, draft, config, request, parse, native_auth=native_auth)
    except PublicationError as error:
        # All PublicationError messages are fixed local diagnostics, never response bodies.
        print(f'❌ 24go: {error}; not marked published')
        return 1
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        # Do not leak JWTs, remote response bodies, or config contents into cron logs.
        print('❌ 24go: missing/invalid config or acceptance evidence, auth, transport or CMS response; not marked published')
        return 1
