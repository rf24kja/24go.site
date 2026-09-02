"""Pydantic schemas for request/response validation."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ── Auth ───────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    tenant_id: UUID
    role: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    tenant_id: UUID
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ── Tenant ─────────────────────────────────────────────────────────────
class TenantCreate(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)


class TenantResponse(BaseModel):
    id: UUID
    company_name: str
    plan: str
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ── Target ─────────────────────────────────────────────────────────────
class TargetCreate(BaseModel):
    platform: str
    target_id_code: str
    title: str
    geo_tag: str
    niche: str
    access: str


class TargetResponse(BaseModel):
    id: UUID
    platform: str
    target_id_code: str
    title: str
    geo_tag: str
    niche: str
    access: str
    members_count: int
    engagement_rate: float = 0.0
    is_active: bool
    last_parsed_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ── Account Pool ───────────────────────────────────────────────────────
class AccountCreate(BaseModel):
    platform: str
    account_identifier: str
    session_data: str = ""
    device_fingerprint: dict = {}


class AccountResponse(BaseModel):
    id: UUID
    platform: str
    account_identifier: str
    status: str
    warmup_stage: int
    daily_action_limit: int
    actions_today: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ── Campaign ───────────────────────────────────────────────────────────
class CampaignCreate(BaseModel):
    name: str
    base_text: str
    target_geos: list[str]
    target_niches: list[str]
    media_urls: list[str] = []
    schedule_cron: str | None = None  # e.g. "0 9,15 * * *"
    posts_per_day: int = 1
    timezone: str = "UTC"
    ab_enabled: bool = False
    ab_variants: list[dict] = []


class CampaignResponse(BaseModel):
    id: UUID
    name: str
    base_text: str
    target_geos: list
    target_niches: list
    is_active: bool
    schedule_cron: str | None = None
    posts_per_day: int = 1
    timezone: str = "UTC"
    last_posted_at: datetime | None = None
    ab_enabled: bool = False
    ab_variants: list = []
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ── Lead ───────────────────────────────────────────────────────────────
class LeadResponse(BaseModel):
    id: UUID
    platform: str
    user_handle: str
    user_full_name: str | None
    geo_tag: str | None
    message_text: str
    intent_score: str
    status: str
    dialog_url: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ── Mailing ────────────────────────────────────────────────────────
class MailingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    message_text: str = Field(..., min_length=1, max_length=5000)
    platform: str = Field(..., pattern="^(telegram|vkontakte)$")
    delay_seconds: int = Field(default=30, ge=5, le=300)


class MailingResponse(BaseModel):
    id: UUID
    name: str
    message_text: str
    platform: str
    status: str
    total_count: int
    sent_count: int
    failed_count: int
    delay_seconds: int
    created_at: datetime | None = None
    started_at: datetime | None = None

    class Config:
        from_attributes = True


class MailingRecipientResponse(BaseModel):
    id: UUID
    username: str
    first_name: str | None
    status: str
    error_message: str | None
    sent_at: datetime | None = None

    class Config:
        from_attributes = True


class MailingImportRequest(BaseModel):
    file: str = Field(..., description="CSV content (username, first_name optional)")
