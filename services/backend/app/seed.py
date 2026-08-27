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
    {"name": "Phuket Real Estate", "group_url": "https://t.me/+phuket_realestate", "platform": "telegram", "geo": "Phuket"},
    {"name": "Phuket Tours", "group_url": "https://t.me/+phuket_tours", "platform": "telegram", "geo": "Phuket"},
    {"name": "Thailand Property", "group_url": "https://t.me/+thai_property", "platform": "telegram", "geo": "Bangkok"},
    {"name": "Phuket Rentals", "group_url": "https://t.me/+phuket_rentals", "platform": "telegram", "geo": "Phuket"},
]

ACCOUNTS = [
    {"phone": "+66123456789", "username": "agent_anna"},
    {"phone": "+66987654321", "username": "agent_mike"},
]

CAMPAIGNS = [
    {
        "name": "Phuket Villa Promo",
        "description": "Promote luxury villas to Phuket buyers",
        "template": "🏠 Luxury villas in Phuket from $200K. {spintax_greeting} Interested in viewing?",
        "schedule_cron": "0 10,14,18 * * *",
        "posts_per_day": 3,
    },
    {
        "name": "Tour Packages",
        "description": "Monthly tour packages promotion",
        "template": "🌴 Exclusive tours to Phuket — {spintax_offer}! DM for details.",
        "schedule_cron": "0 9,17 * * *",
        "posts_per_day": 2,
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
        # Check if already seeded
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
                """INSERT INTO targets (id, tenant_id, name, group_url, platform, geo_tag, is_active)
                   VALUES ($1, $2, $3, $4, $5, $6, true)""",
                tid_row, tid, t["name"], t["group_url"], t["platform"], t["geo"],
            )
            target_ids.append(tid_row)
            result["targets"] += 1

        # 2. Accounts
        account_ids = []
        for a in ACCOUNTS:
            aid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO account_pool (id, tenant_id, phone_number, username, status, daily_action_limit, warmup_stage)
                   VALUES ($1, $2, $3, $4, 'active', 20, 3)""",
                aid, tid, a["phone"], a["username"],
            )
            account_ids.append(aid)
            result["accounts"] += 1

        # 3. Campaigns
        campaign_ids = []
        for c in CAMPAIGNS:
            cid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO campaigns (id, tenant_id, name, description, template, schedule_cron, posts_per_day, is_active)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, true)""",
                cid, tid, c["name"], c["description"], c["template"], c["schedule_cron"], c["posts_per_day"],
            )
            campaign_ids.append(cid)
            result["campaigns"] += 1

        # 4. Leads (spread over last 7 days)
        for i, (handle, name, msg, intent, geo) in enumerate(LEAD_HANDLES):
            lid = uuid.uuid4()
            created = now - timedelta(hours=random.randint(0, 168))
            status = random.choice(["new", "new", "new", "in_progress", "converted"]) if intent != "SPAM" else "rejected"
            target = random.choice(target_ids) if target_ids else None
            account = random.choice(account_ids) if account_ids else None

            await conn.execute(
                """INSERT INTO leads (id, tenant_id, platform, target_id, account_id, user_handle,
                   user_full_name, geo_tag, message_text, intent_score, status, dialog_url, created_at)
                   VALUES ($1, $2, 'telegram', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)""",
                lid, tid, target, account, handle, name, geo, msg, intent, status,
                f"https://t.me/{handle.lstrip('@')}", created,
            )
            result["leads"] += 1

        log.info(f"Seeded demo data for tenant {tenant_id}: {result}")
        return {"status": "seeded", **result}
    finally:
        await conn.close()
