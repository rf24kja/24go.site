"""Blog API — admin CRUD + public read."""
import json
import re
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.security import get_current_user
from app.models import BlogPost, User

router = APIRouter(prefix="/api/v1/blog", tags=["blog"])


# ── Schemas ──────────────────────────────────────────────────────────────

class BlogPostCreate(BaseModel):
    slug: str
    title_ru: str = ""
    title_en: str = ""
    content_ru: str = ""
    content_en: str = ""
    excerpt_ru: str = ""
    excerpt_en: str = ""
    tags: list[str] = []
    published: bool = False
    meta_description_ru: str = ""
    meta_description_en: str = ""
    og_image_url: str = ""


class BlogPostUpdate(BaseModel):
    slug: str | None = None
    title_ru: str | None = None
    title_en: str | None = None
    content_ru: str | None = None
    content_en: str | None = None
    excerpt_ru: str | None = None
    excerpt_en: str | None = None
    tags: list[str] | None = None
    published: bool | None = None
    meta_description_ru: str | None = None
    meta_description_en: str | None = None
    og_image_url: str | None = None


def _post_to_dict(post: BlogPost) -> dict:
    return {
        "id": str(post.id),
        "slug": post.slug,
        "title_ru": post.title_ru,
        "title_en": post.title_en,
        "content_ru": post.content_ru,
        "content_en": post.content_en,
        "excerpt_ru": post.excerpt_ru,
        "excerpt_en": post.excerpt_en,
        "tags": post.tags or [],
        "published": post.published,
        "meta_description_ru": post.meta_description_ru,
        "meta_description_en": post.meta_description_en,
        "og_image_url": post.og_image_url,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
    }


def _make_slug(title: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", title.lower())
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    return slug[:255]


# ── Admin endpoints (auth required) ──────────────────────────────────────

@router.get("/admin/list")
async def admin_list_posts(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(BlogPost).where(BlogPost.tenant_id == current_user.tenant_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(BlogPost.created_at.desc()).limit(limit).offset(offset))
    posts = result.scalars().all()
    return {"items": [_post_to_dict(p) for p in posts], "total": total}


@router.post("/admin", status_code=201)
async def admin_create_post(
    body: BlogPostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slug = body.slug or _make_slug(body.title_en or body.title_ru)
    existing = await db.execute(
        select(BlogPost).where(BlogPost.tenant_id == current_user.tenant_id, BlogPost.slug == slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Slug '{slug}' already exists")

    post = BlogPost(
        tenant_id=current_user.tenant_id,
        slug=slug,
        **body.model_dump(),
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _post_to_dict(post)


@router.put("/admin/{post_id}")
async def admin_update_post(
    post_id: UUID,
    body: BlogPostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost).where(BlogPost.id == post_id, BlogPost.tenant_id == current_user.tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(404, "Post not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(post, key, value)
    post.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(post)
    return _post_to_dict(post)


@router.delete("/admin/{post_id}")
async def admin_delete_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost).where(BlogPost.id == post_id, BlogPost.tenant_id == current_user.tenant_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(404, "Post not found")
    await db.delete(post)
    await db.commit()
    return {"status": "deleted"}


# ── Public endpoints (no auth) ───────────────────────────────────────────

@router.get("")
async def public_list_posts(
    locale: str = Query(default="en", pattern="^(ru|en)$"),
    tag: str | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Public blog listing — returns published posts only."""
    q = select(BlogPost).where(BlogPost.published == True)
    if tag:
        q = q.where(BlogPost.tags.op("@>")(json.dumps([tag])))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(BlogPost.created_at.desc()).limit(limit).offset(offset))
    posts = result.scalars().all()

    items = []
    for p in posts:
        items.append({
            "slug": p.slug,
            "title": p.title_ru if locale == "ru" else p.title_en,
            "excerpt": p.excerpt_ru if locale == "ru" else p.excerpt_en,
            "tags": p.tags or [],
            "og_image_url": p.og_image_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return {"items": items, "total": total}


@router.get("/{slug}")
async def public_get_post(
    slug: str,
    locale: str = Query(default="en", pattern="^(ru|en)$"),
    db: AsyncSession = Depends(get_db),
):
    """Public single post."""
    result = await db.execute(
        select(BlogPost).where(BlogPost.slug == slug, BlogPost.published == True)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(404, "Post not found")

    return {
        "slug": post.slug,
        "title": post.title_ru if locale == "ru" else post.title_en,
        "content": post.content_ru if locale == "ru" else post.content_en,
        "excerpt": post.excerpt_ru if locale == "ru" else post.excerpt_en,
        "tags": post.tags or [],
        "meta_description": post.meta_description_ru if locale == "ru" else post.meta_description_en,
        "og_image_url": post.og_image_url,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
    }
