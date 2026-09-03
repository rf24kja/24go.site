-- 005: Balance system + TgStat search cache
-- User balances for TgStat API queries

CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    balance_kopeks BIGINT NOT NULL DEFAULT 0,  -- баланс в копейках (50000 = 500₽)
    total_spent_kopeks BIGINT NOT NULL DEFAULT 0,  -- всего потрачено
    total_queries INT NOT NULL DEFAULT 0,  -- всего запросов
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Query logs for statistics and billing
CREATE TABLE IF NOT EXISTS search_query_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    query TEXT NOT NULL,  -- поисковый запрос
    query_type VARCHAR(20) NOT NULL DEFAULT 'keyword',  -- keyword, tgstat, semantic
    cost_kopeks INT NOT NULL DEFAULT 0,  -- стоимость в копейках (0 = бесплатно)
    results_count INT NOT NULL DEFAULT 0,  -- количество результатов
    cache_hit BOOLEAN DEFAULT false,  -- был ли запрос из кэша
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Search cache for TgStat results (24h TTL)
CREATE TABLE IF NOT EXISTS search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA256 от нормализованного запроса
    results_json JSONB NOT NULL,  -- результаты поиска
    expires_at TIMESTAMPTZ NOT NULL,  -- время истечения (now + 24h)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_query_logs_tenant ON search_query_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_cache_hash ON search_cache(query_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_balances_tenant ON user_balances(tenant_id);
