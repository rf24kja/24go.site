"""Tenant-owned encrypted Google Web clients; never modifies shared runtime gates."""
import json
import os
import re
import tempfile
import uuid
from dataclasses import replace
from pathlib import Path
from fastapi import HTTPException, Request
from yt import Service

CALLBACK = 'https://www.24go.site/YT/callback'

class TenantClients:
    def __init__(self, service, directory='/run/yt-settings'):
        self.service = service
        self.directory = Path(directory)

    def path(self, actor):
        return self.directory / (str(uuid.UUID(actor.tenant)) + '.encrypted')

    def read(self, actor):
        path = self.path(actor)
        try:
            raw = path.read_bytes()
        except FileNotFoundError:
            return None
        try:
            return json.loads(self.service.cipher.decrypt(raw))
        except Exception:
            raise HTTPException(503, 'YT configuration unavailable') from None

    def scoped(self, actor):
        cfg = self.read(actor)
        # No shared application fallback: each tenant explicitly owns its client.
        opts = replace(self.service.options, client_id='', client_secret='', redirect_uri='', oauth_enabled=False)
        if cfg:
            opts = replace(opts, client_id=cfg['client_id'], client_secret=cfg['client_secret'],
                           redirect_uri=CALLBACK, oauth_enabled=cfg['oauth_enabled'])
        return Service(self.service.store, opts, self.service.cipher)

    def status(self, actor):
        self.service.guard(actor, admin=True)
        cfg = self.read(actor)
        return {'status': 'configured' if cfg else 'missing', 'oauth_configured': bool(cfg),
                'oauth_enabled': bool(cfg and cfg['oauth_enabled']), 'redirect_uri': CALLBACK,
                'scope': 'tenant', 'monitoring_enabled': self.service.options.gate('monitoring'),
                'posting_enabled': self.service.options.posting_enabled}

    async def save(self, actor, request: Request):
        self.service.guard(actor, admin=True)
        # Manual parsing avoids framework validation echoing rejected credentials.
        try:
            if request.headers.get('content-type', '').split(';')[0] != 'application/json':
                raise ValueError()
            raw = bytearray()
            async for part in request.stream():
                raw.extend(part)
                if len(raw) > 32768:
                    raise ValueError()
            body = json.loads(raw)
            if not isinstance(body, dict) or set(body) != {'client_id', 'client_secret', 'redirect_uri', 'oauth_enabled'}:
                raise ValueError()
            cid, secret = body['client_id'], body['client_secret']
            if (not isinstance(cid, str) or not re.fullmatch(r'[A-Za-z0-9_-]+\.apps\.googleusercontent\.com', cid)
                or not isinstance(secret, str) or not 16 <= len(secret) <= 512
                or any(c.isspace() for c in secret) or body['redirect_uri'] != CALLBACK
                or type(body['oauth_enabled']) is not bool):
                raise ValueError()
        except Exception:
            raise HTTPException(422, 'Invalid Google Web client or exact redirect URI') from None
        try:
            # Existing tenant advisory transaction lock serializes writes. Replacement
            # is forbidden while grants or pending states depend on the old client.
            with self.service.store.tx(actor) as db:
                old = self.read(actor)
                changed = old and (old['client_id'] != cid or old['client_secret'] != secret)
                if changed:
                    accounts = db.execute("SELECT body FROM objects WHERE tenant=? AND kind='account'", (actor.tenant,))
                    if any(json.loads(r['body']).get('status') == 'connected' for r in accounts):
                        raise HTTPException(409, 'Disconnect existing YT accounts before replacing client')
                db.execute('DELETE FROM oauth WHERE tenant=?', (actor.tenant,))
                encrypted = self.service.cipher.encrypt(json.dumps(body).encode())
                fd, name = tempfile.mkstemp(prefix='.client-', dir=self.directory)
                try:
                    with os.fdopen(fd, 'wb') as out:
                        out.write(encrypted)
                        out.flush()
                        os.fsync(out.fileno())
                    os.replace(name, self.path(actor))
                    fd = os.open(self.directory, os.O_DIRECTORY)
                    try: os.fsync(fd)
                    finally: os.close(fd)
                finally:
                    if os.path.exists(name): os.unlink(name)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503, 'YT configuration could not be saved') from None
        return self.status(actor)


def mount_settings(app, service, identity, directory='/run/yt-settings'):
    from fastapi import APIRouter, Depends, Response
    clients = TenantClients(service, directory)
    router = APIRouter(prefix='/api/v1/yt', tags=['youtube-settings'])

    @router.get('/settings')
    def status(response: Response, actor=Depends(identity)):
        response.headers['Cache-Control'] = 'no-store'
        return clients.status(actor)

    @router.put('/settings')
    async def save(request: Request, response: Response, actor=Depends(identity)):
        response.headers['Cache-Control'] = 'no-store'
        return await clients.save(actor, request)

    app.include_router(router)
    return clients
