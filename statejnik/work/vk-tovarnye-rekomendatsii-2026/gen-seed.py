import json

ru = open('C:/Code/GeneratorAD/statejnik/work/vk-tovarnye-rekomendatsii-2026/final-ru.md', encoding='utf-8').read()
en = open('C:/Code/GeneratorAD/statejnik/work/vk-tovarnye-rekomendatsii-2026/final-en.md', encoding='utf-8').read()
assert '"""' not in ru and '"""' not in en

seed = '''"""Seed: vk-tovarnye-rekomendatsii-2026 (statejnik run 2026-10-07).
docker cp /tmp/seed-blog-7.py generator-ad-fastapi-1:/tmp/seed-blog-7.py
docker compose exec -T fastapi python /tmp/seed-blog-7.py
"""
import asyncio
import asyncpg
import json

DB = "postgresql://app_user:B6XRri3ev458GMUPyfOk@postgres:5432/app_db"
TENANT = "98893daf-6cce-4a24-9b1a-495dcd23e8a4"

RU = """''' + ru + '''"""

EN = """''' + en + '''"""

POST = {
    "slug": "vk-tovarnye-rekomendatsii-2026",
    "title_ru": "Лента VK оценивает, купишь ли ты: разбираем товарные рекомендации",
    "title_en": "VK Ranks Products by Purchase Intent: What Sellers Should Do",
    "excerpt_ru": "Лента VK ранжирует товары по намерению купить: механика контура, цифры года шопсов с Ozon и что делать продавцу.",
    "excerpt_en": "VK feed ranks products by purchase intent: how the track works, a year of Ozon shops in numbers, and what sellers should do.",
    "meta_ru": "Товарный контур ленты VK: как модель оценивает намерение купить, цифры года шопсов (9,5 млн заказов) и практические шаги для продавцов.",
    "meta_en": "VK product recommendations track: purchase-intent ranking, Ozon shops year figures (9.5M orders), practical steps for sellers.",
    "tags": ["vkontakte", "lead-generation", "ecommerce", "adblogger"],
}


async def main():
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute(
            """
            INSERT INTO blog_posts
              (tenant_id, slug, title_en, title_ru, content_en, content_ru,
               excerpt_en, excerpt_ru, meta_description_en, meta_description_ru,
               tags, published, og_image_url)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,TRUE,'')
            ON CONFLICT (tenant_id, slug) DO UPDATE SET
              title_en=EXCLUDED.title_en, title_ru=EXCLUDED.title_ru,
              content_en=EXCLUDED.content_en, content_ru=EXCLUDED.content_ru,
              excerpt_en=EXCLUDED.excerpt_en, excerpt_ru=EXCLUDED.excerpt_ru,
              meta_description_en=EXCLUDED.meta_description_en,
              meta_description_ru=EXCLUDED.meta_description_ru,
              tags=EXCLUDED.tags, published=TRUE, updated_at=now()
            """,
            TENANT, POST["slug"], POST["title_en"], POST["title_ru"],
            EN, RU, POST["excerpt_en"], POST["excerpt_ru"],
            POST["meta_en"], POST["meta_ru"], json.dumps(POST["tags"]),
        )
        print("UPSERTED:", POST["slug"])
        n = await conn.fetchval(
            "SELECT count(*) FROM blog_posts WHERE tenant_id=$1 AND published=TRUE", TENANT
        )
        print("TOTAL PUBLISHED:", n)
    finally:
        await conn.close()


asyncio.run(main())
'''

open('C:/Code/GeneratorAD/scripts/seed-blog-7.py', 'w', encoding='utf-8').write(seed)
print('seed written, bytes:', len(seed))
