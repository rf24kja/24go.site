"""SQLAlchemy models mirroring ARCHITECTURE.md DDL exactly."""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey, Index, Integer, BigInteger,
    Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


# ── Enums ──────────────────────────────────────────────────────────────
class TenantPlanType(str, enum.Enum):
    trial = "trial"
    starter = "starter"
    pro = "pro"
    enterprise = "enterprise"


class PlatformType(str, enum.Enum):
    telegram = "telegram"
    vkontakte = "vkontakte"
    forum = "forum"


class AccessLevel(str, enum.Enum):
    open_wall = "open_wall"
    open_comments = "open_comments"
    suggested_news = "suggested_news"
    admin_dm_only = "admin_dm_only"


class AccountStatus(str, enum.Enum):
    warming_up = "warming_up"
    active = "active"
    cooldown = "cooldown"
    banned = "banned"
    paused = "paused"


class LeadIntentLevel(str, enum.Enum):
    HOT = "HOT"
    WARM = "WARM"
    COLD = "COLD"
    SPAM = "SPAM"


class LeadStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    converted = "converted"
    rejected = "rejected"


# ── Models ─────────────────────────────────────────────────────────────
class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(255), nullable=False)
    plan = Column(Enum(TenantPlanType, name="tenant_plan_type"), nullable=False, default=TenantPlanType.trial)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    proxies = relationship("Proxy", back_populates="tenant", cascade="all, delete-orphan")
    targets = relationship("Target", back_populates="tenant", cascade="all, delete-orphan")
    account_pool = relationship("AccountPool", back_populates="tenant", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="tenant", cascade="all, delete-orphan")
    posting_logs = relationship("PostingLog", back_populates="tenant", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="tenant", cascade="all, delete-orphan")
    daily_analytics = relationship("DailyAnalytic", back_populates="tenant", cascade="all, delete-orphan")
    monitored_groups = relationship("MonitoredGroup", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(550), nullable=False)
    role = Column(String(50), nullable=False, default="operator")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tenant = relationship("Tenant", back_populates="users")


class Proxy(Base):
    __tablename__ = "proxies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    proxy_url = Column(String(550), nullable=False)
    rotation_api_url = Column(String(550))
    geo_location = Column(String(100))
    is_active = Column(Boolean, default=True)
    last_rotated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tenant = relationship("Tenant", back_populates="proxies")


class Target(Base):
    __tablename__ = "targets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    platform = Column(Enum(PlatformType, name="platform_type"), nullable=False)
    target_id_code = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    geo_tag = Column(String(100), nullable=False)
    niche = Column(String(100), nullable=False)
    access = Column(Enum(AccessLevel, name="access_level"), nullable=False)
    members_count = Column(Integer, default=0)
    engagement_rate = Column(Numeric(5, 2), default=0.0)
    is_active = Column(Boolean, default=True)
    last_parsed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", "platform", "target_id_code", name="unique_tenant_target"),
        Index("idx_targets_tenant_geo", "tenant_id", "geo_tag", "is_active"),
    )

    tenant = relationship("Tenant", back_populates="targets")
    posting_logs = relationship("PostingLog", back_populates="target")
    leads = relationship("Lead", back_populates="target")


class AccountPool(Base):
    __tablename__ = "account_pool"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    platform = Column(Enum(PlatformType, name="platform_type"), nullable=False)
    account_identifier = Column(String(255), nullable=False)
    session_data = Column(Text, nullable=False)
    device_fingerprint = Column(JSONB, nullable=False)
    proxy_id = Column(UUID(as_uuid=True), ForeignKey("proxies.id", ondelete="SET NULL"))
    status = Column(Enum(AccountStatus, name="account_status"), nullable=False, default=AccountStatus.warming_up)
    warmup_stage = Column(Integer, default=1)
    daily_action_limit = Column(Integer, nullable=False, default=15)
    actions_today = Column(Integer, nullable=False, default=0)
    cooldown_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_account_pool_status", "tenant_id", "status", "actions_today"),
    )

    tenant = relationship("Tenant", back_populates="account_pool")
    posting_logs = relationship("PostingLog", back_populates="account")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    base_text = Column(Text, nullable=False)
    target_geos = Column(JSONB, nullable=False)
    target_niches = Column(JSONB, nullable=False)
    media_urls = Column(JSONB, default=list)
    is_active = Column(Boolean, default=True)
    schedule_cron = Column(String(100), nullable=True)  # e.g. "0 9,15 * * *" (9am and 3pm daily)
    posts_per_day = Column(Integer, default=1)
    timezone = Column(String(50), default="UTC")
    last_posted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tenant = relationship("Tenant", back_populates="campaigns")
    posting_logs = relationship("PostingLog", back_populates="campaign")


