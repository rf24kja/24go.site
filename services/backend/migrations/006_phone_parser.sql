-- Migration 006: Phone parsing — contacts, wa_accounts, wa_groups

-- Add whatsapp to platform_type enum
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'whatsapp';

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    wa_jid VARCHAR(50),
    wa_group_source VARCHAR(255),
    wa_group_jid VARCHAR(50),
    wa_parsed_at TIMESTAMPTZ,
    has_tg BOOLEAN DEFAULT FALSE,
    has_viber BOOLEAN DEFAULT FALSE,
    tg_user_id BIGINT,
    tg_username VARCHAR(255),
    viber_user_id VARCHAR(100),
    last_mailing_at TIMESTAMPTZ,
    last_mailing_campaign_id UUID REFERENCES campaigns(id),
    mailing_count INTEGER DEFAULT 0,
    tags JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_phone ON contacts(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_tg ON contacts(tenant_id, has_tg) WHERE has_tg = TRUE;
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_mailing ON contacts(tenant_id, last_mailing_at);

-- WhatsApp accounts
CREATE TABLE IF NOT EXISTS wa_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    jid VARCHAR(50),
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'disconnected',
    session_file_path VARCHAR(500),
    daily_parse_limit INTEGER DEFAULT 50,
    parses_today INTEGER DEFAULT 0,
    last_parse_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_accounts_tenant ON wa_accounts(tenant_id, status);

-- WhatsApp groups
CREATE TABLE IF NOT EXISTS wa_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
    group_jid VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    link VARCHAR(500),
    participants_count INTEGER DEFAULT 0,
    parsed_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'idle',
    last_parsed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, group_jid)
);

CREATE INDEX IF NOT EXISTS idx_wa_groups_tenant ON wa_groups(tenant_id, status);
