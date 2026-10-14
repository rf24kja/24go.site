"""Service overlays: workers read their platform's view, base untouched."""
from app.tenant_settings import _apply_service_overlay, _deep_merge, DEFAULTS


def _merged(service=None):
    raw = {
        "warmup": {"daily_limit": 5, "enabled": True},
        "services": {
            "telegram": {"warmup": {"daily_limit": 10}},
            "vkontakte": {"warmup": {"daily_limit": 20}},
        },
    }
    base = {"warmup": dict(DEFAULTS["warmup"])}
    return _apply_service_overlay(_deep_merge(base, raw), raw, service)


def test_overlay_applies_per_service():
    assert _merged("telegram")["warmup"]["daily_limit"] == 10
    assert _merged("vkontakte")["warmup"]["daily_limit"] == 20


def test_base_unchanged_without_service():
    assert _merged()["warmup"]["daily_limit"] == 5
    assert _merged("whatsapp")["warmup"]["daily_limit"] == 5  # no overlay


def test_overlay_keeps_other_base_keys():
    assert _merged("telegram")["warmup"]["enabled"] is True
