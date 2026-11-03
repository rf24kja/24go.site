-- Additive candidate only. Review and wrap in current Alembic graph at release.
CREATE TABLE yt_objects (
 id text PRIMARY KEY,
 tenant uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('account','channel','template','seen','queue')),
 key text NOT NULL,
 body text NOT NULL CHECK (jsonb_typeof(body::jsonb) = 'object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant,kind,key)
);
CREATE INDEX yt_objects_tenant_kind ON yt_objects(tenant,kind,created_at DESC);
CREATE TABLE yt_oauth (
 state text PRIMARY KEY,
 tenant uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 actor uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires bigint NOT NULL,
 verifier text NOT NULL
);
ALTER TABLE yt_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_objects FORCE ROW LEVEL SECURITY;
CREATE POLICY yt_objects_tenant ON yt_objects
 USING (tenant::text = current_setting('app.current_tenant',true))
 WITH CHECK (tenant::text = current_setting('app.current_tenant',true));
ALTER TABLE yt_oauth ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_oauth FORCE ROW LEVEL SECURITY;
CREATE POLICY yt_oauth_tenant ON yt_oauth
 USING (tenant::text = current_setting('app.current_tenant',true))
 WITH CHECK (tenant::text = current_setting('app.current_tenant',true));
