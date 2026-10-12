"""Schema validation tests — pure, no DB.

Regression coverage for real production incidents:
- Ksenia case: 8-char password without uppercase must 422 (not silently pass).
- WaParseRequest caps (max 5 groups) enforced at the boundary.
- MAX webhook secret minimum length.
"""
import pytest
from pydantic import ValidationError

from app.schemas import (
    LoginRequest,
    RegisterRequest,
    WaParseRequest,
)


# ── Registration passwords ──────────────────────────────────────

def test_register_valid_password():
    r = RegisterRequest(email="a@b.co", password="TestPass123", company_name="Co")
    assert r.password == "TestPass123"


def test_register_ksenia_case_rejected():
    """8 chars but no uppercase/digit mix must fail (prod 422, Sep 2026)."""
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(email="k@yandex.ru", password="password", company="Co")
    assert "uppercase" in str(exc.value)


def test_register_no_lowercase_rejected():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.co", password="TESTPASS123", company="Co")


def test_register_no_digit_rejected():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.co", password="TestPassword", company="Co")


def test_register_too_short_rejected():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.co", password="Aa1", company="Co")


def test_register_bad_email_rejected():
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="TestPass123", company="Co")


def test_login_allows_any_password_shape():
    """Login must not re-validate strength (only register does)."""
    r = LoginRequest(email="a@b.co", password="whatever")
    assert r.password == "whatever"


# ── WhatsApp parse request ──────────────────────────────────────

def test_wa_parse_allows_up_to_5_links():
    import uuid
    r = WaParseRequest(account_id=uuid.uuid4(), group_links=["l1", "l2", "l3", "l4", "l5"])
    assert len(r.group_links) == 5


def test_wa_parse_rejects_6_links():
    import uuid
    with pytest.raises(ValidationError):
        WaParseRequest(account_id=uuid.uuid4(), group_links=["l"] * 6)


def test_wa_parse_rejects_6_ids():
    import uuid
    with pytest.raises(ValidationError):
        WaParseRequest(account_id=uuid.uuid4(), group_ids=["g"] * 6)


def test_wa_parse_leave_defaults_true():
    import uuid
    r = WaParseRequest(account_id=uuid.uuid4(), group_links=["l1"])
    assert r.leave is True


# ── MAX connect/subscribe ───────────────────────────────────────

def test_max_connect_rejects_short_token():
    from app.routers.max import MaxConnectRequest
    with pytest.raises(ValidationError):
        MaxConnectRequest(bot_token="short")
    ok = MaxConnectRequest(bot_token="a-valid-looking-token-12345")
    assert ok.bot_token.startswith("a-valid")


def test_max_subscribe_secret_min_length():
    from app.routers.max import MaxSubscribeRequest as Sub
    with pytest.raises(ValidationError):
        Sub(url="https://api.24go.site/api/v1/max/webhooks/x", secret="abc")
    ok = Sub(url="https://api.24go.site/api/v1/max/webhooks/x", secret="s" * 32)
    assert ok.secret == "s" * 32


def test_max_subscribe_secret_optional():
    from app.routers.max import MaxSubscribeRequest as Sub
    ok = Sub(url="https://api.24go.site/api/v1/max/webhooks/x")
    assert ok.secret is None
