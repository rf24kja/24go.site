import unittest, uuid, hashlib, json, time
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock
from jose import jwt
from sqlalchemy import select, func
from app.models import User, Tenant
from app.billing_models import Subscription
from app.database import Base
from app.security import hash_password, verify_password, create_access_token
from app.config import settings
from app.main import app
import lead_fixture

class RedisFixture:
    def __init__(self): self.data={};self.deadlines={}
    def setex(self,key,ttl,value):self.data[key]=value;self.deadlines[key]=time.time()+ttl
    def get(self,key):return self.data.get(key) if self.deadlines.get(key,float('inf'))>time.time() else None
    def exists(self,key):return self.get(key) is not None
    def delete(self,key):self.data.pop(key,None)
    def incr(self,key):self.data[key]=int(self.get(key) or 0)+1;return self.data[key]
    def expire(self,key,ttl):self.deadlines[key]=time.time()+ttl
    def pipeline(self):return self
    def zremrangebyscore(self,*a):return self
    def zadd(self,*a):return self
    def zcard(self,*a):return self
    def execute(self):return [0,1,1,True]

class AuthContracts(lead_fixture.Fixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as c:await c.run_sync(lambda conn:Base.metadata.create_all(conn,tables=[Subscription.__table__]))
        self.password='Synthetic-Original-123!';self.new='Synthetic-Changed-456!'
        hashed=hash_password(self.password)
        for uid in self.users.values():
            row=await self.session.get(User,uid);row.password_hash=hashed
        await self.session.commit()
        self.redis=RedisFixture();self.patches=[patch('app.routers.auth._redis',self.redis),patch('redis.Redis.from_url',return_value=self.redis),patch('app.routers.auth.smtplib.SMTP'),patch('app.routers.auth.log_event',AsyncMock())]
        self.mocks=[p.start() for p in self.patches];self.smtp=self.mocks[2];self.audit=self.mocks[3]
    async def asyncTearDown(self):
        for p in reversed(self.patches):p.stop()
        await super().asyncTearDown()
    async def post(self,path,body,headers=None):return await self.client.post('/api/v1/auth/'+path,json=body,headers=headers or {})
    async def check_password(self,uid,password):
        row=await self.session.get(User,uid);await self.session.refresh(row);self.assertTrue(verify_password(password,row.password_hash))
    async def test_R001_public_register_new_tenant(self):
        before=(await self.session.execute(select(func.count()).select_from(Tenant))).scalar()
        body={'email':'registered@example.com','password':self.password,'company_name':'Synthetic tenant','tenant_id':str(self.tenants[1]),'role':'admin','user_id':str(self.users[(1,'owner')])}
        r=await self.post('register',body);self.assertEqual(r.status_code,201,r.text)
        result=r.json();self.assertNotIn(uuid.UUID(result['tenant_id']),self.tenants);self.assertEqual(result['role'],'owner')
        row=(await self.session.execute(select(User).where(User.email==body['email']))).scalar_one();self.assertEqual(str(row.tenant_id),result['tenant_id']);await self.check_password(row.id,self.password)
        self.assertEqual((await self.session.execute(select(func.count()).select_from(Tenant))).scalar(),before+1)
        self.assertEqual(self.smtp.call_count,1)
        r=await self.post('register',body);self.assertEqual(r.status_code,409,r.text)
        self.assertEqual((await self.session.execute(select(func.count()).select_from(Tenant))).scalar(),before+1)
    async def test_R002_login_binding_and_negatives(self):
        for t in range(2):
            for role in ['owner','admin','member','viewer']:
                body={'email':f'{t}-{role}@example.com','password':self.password,'tenant_id':str(self.tenants[1-t]),'role':'owner','user_id':str(self.users[(1-t,'owner')])}
                r=await self.post('login',body,self.headers(t,role,'key'));self.assertEqual(r.status_code,200,r.text)
                data=r.json();payload=jwt.decode(data['access_token'],settings.JWT_SECRET,algorithms=[settings.JWT_ALGORITHM],options={'verify_aud':False});self.assertEqual(payload['sub'],str(self.users[(t,role)]));self.assertEqual(payload['tenant_id'],str(self.tenants[t]));self.assertEqual(payload['role'],role)
                r=await self.post('login',{**body,'password':'Synthetic-Wrong-123!'});self.assertEqual(r.status_code,401,r.text)
        r=await self.post('login',{'email':'missing@example.com','password':self.password});self.assertEqual(r.status_code,401,r.text)
        self.smtp.assert_not_called()
    async def test_R007_password_actor_and_roles(self):
        for t in range(2):
            for role in ['owner','admin','member','viewer']:
                uid=self.users[(t,role)];foreign=self.users[(1-t,role)]
                body={'current_password':'Synthetic-Wrong-123!','new_password':self.new,'tenant_id':str(self.tenants[1-t]),'user_id':str(foreign),'id':str(foreign)}
                self.audit.reset_mock()
                for headers,status in [({},401),(self.headers(t,role,'key'),401),(self.headers(t,role),400)]:
                    r=await self.post('change-password',body,headers);self.assertEqual(r.status_code,status,r.text)
                self.audit.assert_not_called();await self.check_password(uid,self.password)
                # Signed misleading tenant/role claims cannot override the DB actor.
                headers={'Authorization':'Bearer '+create_access_token({'sub':str(uid),'tenant_id':str(self.tenants[1-t]),'role':'owner'})}
                r=await self.post('change-password',{**body,'current_password':self.password},headers);self.assertEqual(r.status_code,200,r.text)
                await self.check_password(uid,self.new)
                # Foreign actor may have been changed earlier in this loop; assert its expected state.
                await self.check_password(foreign,self.password)
                self.assertEqual(self.audit.call_args.kwargs['tenant_id'],self.tenants[t])
                r=await self.post('change-password',{**body,'current_password':self.new,'new_password':self.password},headers);self.assertEqual(r.status_code,200,r.text)
                await self.check_password(uid,self.password)
    async def test_R008_R009_reset_expiry_replay_and_binding(self):
        for t in range(2):
            uid=self.users[(t,'member')];email=f'{t}-member@example.com'
            r=await self.post('forgot-password',{'email':email,'tenant_id':str(self.tenants[1-t]),'user_id':str(self.users[(1-t,'owner')])});self.assertEqual(r.status_code,200,r.text)
            jti=next(k.split(':',1)[1] for k,v in self.redis.data.items() if k.startswith('reset_token:') and v==str(uid))
            def token(**overrides):return jwt.encode({'sub':str(uid),'type':'password_reset','jti':jti,'exp':datetime.now(timezone.utc)+timedelta(hours=1),**overrides},settings.JWT_SECRET,algorithm=settings.JWT_ALGORITHM)
            for bad in ['invalid-token-value',create_access_token({'sub':str(uid)}),token(exp=datetime.now(timezone.utc)-timedelta(seconds=1)),token(type='access')]:
                r=await self.post('reset-password',{'token':bad,'new_password':self.new});self.assertEqual(r.status_code,400,r.text);await self.check_password(uid,self.password)
            self.redis.deadlines['reset_token:'+jti]=time.time()-1
            r=await self.post('reset-password',{'token':token(),'new_password':self.new});self.assertEqual(r.status_code,400,r.text)
            self.redis.setex('reset_token:'+jti,3600,str(uid))
            r=await self.post('reset-password',{'token':token(),'new_password':self.new,'user_id':str(self.users[(1-t,'owner')]),'tenant_id':str(self.tenants[1-t])});self.assertEqual(r.status_code,200,r.text)
            await self.check_password(uid,self.new);await self.check_password(self.users[(1-t,'owner')],self.password)
            r=await self.post('reset-password',{'token':token(),'new_password':self.password});self.assertEqual(r.status_code,400,r.text);await self.check_password(uid,self.new)
        sent=self.smtp.call_count
        r=await self.post('forgot-password',{'email':'missing@example.com'});self.assertEqual(r.status_code,200,r.text);self.assertEqual(self.smtp.call_count,sent)

if __name__=='__main__':
    p=Path('/app/app/routers/auth.py');print('SOURCE_HASH',hashlib.sha256(p.read_bytes()).hexdigest(),flush=True)
    print('REGISTERED='+json.dumps([{'path':r.path,'methods':sorted(r.methods),'module':r.endpoint.__module__} for r in app.routes if getattr(r,'methods',set())&{'POST'} and r.path in ['/api/v1/auth/'+s for s in ['register','login','change-password','forgot-password','reset-password']]]),flush=True)
    unittest.main(verbosity=2)
