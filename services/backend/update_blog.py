"""Update 10 blog posts with expanded 1500-2500 word content (RU+EN).
Usage: docker exec fastapi python /app/update_blog.py
"""
import asyncio
import os
from datetime import datetime

import asyncpg

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://app_user:B6XRri3ev458GMUPyfOk@postgres:5432/leadgen",
).replace("+asyncpg", "")

# Articles 1-5 content stored in separate module
from blog_content_part1 import ARTICLES_PART1
from blog_content_part2 import ARTICLES_PART2

ALL_ARTICLES = {**ARTICLES_PART1, **ARTICLES_PART2}


async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        tenant_id = await conn.fetchval("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
        if not tenant_id:
            print("ERROR: No tenants found.")
            return
        print(f"Using tenant: {tenant_id}")
        updated = 0
        for slug, f in ALL_ARTICLES.items():
            exists = await conn.fetchval(
                "SELECT id FROM blog_posts WHERE tenant_id=$1 AND slug=$2",
                tenant_id, slug)
            if not exists:
                print(f"SKIP: {slug}")
                continue
            await conn.execute(
                """UPDATE blog_posts SET
                   content_ru=$3, content_en=$4,
                   excerpt_ru=$5, excerpt_en=$6,
                   meta_description_ru=$7, meta_description_en=$8,
                   created_at=$9::timestamptz, updated_at=now()
                   WHERE tenant_id=$1 AND slug=$2""",
                tenant_id, slug, f["cr"], f["ce"], f["er"], f["ee"],
                f["mr"], f["me"], datetime.fromisoformat(f["ca"]))
            updated += 1
            print(f"OK: {slug}")
        print(f"\nDone. Updated {updated} posts.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
