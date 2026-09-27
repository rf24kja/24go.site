"""Pydantic schemas for request/response validation."""
import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Auth ───────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    tenant_id: UUID
    role: str
    email_verified: bool = False


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    tenant_id: UUID
    email_verified: bool = False
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
    platform: str = Field(..., pattern="^(telegram|vkontakte)$")
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
    is_joined: bool = False
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
    description: str | None = None
    emoji: str | None = None
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
    description: str | None = None
    emoji: str | None = None
    base_text: str
    target_geos: list
    target_niches: list
    media_urls: list = []
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
    file: str = Field(..., description="Plain text: 1 username per line")


# ── Balance & Search ─────────────────────────────────────────────────

class BalanceResponse(BaseModel):
    balance_kopeks: int
    balance_rub: float  # convenience field
    total_spent_kopeks: int
    total_queries: int

    class Config:
        from_attributes = True


class TopUpRequest(BaseModel):
    amount_kopeks: int = Field(..., ge=50000, description="Минимум 50000 копеек (500₽)")  # min 500 RUB


class TopUpResponse(BaseModel):
    checkout_url: str
    session_id: str


class QueryLogResponse(BaseModel):
    id: UUID
    query: str
    query_type: str
    cost_kopeks: int
    results_count: int
    cache_hit: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SemanticQueryRequest(BaseModel):
    keyword: str = Field(..., min_length=3, description="Ключевое слово для расширения")
    country: str = Field(default="ru", description="Код страны (ru, th, en)")
    niche: str = Field(default="", description="Ниша (real_estate, tours)")


class SemanticQueryResponse(BaseModel):
    original: str
    expanded: list[str]  # 10-15 комбинаций
    country: str


class GroupSearchRequest(BaseModel):
    query: str = Field(..., min_length=3)
    country: str = Field(default="ru")
    language: str = Field(default="russian")
    peer_type: str = Field(default="all")  # channel, chat, all
    category: str = Field(default="")
    limit: int = Field(default=20, le=100)
    use_tgstat: bool = Field(default=False, description="Использовать TgStat API (платно)")


class GroupSearchResult(BaseModel):
    title: str
    username: str | None
    subscribers: int | None
    description: str | None
    peer_type: str | None  # channel or chat
    country: str | None
    language: str | None
    category: str | None


class GroupSearchResponse(BaseModel):
    query: str
    results: list[GroupSearchResult]
    total: int
    cost_kopeks: int
    cache_hit: bool
    query_type: str  # keyword, tgstat


# ── Auto-Replies ──────────────────────────────────────────────────────

class AutoReplyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    mode: str = Field(default="keyword", pattern="^(keyword|ai_agent|rotation)$")
    keywords: str = ""
    prompt: str = ""
    model: str = ""
    api_key: str = ""
    answers: list[str] = []


class AutoReplyUpdate(BaseModel):
    name: str | None = None
    mode: str | None = None
    keywords: str | None = None
    prompt: str | None = None
    model: str | None = None
    api_key: str | None = None
    is_active: bool | None = None


class AutoReplyAnswerCreate(BaseModel):
    text: str = Field(..., min_length=1)


# ── WhatsApp ──────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    phone: str = Field(..., min_length=5, max_length=20)
    name: str | None = None
    wa_id: str | None = None
    is_group: bool = False
    metadata_: dict = {}


class ContactResponse(BaseModel):
    id: UUID
    phone: str
    name: str | None = None
    wa_id: str | None = None
    is_group: bool
    metadata_: dict
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class ContactImportRequest(BaseModel):
    file: str = Field(..., description="CSV/JSON with phone, name columns")


class WaConnectRequest(BaseModel):
    phone_number: str = Field(..., min_length=5, max_length=20, description="E.164 format")
    method: str = Field(default="qr", pattern="^(qr|pairing-code|existing)$")


class WaAccountResponse(BaseModel):
    id: UUID
    phone_number: str
    wa_id: str | None = None
    status: str
    daily_action_limit: int
    actions_today: int
    cooldown_until: datetime | None = None
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class WaGroupResponse(BaseModel):
    id: UUID
    group_id: str
    name: str | None = None
    members_count: int
    is_active: bool
    last_scan_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class WaParseRequest(BaseModel):
    account_id: UUID
    group_links: list[str] = Field(default=[], max_length=5, description="Invite links (join-read-leave, higher risk)")
    group_ids: list[str] = Field(default=[], max_length=5, description="Already-joined group IDs (read-only, safest)")


class WaMessageSend(BaseModel):
    phone_number: str = Field(..., min_length=5, max_length=20)
    message: str = Field(..., min_length=1, max_length=5000)
    media_url: str | None = None
