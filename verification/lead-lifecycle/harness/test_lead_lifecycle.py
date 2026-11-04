import unittest, uuid, hashlib, json
from pathlib import Path
from sqlalchemy import text, select
from app.models import Lead
from app.routers import leads
import lead_fixture

class Lifecycle(lead_fixture.Fixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as conn:
            await conn.execute(text('DROP TABLE audit_log'))
            from app.audit import DDL
            await conn.execute(text(DDL.split('CREATE INDEX')[0]))
        self.ids=[uuid.uuid4(),uuid.uuid4()]
        for ti,lid in enumerate(self.ids):
            self.session.add(Lead(id=lid,tenant_id=self.tenants[ti],platform='telegram',user_handle='fixture',message_text='fixture',intent_score='COLD',dialog_url='https://example.invalid/fixture',status='new'))
        await self.session.commit()
    async def status(self, identity=None, tenant=0, role='member', value='converted'):
        return await self.client.patch('/api/v1/leads/'+str(identity or self.ids[tenant]),headers=self.headers(tenant,role),json={'status':value})
    async def stored_status(self, ti=0):
        async with self.engine.connect() as conn:
            return (await conn.execute(select(Lead.status).where(Lead.id==self.ids[ti]))).scalar_one()
    async def test_audit_failure_does_not_commit_status(self):
        async with self.engine.begin() as conn:
            await conn.execute(text("ALTER TABLE audit_log ADD CONSTRAINT fixture_reject CHECK (action <> 'status_change')"))
        r=await self.status()
        self.assertEqual(r.status_code,500,r.text)
        self.assertEqual(await self.stored_status(),'new')
    async def test_status_and_audit_persist_together_and_repeat_is_noop(self):
        r=await self.status()
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(await self.stored_status(),'converted')
        r=await self.status();self.assertEqual(r.status_code,200,r.text)
        async with self.engine.connect() as conn:
            rows=(await conn.execute(text('SELECT tenant_id,user_id,entity_id,old_value,new_value FROM audit_log'))).all()
        self.assertEqual(len(rows),1)
        self.assertEqual(tuple(rows[0][:3]),(self.tenants[0],self.users[(0,'member')],self.ids[0]))
        self.assertEqual(rows[0].old_value,{'status':'new'})
        self.assertEqual(rows[0].new_value,{'status':'converted'})
    async def test_tenant_role_and_malformed_guards(self):
        for ti in range(2):
            for role in ['owner','admin','member','viewer']:
                r=await self.status(self.ids[1-ti],ti,role)
                self.assertEqual(r.status_code,403 if role=='viewer' else 404,r.text)
            for identity in [str(uuid.uuid4()),'not-a-uuid']:
                r=await self.status(identity,ti)
                self.assertEqual(r.status_code,422 if identity=='not-a-uuid' else 404,r.text)
            r=await self.status(tenant=ti,role='viewer');self.assertEqual(r.status_code,403,r.text)
        self.assertEqual(await self.stored_status(0),'new');self.assertEqual(await self.stored_status(1),'new')

if __name__=='__main__':
    print('RUNTIME_MODULE',leads.__file__,hashlib.sha256(Path(leads.__file__).read_bytes()).hexdigest(),flush=True)
    unittest.main(verbosity=2)
