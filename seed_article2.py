#!/usr/bin/env python3
"""Seed article 2 - Python tutorial."""
import asyncio
import asyncpg

DATABASE_URL = "postgresql://app_user:B6XRri3ev458GMUPyfOk@postgres:5432/app_db"
TENANT = "98893daf-6cce-4a24-9b1a-495dcd23e8a4"
SLUG = "kak-sozdat-bot-dlya-lidogeneratsii-v-telegram"

TITLE_EN = "How to Build a Telegram Lead Generation Bot in Python: Complete Tutorial 2026"
TITLE_RU = "Как создать бота для генерации лидов в Telegram: полный туториал на Python 2026"

META_EN = "Complete Python tutorial to build a Telegram lead generation bot with AI classification, auto-reply, and dashboard. 18000+ words, full source code included."
META_RU = "Полный туториал на Python для создания бота генерации лидов в Telegram с ИИ-классификацией, автоответами и дашбордом. 18000+ слов, полный исходный код."

EXCERPT_EN = "Build a fully functional Telegram lead generation system in Python. Complete tutorial covering scraping, AI classification, auto-reply, dashboard, and deployment. Total cost: $5-15/month."
EXCERPT_RU = "Постройте полнофункциональную систему генерации лидов в Telegram на Python. Полный туториал по парсингу, ИИ-классификации, автоответам, дашборду и деплою. Стоимость: $5-15/мес."

TAGS = '["telegram bot", "python tutorial", "lead generation", "AI", "Telethon", "OpenAI", "FastAPI", "PostgreSQL", "automation", "tutorial 2026"]'

# Read content from files
import os
base = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(base, "article2_en.txt"), "r", encoding="utf-8") as f:
    CONTENT_EN = f.read()
with open(os.path.join(base, "article2_ru.txt"), "r", encoding="utf-8") as f:
    CONTENT_RU = f.read()

async def seed():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(f"SET LOCAL app.current_tenant = '{TENANT}'")
        
        existing = await conn.fetchval(
            "SELECT id FROM blog_posts WHERE slug = $1 AND tenant_id = $2",
            SLUG, TENANT
        )
        
        if existing:
            await conn.execute("""
                UPDATE blog_posts SET
                    title_en = $1, title_ru = $2,
                    content_en = $3, content_ru = $4,
                    excerpt_en = $5, excerpt_ru = $6,
                    meta_description_en = $7, meta_description_ru = $8,
                    tags = $9::jsonb, published = true, updated_at = NOW()
                WHERE slug = $10 AND tenant_id = $11
            """, TITLE_EN, TITLE_RU, CONTENT_EN, CONTENT_RU,
                EXCERPT_EN, EXCERPT_RU, META_EN, META_RU,
                TAGS, SLUG, TENANT)
            print(f"Updated: {SLUG}")
        else:
            await conn.execute("""
                INSERT INTO blog_posts (tenant_id, slug, title_en, title_ru,
                    content_en, content_ru, excerpt_en, excerpt_ru,
                    meta_description_en, meta_description_ru,
                    tags, published, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, true, NOW(), NOW())
            """, TENANT, SLUG, TITLE_EN, TITLE_RU,
                CONTENT_EN, CONTENT_RU, EXCERPT_EN, EXCERPT_RU,
                META_EN, META_RU, TAGS)
            print(f"Inserted: {SLUG}")
        
        row = await conn.fetchrow(
            "SELECT LENGTH(content_en) as len_en, LENGTH(content_ru) as len_ru FROM blog_posts WHERE slug = $1 AND tenant_id = $2",
            SLUG, TENANT
        )
        print(f"  EN: {row['len_en']} chars, RU: {row['len_ru']} chars")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
