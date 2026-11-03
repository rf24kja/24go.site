"""Explicit integration seam for the existing 24go.site FastAPI application.

Copy yt.py beside this module in a separately reviewed release. Caller supplies
an initialized Service; this function never reads env, creates a DB, starts a
worker, enables a network call, or changes the existing platform enum.
"""
from fastapi import Depends
from yt import Actor, create_router


def mount_yt(app, service):
    from app.security import get_current_user

    async def current_actor(user=Depends(get_current_user)):
        return Actor(tenant=str(user.tenant_id), user=str(user.id), role=user.role)

    app.include_router(create_router(service, current_actor))
