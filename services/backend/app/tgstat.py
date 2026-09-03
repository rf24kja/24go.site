"""TgStat API integration for group discovery."""
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SearchCache

log = logging.getLogger(__name__)

TGSTAT_API_BASE = "https://api.tgstat.ru"
TGSTAT_TOKEN = os.getenv("TGSTAT_TOKEN", "")

# Semantic query templates for real estate
SEMANTIC_TEMPLATES = {
    "real_estate": [
        "{city} недвижимость",
        "{city} новостройки",
        "{city} аренда",
        "{city} купить квартиру",
        "{city} жилье",
        "ЖК {city}",
        "{city} риэлтор",
        "{city} застройщик",
        "{city} дом",
        "{city}property",
        "{city} real estate",
        "{city} apartments",
        "{city} buy flat",
        "{city} rent",
    ],
    "tours": [
        "{city} туры",
        "{city} путешествия",
        "{city} отдых",
        "{city} отели",
        "{city} турагентство",
        "{city} tours",
        "{city} travel",
        "{city} hotels",
        "{city} vacation",
    ],
    "general": [
        "{city} чат",
        "{city} группа",
        "{city} сообщество",
        "{city} forum",
        "{city} community",
        "{city} chat",
    ],
}


def normalize_query(query: str) -> str:
    """Normalize query for caching."""
    q = query.lower().strip()
    q = re.sub(r'\s+', ' ', q)
    return q


def query_hash(query: str, country: str = "") -> str:
    """Generate SHA256 hash for cache key."""
    key = f"{normalize_query(query)}:{country}"
    return hashlib.sha256(key.encode()).hexdigest()


async def get_cached_results(query: str, country: str, db: AsyncSession) -> dict | None:
    """Get cached results if not expired."""
    h = query_hash(query, country)
    result = await db.execute(
        select(SearchCache).where(
            SearchCache.query_hash == h,
            SearchCache.expires_at > datetime.now(timezone.utc),
        )
    )
    cache = result.scalar_one_or_none()
    if cache:
        return cache.results_json
    return None


async def set_cached_results(query: str, country: str, results: dict, db: AsyncSession):
    """Cache results for 24 hours."""
    h = query_hash(query, country)
    expires = datetime.now(timezone.utc) + timedelta(hours=24)

    # Upsert
    existing = await db.execute(
        select(SearchCache).where(SearchCache.query_hash == h)
    )
    cache = existing.scalar_one_none()
    if cache:
        cache.results_json = results
        cache.expires_at = expires
    else:
        cache = SearchCache(
            query_hash=h,
            results_json=results,
            expires_at=expires,
        )
        db.add(cache)
    await db.flush()


async def search_tgstat(
    query: str,
    country: str = "ru",
    language: str = "russian",
    peer_type: str = "all",
    category: str = "",
    limit: int = 20,
) -> dict:
    """Search TgStat API for channels/chats."""
    if not TGSTAT_TOKEN:
        return {"error": "TGStat API token not configured", "items": []}

    params = {
        "token": TGSTAT_TOKEN,
        "q": query,
        "country": country,
        "language": language,
        "peer_type": peer_type,
        "limit": min(limit, 100),
    }
    if category:
        params["category"] = category

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{TGSTAT_API_BASE}/channels/search", params=params)
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") == "error":
                log.warning(f"TgStat API error: {data.get('error')}")
                return {"error": data.get("error"), "items": []}

            items = data.get("response", {}).get("items", [])
            return {
                "items": items,
                "total": data.get("response", {}).get("total", len(items)),
            }
    except Exception as e:
        log.error(f"TgStat API request failed: {e}")
        return {"error": str(e), "items": []}


def expand_semantic_queries(keyword: str, niche: str = "general", country: str = "ru") -> list[str]:
    """Generate 10-15 semantic query combinations from a keyword."""
    templates = SEMANTIC_TEMPLATES.get(niche, SEMANTIC_TEMPLATES["general"])

    # Extract city name (simplified - in production use geocoding)
    city = keyword.strip()

    # Country-specific mappings
    city_map = {
        "ru": {
            "москва": "Москва", "мск": "Москва", "peter": "СПб",
            "петербург": "СПб", "спб": "СПб",
        },
        "th": {
            "пхукет": "Phuket", "phuket": "Phuket",
            "банкок": "Bangkok", "bangkok": "Bangkok",
            "паттайя": "Pattaya", "pattaya": "Pattaya",
        },
    }

    # Normalize city
    city_lower = city.lower()
    if country in city_map:
        for key, val in city_map[country].items():
            if key in city_lower:
                city = val
                break

    # Generate combinations
    queries = []
    for template in templates:
        q = template.format(city=city)
        if q not in queries:
            queries.append(q)

    # Add the original keyword
    if city not in queries:
        queries.insert(0, city)

    return queries[:15]  # Max 15


def parse_tgstat_results(items: list[dict]) -> list[dict]:
    """Parse TgStat API results into our format."""
    results = []
    for item in items:
        results.append({
            "title": item.get("title", ""),
            "username": item.get("username"),
            "subscribers": item.get("subscribers_count"),
            "description": item.get("description", ""),
            "peer_type": item.get("type"),
            "country": item.get("country"),
            "language": item.get("language"),
            "category": item.get("category"),
        })
    return results
