"""Parser tasks: target discovery, qualification, DB upsert.

Queue: parser_tasks
Concurrency: Gevent/AsyncIO (100 workers)
Retry: Exponential backoff, 3 retries
Timeout: 300s
"""
import logging



log = logging.getLogger(__name__)

# ── GEO + Niche search matrix ─────────────────────────────────────────
GEO_KEYWORDS = {
    "Moscow": ["москва", "москвы", "подмосковье"],
    "SPb": ["петербург", "питер", "ленинградская"],
    "Kamchatka": ["камчатка", "петропавловск-камчатский"],
    "Novosibirsk": ["новосибирск", "новосибирской"],
}

NICHE_KEYWORDS = {
    "thailand_travel": ["тайланд", "тайланд", "пхукет", "паттайя", "бали"],
    "phuket_real_estate": ["недвижимость пхукет", "квартира пхукет", "вилла пхукет"],
}



