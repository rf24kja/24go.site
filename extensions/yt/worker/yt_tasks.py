"""Finite worker registration against the existing Celery instance; no new broker.
Call register_yt(celery, service_factory, tenants) from app.celery_app after its
Celery instance exists. tenants returns a bounded configured tenant page; it must
not use user-supplied IDs. Provider gates remain enforced inside the service.
"""
import asyncio
from fastapi import HTTPException
from yt import Actor

async def monitor(service, actor):
    if not service.options.gate('monitoring'): return {'disabled':True}
    scanned=0;errors=0
    candidates=[r for r in service.store.rows(actor,'channel') if r.get('enabled') and r.get('template_id')]
    for row in sorted(candidates,key=lambda r:r.get('last_scan_at',0))[:3]:
        import time
        with service.store.tx(actor) as db:
            current=service.store.get(actor,'channel',row['id'],db)
            if current.get('last_scan_at',0)>time.time()-290: continue
            current['last_scan_at']=int(time.time())
            service.store.save(actor,current,db)
        try:
            await service.sync(actor,row['id'],row['template_id']);scanned+=1
        except HTTPException: errors+=1
    return {'scanned':scanned,'errors':errors}

async def consume(service, actor):
    if not service.options.posting_enabled: return {'disabled':True}
    sent=0;blocked=0
    candidates=[r for r in service.store.rows(actor,'queue') if r.get('status')=='approved' and r.get('account_id') and r.get('approved_by')]
    for row in sorted(candidates,key=lambda r:r.get('created_at',0))[:100]:
        try:
            await service.send(actor,row['id'],row['account_id']);sent+=1
        except HTTPException: blocked+=1
        # A tenant's interval quota permits at most one attempt per tick.
        if sent: break
    return {'attempted':sent,'blocked':blocked}

def register_yt(celery, service_factory, tenants):
    def tick(kind, tenant_id=None):
        if tenant_id is None:
            selected=list(tenants())
            if len(selected)>100: raise RuntimeError('YT dispatcher capacity exceeded')
            task=monitor_task if kind=='monitor' else consume_task
            for tenant in selected:
                task.apply_async(kwargs={'tenant_id':str(tenant)},queue='yt')
            return {'scheduled':len(selected)}
        import uuid
        actor=Actor(str(uuid.UUID(tenant_id)),'scheduler','operator')
        service=service_factory()
        try:
            return asyncio.run((monitor if kind=='monitor' else consume)(service,actor))
        finally: service.store.close()
    @celery.task(name='app.tasks.yt.monitor',soft_time_limit=90,time_limit=110,acks_late=False,queue='yt')
    def monitor_task(tenant_id=None): return tick('monitor',tenant_id)
    @celery.task(name='app.tasks.yt.consume',soft_time_limit=90,time_limit=110,acks_late=False,queue='yt')
    def consume_task(tenant_id=None): return tick('consume',tenant_id)
    # Exact YT routes precede any existing broad app.tasks.* route.
    previous = celery.conf.task_routes or {}
    if not isinstance(previous, dict):
        raise RuntimeError('Review non-mapping Celery routes before YT registration')
    celery.conf.task_routes = {
        'app.tasks.yt.monitor': {'queue': 'yt'},
        'app.tasks.yt.consume': {'queue': 'yt'},
        **{key: value for key, value in previous.items()
           if key not in {'app.tasks.yt.monitor', 'app.tasks.yt.consume', 'app.tasks.yt.*'}},
    }
    schedule=dict(celery.conf.beat_schedule or {})
    schedule.update({'yt-monitor':{'task':'app.tasks.yt.monitor','schedule':300.0,'options':{'queue':'yt'}},'yt-approved':{'task':'app.tasks.yt.consume','schedule':300.0,'options':{'queue':'yt'}}})
    celery.conf.beat_schedule=schedule
    return monitor_task,consume_task
