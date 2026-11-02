import unittest, uuid, hashlib
from pathlib import Path
from unittest.mock import AsyncMock, patch
from sqlalchemy import select, text
from app.database import Base
from app.models import Contact, Campaign, User, ApiKey, Lead
from app.routers import phone_parser
import lead_fixture

class SharedIsolation(lead_fixture.Fixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=[Campaign.__table__, Contact.__table__]))
            await conn.execute(text('CREATE TABLE tenant_settings (id uuid PRIMARY KEY, tenant_id uuid UNIQUE REFERENCES tenants(id), settings jsonb NOT NULL DEFAULT \'{}\', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())'))
        self.contacts=[]; self.campaigns=[]
        for ti in range(2):
            campaign=uuid.uuid4(); contact=uuid.uuid4()
            self.campaigns.append(campaign); self.contacts.append(contact)
            self.session.add(Campaign(id=campaign,tenant_id=self.tenants[ti],name=f'PRIVATE-CAMPAIGN-{ti}',base_text='synthetic',target_geos=[],target_niches=[],platform='telegram'))
            self.session.add(Contact(id=contact,tenant_id=self.tenants[ti],phone=f'+1202555010{ti}',name=f'PRIVATE-CONTACT-{ti}',tags=['fixture']))
        await self.session.commit()
        self.audit=patch('app.routers.auth.log_event',AsyncMock());self.audit.start()
    async def asyncTearDown(self):
        self.audit.stop()
        await super().asyncTearDown()
    async def test_campaign_reference_must_be_owned_before_assignment(self):
        for tenant in range(2):
            for role in ['owner','admin','member']:
                for foreign in [self.campaigns[1-tenant],uuid.uuid4()]:
                    with self.subTest(tenant=tenant,role=role,reference=str(foreign)):
                        r=await self.client.post('/api/v1/contacts/assign-campaign',headers=self.headers(tenant,role),json={'contact_ids':[str(self.contacts[tenant])],'campaign_id':str(foreign)})
                        self.assertEqual(r.status_code,404,r.text)
                        await self.session.rollback()
                        row=await self.session.get(Contact,self.contacts[tenant]);await self.session.refresh(row)
                        self.assertIsNone(row.last_mailing_campaign_id)
    async def test_owned_assignment_contact_guards_and_viewer(self):
        for tenant in range(2):
            for role in ['owner','admin','member','viewer']:
                r=await self.client.post('/api/v1/contacts/assign-campaign',headers=self.headers(tenant,role),json={'contact_ids':[str(self.contacts[tenant])],'campaign_id':str(self.campaigns[tenant])})
                self.assertEqual(r.status_code,403 if role=='viewer' else 200,r.text)
            r=await self.client.post('/api/v1/contacts/assign-campaign',headers=self.headers(tenant),json={'contact_ids':[str(self.contacts[1-tenant])],'campaign_id':str(self.campaigns[tenant])})
            self.assertEqual(r.status_code,404,r.text)
    async def test_contacts_read_update_export_are_tenant_bound(self):
        for tenant in range(2):
            for role in ['owner','admin','member','viewer']:
                h=self.headers(tenant,role)
                for suffix in ['', '/stats', '/export']:
                    r=await self.client.get('/api/v1/contacts'+suffix,headers=h)
                    self.assertEqual(r.status_code,200,r.text)
                    self.assertNotIn('PRIVATE-CONTACT-'+str(1-tenant),r.text)
                r=await self.client.get('/api/v1/contacts/'+str(self.contacts[1-tenant]),headers=h)
                self.assertEqual(r.status_code,404,r.text)
                r=await self.client.put('/api/v1/contacts/'+str(self.contacts[1-tenant]),headers=h,json={'notes':'denied'})
                self.assertEqual(r.status_code,403 if role=='viewer' else 404,r.text)
                r=await self.client.get('/api/v1/contacts',headers=self.headers(tenant,role,'key'))
                self.assertEqual(r.status_code,401,r.text)
    async def test_team_scope_and_foreign_mutations(self):
        for tenant in range(2):
            for role in ['owner','admin','member','viewer']:
                h=self.headers(tenant,role)
                r=await self.client.get('/api/v1/auth/users',headers=h)
                self.assertEqual(r.status_code,200,r.text)
                self.assertEqual({x['tenant_id'] for x in r.json()},{str(self.tenants[tenant])})
                foreign=str(self.users[(1-tenant,'member')])
                for method,suffix,body in [('PATCH','/role',{'role':'viewer'}),('DELETE','',None)]:
                    r=await self.client.request(method,'/api/v1/auth/users/'+foreign+suffix,headers=h,json=body)
                    self.assertEqual(r.status_code,404 if role in ['owner','admin'] else 403,r.text)
                r=await self.client.get('/api/v1/auth/users',headers=self.headers(tenant,role,'key'))
                self.assertEqual(r.status_code,401,r.text)
    async def test_settings_service_and_key_isolation(self):
        for tenant in range(2):
            for service in ['telegram','vkontakte','whatsapp','facebook','max']:
                r=await self.client.put('/api/v1/settings/groups',headers=self.headers(tenant),params={'service':service},json={'settings':{'fixture_marker':f'{tenant}-{service}'}})
                self.assertEqual(r.status_code,200,r.text)
        for tenant in range(2):
            for role in ['owner','admin','member','viewer']:
                h=self.headers(tenant,role)
                for service in ['telegram','vkontakte','whatsapp','facebook','max']:
                    r=await self.client.get('/api/v1/settings/groups',headers=h,params={'service':service})
                    self.assertEqual(r.status_code,200,r.text)
                    self.assertEqual(r.json()['settings']['fixture_marker'],f'{tenant}-{service}')
                r=await self.client.get('/api/v1/settings/api-keys',headers=h)
                self.assertEqual(r.status_code,200,r.text)
                self.assertEqual(len(r.json()['keys']),4)
                foreign=(await self.session.execute(select(ApiKey).where(ApiKey.user_id==self.users[(1-tenant,'member')]))).scalar_one()
                r=await self.client.delete('/api/v1/settings/api-keys/'+str(foreign.id),headers=h)
                self.assertEqual(r.status_code,403 if role=='viewer' else 200,r.text)
                await self.session.refresh(foreign);self.assertTrue(foreign.is_active)
                r=await self.client.get('/api/v1/settings/',headers=self.headers(tenant,role,'key'))
                self.assertEqual(r.status_code,401,r.text)
    async def test_admin_boundaries_and_backup_tenant_predicate(self):
        for tenant in range(2):
            self.session.add(Lead(id=uuid.uuid4(),tenant_id=self.tenants[tenant],platform='telegram',user_handle=f'PRIVATE-LEAD-{tenant}',message_text='fixture',intent_score='COLD',dialog_url='https://example.invalid/fixture'))
        await self.session.commit()
        for tenant in range(2):
            for role in ['owner','admin','member','viewer']:
                for route in ['/api/v1/audit/owner','/api/v1/audit/owner/users']:
                    r=await self.client.get(route,headers=self.headers(tenant,role))
                    self.assertEqual(r.status_code,403,r.text)
                r=await self.client.get('/api/v1/system/backup/leads',headers=self.headers(tenant,role))
                self.assertEqual(r.status_code,200 if role in ['owner','admin'] else 403,r.text)
                self.assertNotIn('PRIVATE-LEAD-'+str(1-tenant),r.text)
                if role in ['owner','admin']:self.assertIn('PRIVATE-LEAD-'+str(tenant),r.text)
                r=await self.client.get('/api/v1/tenants/'+str(self.tenants[1-tenant]),headers=self.headers(tenant,role))
                self.assertEqual(r.status_code,403,r.text)

if __name__=='__main__':
    print('RUNTIME_MODULE',phone_parser.__file__,hashlib.sha256(Path(phone_parser.__file__).read_bytes()).hexdigest(),flush=True)
    unittest.main(verbosity=2)
