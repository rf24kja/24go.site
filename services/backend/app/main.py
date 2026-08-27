import asyncio
import logging
import time
from collections import deque

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.middleware import TenantRLSMiddleware
from app.rate_limiter import RateLimitMiddleware
from app.routers import auth, tenants, targets, accounts, campaigns, leads, tasks, billing, analytics, listeners, audit, campaign_analytics, scoring, system

app = FastAPI(title="LeadGen Control Plane", version="0.3.0")

# ── Middleware ──────────────────────────────────────────────────────────
import os
ALLOWED_ORIGINS = [
    "http://localhost:3000",  # local dev
    "http://localhost:8080",  # docker dashboard
    "https://24go.site",
    "https://www.24go.site",
    "https://app.24go.site",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantRLSMiddleware)
app.add_middleware(RateLimitMiddleware)

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


@app.websocket("/ws/{tenant_id}")
async def websocket_endpoint(websocket: WebSocket, tenant_id: str):
    await ws_manager.connect(tenant_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Client can send ping, ignore for now
    except WebSocketDisconnect:
        ws_manager.disconnect(tenant_id, websocket)


# ── Broadcast helper (call from workers/tasks) ────────────────────────

import asyncio
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
    # Init audit table
    from app.config import settings
    from app.audit import init_audit_table
    from app.scoring import init_scoring_rules
    try:
        url = settings.DATABASE_URL.replace("+asyncpg", "")
        await init_audit_table(url)
        await init_scoring_rules(url)
    except Exception as e:
        logging.getLogger(__name__).warning(f"Init skipped: {e}")


@app.post("/internal/broadcast")
async def broadcast_event(tenant_id: str, event: dict):
    """Internal endpoint for workers to broadcast events via HTTP (no auth)."""
    queue = get_event_queue()
    await queue.put((tenant_id, event))
    return {"queued": True}


# ── Polling fallback (for Vercel — no WebSocket support) ──────────────
# ponytail: in-memory ring buffer per tenant, last 50 events. Upgrade to Redis if multi-worker.
_event_buffer: dict[str, deque] = {}
_BUFFER_TTL = 300  # 5 minutes


@app.get("/api/v1/events/poll")
async def poll_events(tenant_id: str, since: float = 0):
    """Long-poll endpoint for Vercel clients without WebSocket.

    Returns events newer than `since` (unix timestamp).
    If no events, holds connection for up to 25s then returns empty.
    """
    cutoff = time.time() - _BUFFER_TTL
    events = []

    # Check buffer for events since cutoff
    buf = _event_buffer.get(tenant_id, deque())
    for ev in buf:
        if ev.get("timestamp", 0) > since and ev.get("timestamp", 0) > cutoff:
            events.append(ev)

    if events:
        return {"events": events}

    # Long-poll: wait up to 25s for new events
    for _ in range(50):  # 50 * 0.5s = 25s
        await asyncio.sleep(0.5)
        buf = _event_buffer.get(tenant_id, deque())
        new_events = [ev for ev in buf if ev.get("timestamp", 0) > since and ev.get("timestamp", 0) > cutoff]
        if new_events:
            return {"events": new_events}

    return {"events": []}


# Patch broadcast to also write to buffer
_orig_broadcast = ConnectionManager.broadcast


async def _broadcast_with_buffer(self, tenant_id: str, event: dict):
    # Add timestamp
    event_with_ts = {**event, "timestamp": time.time()}
    # Write to ring buffer
    buf = _event_buffer.setdefault(tenant_id, deque(maxlen=50))
    buf.append(event_with_ts)
    # Prune old entries
    cutoff = time.time() - _BUFFER_TTL
    while buf and buf[0].get("timestamp", 0) < cutoff:
        buf.popleft()
    # Original broadcast
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


@app.get("/health")
async def health():
    return {"status": "ok", "ws_connections": ws_manager.active_tenants()}
