import unittest, uuid
from unittest.mock import patch, Mock, AsyncMock
from sqlalchemy import update
from app.models import Campaign, Mailing, MailingRecipient, AccountPool, Target
from app.database import Base
from app.celery_app import celery
import lead_fixture

class Contracts(lead_fixture.Fixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as c:
            await c.run_sync(lambda conn:Base.metadata.create_all(conn,tables=[m.__table__ for m in [Campaign,Mailing,MailingRecipient]]))
        self.c={};self.m={}
        for t in range(2):
            for p in ['telegram','vkontakte','whatsapp','facebook','max']:
                self.c[t,p]=uuid.uuid4();self.m[t,p]=uuid.uuid4()
                self.session.add(Campaign(id=self.c[t,p],tenant_id=self.tenants[t],name='fixture',base_text='synthetic',platform=p,target_geos=[],target_niches=[]))
                self.session.add(Mailing(id=self.m[t,p],tenant_id=self.tenants[t],name='fixture',message_text='synthetic',platform=p))
        await self.session.execute(update(AccountPool).values(status='active',actions_today=0,daily_action_limit=10))
        await self.session.execute(update(Target).values(target_id_code='12345'))
        await self.session.commit()
        self.dispatch=Mock(return_value=Mock(id='synthetic'))
        self.patches=[patch.object(celery,'send_task',self.dispatch),patch('app.routers.campaigns.log_event',AsyncMock())]
        for p in self.patches:p.start()
    async def asyncTearDown(self):
        for p in self.patches:p.stop()
        await super().asyncTearDown()

    async def test_registered_ownership_and_auth(self):
        for t in range(2):
            for role in ['owner','admin','member','viewer']:
                for family,ids,actions in [('campaigns',self.c,['get','patch','delete','run']),('mailings',self.m,['get','delete','start','pause','stop','check-read','import'])]:
                    for ref in [ids[1-t,'telegram'],uuid.uuid4()]:
                        for action in actions:
                            verb=action if action in ['get','patch','delete'] else 'post'
                            path=f'/api/v1/{family}/{ref}'+('' if action in ['get','patch','delete'] else '/'+action)
                            kw={}
                            if action=='patch':kw['json']={'name':'forbidden'}
                            if action=='import':path=f'/api/v1/mailings/import?mailing_id={ref}';kw['json']={'file':'synthetic_user','platform':'telegram'}
                            r=await self.client.request(verb,path,headers=self.headers(t,role),**kw)
                            self.assertEqual(r.status_code,403 if role=='viewer' and verb!='get' else 404,(action,r.text))
                    r=await self.client.get(f'/api/v1/{family}/{ids[t,"telegram"]}',headers=self.headers(t,role))
                    self.assertEqual(r.status_code,200,r.text)
                    r=await self.client.post(f'/api/v1/{family}/{ids[t,"telegram"]}/'+('run' if family=='campaigns' else 'start'),headers=self.headers(t,role,'key'))
                    self.assertEqual(r.status_code,401,r.text)
        self.dispatch.assert_not_called()

    async def test_malformed_mailing_ids_are_validation_errors(self):
        for action in ['get','delete','start','pause','stop','check-read','import']:
            method=action if action in ['get','delete'] else 'post'
            path='/api/v1/mailings/not-a-uuid'+('' if action in ['get','delete'] else '/'+action)
            kw={}
            if action=='import':path='/api/v1/mailings/import?mailing_id=not-a-uuid';kw['json']={'file':'synthetic_user','platform':'telegram'}
            r=await self.client.request(method,path,headers=self.headers(),**kw)
            self.assertEqual(r.status_code,422,(action,r.text))
        self.dispatch.assert_not_called()

    async def test_inactive_campaign_cannot_dispatch(self):
        await self.session.execute(update(Campaign).values(is_active=False));await self.session.commit()
        r=await self.client.post(f'/api/v1/campaigns/{self.c[0,"telegram"]}/run',headers=self.headers())
        self.assertEqual(r.status_code,400,r.text)
        self.dispatch.assert_not_called()

    async def test_owned_positive_payloads_and_lifecycle(self):
        for t in range(2):
            for role in ['owner','admin','member','viewer']:
                for p in ['telegram','vkontakte']:
                    self.dispatch.reset_mock()
                    r=await self.client.post(f'/api/v1/campaigns/{self.c[t,p]}/run',headers=self.headers(t,role))
                    self.assertEqual(r.status_code,403 if role=='viewer' else 200,r.text)
                    if role!='viewer':
                        payload=self.dispatch.call_args.kwargs
                        self.assertEqual(payload['queue'],'poster')
                        if p=='telegram':self.assertEqual(payload['args'][:4],[str(self.tenants[t]),str(self.c[t,p]),str(self.targets[t,p]),str(self.accounts[t,p])])
                        else:self.assertEqual(payload['kwargs']['tenant_id'],str(self.tenants[t]));self.assertEqual(payload['kwargs']['account_id'],str(self.accounts[t,p]))
                for action in ['start','pause','start','stop']:
                    r=await self.client.post(f'/api/v1/mailings/{self.m[t,"telegram"]}/{action}',headers=self.headers(t,role))
                    self.assertEqual(r.status_code,403 if role=='viewer' else 200,(action,r.text))
                row=await self.session.get(Mailing,self.m[t,'telegram']);row.status='draft';await self.session.commit()

    async def test_enqueue_failure_restores_draft_and_canonical_read_payload(self):
        self.dispatch.side_effect=RuntimeError('synthetic broker failure')
        mid=self.m[0,'telegram']
        r=await self.client.post(f'/api/v1/mailings/{mid}/start',headers=self.headers())
        self.assertEqual(r.status_code,503,r.text)
        row=await self.session.get(Mailing,mid);await self.session.refresh(row)
        self.assertEqual(row.status.value,'draft');self.assertIsNone(row.started_at)
        self.dispatch.side_effect=None;self.dispatch.reset_mock()
        r=await self.client.post(f'/api/v1/mailings/{str(mid).upper()}/check-read',headers=self.headers())
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.dispatch.call_args.kwargs['args'],[str(mid)])

    async def test_owned_mutation_import_and_five_platform_storage(self):
        for t in range(2):
            for p in ['telegram','vkontakte','whatsapp','facebook','max']:
                r=await self.client.patch(f'/api/v1/campaigns/{self.c[t,p]}',headers=self.headers(t),json={'name':'changed'})
                self.assertEqual(r.status_code,200,r.text)
                r=await self.client.post('/api/v1/mailings/import',params={'mailing_id':str(self.m[t,p])},headers=self.headers(t),json={'file':'synthetic_user','platform':p})
                self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['imported'],1)
                for family in ['campaigns','mailings']:
                    r=await self.client.get('/api/v1/'+family+'/',params={'platform':p},headers=self.headers(t))
                    self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['total'],1)
        self.dispatch.assert_not_called()

if __name__=='__main__':unittest.main(verbosity=2)
