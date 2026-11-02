import uuid, unittest
from unittest.mock import patch, MagicMock
from sqlalchemy import text
import lead_fixture as fixture
from app.routers import tasks

class Contracts(fixture.Fixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        from app.models import MonitoredGroup
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c:MonitoredGroup.__table__.create(c))
        self.groups={}
        for ti in [0,1]:
            gid=uuid.uuid4(); self.groups[ti]=gid
            self.session.add(MonitoredGroup(id=gid,tenant_id=self.tenants[ti],account_id=self.accounts[(ti,'facebook')],platform='facebook',group_identifier='https://www.facebook.com/groups/fixture',title='fixture'))
        await self.session.commit()

    async def test_warmup_denies_inaccessible_accounts_before_dispatch(self):
        for role in ['owner','admin','member']:
            for aid in [self.accounts[(1,'telegram')],uuid.uuid4()]:
                with self.subTest(role=role,aid=str(aid)), patch.object(tasks._celery,'send_task') as send:
                    r=await self.client.post('/api/v1/tasks/warmup/run',headers=self.headers(role=role),json={'account_id':str(aid)})
                    self.assertEqual(r.status_code,404,r.text)
                    send.assert_not_called()

    async def test_task_ids_are_validated_before_database_or_dispatch(self):
        with patch.object(tasks._celery,'send_task') as send:
            r=await self.client.post('/api/v1/tasks/warmup/run',headers=self.headers(),json={'account_id':'not-a-uuid'})
            self.assertEqual(r.status_code,422,r.text)
            send.assert_not_called()

    async def test_poster_malformed_references_rejected_before_dispatch(self):
        with patch.object(tasks._celery,'send_task') as send:
            r=await self.client.post('/api/v1/tasks/poster/publish',headers=self.headers(),json={'account_id':'not-a-uuid','campaign_id':'not-a-uuid','target_id':'not-a-uuid'})
            self.assertEqual(r.status_code,422,r.text)
            send.assert_not_called()

    async def test_warmup_owned_account_preserves_roles_and_canonical_dispatch(self):
        for tenant in [0,1]:
            for role in ['owner','admin','member']:
                aid=self.accounts[(tenant,'telegram')]
                with self.subTest(tenant=tenant,role=role),patch.object(tasks._celery,'send_task',return_value=MagicMock(id='fixture-job')) as send:
                    r=await self.client.post('/api/v1/tasks/warmup/run',headers=self.headers(tenant=tenant,role=role),json={'account_id':aid.hex.upper()})
                    self.assertEqual(r.status_code,200,r.text)
                    self.assertEqual(send.call_args.kwargs,{'args':[str(self.tenants[tenant]),str(aid)],'queue':'warmup'})

    async def test_accounts_targets_foreign_missing_and_owned_reads(self):
        for family,ids in [('accounts',self.accounts),('targets',self.targets)]:
            for role in ['owner','admin','member','viewer']:
                for tenant in [0,1]:
                    for aid in [ids[(1-tenant,'telegram')],uuid.uuid4()]:
                        r=await self.client.get(f'/api/v1/{family}/{aid}',headers=self.headers(tenant=tenant,role=role))
                        self.assertEqual(r.status_code,404,(family,r.text))
                    r=await self.client.get(f'/api/v1/{family}/{ids[(tenant,"telegram")]}',headers=self.headers(tenant=tenant,role=role))
                    self.assertEqual(r.status_code,200,(family,r.text))

    async def test_groups_targets_accounts_negative_writes(self):
        for role in ['owner','admin','member']:
            routes=[('accounts',self.accounts[(1,'telegram')],'disconnect'),('targets',self.targets[(1,'telegram')],'scrape-comments'),('groups',self.groups[1],'start'),('groups',self.groups[1],'stop'),('groups',uuid.uuid4(),'start'),('groups',uuid.uuid4(),'stop')]
            for family,aid,action in routes:
                r=await self.client.post(f'/api/v1/{family}/{aid}/{action}',headers=self.headers(role=role),json={'post_id':'1'})
                self.assertEqual(r.status_code,404,(family,action,r.text))

    async def test_viewer_denied_and_api_keys_not_promoted_to_jwt_routes(self):
        aid=self.accounts[(0,'telegram')]
        with patch.object(tasks._celery,'send_task') as send:
            for tenant in [0,1]:
                r=await self.client.post('/api/v1/tasks/warmup/run',headers=self.headers(tenant=tenant,role='viewer'),json={'account_id':str(aid)})
                self.assertEqual(r.status_code,403,r.text)
                for role in ['owner','admin','member','viewer']:
                    r=await self.client.post('/api/v1/tasks/warmup/run',headers=self.headers(tenant=tenant,role=role,mode='key'),json={'account_id':str(aid)})
                    self.assertEqual(r.status_code,401,r.text)
            send.assert_not_called()

if __name__=='__main__':
    import hashlib,json
    from pathlib import Path
    print('RUNTIME',json.dumps({'tasks_file':tasks.__file__,'tasks_sha256':hashlib.sha256(Path(tasks.__file__).read_bytes()).hexdigest(),'routes':[{'path':r.path,'methods':sorted(r.methods)} for r in fixture.full_app.routes if hasattr(r,'methods') and r.path.startswith(('/api/v1/accounts','/api/v1/groups','/api/v1/targets','/api/v1/tasks'))]}),flush=True)
    unittest.main(verbosity=2)
