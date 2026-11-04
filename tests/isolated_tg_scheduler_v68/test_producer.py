import unittest,uuid
from unittest.mock import patch,AsyncMock
from sqlalchemy import select
from app.models import Campaign,AccountPool
from app.database import Base
import lead_fixture
class Contracts(lead_fixture.Fixture):
 async def asyncSetUp(self):
  await super().asyncSetUp()
  async with self.engine.begin() as c:await c.run_sync(lambda con:Base.metadata.create_all(con,tables=[Campaign.__table__]))
  self.audit=patch('app.routers.campaigns.log_event',AsyncMock());self.audit.start()
  for a in (await self.session.execute(select(AccountPool))).scalars():a.status='active';a.actions_today=0;a.daily_action_limit=100
  await self.session.commit()
 async def asyncTearDown(self):
  self.audit.stop();await super().asyncTearDown()
 async def test_registered_create_manual_run_disable_delete_persistence(self):
  h=self.headers()
  r=await self.client.post('/api/v1/campaigns/',headers=h,json={'name':'synthetic','base_text':'synthetic','platform':'telegram','schedule_cron':None,'target_geos':[],'target_niches':[]})
  self.assertEqual(r.status_code,201,r.text);cid=r.json()['id']
  r=await self.client.get('/api/v1/campaigns/'+cid,headers=h);self.assertEqual(r.status_code,200,r.text);self.assertIsNone(r.json()['schedule_cron'])
  with patch('app.celery_app.celery.send_task') as broker:
   r=await self.client.post('/api/v1/campaigns/'+cid+'/run',headers=self.headers(1));self.assertEqual(r.status_code,404,r.text);broker.assert_not_called()
   r=await self.client.post('/api/v1/campaigns/'+cid+'/run',headers=h);self.assertEqual(r.status_code,200,r.text)
   broker.assert_called_once();c=broker.call_args
   self.assertEqual(c.args[0],'app.tasks.poster.publish_post');self.assertEqual(c.kwargs['queue'],'poster')
   self.assertEqual(c.kwargs['args'][:4],[str(self.tenants[0]),cid,str(self.targets[(0,'telegram')]),str(self.accounts[(0,'telegram')])])
  r=await self.client.patch('/api/v1/campaigns/'+cid,headers=h,json={'is_active':False});self.assertEqual(r.status_code,200,r.text)
  with patch('app.celery_app.celery.send_task') as broker:
   r=await self.client.post('/api/v1/campaigns/'+cid+'/run',headers=h);self.assertEqual(r.status_code,400,r.text);broker.assert_not_called()
  r=await self.client.delete('/api/v1/campaigns/'+cid,headers=h);self.assertEqual(r.status_code,204,r.text)
  async with self.engine.connect() as c:self.assertFalse((await c.execute(select(Campaign.is_active).where(Campaign.id==uuid.UUID(cid)))).scalar_one())
if __name__=='__main__':unittest.main(verbosity=2)
