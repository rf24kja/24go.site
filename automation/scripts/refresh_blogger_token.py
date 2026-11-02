#!/usr/bin/env python3
"""Refresh Blogger access_token using refresh_token.
Runs via cron every 15m. Falls back to existing GOOGLE_ACCESS_TOKEN
if refresh fails (token may be issued by a different OAuth client).

Saves refreshed BLOGGER_ACCESS_TOKEN to .env.
"""
import os, json, time, urllib.request, urllib.parse, urllib.error

ENV_PATH = os.path.expanduser("~/.hermes/.env")

def load_env(path=ENV_PATH):
    env = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env

def save_env(updates, path=ENV_PATH):
    """Update .env in-place."""
    lines = []
    if os.path.exists(path):
        with open(path) as f:
            lines = f.readlines()
    existing = set()
    new_lines = []
    for line in lines:
        s = line.strip()
        if s and "=" in s and not s.startswith("#"):
            k = s.partition("=")[0].strip()
            if k in updates:
                existing.add(k)
                new_lines.append(f"{k}={updates[k]}\n")
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    for k, v in updates.items():
        if k not in existing:
            new_lines.append(f"{k}={v}\n")
    with open(path, "w") as f:
        f.writelines(new_lines)

def is_token_valid(access_token):
    """Check Blogger authorization without placing a bearer secret in a URL."""
    if not access_token:
        return False
    req = urllib.request.Request(
        "https://www.googleapis.com/blogger/v3/users/self/blogs",
        headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            info = json.loads(resp.read().decode())
            return isinstance(info, dict) and info.get("kind") == "blogger#blogList"
    except Exception:
        return False

class BloggerRefreshError(RuntimeError):
    def __init__(self, code, status=None):
        self.code = code
        self.status = status
        super().__init__(f"{status or 'no_http'} {code}")


def try_refresh(refresh_token, client_id, client_secret):
    """Return a refreshed token, or raise a sanitized transport/OAuth failure."""
    if not all([refresh_token, client_id, client_secret]):
        return None
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=data, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            tokens = json.loads(resp.read().decode())
        token = tokens.get("access_token")
        if not isinstance(token, str) or not token:
            raise BloggerRefreshError("invalid_response")
        return token
    except urllib.error.HTTPError as exc:
        code = "oauth_error"
        try:
            body = json.loads(exc.read(4096))
            reported = body.get("error") if isinstance(body, dict) else None
            if reported in {"invalid_client", "unauthorized_client", "invalid_grant", "access_denied", "server_error", "temporarily_unavailable"}:
                code = reported
        except (ValueError, TypeError):
            pass
        finally:
            exc.close()
        raise BloggerRefreshError(code, exc.code) from None
    except (OSError, TimeoutError):
        raise BloggerRefreshError("network_error") from None
    except (ValueError, TypeError, AttributeError):
        raise BloggerRefreshError("invalid_response") from None

def main():
    env = load_env()
    refresh = env.get("BLOGGER_REFRESH_TOKEN") or env.get("GOOGLE_REFRESH_TOKEN")
    cid = env.get("BLOGGER_CLIENT_ID") or env.get("GOOGLE_CLIENT_ID")
    csec = env.get("BLOGGER_CLIENT_SECRET") or env.get("GOOGLE_CLIENT_SECRET")
    current_access = env.get("BLOGGER_ACCESS_TOKEN") or env.get("GOOGLE_ACCESS_TOKEN")
    blog_id = env.get("BLOGGER_BLOG_ID", "")

    if not cid or not csec:
        print("❌ BLOGGER_CLIENT_ID/SECRET не заданы")
        return 1

    # Check if current token is still valid
    if current_access and is_token_valid(current_access):
        print(f"✅ access_token валиден (blog_id={blog_id})")
        return 0

    # Token is expired or missing — try refresh
    print("Blogger access не подтверждён; выполняется штатный refresh...")
    try:
        new_token = try_refresh(refresh, cid, csec)
    except BloggerRefreshError as exc:
        print(f"Refresh Blogger не выполнен: {exc}")
        if exc.code in {"invalid_client", "unauthorized_client", "invalid_grant", "access_denied"}:
            print("Требуется проверка OAuth-настройки и согласия пользователя; безопасный helper: blogger_authorize_loopback.py")
        else:
            print("Доставка не подтверждена; временная или неклассифицированная ошибка, без немедленного повтора")
        return 1
    if new_token:
        save_env({
            "BLOGGER_ACCESS_TOKEN": new_token,
            "BLOGGER_CLIENT_ID": cid,
            "BLOGGER_CLIENT_SECRET": csec,
            "BLOGGER_REFRESH_TOKEN": refresh,
        })
        print(f"✅ Новый access_token сохранён (len={len(new_token)})")
        # Also verify blog_id
        if not blog_id:
            req = urllib.request.Request(
                "https://www.googleapis.com/blogger/v3/blogs/byurl?url=https://dev24pro.blogspot.com",
                headers={"Authorization": f"Bearer {new_token}"})
            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    info = json.loads(resp.read().decode())
                    save_env({"BLOGGER_BLOG_ID": info.get("id", "")})
                    print(f"✅ blog_id={info.get('id')}")
            except Exception as e:
                print(f"⚠️  Не удалось определить blog_id: {e}")
        return 0
    else:
        print("Refresh Blogger заблокирован: отсутствуют необходимые refresh credentials")
        return 1

if __name__ == "__main__":
    # Log to file
    import sys
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    result = main()
    with open(os.path.expanduser("~/.hermes/cache/monitoring/blogger_refresh.log"), "a") as f:
        f.write(f"[{ts}] exit={result}\n")
    sys.exit(result)
