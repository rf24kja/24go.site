"""Bounded 24go.site YT candidate. New implementation; archive code not imported.

Explicit local repository initialization only; never import this against production
without a reviewed repository adapter/rollout. External operations default off.
"""
from __future__ import annotations
import base64
import hashlib
import json
import re
import secrets
import time
import uuid
from dataclasses import dataclass
from string import Formatter
from urllib.parse import urlencode
from xml.etree import ElementTree as ET

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field

CHANNEL = re.compile(r'UC[A-Za-z0-9_-]{22}', re.ASCII)
VIDEO = re.compile(r'[A-Za-z0-9_-]{11}', re.ASCII)
WRITERS = {'owner', 'admin', 'member', 'operator'}
ADMINS = {'owner', 'admin'}

@dataclass(frozen=True)
class Actor:
    tenant: str
    user: str
    role: str

@dataclass(frozen=True)
class Options:
    external_enabled: bool = False
    posting_enabled: bool = False
    client_id: str = ''
    client_secret: str = ''
    redirect_uri: str = ''
    oauth_enabled: bool | None = None
    monitoring_enabled: bool | None = None

    def gate(self, name):
        value = getattr(self, name + '_enabled')
        return self.external_enabled if value is None else value

class Input(BaseModel):
    model_config = ConfigDict(extra='forbid')

class ChannelIn(Input):
    channel_id: str = Field(pattern=r'^UC[A-Za-z0-9_-]{22}$')
    name: str = Field(min_length=1, max_length=200)

class ToggleIn(Input):
    enabled: bool
    template_id: uuid.UUID | None = None

class TemplateIn(Input):
    name: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=10, max_length=900)

class TextIn(Input):
    text: str = Field(min_length=20, max_length=900)

class SendIn(Input):
    account_id: uuid.UUID

class SyncIn(Input):
    template_id: uuid.UUID


def validate_template(text):
    try:
        fields = [field for _, field, spec, conv in Formatter().parse(text)
                  if field is not None]
        if not fields or not set(fields) <= {'title', 'description', 'video_url'} or 'title' not in fields:
            raise ValueError()
        for _, field, spec, conv in Formatter().parse(text):
            if spec or conv:
                raise ValueError()
    except ValueError:
        raise HTTPException(422, 'Template requires {title}; only title, description, video_url allowed')


class OAuthComplete(Input):
    state: str = Field(min_length=30, max_length=200)
    code: str = Field(min_length=1, max_length=2048)

