import hashlib, unittest, uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import httpx
from fastapi import FastAPI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app as full_app
from app.database import Base, get_db
from app.models import Tenant, User, ApiKey, Target, AccountPool, Proxy, Lead
from app.security import create_access_token

class Fixture(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine=create_async_engine('postgresql+asyncpg://fixture@/fixture?host=/fixture',pool_pre_ping=True)
        async with self.engine.begin() as conn:
            assert (await conn.execute(text('SELECT current_database()'))).scalar()=='fixture'
            await conn.execute(text('DROP SCHEMA public CASCADE'))
            await conn.execute(text('CREATE SCHEMA public'))
            await conn.run_sync(lambda c:Base.metadata.create_all(c,tables=[x.__table__ for x in [Tenant,User,ApiKey,Proxy,Target,AccountPool,Lead]]))
            await conn.execute(text('CREATE TABLE audit_log (entity_type text, entity_id uuid, tenant_id uuid, action text, old_value jsonb, new_value jsonb, created_at timestamptz)'))
        self.session=async_sessionmaker(self.engine,expire_on_commit=False)()
        self.tenants=[uuid.uuid4(),uuid.uuid4()];self.users={};self.keys={};self.targets={};self.accounts={}
        for ti,tenant in enumerate(self.tenants):
            self.session.add(Tenant(id=tenant,company_name=f'Fixture {ti}'))
        await self.session.flush()
        for ti,tenant in enumerate(self.tenants):
            for role in ['owner','admin','member','viewer']:
                uid=uuid.uuid4();self.users[(ti,role)]=uid
                self.session.add(User(id=uid,tenant_id=tenant,email=f'{ti}-{role}@example.invalid',password_hash='synthetic-only',role=role))
            for platform in ['telegram','vkontakte','whatsapp','facebook','max','forum']:
                target=uuid.uuid4();account=uuid.uuid4()
                self.targets[(ti,platform)]=target;self.accounts[(ti,platform)]=account
                self.session.add(Target(id=target,tenant_id=tenant,platform=platform,target_id_code=str(target),title=f'PRIVATE-{ti}-{platform}',geo_tag='fixture',niche='fixture',access='open_wall'))
                self.session.add(AccountPool(id=account,tenant_id=tenant,platform=platform,account_identifier='fixture',session_data='synthetic',device_fingerprint={}))
        await self.session.flush()
        for (ti,role),uid in self.users.items():
            raw=f'synthetic-{ti}-{role}';salt=bytes.fromhex('01'*16);self.keys[(ti,role)]=raw
            self.session.add(ApiKey(id=uuid.uuid4(),tenant_id=self.tenants[ti],user_id=uid,name='fixture',key_preview='fixture',created_at=datetime.now(timezone.utc),key_hash=salt.hex()+':'+hashlib.pbkdf2_hmac('sha256',raw.encode(),salt,100000).hex(),is_active=True))
        await self.session.commit()
        self.app=FastAPI()
        self.app.router.routes.extend(full_app.routes)
        async def db():yield self.session
        full_app.dependency_overrides[get_db]=db
        self.app.dependency_overrides[get_db]=db
        self.client=httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app,raise_app_exceptions=False),base_url='http://fixture.invalid')
        self.pipeline=AsyncMock(return_value={'status':'processed','lead_id':None,'intent_score':'COLD','confidence':0.8,'summary':'fixture'})
        self.mock=patch('app.lead_pipeline.process_incoming_message',self.pipeline);self.mock.start()
    async def asyncTearDown(self):
        self.mock.stop();full_app.dependency_overrides.clear()
        await self.client.aclose();await self.session.close();await self.engine.dispose()
    def headers(self,tenant=0,role='member',mode='jwt'):
        if mode=='key':return {'X-API-Key':self.keys[(tenant,role)]}
        return {'Authorization':'Bearer '+create_access_token({'sub':str(self.users[(tenant,role)])})}
    async def qualify(self,**extra):
        return await self.client.post('/api/v1/leads/qualify',headers=self.headers(),json={'user_handle':'fixture','message_text':'fixture',**extra})
