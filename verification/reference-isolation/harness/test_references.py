import os,uuid,unittest,json,hashlib
from pathlib import Path
from unittest.mock import patch,AsyncMock,MagicMock
from sqlalchemy import select
import lead_fixture as f
from app.models import AccountPool,MonitoredGroup
from app.routers import accounts,groups,targets

class Contracts(f.Fixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as c:
            await c.run_sync(lambda c:MonitoredGroup.__table__.create(c))
        for ti in [0,1]:
            for platform in ['telegram','facebook']:
                a=await self.session.get(AccountPool,self.accounts[ti,platform]);a.status='active'
        await self.session.commit()

    async def test_telegram_auth_single_rejects_wrong_platform(self):
        for ti in [0,1]:
            for role in ['owner','admin','member']:
                for action,payload in [('connect',{'phone':'+15555550100'}),('confirm',{'phone':'+15555550100','code':'12345'}),('confirm-password',{'password':'synthetic'})]:
                    with self.subTest(tenant=ti,role=role,action=action),patch('telethon.TelegramClient') as sdk,patch('redis.Redis.from_url') as redis:
                        aid=self.accounts[ti,'facebook']
                        r=await self.client.post(f'/api/v1/accounts/{aid}/{action}',headers=self.headers(tenant=ti,role=role),json=payload)
                        self.assertEqual(r.status_code,404,r.text)
                        sdk.assert_not_called();redis.assert_not_called()

    async def test_telegram_auth_bulk_rejects_wrong_platform(self):
        for ti in [0,1]:
            for role in ['owner','admin','member']:
                aid=self.accounts[ti,'facebook']
                with self.subTest(tenant=ti,role=role),patch('telethon.TelegramClient') as sdk:
                    r=await self.client.post('/api/v1/accounts/connect-all',headers=self.headers(tenant=ti,role=role),json={'account_ids':[str(aid)]})
                    self.assertEqual(r.status_code,200,r.text)
                    self.assertEqual(r.json()['sent'],0)
                    self.assertIn('not found',str(r.json()))
                    sdk.assert_not_called()

    async def test_telegram_auth_controls(self):
        for ti in [0,1]:
            aid=self.accounts[ti,'telegram']
            # Eligible Telegram still reaches its pre-existing configuration gate.
            r=await self.client.post(f'/api/v1/accounts/{aid}/connect',headers=self.headers(tenant=ti),json={'phone':'+15555550100'})
            self.assertEqual(r.status_code,500,r.text)
            self.assertIn('credentials not configured',r.text)
            for mode,role,expected in [('jwt','viewer',403),('key','member',401)]:
                r=await self.client.post('/api/v1/accounts/connect-all',headers=self.headers(tenant=ti,role=role,mode=mode),json={'account_ids':[str(aid)]})
                self.assertEqual(r.status_code,expected,r.text)

    async def test_groups_explicit_and_auto_platform_eligibility(self):
        with patch.object(groups,'get_subscription_plan',AsyncMock(return_value='trial')),patch.object(groups,'log_event',AsyncMock()):
            for ti in [0,1]:
                for role in ['owner','admin','member']:
                    for aid in [self.accounts[1-ti,'facebook'],self.accounts[ti,'telegram'],uuid.uuid4()]:
                        r=await self.client.post('/api/v1/groups/',headers=self.headers(tenant=ti,role=role),json={'platform':'facebook','group_identifier':'https://www.facebook.com/groups/fixture','account_id':str(aid)})
                        self.assertEqual(r.status_code,404,r.text)
                # Auto selection must ignore another platform and inactive own accounts.
                a=await self.session.get(AccountPool,self.accounts[ti,'facebook']);a.status='banned';await self.session.commit()
                payload={'platform':'facebook','group_identifier':'https://www.facebook.com/groups/fixture'}
                r=await self.client.post('/api/v1/groups/',headers=self.headers(tenant=ti),json=payload)
                self.assertEqual(r.status_code,400,r.text)
                r=await self.client.post('/api/v1/groups/bulk-import',headers=self.headers(tenant=ti),json={'groups':[payload]})
                self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['imported'],0);self.assertTrue(r.json()['errors'])
                a=await self.session.get(AccountPool,self.accounts[ti,'facebook']);a.status='active';await self.session.commit()
                r=await self.client.post('/api/v1/groups/',headers=self.headers(tenant=ti),json=payload)
                self.assertEqual(r.status_code,201,r.text)
                payload['group_identifier']='https://www.facebook.com/groups/fixturebulk'
                r=await self.client.post('/api/v1/groups/bulk-import',headers=self.headers(tenant=ti),json={'groups':[payload]})
                self.assertEqual(r.json()['imported'],1,r.text)
                rows=(await self.session.execute(select(MonitoredGroup).where(MonitoredGroup.tenant_id==self.tenants[ti]))).scalars().all()
                self.assertEqual(len(rows),2)
                self.assertTrue(all(x.account_id==self.accounts[ti,'facebook'] for x in rows))

    async def test_target_join_explicit_and_auto_platform_eligibility(self):
        for ti in [0,1]:
            target=self.targets[ti,'telegram']
            for ids in [[self.accounts[1-ti,'telegram']],[self.accounts[ti,'facebook']],[uuid.uuid4()]]:
                r=await self.client.post(f'/api/v1/targets/{target}/join',headers=self.headers(tenant=ti),json={'account_ids':[str(x) for x in ids]})
                self.assertEqual(r.status_code,400,r.text)
            a=await self.session.get(AccountPool,self.accounts[ti,'telegram']);a.status='banned';await self.session.commit()
            r=await self.client.post(f'/api/v1/targets/{target}/join',headers=self.headers(tenant=ti),json={})
            self.assertEqual(r.status_code,400,r.text)

if __name__=='__main__':
    print('RUNTIME',json.dumps({m.__name__:{'path':m.__file__,'sha256':hashlib.sha256(Path(m.__file__).read_bytes()).hexdigest()} for m in [accounts,groups,targets]}),flush=True)
    unittest.main(verbosity=2)
