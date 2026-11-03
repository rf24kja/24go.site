"""Full v52 app composition; caller supplies reviewed encryption/configuration.
Use a factory entrypoint, not a second FastAPI app or alternate JWT implementation.
"""
from yt import Service, Options
from yt_pg import PgStore
from yt_adapter import mount_yt

def create_application(cipher=None, options=None):
    database_url = None
    if cipher is None:
        from yt_runtime import load_runtime
        runtime = load_runtime()
        cipher, options, database_url = runtime.cipher, runtime.options, runtime.database_url
    from app.main import app
    from app.config import settings
    if getattr(app.state,'yt_service',None): raise RuntimeError('YT already registered')
    service=Service(PgStore(database_url or settings.DATABASE_URL), options or Options(), cipher)
    mount_yt(app,service)
    app.state.yt_service=service
    app.router.add_event_handler('shutdown',service.store.close)
    return app
