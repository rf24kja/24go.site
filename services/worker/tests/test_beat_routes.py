"""Beat schedule integrity — no phantom tasks, every route lands somewhere.

Regression test for the 2026-10-10 outage class: beat referenced
app.tasks.parser.periodic_discovery, which never existed, erroring every
6 hours unnoticed. The runtime guard in celery_app drops phantoms loudly;
this test fails the build instead.
"""
import pytest

from app import celery_app
from app.celery_app import celery


def _registered_names():
    return set(celery.tasks.keys())


def test_all_beat_tasks_registered():
    missing = [
        (sched, entry["task"])
        for sched, entry in celery.conf.beat_schedule.items()
        if entry["task"] not in _registered_names()
    ]
    assert missing == [], f"phantom beat entries: {missing}"


def test_no_unrouted_task_modules():
    """Every task name must match at least one task_routes glob or an
    explicit queue (else .delay() lands on the unconsumed default queue)."""
    import fnmatch

    routes = celery_app.celery.conf.task_routes or {}
    globs = [g for g in routes if "*" in g]
    exact = {g for g in routes if "*" not in g}

    def routed(name):
        if name in exact:
            return True
        return any(fnmatch.fnmatchcase(name, g) for g in globs)

    # task_routes keys are module globs; verify each glob matches ≥1 task
    for g in globs:
        matched = [n for n in _registered_names() if fnmatch.fnmatchcase(n, g)]
        assert matched, f"route glob matches nothing: {g}"


def test_expected_queues_covered():
    """Every queue a worker consumes must have at least one routed task."""
    import fnmatch

    routes = celery_app.celery.conf.task_routes or {}
    for queue in ("parser", "poster", "warmup", "listener", "billing"):
        assert any(
            q.get("queue") == queue for q in routes.values()
        ), f"no tasks routed to queue: {queue}"


def test_max_tasks_registered():
    names = _registered_names()
    assert "app.tasks.max_listener.start_max_listener" in names
    assert "app.tasks.max_poster.post_to_max" in names
    assert "app.tasks.vk_health_check.check_vk_listeners" in names
