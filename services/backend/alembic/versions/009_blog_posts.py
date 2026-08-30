"""add blog_posts table

Revision ID: 009
Revises: 008
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "009"
down_revision = "008_leads_unique_handle"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "blog_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("title_ru", sa.String(500), nullable=False, server_default=""),
        sa.Column("title_en", sa.String(500), nullable=False, server_default=""),
        sa.Column("content_ru", sa.Text, nullable=False, server_default=""),
        sa.Column("content_en", sa.Text, nullable=False, server_default=""),
        sa.Column("excerpt_ru", sa.String(1000), nullable=False, server_default=""),
        sa.Column("excerpt_en", sa.String(1000), nullable=False, server_default=""),
        sa.Column("tags", JSONB, nullable=False, server_default="[]"),
        sa.Column("published", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("meta_description_ru", sa.String(300), nullable=False, server_default=""),
        sa.Column("meta_description_en", sa.String(300), nullable=False, server_default=""),
        sa.Column("og_image_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_unique_constraint("uq_blog_posts_tenant_slug", "blog_posts", ["tenant_id", "slug"])

def downgrade() -> None:
    op.drop_table("blog_posts")
