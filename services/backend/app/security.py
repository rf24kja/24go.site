"""JWT token creation, password hashing, and auth dependencies."""
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import ApiKey, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now, "aud": "24go"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], audience="24go")
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exc
    return user


async def get_current_user_or_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """JWT (dashboard users) or X-API-Key (bot/service integrations).

    ponytail: keys are tenant-scoped bearer secrets with the same power as
    the creator's JWT — but only endpoints that explicitly opt into this dep
    accept them. Everything else stays JWT-only.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            payload = jwt.decode(auth[7:], settings.JWT_SECRET,
                                 algorithms=[settings.JWT_ALGORITHM], audience="24go")
            user_id = payload.get("sub")
            if user_id:
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if user is not None:
                    return user
        except JWTError:
            pass
        raise unauthorized

    raw_key = request.headers.get("x-api-key")
    if raw_key:
        rows = (await db.execute(
            select(ApiKey).where(ApiKey.is_active.is_(True))
        )).scalars().all()
        # ponytail: salt is per-key, so no single-hash lookup — compare_digest
        # over active keys (100k pbkdf2 rounds each; key counts stay tiny)
        for k in rows:
            try:
                salt_hex, expected = k.key_hash.split(":")
            except ValueError:
                continue
            cand = hashlib.pbkdf2_hmac(
                "sha256", raw_key.encode(), bytes.fromhex(salt_hex), 100_000
            ).hex()
            if hmac.compare_digest(cand, expected):
                result = await db.execute(select(User).where(User.id == k.user_id))
                user = result.scalar_one_or_none()
                if user is None:
                    break
                await db.execute(
                    update(ApiKey).where(ApiKey.id == k.id)
                    .values(last_used_at=datetime.now(timezone.utc))
                )
                await db.commit()
                return user
        raise unauthorized

    raise unauthorized
