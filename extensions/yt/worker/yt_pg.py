"""PostgreSQL repository over the application's SQLAlchemy configuration.

No schema creation on import/startup. Sync domain API is bridged onto one private
async loop, with NullPool connections (never shares a request's event-loop pool).
Transactions serialize per tenant, including quota checks and durable send claims.
"""
import asyncio
import json
import re
import threading
import uuid
from contextlib import contextmanager
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

class Result:
    def __init__(self, rows): self.rows = rows
    def fetchone(self): return self.rows[0] if self.rows else None
    def __iter__(self): return iter(self.rows)

class Row:
    def __init__(self, row): self.row = row
    def __getitem__(self, key): return self.row[key] if isinstance(key, int) else self.row._mapping[key]

class Connection:
    def __init__(self, store, connection): self.store, self.connection = store, connection
    def execute(self, sql, values=()):
        sql = re.sub(r'\bobjects\b', 'yt_objects', sql)
        sql = re.sub(r'\boauth\b', 'yt_oauth', sql)
        sql = sql.replace('ORDER BY rowid DESC', 'ORDER BY created_at DESC, id DESC')
        pieces = sql.split('?')
        if len(pieces)-1 != len(values): raise ValueError('Invalid SQL binding')
        query = ''.join(p + (f':p{i}' if i<len(values) else '') for i,p in enumerate(pieces))
        async def execute():
            result = await self.connection.execute(text(query), {f'p{i}':v for i,v in enumerate(values)})
            return Result([Row(r) for r in result.fetchall()] if result.returns_rows else [])
        return self.store.run(execute())

class PgStore:
    storage = 'postgresql-tenant-owned'
    def __init__(self, database_url):
        if not database_url.startswith('postgresql+asyncpg://'): raise ValueError('PostgreSQL asyncpg required')
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, daemon=True)
        self.thread.start()
        self.engine = create_async_engine(database_url, poolclass=NullPool, connect_args={'timeout':10,'command_timeout':20})
    def run(self, coroutine):
        future=asyncio.run_coroutine_threadsafe(coroutine, self.loop)
        try:return future.result(timeout=30)
        except TimeoutError:
            future.cancel()
            raise
    def close(self):
        self.run(self.engine.dispose()); self.loop.call_soon_threadsafe(self.loop.stop); self.thread.join(timeout=5)
    @contextmanager
    def tx(self, actor):
        tenant = str(uuid.UUID(actor.tenant))
        async def begin():
            conn = await self.engine.connect()
            try:
                await conn.begin()
                await conn.execute(text("SET LOCAL lock_timeout = '5s'"))
                await conn.execute(text("SELECT set_config('app.current_tenant', :tenant, true)"), {'tenant':tenant})
                await conn.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:tenant, 0))'), {'tenant':tenant})
                return conn
            except BaseException:
                await conn.close()
                raise
        conn = self.run(begin())
        try:
            yield Connection(self, conn)
            self.run(conn.commit())
        except BaseException:
            self.run(conn.rollback()); raise
        finally: self.run(conn.close())
    def rows(self, actor, kind):
        with self.tx(actor) as db:
            return [json.loads(r['body']) for r in db.execute('SELECT body FROM objects WHERE tenant=? AND kind=? ORDER BY rowid DESC LIMIT 500',(actor.tenant,kind))]
    def get(self, actor, kind, ident, db=None):
        if db is None:
            with self.tx(actor) as conn: return self.get(actor,kind,ident,conn)
        row=db.execute('SELECT body FROM objects WHERE tenant=? AND kind=? AND id=?',(actor.tenant,kind,ident)).fetchone()
        if not row: raise HTTPException(404,'YT resource not found')
        return json.loads(row['body'])
    def put(self, actor, kind, key, body):
        with self.tx(actor) as db:
            row=db.execute('SELECT body FROM objects WHERE tenant=? AND kind=? AND key=?',(actor.tenant,kind,key)).fetchone()
            if row:return json.loads(row['body'])
            body=dict(body,id=str(uuid.uuid4()))
            db.execute('INSERT INTO objects(id,tenant,kind,key,body) VALUES(?,?,?,?,?)',(body['id'],actor.tenant,kind,key,json.dumps(body)))
            return body
    def save(self, actor, body, db):
        db.execute('UPDATE objects SET body=? WHERE tenant=? AND id=?',(json.dumps(body),actor.tenant,body['id']))
