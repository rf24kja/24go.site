"""Scheduler platform guard: TG dispatches, WA/MAX skip (no posters for them).

Regression test: scheduler used to build t.me links for WA/MAX targets
and fire them through the TG poster. Now it skips with a debug log.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import app.tasks.campaign_scheduler as sched


def _campaign(cid, platform):
    return {
        "id": cid, "tenant_id": "t1", "base_text": "hi",
        "platform": platform, "target_geos": [], "target_niches": [],
        "schedule_cron": "* * * * *", "posts_per_day": 5,
        "timezone": "UTC", "last_posted_at": None,
        "ab_enabled": False, "ab_variants": [],
    }


def _target(tid, platform):
    return {"id": tid, "target_id_code": "chan1", "title": "T",
            "platform": platform}


def test_wa_max_skipped_tg_dispatched():
    campaigns = [_campaign("c-tg", "telegram"),
                 _campaign("c-wa", "whatsapp"),
                 _campaign("c-max", "max")]
    fetchrows = [_target("t-tg", "telegram"), {"id": "a1", "account_identifier": "@a"},
                 _target("t-wa", "whatsapp"), _target("t-max", "max")]

    fake_redis = AsyncMock()
    fake_redis.exists.return_value = False

    with patch.object(sched, "fetch", new=AsyncMock(return_value=campaigns)), \
         patch.object(sched, "fetchval", new=AsyncMock(return_value=0)), \
         patch.object(sched, "fetchrow", new=AsyncMock(side_effect=fetchrows)), \
         patch.object(sched, "execute", new=AsyncMock()), \
         patch.object(sched, "get_redis", new=AsyncMock(return_value=fake_redis)), \
         patch("app.tenant_settings.get_tenant_settings_from_db",
               new=AsyncMock(return_value={"posting": {}})), \
         patch("asyncio.sleep", new=AsyncMock()), \
         patch.object(sched.celery, "send_task") as send_task:
        result = asyncio.run(sched._run())

    assert result["dispatched"] == ["c-tg"]
    assert send_task.call_count == 1
    args, kwargs = send_task.call_args
    assert args[0] == "app.tasks.poster.publish_post"
