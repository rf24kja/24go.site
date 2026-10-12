"""SQLAlchemy models for billing tables (from BILLING_AND_LIMITS.md)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import Base
from app.models import TenantPlanType


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    plan = Column(Enum(TenantPlanType, name="tenant_plan_type", create_type=False), nullable=False, default="trial")
    status = Column(String(50), nullable=False, default="active")
    current_period_start = Column(DateTime(timezone=True), nullable=False)
    current_period_end = Column(DateTime(timezone=True), nullable=False)
    monthly_posts_limit = Column(Integer, nullable=False, default=500)
    monthly_posts_used = Column(Integer, nullable=False, default=0)
    token_credits_balance = Column(Integer, nullable=False, default=200000)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", name="unique_tenant_subscription"),
        Index("idx_subscriptions_lookup", "tenant_id", "status"),
    )


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    service_type = Column(String(50), nullable=False)
    quantity_used = Column(Integer, nullable=False)
    estimated_cost_usd = Column(Numeric(10, 6), nullable=False)
    meta_info = Column("metadata", JSONB, default={})
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_usage_logs_tenant_date", "tenant_id", "created_at"),
    )


class BillingTransaction(Base):
    __tablename__ = "billing_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    amount_usd = Column(Numeric(10, 2), nullable=False)
    payment_provider = Column(String(50), nullable=False)
    provider_transaction_id = Column(String(255), unique=True, nullable=False)
    status = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
