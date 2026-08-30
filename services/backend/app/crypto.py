"""Fernet-based encryption for sensitive fields (session_data, etc.).

ponytail: Fernet from stdlib cryptography. Key from ENCRYPTION_KEY env var.
If no key set, encryption is a no-op (for dev). Production MUST set it.
"""
import base64
import hashlib
import logging
from app.config import settings

log = logging.getLogger(__name__)

_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet
    if not settings.ENCRYPTION_KEY:
        log.warning("ENCRYPTION_KEY not set — encryption disabled (dev mode only)")
        return None
    try:
        from cryptography.fernet import Fernet
        # Derive a valid Fernet key from the configured ENCRYPTION_KEY
        key = hashlib.sha256(settings.ENCRYPTION_KEY.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key)
        _fernet = Fernet(fernet_key)
        return _fernet
    except ImportError:
        log.warning("cryptography not installed — encryption disabled")
        return None


def is_encrypted() -> bool:
    """Return True if encryption is active (key is set and Fernet is available)."""
    return _get_fernet() is not None


def encrypt(plaintext: str) -> str:
    """Encrypt a string. Returns plaintext if encryption is unavailable."""
    f = _get_fernet()
    if f is None:
        return plaintext
    return f.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a string. Returns ciphertext if encryption is unavailable."""
    f = _get_fernet()
    if f is None:
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        # Already plaintext or corrupted
        return ciphertext
