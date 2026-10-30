#!/usr/bin/env python3
"""Runs only inside native FastAPI runtime; never returns authentication material."""
import argparse
import asyncio
import base64
import contextlib
from datetime import timedelta
import io
import json
import os
from pathlib import Path
import shutil
import sys
from uuid import UUID
import urllib.request
from urllib.error import HTTPError

from _cms24go import editorial_gate, payload_for, publish
from final_review import parse_frontmatter as parse


def validate_actor(user, cfg):
    if (user is None or str(user.id) != cfg['owner_user_id']
            or str(user.tenant_id) != cfg['owner_tenant_id'] or user.role != 'owner'):
        raise ValueError('Owner mismatch')
    return dict(user_id=str(user.id), tenant_id=str(user.tenant_id), role='owner')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(url, method='GET', data=None, headers=None, **kwargs):
    if not (url == 'https://api.24go.site/api/v1/blog' or
            url.startswith('https://api.24go.site/api/v1/blog/')):
        raise ValueError('Transport scope')
    h = dict(headers or {})
    body = None if data is None else json.dumps(data).encode()
    if body is not None:
        h['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=30) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, None


async def native_actor(cfg):
    from app.database import async_session
    from app.models import User
    from app.security import create_access_token
    async with async_session() as session:
        user = await session.get(User, UUID(cfg['owner_user_id']))
        actor = validate_actor(user, cfg)
        token = create_access_token(data={'sub':actor['user_id'],
            'tenant_id':actor['tenant_id'], 'role':'owner'}, expires_delta=timedelta(minutes=5))
    return actor, token


def execute(job, mint=native_actor, transport=request):
    cfg = job['config']['publishing']['platforms']['24go']
    # Duplicate exact scope check without trusting the host invocation.
    from statejnik_local_cms import scope
    scope(job['config'])
    draft = None
    created = False
    token = None
    try:
        if not job.get('probe'):
            if cfg.get('enabled') is not True:
                raise ValueError('Publication disabled')
            draft = Path(job['source'])
            if (not draft.is_absolute() or draft.name != 'draft.md' or
                    draft.parent.exists() or draft != draft.resolve()):
                raise ValueError('Source collision/unsafe path')
            draft.parent.mkdir(parents=True, mode=0o700)
            created = True
            for name, encoded in job['files'].items():
                p = Path(name)
                if p != p.resolve() or not p.is_relative_to(draft.parent):
                    raise ValueError('Evidence escape')
                p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                p.write_bytes(base64.b64decode(encoded, validate=True))
                p.chmod(0o600)
            payload = payload_for(draft.parent.name, draft.read_text(), draft.with_name('draft.en.md').read_text(), parse)
            if payload != job['payload'] or editorial_gate(draft, payload, job['config']['qa']['final_review'], parse) != job['acceptance']:
                raise ValueError('Native gate mismatch')
        actor, token = asyncio.run(mint(cfg))
        headers = {'Authorization':'Bearer '+token}
        code, listing = transport(cfg['api_base_url']+'/admin/list?limit=1&offset=0',headers=headers)
        if code != 200 or not isinstance(listing, dict) or not isinstance(listing.get('items'), list) or type(listing.get('total')) is not int:
            raise ValueError('Authenticated probe failed')
        if job.get('probe'):
            return dict(status='verified', actor=actor)
        with contextlib.redirect_stdout(io.StringIO()):
            rc = publish(draft.parent.name, 'published', str(draft), job['config'],
                         transport, parse, native_auth=token)
        if rc != 0:
            raise ValueError('CMS delivery unconfirmed')
        return dict(status='verified', actor=actor, files={str(p):p.read_text() for p in (draft, draft.with_name('draft.en.md'))})
    finally:
        token = None
        if created:
            shutil.rmtree(draft.parent)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('job'); parser.add_argument('result'); parser.add_argument('--probe', action='store_true')
    args = parser.parse_args()
    try:
        job = json.loads(Path(args.job).read_text())
        if args.probe:
            job['probe'] = True
        result = execute(job)
        Path(args.result).write_text(json.dumps(result))
        return 0
    except Exception:
        # Never serialize exception messages, response bodies or local variables.
        Path(args.result).write_text('{"status":"unconfirmed"}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
