import unittest,uuid
import lead_fixture
from app.models import Lead

class Ownership(lead_fixture.Fixture):
    async def test_rejects_foreign_wrong_platform_and_missing_references_before_pipeline(self):
        for field,objects in [('target_id',self.targets),('account_id',self.accounts)]:
            for identity in [objects[(1,'telegram')],objects[(0,'vkontakte')],uuid.uuid4()]:
                with self.subTest(field=field,identity=str(identity)):
                    self.pipeline.reset_mock()
                    response=await self.qualify(**{field:str(identity)})
                    self.assertEqual(response.status_code,404,response.text)
                    self.pipeline.assert_not_awaited()

    async def test_detail_does_not_disclose_foreign_or_other_platform_target_name(self):
        for target in [self.targets[(1,'telegram')],self.targets[(0,'vkontakte')]]:
            lead_id=uuid.uuid4()
            self.session.add(Lead(id=lead_id,tenant_id=self.tenants[0],platform='telegram',target_id=target,user_handle='fixture',message_text='fixture',dialog_url=''))
            await self.session.commit()
            response=await self.client.get('/api/v1/leads/'+str(lead_id),headers=self.headers())
            self.assertEqual(response.status_code,200,response.text)
            self.assertIsNone(response.json()['target_name'])
            self.assertNotIn('PRIVATE-',response.text)

    async def test_rejects_unsupported_platform_before_pipeline(self):
        response=await self.qualify(platform='unsupported')
        self.assertEqual(response.status_code,422,response.text)
        self.pipeline.assert_not_awaited()

    async def test_owned_references_and_manual_qualification_keep_working(self):
        for ti in [0,1]:
            for platform in ['telegram','vkontakte','whatsapp','facebook','max','forum']:
                for role,mode in [('owner','jwt'),('admin','jwt'),('member','jwt'),('member','key')]:
                    response=await self.client.post('/api/v1/leads/qualify',headers=self.headers(tenant=ti,role=role,mode=mode),json={'platform':platform,'target_id':str(self.targets[(ti,platform)]),'account_id':str(self.accounts[(ti,platform)]),'user_handle':'fixture','message_text':'fixture'})
                    self.assertEqual(response.status_code,200,response.text)
                    self.assertEqual(self.pipeline.call_args.kwargs['tenant_id'],str(self.tenants[ti]))
                    self.assertEqual(self.pipeline.call_args.kwargs['platform'],platform)
        response=await self.qualify()
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.pipeline.call_args.kwargs['target_id'],'')

    async def test_viewers_are_denied_in_both_authentication_paths(self):
        for ti in [0,1]:
            for mode in ['jwt','key']:
                response=await self.client.post('/api/v1/leads/qualify',headers=self.headers(tenant=ti,role='viewer',mode=mode),json={'user_handle':'fixture','message_text':'fixture'})
                self.assertEqual(response.status_code,403,response.text)
        self.pipeline.assert_not_awaited()

    async def test_owned_detail_is_preserved_and_foreign_lead_is_not_readable(self):
        lead_id=uuid.uuid4()
        self.session.add(Lead(id=lead_id,tenant_id=self.tenants[0],platform='telegram',target_id=self.targets[(0,'telegram')],user_handle='fixture',message_text='fixture',dialog_url=''))
        await self.session.commit()
        response=await self.client.get('/api/v1/leads/'+str(lead_id),headers=self.headers())
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['target_name'],'PRIVATE-0-telegram')
        response=await self.client.get('/api/v1/leads/'+str(lead_id),headers=self.headers(tenant=1))
        self.assertEqual(response.status_code,404,response.text)

if __name__=='__main__':unittest.main(verbosity=2)
