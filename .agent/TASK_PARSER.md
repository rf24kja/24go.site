.agent/TASK_PARSER.md
# Specification: Target Channel Discovery & Qualification Engine (v5.0 Enterprise SaaS)

## 1. System Role & Scope
The Discovery & Qualification Engine (`worker-parser`) is an asynchronous microservice responsible for automated targeting across VKontakte groups, Telegram channels/groups, and regional travel forums. It scans traffic hubs, calculates real engagement rates, validates posting permissions, tags geographic coordinates (Moscow, SPb, Kamchatka, Novosibirsk, Million-plus cities), and filters spam sources before saving validated targets into tenant databases.

---

## 2. Multi-Tenant Target Pipeline Topology


+-----------------------------------------------------------------------------------+ | Target Parsing Workflow (Per Tenant) | +-----------------------------------------------------------------------------------+ | +---------------------------------+---------------------------------+ | | v v +-------------------------------+ +-------------------------------+ | Telegram Telethon Scraper | | VKontakte API / Scraper | | (Search Global & Dialog Search)| | (groups.search & Wall Parse) | +---------------+---------------+ +---------------+---------------+ | | +---------------------------------+-----------------------+ | v +-----------------------------------+ | Target Qualification Engine | | - Engagement Rate (ER%) | | - Open Wall / Comment Validation | | - Anti-Spam / Anti-Bot Filter | +-----------------+-----------------+ | v +-----------------------------------+ | PostgreSQL Upsert (targets) | | (Scoped to tenant_id) | +-----------------------------------+
---

## 3. GEO Identification & Search Matrix

Target acquisition runs against a dynamic multi-variable matrix. Keywords are cross-matched with target geographic tags.

### A. Geographic Taxonomy (`geo_tag`)
- `Moscow`: Central Federal District hubs, regional travel groups, local chats.
- `SPb`: North-Western Federal District traffic hubs, local ex-pat communities.
- `Kamchatka`: Far East regional channels, Petropavlovsk-Kamchatsky local boards.
- `Novosibirsk`: Siberian regional travel groups, winter escape chats.
- `Millionaire_Cities`: Yekaterinburg, Kazan, Nizhny Novgorod, Chelyabinsk, Krasnoyarsk, Samara, Ufa, Rostov-on-Don.

### B. Search Taxonomy (`niche`)
- **Primary Keywords**: `"???????"`, `"??????"`, `"???? ? ???????"`, `"??????? ??????"`, `"???????????? ??????"`, `"????????? ??????"`, `"?????? ??????"`.
- **Secondary Intent Keywords**: `"????? ?? [?????]"`, `"?????? [?????] ??????"`, `"??? [?????] ???????"`.

---

## 4. Target Qualification & Filtering Rules

A channel or group MUST pass ALL quality gates before being inserted into the `targets` table with `is_active = true`.

### Rule 1: Minimum Member Threshold
- Telegram Channels/Groups: `members_count >= 500`
- VKontakte Groups/Publics: `members_count >= 1000`

### Rule 2: Engagement Rate (ER%) Formula
Calculate average engagement across the last 20 posts:

$$ER\% = \left( \frac{\text{Average Views per Post}}{\text{Total Members Count}} \right) \times 100$$

- **Threshold**: Target is discarded if $ER\% < 1.5\%$ (indicates inflated bot audience).

### Rule 3: Anti-Spam & Dead Channel Detection
Evaluate posts created over the past 30 days:
- **Commercial Ad Density**: If $> 70\%$ of posts contain outbound referral links or casino/crypto promotions, discard as spam farm.
- **Inactivity Check**: Discard if no posts were published in the last 14 days.

### Rule 4: Access Level Classification (`access_level`)
Verify target structure to assign posting vector:
- `open_wall`: Anyone can post directly to the wall (VK Groups).
- `open_comments`: Posts are read-only, but comment sections are open to all users (Telegram Channels & VK Publics).
- `suggested_news`: Wall is restricted, but "Suggest News" (?????????? ???????) feature is active.
- `admin_dm_only`: Comments and wall closed; outreach possible only via direct message to group admins.

---

## 5. Execution Interface & Data Payload

### Service Task API Request (`POST /api/v1/parser/execute`)
```json
{
  "tenant_id": "cfa84489-0b42-4e89-9a0c-7b707412fa01",
  "platforms": ["telegram", "vkontakte"],
  "target_geos": ["Moscow", "SPb", "Kamchatka", "Novosibirsk"],
  "niches": ["thailand_travel", "phuket_real_estate"],
  "max_results_per_niche": 50
}

Database Ingestion Query (SQL Upsert)
INSERT INTO targets (
    id, tenant_id, platform, target_id_code, title, geo_tag, niche, 
    access, members_count, engagement_rate, is_active, last_parsed_at
) VALUES (
    gen_random_uuid(), :tenant_id, :platform, :target_id_code, :title, :geo_tag, :niche,
    :access, :members_count, :engagement_rate, true, NOW()
)
ON CONFLICT (tenant_id, platform, target_id_code) 
DO UPDATE SET 
    members_count = EXCLUDED.members_count,
    engagement_rate = EXCLUDED.engagement_rate,
    last_parsed_at = NOW();