class PostingLog(Base):
    __tablename__ = "posting_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"))
    target_id = Column(UUID(as_uuid=True), ForeignKey("targets.id", ondelete="CASCADE"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("account_pool.id", ondelete="SET NULL"))
    rendered_text = Column(Text, nullable=False)
    utm_url = Column(String(700), nullable=False)
    status = Column(String(50), nullable=False)
    message_id = Column(String(255))
    error_trace = Column(Text)
    executed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_posting_logs_tenant", "tenant_id", "executed_at"),
    )

    tenant = relationship("Tenant", back_populates="posting_logs")
    campaign = relationship("Campaign", back_populates="posting_logs")
    target = relationship("Target", back_populates="posting_logs")
    account = relationship("AccountPool", back_populates="posting_logs")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    platform = Column(Enum(PlatformType, name="platform_type"), nullable=False)
    target_id = Column(UUID(as_uuid=True), ForeignKey("targets.id", ondelete="SET NULL"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("account_pool.id", ondelete="SET NULL"))
    user_handle = Column(String(255), nullable=False)
    user_full_name = Column(String(255))
    geo_tag = Column(String(100))
    message_text = Column(Text, nullable=False)
    intent_score = Column(Enum(LeadIntentLevel, name="lead_intent_level"), nullable=False, default=LeadIntentLevel.WARM)
    status = Column(Enum(LeadStatus, name="lead_status"), nullable=False, default=LeadStatus.new)
    source = Column(String(50), nullable=False, default="dm")  # dm, comment, group, manual, import, webhook
    post_id = Column(String(255), nullable=True)  # TG message_id or VK post_id that generated this lead
    dialog_url = Column(String(550), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_leads_tenant_status", "tenant_id", "status", "intent_score"),
    )

    tenant = relationship("Tenant", back_populates="leads")
    target = relationship("Target", back_populates="leads")


class DailyAnalytic(Base):
    __tablename__ = "daily_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    total_parsed_targets = Column(Integer, default=0)
    total_posts_published = Column(Integer, default=0)
    total_clicks = Column(Integer, default=0)
    total_leads_captured = Column(Integer, default=0)
    total_hot_leads = Column(Integer, default=0)
    llm_tokens_spent = Column(Integer, default=0)
    proxy_bytes_used = Column(BigInteger, default=0)

    __table_args__ = (
        UniqueConstraint("tenant_id", "date", name="unique_tenant_daily"),
        Index("idx_daily_analytics_lookup", "tenant_id", "date"),
    )

    tenant = relationship("Tenant", back_populates="daily_analytics")


class MonitoredGroup(Base):
    __tablename__ = "monitored_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("account_pool.id", ondelete="SET NULL"), nullable=True)
    platform = Column(String(50), nullable=False)  # 'telegram' | 'vkontakte'
    group_identifier = Column(String(255), nullable=False)  # '@username' or 'vk_id:12345'
    title = Column(String(255), nullable=True)
    members_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    status = Column(String(50), default="idle")  # 'idle' | 'scanning' | 'error'
    last_scan_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", "platform", "group_identifier", name="uq_tenant_platform_group"),
        Index("idx_monitored_groups_tenant", "tenant_id", "is_active"),
    )

    tenant = relationship("Tenant", back_populates="monitored_groups")
    account = relationship("AccountPool")


class TenantSettings(Base):
    """Per-tenant configuration overrides. JSONB blob with sensible defaults in code.

    Sections: llm, warmup, posting, notifications, groups, scoring
    """
    __tablename__ = "tenant_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    settings = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=datetime.utcnow)

    tenant = relationship("Tenant")
