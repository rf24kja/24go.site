"""FastAPI application — LeadGen Control Plane v0.3.3."""
import asyncio
import hmac
import logging
import os
import time
import uuid
from collections import deque

import sentry_sdk
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt

from app.config import settings
from app.logging_config import setup_logging
from app.middleware import TenantRLSMiddleware
from app.rate_limiter import RateLimitMiddleware
from app.routers import auth, tenants, targets, accounts, campaigns, leads, tasks, billing, analytics, listeners, audit, campaign_analytics, scoring, system, groups, notifications, tenant_settings, blog, group_search, auto_replies, balance, proxies, tools, mailings, metrics, phone_parser, contacts

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    traces_sample_rate=0.1,
    environment=os.environ.get("APP_ENV", "production"),
)

# ── Startup guard ─────────────────────────────────────────────────────
if not settings.JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required. Refusing to start without it.")

setup_logging()

_is_production = os.getenv("ENVIRONMENT", "production").lower() == "production" and not os.getenv("DEBUG", "")
_app_start_time = time.time()

app = FastAPI(
    title="LeadGen Control Plane",
    description="Multi-tenant B2B SaaS platform for automated lead generation in Telegram/VK social networks.",
    version="0.3.3",
    redirect_slashes=False,
    docs_url="/docs" if not _is_production else None,
    redoc_url="/redoc" if not _is_production else None,
    openapi_tags=[
        {"name": "auth", "description": "User registration, login, JWT tokens"},
        {"name": "leads", "description": "Lead capture, qualification, status management, CSV import/export"},
        {"name": "campaigns", "description": "Campaign CRUD, scheduling (timezone-aware cron), posting, analytics"},
        {"name": "targets", "description": "Target channels/groups discovery, comment scraping"},
        {"name": "groups", "description": "Public group monitoring — auto-discover, start/stop scanning for buying signals"},
        {"name": "accounts", "description": "Telegram/VK account management, connect/disconnect, warmup status"},
        {"name": "analytics", "description": "Time-series charts, funnel, geo/source breakdown, leaderboard"},
        {"name": "billing", "description": "Subscription plans, quota enforcement, usage tracking"},
        {"name": "listeners", "description": "Real-time DM listener, group scanner status and control"},
        {"name": "notifications", "description": "SMTP test, notification channel status"},
        {"name": "audit", "description": "Audit log — who changed what and when"},
        {"name": "system", "description": "Health check, system info, demo data, backup"},
    ],
)

# ── Structured logging ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","name":"%(name)s","message":"%(message)s"}',
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("leadgen")


# ── Request ID middleware ─────────────────────────────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    start = time.time()
    response = await call_next(request)
    elapsed_ms = round((time.time() - start) * 1000, 1)
    response.headers["X-Request-ID"] = request_id
    log.info(f"{request.method} {request.url.path} → {response.status_code} ({elapsed_ms}ms) req={request_id}")
    return response

# ── Middleware ──────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "https://24go.site",
    "https://www.24go.site",
    "https://app.24go.site",
]
if not _is_production:
    ALLOWED_ORIGINS.extend([
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
    ])
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
app.add_middleware(TenantRLSMiddleware)
app.add_middleware(RateLimitMiddleware)


# ── Security Headers ─────────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if _is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response


# ── WebSocket Hub ──────────────────────────────────────────────────────
# ponytail: simple in-memory pub/sub, one process only. Add Redis pub/sub if multi-worker.


class ConnectionManager:
    """Manages WebSocket connections per tenant."""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, tenant_id: str, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(tenant_id, []).append(ws)

    def disconnect(self, tenant_id: str, ws: WebSocket):
        conns = self._connections.get(tenant_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, tenant_id: str, event: dict):
        dead = []
        for ws in self._connections.get(tenant_id, []):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(tenant_id, ws)

    def active_tenants(self) -> int:
        return sum(1 for v in self._connections.values() if v)


ws_manager = ConnectionManager()


