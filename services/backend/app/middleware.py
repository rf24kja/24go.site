"""Middleware to set PostgreSQL RLS tenant context per request."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from jose import JWTError, jwt

from app.config import settings


class TenantRLSMiddleware(BaseHTTPMiddleware):
    """Extract tenant_id from JWT and set on request.state for RLS."""

    async def dispatch(self, request: Request, call_next):
        tenant_id = None

        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                payload = jwt.decode(
                    token,
                    settings.JWT_SECRET,
                    algorithms=[settings.JWT_ALGORITHM],
                    audience="24go",
                )
                tenant_id = payload.get("tenant_id")
            except JWTError:
                pass

        request.state.tenant_id = tenant_id

        response = await call_next(request)
        return response
