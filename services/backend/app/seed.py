"""Seed demo data for a tenant: targets, accounts, campaigns, leads.

Called after first registration or via POST /api/v1/system/seed-demo.
"""
import logging
import uuid
import random
from datetime import datetime, timedelta

import asyncpg

log = logging.getLogger(__name__)

TARGETS = [
    {"title": "Phuket Real Estate", "target_id_code": "phuket_realestate", "platform": "telegram", "geo": "Phuket", "niche": "real_estate", "access": "open_comments", "members": 5200},
    {"title": "Phuket Tours", "target_id_code": "phuket_tours", "platform": "telegram", "geo": "Phuket", "niche": "travel", "access": "open_comments", "members": 8100},
    {"title": "Thailand Property", "target_id_code": "thai_property", "platform": "telegram", "geo": "Bangkok", "niche": "real_estate", "access": "open_wall", "members": 12000},
    {"title": "Phuket Rentals", "target_id_code": "phuket_rentals", "platform": "telegram", "geo": "Phuket", "niche": "rentals", "access": "open_comments", "members": 3400},
]

ACCOUNTS = [
    {"identifier": "+66123456789"},
    {"identifier": "+66987654321"},
]

CAMPAIGNS = [
    {
        "name": "Phuket Villa Promo",
        "base_text": "Luxury villas in Phuket from $200K. {spintax_greeting} Interested in viewing?",
        "geos": ["Phuket"],
        "niches": ["real_estate"],
    },
    {
        "name": "Tour Packages",
        "base_text": "Exclusive tours to Phuket - {spintax_offer}! DM for details.",
        "geos": ["Phuket", "Bangkok"],
        "niches": ["travel"],
    },
]

LEAD_HANDLES = [
    ("@john_buyer", "John", "Хочу купить виллу в Пхукете, какая цена?", "HOT", "Phuket"),
    ("@maria_seeker", "Maria", "Интересует аренда квартиры на месяц", "WARM", "Phuket"),
    ("@peter_travel", "Peter", "Какие есть экскурсии на Новый год?", "WARM", "Bangkok"),
    ("@spam_bot_1", "", "FREE CRYPTO MONEY click here!!!", "SPAM", ""),
    ("@anna_villas", "Anna", "Расскажите подробнее о таунхаусах", "WARM", "Phuket"),
    ("@david_invest", "David", "Готов купить недвижимость, budget $500K", "HOT", "Phuket"),
    ("@olga_tour", "Olga", "Планирую отпуск в ноябре с детьми", "COLD", "Phuket"),
    ("@mike_property", "Mike", "Сколько стоит дом в Пхукете? Заказать проект", "HOT", "Phuket"),
    ("@spam2", "", "Casino win money free bonus", "SPAM", ""),
    ("@lucy_rent", "Lucy", "Ищу квартиру в аренду, 2 спальни", "WARM", "Bangkok"),
    ("@carlos_buy", "Carlos", "Quiero comprar una villa en Phuket, precio?", "HOT", "Phuket"),
    ("@sophie_info", "Sophie", "Подскажите какие есть варианты недвижимости", "WARM", "Phuket"),
]


async def seed_demo_data(url: str, tenant_id: str | uuid.UUID) -> dict:
    """Seed targets, accounts, campaigns, and leads for a new tenant."""
    tid = uuid.UUID(str(tenant_id))
    conn = await asyncpg.connect(url)
    try:
        count = await conn.fetchval("SELECT COUNT(*) FROM leads WHERE tenant_id = $1", tid)
        if count > 0:
            return {"status": "already_seeded", "leads": count}

        now = datetime.utcnow()
        result = {"targets": 0, "accounts": 0, "campaigns": 0, "leads": 0}

        # 1. Targets
        target_ids = []
        for t in TARGETS:
            tid_row = uuid.uuid4()
            await conn.execute(
                """INSERT INTO targets (id, tenant_id, platform, target_id_code, title, geo_tag, niche, access, members_count, engagement_rate, is_active)
                   VALUES ($1, $2, $3::platform_type, $4, $5, $6, $7, $8::access_level, $9, $10, true)""",
                tid_row, tid, t["platform"], t["target_id_code"], t["title"], t["geo"], t["niche"], t["access"], t["members"], round(random.uniform(1.0, 8.0), 2),
            )
            target_ids.append(tid_row)
            result["targets"] += 1

        # 2. Accounts
        for a in ACCOUNTS:
            aid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO account_pool (id, tenant_id, platform, account_identifier, session_data, device_fingerprint, status, daily_action_limit, warmup_stage)
                   VALUES ($1, $2, 'telegram'::platform_type, $3, '', '{}', 'active'::account_status, 20, 3)""",
                aid, tid, a["identifier"],
            )
            result["accounts"] += 1

        # 3. Campaigns
        for c in CAMPAIGNS:
            cid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO campaigns (id, tenant_id, name, base_text, target_geos, target_niches, is_active)
                   VALUES ($1, $2, $3, $4, $5, $6, true)""",
                cid, tid, c["name"], c["base_text"],
                c["geos"], c["niches"],
            )
            result["campaigns"] += 1

        # 4. Leads
        for handle, name, msg, intent, geo in LEAD_HANDLES:
            lid = uuid.uuid4()
            created = now - timedelta(hours=random.randint(0, 168))
            status = random.choice(["new", "new", "new", "in_progress", "converted"]) if intent != "SPAM" else "rejected"

            await conn.execute(
                """INSERT INTO leads (id, tenant_id, platform, user_handle, user_full_name, geo_tag, message_text, intent_score, status, dialog_url, created_at)
                   VALUES ($1, $2, 'telegram'::platform_type, $3, $4, $5, $6, $7::lead_intent_level, $8::lead_status, $9, $10)""",
                lid, tid, handle, name, geo, msg, intent, status,
                f"https://t.me/{handle.lstrip('@')}", created,
            )
            result["leads"] += 1

        log.info(f"Seeded demo data for tenant {tenant_id}: {result}")
        return {"status": "seeded", **result}
    finally:
        await conn.close()
