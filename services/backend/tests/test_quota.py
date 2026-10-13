"""Quota module — P1-1 guard: shared Redis client, no per-call pools."""
from app import quota


def test_get_redis_singleton():
    # ponytail: from_url doesn't connect — no infra needed for this assert
    assert quota._get_redis() is quota._get_redis()