def _decode_ws_token(token: str) -> dict | None:
    """Validate JWT and return payload, or None if invalid."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], audience="24go")
    except JWTError:
        return None


@app.websocket("/ws/{tenant_id}")
async def websocket_endpoint(websocket: WebSocket, tenant_id: str):
    """Authenticated WebSocket — tenant_id must match JWT claim."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    payload = _decode_ws_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return
    # Enforce tenant isolation: JWT tenant_id must match URL
    jwt_tenant = payload.get("tenant_id")
    if str(jwt_tenant) != str(tenant_id):
        await websocket.close(code=4003, reason="Tenant mismatch")
        return
    await ws_manager.connect(tenant_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(tenant_id, websocket)


# ── Broadcast helper (call from workers/tasks) ────────────────────────
_event_queue: asyncio.Queue | None = None


def get_event_queue() -> asyncio.Queue:
    global _event_queue
    if _event_queue is None:
        _event_queue = asyncio.Queue()
    return _event_queue


async def _event_processor():
    """Background task that broadcasts queued events to connected clients."""
    queue = get_event_queue()
    while True:
        tenant_id, event = await queue.get()
        await ws_manager.broadcast(tenant_id, event)


@app.on_event("startup")
async def start_event_processor():
    asyncio.create_task(_event_processor())
    # Init tables
    from app.audit import init_audit_table
    from app.scoring import init_scoring_rules
    from app.db_pool import get_pool
    try:
        url = settings.DATABASE_URL.replace("+asyncpg", "")
        await init_audit_table(url)
        await init_scoring_rules(url)
        await get_pool()  # warm up connection pool
    except Exception as e:
        logging.getLogger(__name__).warning(f"Init skipped: {e}")


@app.on_event("shutdown")
async def shutdown_pool():
    from app.db_pool import close_pool
    await close_pool()


@app.post("/internal/broadcast")
async def broadcast_event(
    tenant_id: str,
    event: dict,
    x_internal_key: str = Header(default=""),
):
    """Internal endpoint for workers — requires X-Internal-Key header."""
    if not settings.INTERNAL_API_KEY or not hmac.compare_digest(x_internal_key, settings.INTERNAL_API_KEY):
        raise HTTPException(403, "Invalid internal key")
    queue = get_event_queue()
    await queue.put((tenant_id, event))
    return {"queued": True}


# ── Polling fallback (for Vercel — no WebSocket support) ──────────────
# ponytail: in-memory ring buffer per tenant, last 50 events. Upgrade to Redis if multi-worker.
_event_buffer: dict[str, deque] = {}
_BUFFER_TTL = 300  # 5 minutes


@app.get("/api/v1/events/poll")
async def poll_events(
    since: float = 0,
    token: str = Query(...),
):
    """Authenticated long-poll — token required, tenant from JWT."""
    payload = _decode_ws_token(token)
    if not payload:
        raise HTTPException(401, "Invalid token")
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(401, "Token missing tenant_id")

    cutoff = time.time() - _BUFFER_TTL
    buf = _event_buffer.get(str(tenant_id), deque())
    events = [ev for ev in buf if ev.get("timestamp", 0) > since and ev.get("timestamp", 0) > cutoff]

    if events:
        return {"events": events}

    # Long-poll: wait up to 25s for new events
    for _ in range(50):
        await asyncio.sleep(0.5)
        buf = _event_buffer.get(str(tenant_id), deque())
        new_events = [ev for ev in buf if ev.get("timestamp", 0) > since and ev.get("timestamp", 0) > cutoff]
        if new_events:
            return {"events": new_events}

    return {"events": []}


# Patch broadcast to also write to buffer
_orig_broadcast = ConnectionManager.broadcast


async def _broadcast_with_buffer(self, tenant_id: str, event: dict):
    event_with_ts = {**event, "timestamp": time.time()}
    buf = _event_buffer.setdefault(tenant_id, deque(maxlen=50))
    buf.append(event_with_ts)
    cutoff = time.time() - _BUFFER_TTL
    while buf and buf[0].get("timestamp", 0) < cutoff:
        buf.popleft()
    await _orig_broadcast(self, tenant_id, event)


ConnectionManager.broadcast = _broadcast_with_buffer


# ── Routers ────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(tenants.router)
app.include_router(targets.router)
app.include_router(accounts.router)
app.include_router(campaigns.router)
app.include_router(leads.router)
app.include_router(tasks.router)
app.include_router(billing.router)
app.include_router(analytics.router)
app.include_router(listeners.router)
app.include_router(audit.router)
app.include_router(campaign_analytics.router)
app.include_router(scoring.router)
app.include_router(system.router)
app.include_router(groups.router)
app.include_router(notifications.router)
app.include_router(tenant_settings.router)
app.include_router(blog.router)
app.include_router(group_search.router)
app.include_router(auto_replies.router)
app.include_router(balance.router)

app.include_router(proxies.router)
app.include_router(tools.router)
app.include_router(mailings.router)
app.include_router(metrics.router)
app.include_router(phone_parser.router)
app.include_router(contacts.router)


@app.get("/health")
async def health():
    """Health check — returns status + dependency health."""
    import time as _time
    checks = {
        "status": "ok",
        "api_version": "1.0.0",
        "uptime_seconds": int(_time.time() - _app_start_time),
        "ws_connections": ws_manager.active_tenants(),
    }

    # DB check — reuse SQLAlchemy pool
    try:
        from app.database import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        checks["status"] = "degraded"

    # Redis check
    try:
        import redis.asyncio as _aioredis
        r = _aioredis.from_url(settings.REDIS_URL, socket_timeout=3)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"
        checks["status"] = "degraded"

    return checks
