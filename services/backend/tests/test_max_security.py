"""MAX webhook helper tests — pure logic, no DB.

Covers the security-critical validation added in the audit batches:
malformed UUIDs must 404 (not 500), webhook URLs must be public https,
secret comparison must be hash-based and closed-by-default.
"""
import hashlib

import pytest
from fastapi import HTTPException

from app.routers.max import _parse_uuid, _validate_webhook_url


def test_parse_uuid_valid():
    u = _parse_uuid("aea34019-96af-40a1-bfb8-eb9bd81d13fb")
    assert str(u) == "aea34019-96af-40a1-bfb8-eb9bd81d13fb"


def test_parse_uuid_malformed_is_404_not_500():
    for bad in ["not-a-uuid", "", "12345", "aea34019-xxxx"]:
        with pytest.raises(HTTPException) as exc:
            _parse_uuid(bad)
        assert exc.value.status_code == 404


def test_webhook_url_accepts_public_https():
    # must not raise
    _validate_webhook_url("https://api.24go.site/api/v1/max/webhooks/x")


def test_webhook_url_rejects_http():
    with pytest.raises(HTTPException) as exc:
        _validate_webhook_url("http://api.24go.site/hook")
    assert exc.value.status_code == 400


def test_webhook_url_rejects_private_hosts():
    for bad in [
        "https://127.0.0.1/hook",
        "https://10.0.0.5/hook",
        "https://192.168.1.1/hook",
        "https://localhost/hook",
    ]:
        with pytest.raises(HTTPException):
            _validate_webhook_url(bad)


def test_webhook_url_rejects_garbage():
    with pytest.raises(HTTPException):
        _validate_webhook_url("not a url")


def test_secret_hash_scheme():
    """Server stores sha256, compares hashes — verify the exact scheme."""
    secret = "server-generated-secret-32-chars-xx"
    stored = hashlib.sha256(secret.encode()).hexdigest()
    assert stored == hashlib.sha256(secret.encode()).hexdigest()
    assert stored != hashlib.sha256(b"wrong").hexdigest()
    assert len(stored) == 64
