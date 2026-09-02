-- Migration 003: Add mailings and mailing_recipients tables
-- Run against the app_db database

CREATE TYPE mailing_status AS ENUM ('draft', 'running', 'paused', 'completed');
CREATE TYPE mailing_recipient_status AS ENUM ('pending', 'sent', 'failed', 'blocked');

CREATE TABLE IF NOT EXISTS mailings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    message_text TEXT NOT NULL,
    platform platform_type NOT NULL,
    status mailing_status NOT NULL DEFAULT 'draft',
    total_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    delay_seconds INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ
);

CREATE INDEX idx_mailings_tenant ON mailings(tenant_id, status);

CREATE TABLE IF NOT EXISTS mailing_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailing_id UUID NOT NULL REFERENCES mailings(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    status mailing_recipient_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_mailing_recipients_mailing ON mailing_recipients(mailing_id, status);
