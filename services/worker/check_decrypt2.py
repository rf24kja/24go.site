import hashlib, base64, os

KEY = os.getenv("ENCRYPTION_KEY", "")
print(f"Key: {KEY[:10]}...")

# Check if decrypt function works by trying manually
encrypted = "gAAAAABqlBEna8-YD7L4zsCGWgEIEqOozzR4gPE3NbT7-ahmRU1T5GMv4rxSlh1HNGkctY-xKpiuInFHtThM6JITW7Mux7jHxcUF"

# The issue: worker container might not have cryptography installed
# Check what's available
import importlib
mods = ["cryptography", "fernet", "crypto"]
for m in mods:
    try:
        importlib.import_module(m)
        print(f"  Module '{m}': AVAILABLE")
    except ImportError:
        print(f"  Module '{m}': MISSING")

# Try via the app's own crypto module
try:
    import sys
    sys.path.insert(0, "/app")
    from app.crypto import decrypt as app_decrypt
    result = app_decrypt(encrypted)
    print(f"App decrypt: length={len(result)}, first100={result[:100]}")
except Exception as e:
    print(f"App decrypt error: {e}")