class Service:
    def __init__(self, store, options, cipher):
        self.store, self.options, self.cipher = store, options, cipher
        if cipher is None:
            raise ValueError('YT requires encryption at rest')

    def guard(self, actor, admin=False):
        if actor.role not in (ADMINS if admin else WRITERS):
            raise HTTPException(403, 'YT action not allowed')

    def external(self, purpose='monitoring'):
        if not self.options.gate(purpose):
            raise HTTPException(503, 'YT ' + purpose + ' disabled')

    def oauth_start(self, actor):
        self.guard(actor, admin=True)
        self.external('oauth')
        o = self.options
        if not (o.client_id and o.client_secret and o.redirect_uri == 'https://www.24go.site/YT/callback'):
            raise HTTPException(503, 'YT OAuth application not configured')
        state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
        digest = hashlib.sha256(state.encode()).hexdigest()
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
        with self.store.tx(actor) as db:
            db.execute('DELETE FROM oauth WHERE tenant=? AND expires<?', (actor.tenant, int(time.time())))
            db.execute('INSERT INTO oauth VALUES(?,?,?,?,?)',
                       (digest, actor.tenant, actor.user, int(time.time())+600,
                        self.cipher.encrypt(json.dumps({'verifier': verifier, 'client': hashlib.sha256((o.client_id + '\\0' + o.client_secret).encode()).hexdigest()}).encode()).decode()))
        return {'authorization_url': 'https://accounts.google.com/o/oauth2/v2/auth?'+urlencode({
            'client_id':o.client_id, 'redirect_uri':o.redirect_uri, 'response_type':'code',
            'scope':'https://www.googleapis.com/auth/youtube.force-ssl',
            'access_type':'offline', 'prompt':'consent', 'state':state,
            'code_challenge':challenge, 'code_challenge_method':'S256'})}

    async def exchange(self, code, verifier):
        o = self.options
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            result = await client.post('https://oauth2.googleapis.com/token', data={
                'client_id':o.client_id, 'client_secret':o.client_secret,
                'redirect_uri':o.redirect_uri, 'grant_type':'authorization_code',
                'code':code, 'code_verifier':verifier})
            result.raise_for_status()
            token = result.json()
            if 'https://www.googleapis.com/auth/youtube.force-ssl' not in token.get('scope','').split():
                raise ValueError('Missing required scope')
            if not token.get('refresh_token'):
                raise ValueError('Missing offline grant')
            channels = await client.get('https://www.googleapis.com/youtube/v3/channels',
                params={'part':'snippet','mine':'true'},
                headers={'Authorization':'Bearer '+token['access_token']})
            channels.raise_for_status()
            rows = channels.json()['items']
            if len(rows) != 1 or not CHANNEL.fullmatch(rows[0]['id']):
                raise ValueError('Expected one verified YouTube channel')
            return {'channel_id':rows[0]['id'], 'name':rows[0]['snippet']['title'][:200],
                    'refresh_token':token['refresh_token']}

    async def oauth_complete(self, actor, state, code):
        self.guard(actor, admin=True)
        self.external('oauth')
        digest = hashlib.sha256(state.encode()).hexdigest()
        with self.store.tx(actor) as db:
            row = db.execute('SELECT * FROM oauth WHERE state=? AND tenant=? AND actor=? AND expires>?',
                             (digest, actor.tenant, actor.user, int(time.time()))).fetchone()
            if not row:
                raise HTTPException(400, 'Invalid, expired or already consumed OAuth state')
            db.execute('DELETE FROM oauth WHERE state=? AND tenant=? AND actor=?', (digest, actor.tenant, actor.user))
            payload = json.loads(self.cipher.decrypt(row['verifier'].encode()))
            fingerprint = hashlib.sha256((self.options.client_id + '\\0' + self.options.client_secret).encode()).hexdigest()
            if payload.get('client') != fingerprint:
                raise HTTPException(400, 'OAuth client changed; begin a new connection')
            verifier = payload['verifier']
        try:
            result = await self.exchange(code, verifier)
            encrypted = self.cipher.encrypt(json.dumps({'refresh_token':result['refresh_token']}).encode()).decode()
        except Exception:
            raise HTTPException(502, 'YT authorization failed; begin a new connection')
        # Upsert permits deliberate reconnection without returning or logging a token.
        with self.store.tx(actor) as db:
            existing = db.execute("SELECT body FROM objects WHERE tenant=? AND kind='account' AND key=?",
                                  (actor.tenant, result['channel_id'])).fetchone()
            if existing:
                account = json.loads(existing[0])
                account.update(credential=encrypted, status='connected', name=result['name'])
                self.store.save(actor, account, db)
            else:
                account = {'id':str(uuid.uuid4()), 'channel_id':result['channel_id'],
                           'name':result['name'], 'status':'connected', 'credential':encrypted}
                db.execute('INSERT INTO objects(id,tenant,kind,key,body) VALUES(?,?,?,?,?)',
                           (account['id'], actor.tenant, 'account', result['channel_id'], json.dumps(account)))
        return self.public(account)

    async def sync(self, actor, ident, template_id):
        self.guard(actor)
        channel = self.store.get(actor, 'channel', ident)
        self.store.get(actor, 'template', template_id)
        if not channel['enabled']:
            raise HTTPException(409, 'Monitoring disabled')
        self.external()
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
                async with client.stream('GET', 'https://www.youtube.com/feeds/videos.xml',
                                         params={'channel_id':channel['channel_id']}) as response:
                    response.raise_for_status()
                    raw = bytearray()
                    async for chunk in response.aiter_bytes():
                        raw.extend(chunk)
                        if len(raw)>262144:
                            raise ValueError('Feed oversized')
            entries = parse_feed(bytes(raw), channel['channel_id'])
        except Exception:
            raise HTTPException(502, 'YT feed unavailable or invalid')
        return {'drafts':self.ingest(actor, ident, entries, template_id), 'baseline_only':not channel['seeded']}

    def ingest(self, actor, channel_id, entries, template_id):
        channel = self.store.get(actor, 'channel', channel_id)
        template = self.store.get(actor, 'template', template_id)
        validate_template(template['text'])
        added = []
        for entry in entries[:15]:
            if not VIDEO.fullmatch(entry.get('video_id', '')):
                continue
            # First observation is a watermark, never bulk-comment historical videos.
            if not channel['enabled'] or not channel['seeded']:
                self.store.put(actor, 'seen', entry['video_id'], entry)
                continue
            with self.store.tx(actor) as db:
                seen = db.execute("SELECT 1 FROM objects WHERE tenant=? AND kind='seen' AND key=?",
                                  (actor.tenant, entry['video_id'])).fetchone()
            if seen:
                continue
            title = str(entry.get('title', ''))[:200]
            description = str(entry.get('description', ''))[:400]
            text = template['text'].format(title=title, description=description,
                        video_url='https://www.youtube.com/watch?v='+entry['video_id'])
            if not 20 <= len(text) <= 900:
                continue
            added.append(self.store.put(actor, 'queue', entry['video_id'], {
                'video_id': entry['video_id'], 'channel_id': channel_id,
                'title': title, 'text': text, 'status': 'draft',
                'approved_by': None, 'account_id': None, 'created_at': int(time.time())}))
        with self.store.tx(actor) as db:
            channel = self.store.get(actor, 'channel', channel_id, db)
            channel['seeded'] = True
            self.store.save(actor, channel, db)
        return added

    async def provider_post(self, account, row):
        # Refresh once, then issue exactly one insertion; never retry an insertion.
        credential = json.loads(self.cipher.decrypt(account['credential'].encode()))
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            token = await client.post('https://oauth2.googleapis.com/token', data={
                'client_id': self.options.client_id, 'client_secret': self.options.client_secret,
                'refresh_token': credential['refresh_token'], 'grant_type': 'refresh_token'})
            token.raise_for_status()
            access = token.json()['access_token']
            result = await client.post('https://www.googleapis.com/youtube/v3/commentThreads',
                params={'part':'snippet'}, headers={'Authorization': 'Bearer '+access}, json={
                    'snippet': {'videoId': row['video_id'], 'topLevelComment': {
                        'snippet': {'textOriginal': row['text']}}}})
            result.raise_for_status()
            ident = result.json().get('id')
            if not ident:
                raise ValueError('Missing provider receipt')
            return ident

    async def send(self, actor, ident, account_id):
        self.guard(actor)
        self.external('posting')
        if not self.options.posting_enabled:
            raise HTTPException(503, 'YT posting disabled')
        with self.store.tx(actor) as db:
            row = self.store.get(actor, 'queue', ident, db)
            account = self.store.get(actor, 'account', account_id, db)
            channel = self.store.get(actor, 'channel', row['channel_id'], db)
            if not channel['enabled'] or account['status'] != 'connected':
                raise HTTPException(409, 'Account/channel inactive')
            if row['status'] != 'approved' or not row['approved_by']:
                raise HTTPException(409, 'Approved draft required; sending/unknown cannot retry')
            # Per-tenant conservative finite capacity, serialized with the claim.
            recent = [json.loads(r[0]) for r in db.execute(
                "SELECT body FROM objects WHERE tenant=? AND kind='queue'", (actor.tenant,))]
            attempts = [r for r in recent if r.get('attempt_at',0) > time.time()-86400]
            if len(attempts) >= 5 or any(r.get('attempt_at',0)>time.time()-2700 for r in attempts):
                raise HTTPException(429, 'YT daily/interval attempt limit')
            row.update(status='sending', account_id=account_id, attempt_at=int(time.time()))
            self.store.save(actor, row, db)
        try:
            receipt = await self.provider_post(account, row)
            outcome = {'status':'posted', 'provider_id':receipt}
        except Exception:
            # Includes refresh failures: conservative quarantine, sanitized response.
            outcome = {'status':'unknown', 'error':'provider_outcome_unconfirmed'}
        with self.store.tx(actor) as db:
            row = self.store.get(actor, 'queue', ident, db)
            row.update(outcome)
            self.store.save(actor, row, db)
        return self.public(row)

    async def oauth_account_action(self, actor, ident, revoke=False):
        self.guard(actor, admin=True)
        self.external('oauth')
        account = self.store.get(actor, 'account', ident)
        if account['status'] != 'connected' or not account.get('credential'):
            raise HTTPException(409, 'Connected account required')
        try:
            token = json.loads(self.cipher.decrypt(account['credential'].encode()))['refresh_token']
            async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
                if revoke:
                    response = await client.post('https://oauth2.googleapis.com/revoke', data={'token': token})
                else:
                    response = await client.post('https://oauth2.googleapis.com/token', data={
                        'client_id': self.options.client_id, 'client_secret': self.options.client_secret,
                        'grant_type': 'refresh_token', 'refresh_token': token})
                response.raise_for_status()
                if not revoke and not response.json().get('access_token'):
                    raise ValueError('Missing access token')
        except Exception:
            raise HTTPException(502, 'YT provider authorization action failed') from None
        if revoke:
            with self.store.tx(actor) as db:
                account = self.store.get(actor, 'account', ident, db)
                account.update(status='disconnected', credential='')
                self.store.save(actor, account, db)
        return {'status': 'revoked' if revoke else 'refreshed'}

    def public(self, obj):
        return {k:v for k,v in obj.items() if k not in {'credential'}}


class RedactedRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        async def safe(request):
            from fastapi.exceptions import RequestValidationError
            try:
                return await handler(request)
            except RequestValidationError:
                raise HTTPException(422, 'Invalid YT request') from None
        return safe


def create_router(service: Service, identity, scoped=None):
    scoped = scoped or (lambda actor: service)
    router = APIRouter(prefix='/api/v1/yt', tags=['youtube'], route_class=RedactedRoute)

    @router.get('/capabilities')
    def capabilities(actor=Depends(identity)):
        options = scoped(actor).options
        return {'external_enabled': options.gate('monitoring'),
                'oauth_enabled': options.gate('oauth'),
                'monitoring_enabled': options.gate('monitoring'),
                'posting_enabled': options.posting_enabled,
                'oauth_configured': bool(options.client_id and options.client_secret and options.redirect_uri),
                'storage': getattr(service.store, 'storage', 'isolated-sqlite-candidate'), 'automatic_posting': False}

    @router.get('/channels')
    def channels(actor=Depends(identity)):
        return service.store.rows(actor, 'channel')

    @router.post('/channels', status_code=201)
    def add_channel(body: ChannelIn, actor=Depends(identity)):
        service.guard(actor)
        if not CHANNEL.fullmatch(body.channel_id):
            raise HTTPException(422, 'Invalid channel ID')
        return service.store.put(actor, 'channel', body.channel_id,
                                 dict(body.model_dump(), enabled=False, seeded=False))

    @router.patch('/channels/{ident}')
    def toggle_channel(ident: uuid.UUID, body: ToggleIn, actor=Depends(identity)):
        service.guard(actor)
        with service.store.tx(actor) as db:
            row = service.store.get(actor, 'channel', str(ident), db)
            if body.template_id:
                service.store.get(actor, 'template', str(body.template_id), db)
                row['template_id'] = str(body.template_id)
            row['enabled'] = body.enabled
            service.store.save(actor, row, db)
        return row

    @router.get('/templates')
    def templates(actor=Depends(identity)):
        return service.store.rows(actor, 'template')

    @router.post('/templates', status_code=201)
    def add_template(body: TemplateIn, actor=Depends(identity)):
        service.guard(actor)
        validate_template(body.text)
        return service.store.put(actor, 'template', str(uuid.uuid4()), body.model_dump())

    @router.put('/templates/{ident}')
    def edit_template(ident: uuid.UUID, body: TemplateIn, actor=Depends(identity)):
        service.guard(actor)
        validate_template(body.text)
        with service.store.tx(actor) as db:
            row = service.store.get(actor, 'template', str(ident), db)
            row.update(body.model_dump())
            service.store.save(actor, row, db)
        return row

    @router.get('/queue')
    def queue(actor=Depends(identity)):
        return service.store.rows(actor, 'queue')

    @router.patch('/queue/{ident}')
    def edit(ident: uuid.UUID, body: TextIn, actor=Depends(identity)):
        service.guard(actor)
        with service.store.tx(actor) as db:
            row = service.store.get(actor, 'queue', str(ident), db)
            if row['status'] not in {'draft', 'approved'}:
                raise HTTPException(409, 'Terminal or claimed draft')
            row.update(text=body.text, status='draft', approved_by=None)
            service.store.save(actor, row, db)
        return row

    @router.post('/queue/{ident}/approve')
    def approve(ident: uuid.UUID, actor=Depends(identity)):
        service.guard(actor)
        with service.store.tx(actor) as db:
            row = service.store.get(actor, 'queue', str(ident), db)
            if row['status'] != 'draft':
                raise HTTPException(409, 'Draft required')
            row.update(status='approved', approved_by=actor.user, approved_at=int(time.time()))
            service.store.save(actor, row, db)
        return row

    @router.post('/queue/{ident}/reject')
    def reject(ident: uuid.UUID, actor=Depends(identity)):
        service.guard(actor)
        with service.store.tx(actor) as db:
            row = service.store.get(actor, 'queue', str(ident), db)
            if row['status'] not in {'draft', 'approved'}:
                raise HTTPException(409, 'Terminal or claimed draft')
            row.update(status='rejected')
            service.store.save(actor, row, db)
        return row

    @router.post('/queue/{ident}/schedule')
    def schedule(ident: uuid.UUID, body: SendIn, actor=Depends(identity)):
        service.guard(actor)
        with service.store.tx(actor) as db:
            row = service.store.get(actor, 'queue', str(ident), db)
            account = service.store.get(actor, 'account', str(body.account_id), db)
            if row['status'] != 'approved' or not row.get('approved_by') or account['status'] != 'connected':
                raise HTTPException(409, 'Approved draft and connected account required')
            row['account_id'] = str(body.account_id)
            service.store.save(actor, row, db)
        return row

    @router.post('/queue/{ident}/send')
    async def send(ident: uuid.UUID, body: SendIn, actor=Depends(identity)):
        return await service.send(actor, str(ident), str(body.account_id))

    @router.post('/oauth/start')
    def oauth_start(actor=Depends(identity)):
        return scoped(actor).oauth_start(actor)

    @router.post('/oauth/complete')
    async def oauth_complete(body: OAuthComplete, actor=Depends(identity)):
        return await scoped(actor).oauth_complete(actor, body.state, body.code)

    @router.post('/accounts/{ident}/refresh')
    async def refresh(ident: uuid.UUID, actor=Depends(identity)):
        return await scoped(actor).oauth_account_action(actor, str(ident))

    @router.post('/accounts/{ident}/revoke')
    async def revoke(ident: uuid.UUID, actor=Depends(identity)):
        return await scoped(actor).oauth_account_action(actor, str(ident), revoke=True)

    @router.get('/accounts')
    def accounts(actor=Depends(identity)):
        return [service.public(a) for a in service.store.rows(actor, 'account')]

    @router.delete('/accounts/{ident}')
    def disconnect(ident: uuid.UUID, actor=Depends(identity)):
        service.guard(actor, admin=True)
        with service.store.tx(actor) as db:
            row = service.store.get(actor, 'account', str(ident), db)
            row.update(status='disconnected', credential='')
            service.store.save(actor, row, db)
        return {'status':'disconnected', 'provider_revocation':'not_requested'}

    @router.post('/channels/{ident}/sync')
    async def sync(ident: uuid.UUID, body: SyncIn, actor=Depends(identity)):
        return await service.sync(actor, str(ident), str(body.template_id))

    return router


def parse_feed(raw, channel_id):
    if len(raw)>262144 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('Unsafe XML')
    root = ET.fromstring(raw)
    ns={'a':'http://www.w3.org/2005/Atom', 'y':'http://www.youtube.com/xml/schemas/2015',
        'm':'http://search.yahoo.com/mrss/'}
    if root.findtext('y:channelId', namespaces=ns) != channel_id:
        raise ValueError('Channel mismatch')
    entries=[]
    for e in root.findall('a:entry',ns)[:15]:
        if e.findtext('y:channelId',namespaces=ns) != channel_id:
            raise ValueError('Entry channel mismatch')
        video=e.findtext('y:videoId',default='',namespaces=ns)
        if VIDEO.fullmatch(video):
            entries.append({'video_id':video,'title':e.findtext('a:title',default='',namespaces=ns)[:200],
                            'description':e.findtext('m:group/m:description',default='',namespaces=ns)[:400]})
    return entries
