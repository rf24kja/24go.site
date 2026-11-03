"""Composition for app.celery_app.celery (worker/Beat share this registration).
No default environment/secret loading, no independent Celery application.
"""
from sqlalchemy import text
from yt import Service, Options
from yt_pg import PgStore
from yt_tasks import register_yt

def create_worker(database_url=None, cipher=None, options=None):
    if database_url is None or cipher is None:
        if database_url is not None or cipher is not None:
            raise RuntimeError("Supply both database_url and cipher, or neither")
        from yt_runtime import load_runtime
        runtime = load_runtime()
        database_url, cipher, options = runtime.database_url, runtime.cipher, runtime.options
    from app.celery_app import celery
    configure_worker(celery,database_url,cipher,options)
    return celery

def configure_worker(celery, database_url, cipher, options=None):
    options=options or Options()
    def factory():return Service(PgStore(database_url),options,cipher)
    def tenants():
        if not (options.gate('monitoring') or options.posting_enabled):return []
        store=PgStore(database_url)
        async def select_tenants():
            async with store.engine.connect() as conn:
                result=await conn.execute(text('SELECT id FROM tenants ORDER BY id LIMIT 101'))
                rows=[str(r[0]) for r in result]
                if len(rows)>100:raise RuntimeError('YT scheduler tenant-page capacity exceeded; shard before enabling')
                return rows
        try:return store.run(select_tenants())
        finally:store.close()
    return register_yt(celery,factory,tenants)
