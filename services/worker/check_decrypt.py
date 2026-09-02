from cryptography.fernet import Fernet
import asyncpg, asyncio, os

KEY = os.getenv("ENCRYPTION_KEY", "")
if not KEY:
    print("NO ENCRYPTION_KEY!")
    exit(1)

f = Fernet(KEY.encode())
print(f"Key: {KEY[:10]}...")

async def main():
    db_url = os.getenv("DATABASE_URL", "postgresql://app_user:B6XRri3ev458GMUPyfOk@postgres:5434/app_db")
    conn = await asyncpg.connect(db_url)
    row = await conn.fetchrow("SELECT session_data FROM account_sessions LIMIT 1")
    if not row:
        print("NO SESSIONS FOUND")
        return
    encrypted = row["session_data"]
    print(f"Encrypted length: {len(encrypted)}")
    try:
        decrypted = f.decrypt(encrypted.encode()).decode()
        print(f"Decrypted length: {len(decrypted)}")
        print(f"First 100 chars: {decrypted[:100]}")
        if decrypted.startswith("1:") or len(decrypted) > 50:
            print("LOOKS VALID")
        else:
            print("SUSPICIOUS")
    except Exception as e:
        print(f"DECRYPT ERROR: {e}")
        print(f"Raw (first 80): {encrypted[:80]}")
    await conn.close()

asyncio.run(main())
