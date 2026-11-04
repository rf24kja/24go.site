import asyncio,unittest,uuid,contextlib
from unittest.mock import patch,Mock,AsyncMock
import asyncpg
import app.tasks.campaign_scheduler as scheduler
DSN='postgresql://fixture@/fixture?host=/fixture'
async def query(method,sql,*args):
 c=await asyncpg.connect(DSN)
 try:return await getattr(c,method)(sql,*args)
 finally:await c.close()
class Redis:
 def __init__(self):self.keys=set();self.arrived=0;self.barrier=asyncio.Event()
 async def exists(self,key):
  present=key in self.keys;self.arrived+=1
  if self.arrived==2:self.barrier.set()
  await self.barrier.wait();return present
 async def set(self,key,value,ex=None,nx=False):
  if nx and key in self.keys:return False
  self.keys.add(key);return True
class Contracts(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.id=uuid.uuid4();self.tenant=uuid.uuid4();self.account=uuid.uuid4();self.target=uuid.uuid4()
  await query('execute','DROP TABLE IF EXISTS campaigns,targets,account_pool,posting_logs; CREATE TABLE campaigns(id uuid,tenant_id uuid,base_text text,platform text,target_geos text[],target_niches text[],schedule_cron text,posts_per_day int,timezone text,last_posted_at timestamptz,ab_enabled boolean,ab_variants jsonb,is_active boolean); CREATE TABLE targets(id uuid,tenant_id uuid,target_id_code text,title text,platform text,is_active boolean,geo_tag text,niche text); CREATE TABLE account_pool(id uuid,tenant_id uuid,account_identifier text,status text,platform text,actions_today int,daily_action_limit int); CREATE TABLE posting_logs(campaign_id uuid,executed_at timestamptz)')
  await query('execute',"INSERT INTO campaigns VALUES($1,$2,'synthetic','telegram','{}','{}',$3,10,'UTC',NULL,false,'[]',true)",self.id,self.tenant,'* * * * *')
  await query('execute',"INSERT INTO targets VALUES($1,$2,'fixture_group','fixture','telegram',true,NULL,NULL)",self.target,self.tenant)
  await query('execute',"INSERT INTO account_pool VALUES($1,$2,'fixture','active','telegram',0,100)",self.account,self.tenant)
  self.broker=Mock();self.redis=Redis();self.stack=contextlib.ExitStack()
  for method in ['fetch','fetchrow','fetchval','execute']:
   async def bridge(sql,*args,m=method):return await query(m,sql,*args)
   self.stack.enter_context(patch.object(scheduler,method,side_effect=bridge))
  self.stack.enter_context(patch.object(scheduler,'get_redis',AsyncMock(return_value=self.redis)))
  self.stack.enter_context(patch.object(scheduler.celery,'send_task',self.broker))
  self.stack.enter_context(patch('app.tenant_settings.get_tenant_settings_from_db',AsyncMock(return_value={})))
 async def asyncTearDown(self):self.stack.close()
 async def test_manual_only_never_dispatches_or_updates_persistence(self):
  await query('execute','UPDATE campaigns SET schedule_cron=NULL')
  # Single-run baseline exists() must not wait for a second scheduler.
  self.redis.barrier.set()
  await scheduler._run()
  self.assertEqual(self.broker.call_count,0,'manual-only campaign dispatched by Beat')
  self.assertIsNone(await query('fetchval','SELECT last_posted_at FROM campaigns'))
 async def test_dispatch_failure_does_not_claim_last_posted(self):
  self.redis.barrier.set();self.broker.side_effect=RuntimeError('synthetic broker refusal')
  with self.assertRaisesRegex(RuntimeError,'broker refusal'):await scheduler._run()
  self.assertIsNone(await query('fetchval','SELECT last_posted_at FROM campaigns'))
 async def test_inactive_campaign_not_selected(self):
  await query('execute','UPDATE campaigns SET is_active=false')
  await scheduler._run();self.broker.assert_not_called()
 async def test_daily_limit_preserves_last_posted(self):
  self.redis.barrier.set()
  await query('execute',"INSERT INTO posting_logs SELECT id,NOW() FROM campaigns CROSS JOIN generate_series(1,10)")
  await scheduler._run();self.broker.assert_not_called()
  self.assertIsNone(await query('fetchval','SELECT last_posted_at FROM campaigns'))
 async def test_no_matching_target_does_not_dispatch(self):
  self.redis.barrier.set();await query('execute',"UPDATE targets SET platform='vkontakte'")
  await scheduler._run();self.broker.assert_not_called()
 async def test_repeat_in_window_does_not_dispatch_again(self):
  self.redis.barrier.set();await scheduler._run();await scheduler._run()
  self.assertEqual(self.broker.call_count,1)
 async def test_redis_unavailable_never_dispatches(self):
  with patch.object(scheduler,'get_redis',AsyncMock(side_effect=ConnectionError('synthetic unavailable'))):
   await scheduler._run()
  self.assertEqual(self.broker.call_count,0,'lock outage must not allow duplicate dispatch')
  self.assertIsNone(await query('fetchval','SELECT last_posted_at FROM campaigns'))
 async def test_concurrent_due_campaign_dispatches_once(self):
  await asyncio.wait_for(asyncio.gather(scheduler._run(),scheduler._run()),10)
  self.assertEqual(self.broker.call_count,1,'concurrent scheduler double-dispatch')
  self.assertIsNotNone(await query('fetchval','SELECT last_posted_at FROM campaigns'))
  call=self.broker.call_args
  self.assertEqual(call.args[0],'app.tasks.poster.publish_post');self.assertEqual(call.kwargs['queue'],'poster')
  self.assertEqual(call.kwargs['args'][:4],[str(self.tenant),str(self.id),str(self.target),str(self.account)])
if __name__=='__main__':unittest.main(verbosity=2)
