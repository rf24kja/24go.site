-- Auto-replies: keyword matching, AI agent, and rotation modes
CREATE TABLE auto_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('keyword', 'ai_agent', 'rotation')),
    keywords TEXT DEFAULT '',
    prompt TEXT DEFAULT '',
    model VARCHAR(50) DEFAULT '',
    api_key_encrypted TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auto_reply_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_reply_id UUID NOT NULL REFERENCES auto_replies(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auto_replies_tenant ON auto_replies(tenant_id, is_active);
CREATE INDEX idx_auto_reply_answers_auto_reply ON auto_reply_answers(auto_reply_id);
