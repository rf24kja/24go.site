"""Auth endpoints: register, login, me, user management, password recovery."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from app.config import settings

# Simple in-memory rate limiter
_rate_limits: dict[str, list[datetime]] = defaultdict(list)

def _check_rate_limit(key: str, max_requests: int = 5, window_seconds: int = 60) -> bool:
    """Returns True if request is allowed."""
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=window_seconds)
    _rate_limits[key] = [t for t in _rate_limits[key] if t > cutoff]
    if len(_rate_limits[key]) >= max_requests:
        return False
    _rate_limits[key].append(now)
    return True
from app.audit import log_event
from app.database import get_db
from app.models import User, Tenant
from app.billing_models import Subscription
from app.security import hash_password, verify_password, create_access_token, get_current_user
from app.schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Rate limit: 5 registrations per minute per IP
    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(f"register:{ip}", max_requests=5, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Try again later.")

    # Check unique email
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create tenant
    tenant = Tenant(company_name=body.company_name)
    db.add(tenant)
    await db.flush()

    # Create user (owner)
    user = User(
        tenant_id=tenant.id,
        email=body.email,
        password_hash=hash_password(body.password),
        role="owner",
    )
    db.add(user)

    # Create default subscription (trial — 14 days, 100 posts, 100k tokens)
    now = datetime.now(timezone.utc)
    sub = Subscription(
        tenant_id=tenant.id,
        plan="trial",
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=14),
        monthly_posts_limit=100,
        token_credits_balance=100_000,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(user)
    await db.refresh(tenant)

    token = create_access_token({
        "sub": str(user.id),
        "tenant_id": str(tenant.id),
        "role": user.role,
    })
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        tenant_id=tenant.id,
        role=user.role,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Rate limit: 10 login attempts per minute per IP
    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(f"login:{ip}", max_requests=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Fetch tenant_id (already on user)
    token = create_access_token({
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role,
    })
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=user.role,
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


# ── User Management ────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    role: str = Field(default="member", pattern="^(admin|member|viewer)$")


class UpdateRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(admin|member|viewer)$")


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all users in the tenant."""
    result = await db.execute(
        select(User).where(User.tenant_id == current_user.tenant_id).order_by(User.created_at)
    )
    return result.scalars().all()


@router.post("/invite", response_model=UserResponse, status_code=201)
async def invite_user(
    body: InviteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite a new user to the tenant (creates with temporary password)."""
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Only owners and admins can invite users")

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    # Create user with temporary password (must change on first login)
    import secrets
    temp_password = secrets.token_urlsafe(12) + "!"  # e.g. "xK9mN2pL!"
    user = User(
        tenant_id=current_user.tenant_id,
        email=body.email,
        password_hash=hash_password(temp_password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="created", entity_type="user",
        entity_id=user.id, new_value={"email": body.email, "role": body.role},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )

    # ponytail: in prod, send email with temp_password. For now, return it.
    return user


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    body: UpdateRoleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a user's role (owner/admin only)."""
    import uuid
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Only owners and admins can change roles")
    if str(current_user.id) == user_id:
        raise HTTPException(400, "Cannot change your own role")

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.tenant_id == current_user.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    old_role = user.role
    user.role = body.role
    await db.commit()

    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="updated", entity_type="user",
        entity_id=user.id, old_value={"role": old_role}, new_value={"role": body.role},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return {"status": "ok"}


@router.delete("/users/{user_id}", status_code=204)
async def remove_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a user from the tenant (owner/admin only)."""
    import uuid
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Only owners and admins can remove users")
    if str(current_user.id) == user_id:
        raise HTTPException(400, "Cannot remove yourself")

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.tenant_id == current_user.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    await db.delete(user)
    await db.commit()

    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="deleted", entity_type="user",
        entity_id=uuid.UUID(user_id), user_id=current_user.id,
        ip_address=request.client.host if request else None,
    )


# ── Tenant Settings ────────────────────────────────────────────────────

class UpdateTenantRequest(BaseModel):
    company_name: str | None = None


@router.patch("/tenant")
async def update_tenant(
    body: UpdateTenantRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update tenant settings (owner only)."""
    if current_user.role != "owner":
        raise HTTPException(403, "Only the owner can update tenant settings")

    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    old_name = tenant.company_name
    if body.company_name is not None:
        tenant.company_name = body.company_name
    await db.commit()

    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="updated", entity_type="tenant",
        entity_id=tenant.id, old_value={"company_name": old_name},
        new_value={"company_name": tenant.company_name},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return {"status": "ok"}


# ── Password Change ────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=8)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password."""
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(400, "Current password is incorrect")

    current_user.password_hash = hash_password(body.new_password)
    await db.commit()

    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="updated", entity_type="user",
        entity_id=current_user.id, new_value={"action": "password_changed"},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return {"status": "ok"}


# ── Password Recovery ────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=8)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send a password reset email. Always returns 200 to prevent email enumeration."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user:
        reset_token = jwt.encode(
            {
                "sub": str(user.id),
                "type": "password_reset",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )

        reset_link = f"https://www.24go.site/reset-password?token={reset_token}"
        body_text = (
            f"Hi,\n\n"
            f"Click the link below to reset your password:\n\n"
            f"{reset_link}\n\n"
            f"This link expires in 1 hour.\n"
            f"If you didn't request this, you can safely ignore this email.\n"
        )

        try:
            msg = MIMEMultipart()
            msg["From"] = settings.FROM_EMAIL
            msg["To"] = body.email
            msg["Subject"] = "Reset your password — 24GO"
            msg.attach(MIMEText(body_text, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
                server.sendmail(settings.FROM_EMAIL, body.email, msg.as_string())
        except Exception:
            # ponytail: swallow email errors, don't leak info
            pass

    return {"message": "If that email is registered, you'll receive a reset link shortly."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using a valid token."""
    try:
        payload = jwt.decode(body.token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.password_hash = hash_password(body.new_password)
    await db.commit()

    return {"message": "Password updated successfully. You can now log in."}
