"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { getTenantSettings, updateSettingsSection, resetSettingsSection } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { FieldHint } from "@/components/FieldHint";
import { Cog, UsersGroup, ExternalLink, Shield, TrendingUp, Bot, type IconProps } from "@/components/Icons";

type Section = "api_tokens" | "community_tokens" | "rate_limits" | "anti_ban" | "proxies" | "accounts" | "auto_reply" | "posting";

const SECTIONS: { key: Section; label: string; Icon: React.FC<IconProps> }[] = [
  { key: "api_tokens", label: "API Tokens", Icon: Cog },
  { key: "community_tokens", label: "Community Tokens", Icon: UsersGroup },
  { key: "rate_limits", label: "Rate Limits", Icon: TrendingUp },
  { key: "anti_ban", label: "Anti-Ban System", Icon: Shield },
  { key: "proxies", label: "Proxy Settings", Icon: ExternalLink },
  { key: "accounts", label: "Bulk Account Import", Icon: UsersGroup },
  { key: "auto_reply", label: "Auto-Reply", Icon: Bot },
  { key: "posting", label: "Posting", Icon: Bot },
];

export default function VkSettingsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState<Section>("api_tokens");
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [defaults, setDefaults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const data = await getTenantSettings(auth.token);
      setSettings(data.settings || {});
      setDefaults(data.defaults || {});
    } catch { /* defaults */ }
    setLoading(false);
  }, [auth?.token]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async (section: string, values: Record<string, any>) => {
    if (!auth?.token) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      await updateSettingsSection(auth.token, section, values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadSettings();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (section: string) => {
    if (!auth?.token || !confirm(`Reset ${section} to defaults?`)) return;
    try {
      await resetSettingsSection(auth.token, section);
      await loadSettings();
    } catch { /* reset failed */ }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-6xl animate-fade-slide-in">
      {/* Mobile section selector */}
      <div className="md:hidden w-full">
        <select value={activeSection} onChange={(e) => { setActiveSection(e.target.value as Section); setSaved(false); setError(""); }}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 mb-4">
          {SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Sidebar nav */}
      <nav className="hidden md:block w-52 shrink-0 space-y-1">
        <h1 className="text-lg font-bold mb-4">VK Settings</h1>
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => { setActiveSection(s.key); setSaved(false); setError(""); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 whitespace-nowrap transition ${
              activeSection === s.key ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}>
            <s.Icon className="w-4 h-4 shrink-0" />{s.label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <div className="flex-1 space-y-6 min-w-0">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : (
          <>
            {saved && <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">Saved!</div>}
            {error && <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400">{error}</div>}

            {activeSection === "api_tokens" && <ApiTokensSection settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "community_tokens" && <CommunityTokensSection settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "rate_limits" && <RateLimitsSection settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "anti_ban" && <AntiBanSection settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "proxies" && <ProxiesSection settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "accounts" && <BulkAccountsSection settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "auto_reply" && <AutoReplySection settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "posting" && <PostingSection settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Shared field components ───────────────────────────────────────
function SectionHeader({ Icon, title, desc }: { Icon: React.FC<IconProps>; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-zinc-800 rounded-lg"><Icon className="w-5 h-5 text-zinc-300" /></div>
      <div>
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-400 flex items-center">
        {label}
        {hint && <FieldHint hint={hint} />}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500" />;
}

function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return <input type="number" value={value} min={min} max={max} step={step}
    onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500" />;
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className={`w-10 h-5 rounded-full transition-colors relative ${value ? "bg-emerald-500" : "bg-zinc-700"}`}
        onClick={() => onChange(!value)}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? "left-5" : "left-0.5"}`} />
      </div>
      {label && <span className="text-sm text-zinc-300">{label}</span>}
    </label>
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono resize-y" />;
}

function SectionActions({ onSave, onReset, saving }: { onSave: () => void; onReset: () => void; saving: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
      <button onClick={onSave} disabled={saving}
        className="px-5 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 btn-press">
        {saving ? "Saving..." : "Save"}
      </button>
      <button onClick={onReset} className="px-4 py-2 text-zinc-500 text-sm hover:text-zinc-300 transition">Reset</button>
    </div>
  );
}

// ── Section: API Tokens ──────────────────────────────────────────
function ApiTokensSection({ settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    service_token: settings.service_token || "",
    app_id: settings.app_id || "",
    app_secret: settings.app_secret || "",
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Cog} title="API Tokens" desc="VK API authentication tokens for accessing VKontakte services." />

      <Field label="Service Token" hint="VK API service token. Used for reading public data (groups, users, wall posts). Get from https://vk.com/dev">
        <Input value={cfg.service_token} onChange={(v) => set("service_token", v)} placeholder="Service token..." />
      </Field>

      <Field label="App ID" hint="VK application ID. Found in your VK app settings at https://vk.com/apps">
        <Input value={cfg.app_id} onChange={(v) => set("app_id", v)} placeholder="Application ID..." />
      </Field>

      <Field label="App Secret Key" hint="VK application secret key. Used for server-side authentication.">
        <Input value={cfg.app_secret} onChange={(v) => set("app_secret", v)} placeholder="Secret key..." type="password" />
      </Field>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Community Tokens ────────────────────────────────────
function CommunityTokensSection({ settings, onSave, onReset, saving }: any) {
  const [tokens, setTokens] = useState<string[]>(settings.community_tokens || []);
  const [newToken, setNewToken] = useState("");

  return (
    <div className="space-y-6">
      <SectionHeader Icon={UsersGroup} title="Community Tokens" desc="VK community access tokens. Used for sending messages, posting, and reading community data." />

      <Field label="Community Tokens" hint="Add VK community tokens. Each token allows one community to be used for outreach.">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={newToken} onChange={setNewToken} placeholder="Community access token..." />
            <button onClick={() => { if (newToken.trim()) { setTokens([...tokens, newToken.trim()]); setNewToken(""); } }}
              className="px-3 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 whitespace-nowrap">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tokens.map((token: string, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 font-mono">
                {token.slice(0, 8)}...{token.slice(-4)}
                <button onClick={() => setTokens(tokens.filter((_: string, j: number) => j !== i))} className="text-zinc-500 hover:text-zinc-300">×</button>
              </span>
            ))}
          </div>
        </div>
      </Field>

      <SectionActions onSave={() => onSave({ community_tokens: tokens })} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Rate Limits ─────────────────────────────────────────
function RateLimitsSection({ settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    messages_per_hour: settings.rate_limits?.messages_per_hour ?? 30,
    messages_per_day: settings.rate_limits?.messages_per_day ?? 300,
    posts_per_day: settings.rate_limits?.posts_per_day ?? 10,
    comments_per_hour: settings.rate_limits?.comments_per_hour ?? 50,
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={TrendingUp} title="Rate Limits" desc="Control how many actions each VK account can perform. Lower values = safer, higher values = faster but riskier." />

      <Field label="Messages per Hour" hint="Max direct messages one account can send per hour. VK typically allows 30-50.">
        <NumberInput value={cfg.messages_per_hour} onChange={(v) => set("messages_per_hour", v)} min={1} max={100} />
      </Field>

      <Field label="Messages per Day" hint="Max direct messages one account can send per day. Recommended: 200-300 for warmed-up accounts.">
        <NumberInput value={cfg.messages_per_day} onChange={(v) => set("messages_per_day", v)} min={1} max={1000} />
      </Field>

      <Field label="Wall Posts per Day" hint="Max posts one account can publish per day. Recommended: 5-10 to avoid spam flags.">
        <NumberInput value={cfg.posts_per_day} onChange={(v) => set("posts_per_day", v)} min={1} max={50} />
      </Field>

      <Field label="Comments per Hour" hint="Max comments one account can post per hour. Recommended: 30-50.">
        <NumberInput value={cfg.comments_per_hour} onChange={(v) => set("comments_per_hour", v)} min={1} max={100} />
      </Field>

      <SectionActions onSave={() => onSave({ rate_limits: cfg })} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Anti-Ban System ─────────────────────────────────────
function AntiBanSection({ settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    min_delay: settings.anti_ban?.min_delay ?? 15,
    max_delay: settings.anti_ban?.max_delay ?? 45,
    cooldown_minutes: settings.anti_ban?.cooldown_minutes ?? 5,
    warmup_days: settings.anti_ban?.warmup_days ?? 3,
    warmup_day1_actions: settings.anti_ban?.warmup_day1_actions ?? 5,
    warmup_day2_actions: settings.anti_ban?.warmup_day2_actions ?? 15,
    warmup_day3_actions: settings.anti_ban?.warmup_day3_actions ?? 30,
    flood_wait_autoretry: settings.anti_ban?.flood_wait_autoretry ?? true,
    randomize_order: settings.anti_ban?.randomize_order ?? true,
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Shield} title="Anti-Ban System" desc="Protect your accounts from being banned by VK. These settings control delays, cooldowns, and warmup stages." />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Min Delay (sec)" hint="Minimum random delay between actions in seconds.">
          <NumberInput value={cfg.min_delay} onChange={(v) => set("min_delay", v)} min={5} max={120} />
        </Field>
        <Field label="Max Delay (sec)" hint="Maximum random delay between actions in seconds.">
          <NumberInput value={cfg.max_delay} onChange={(v) => set("max_delay", v)} min={10} max={180} />
        </Field>
      </div>

      <Field label="Cooldown Between Batches (min)" hint="After a batch of actions, pause for this many minutes before starting the next batch.">
        <NumberInput value={cfg.cooldown_minutes} onChange={(v) => set("cooldown_minutes", v)} min={1} max={30} />
      </Field>

      <div className="border border-zinc-800 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">Account Warmup</h3>
        <p className="text-xs text-zinc-500">New accounts gradually increase their activity over {cfg.warmup_days} days to avoid sudden spikes that trigger bans.</p>

        <Field label="Warmup Days" hint="Number of warmup stages. During this period, accounts use reduced limits.">
          <NumberInput value={cfg.warmup_days} onChange={(v) => set("warmup_days", v)} min={1} max={7} />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Day 1 Actions" hint="Max actions on first day.">
            <NumberInput value={cfg.warmup_day1_actions} onChange={(v) => set("warmup_day1_actions", v)} min={1} max={50} />
          </Field>
          <Field label="Day 2 Actions" hint="Max actions on second day.">
            <NumberInput value={cfg.warmup_day2_actions} onChange={(v) => set("warmup_day2_actions", v)} min={1} max={50} />
          </Field>
          <Field label="Day 3 Actions" hint="Max actions on third day.">
            <NumberInput value={cfg.warmup_day3_actions} onChange={(v) => set("warmup_day3_actions", v)} min={1} max={100} />
          </Field>
        </div>
      </div>

      <Toggle value={cfg.flood_wait_autoretry} onChange={(v) => set("flood_wait_autoretry", v)} label="Auto-retry on Flood Wait" />
      <p className="text-xs text-zinc-500 -mt-4">When VK returns a flood wait error, automatically sleep for the required time and retry.</p>

      <Toggle value={cfg.randomize_order} onChange={(v) => set("randomize_order", v)} label="Randomize Action Order" />
      <p className="text-xs text-zinc-500 -mt-4">Randomize the order of actions across accounts to avoid predictable patterns.</p>

      <SectionActions onSave={() => onSave({ anti_ban: cfg })} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Proxies ─────────────────────────────────────────────
function ProxiesSection({ settings, onSave, onReset, saving }: any) {
  const [proxies, setProxies] = useState<string[]>(settings.proxy_list || []);
  const [newProxy, setNewProxy] = useState("");
  const [rotation, setRotation] = useState(settings.proxy_rotation || "round_robin");

  const handleBulkImport = (text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    setProxies([...proxies, ...lines]);
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={ExternalLink} title="Proxy Settings" desc="Configure proxies for VK API requests. Each account should use a different proxy IP to avoid detection." />

      <Field label="Proxy Rotation Strategy" hint="How to assign proxies to accounts.">
        <select value={rotation} onChange={(e) => setRotation(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
          <option value="round_robin">Round Robin (sequential)</option>
          <option value="random">Random</option>
          <option value="least_used">Least Used</option>
        </select>
      </Field>

      <Field label="Proxy List" hint="One proxy per line. Format: protocol://user:pass@host:port">
        <Textarea value={proxies.join("\n")} onChange={(v) => setProxies(v.split("\n").filter((l) => l.trim()))} placeholder={"http://user:pass@ip:port\nsocks5://user:pass@ip:port"} rows={6} />
      </Field>

      <Field label="Bulk Import" hint="Paste multiple proxies (one per line) to add to the list.">
        <Textarea value="" onChange={handleBulkImport} placeholder="Paste proxies here..." rows={3} />
      </Field>

      <div className="text-xs text-zinc-500">{proxies.length} proxies configured</div>

      <SectionActions onSave={() => onSave({ proxy_list: proxies, proxy_rotation: rotation })} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Bulk Account Import ─────────────────────────────────
function BulkAccountsSection({ settings, onSave, onReset, saving }: any) {
  const [jsonText, setJsonText] = useState("");
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);

  const handleImport = () => {
    try {
      const accounts = JSON.parse(jsonText);
      if (!Array.isArray(accounts)) throw new Error("Expected an array of accounts");
      const errors: string[] = [];
      let success = 0;
      accounts.forEach((acc: any, i: number) => {
        if (!acc.group_id || !acc.token) {
          errors.push(`Account ${i + 1}: missing group_id or token`);
        } else {
          success++;
        }
      });
      setImportResult({ success, errors });
    } catch (e: any) {
      setImportResult({ success: 0, errors: [e.message] });
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={UsersGroup} title="Bulk Account Import" desc="Import VK community accounts in bulk using JSON format." />

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-200 mb-2">JSON Format</h3>
        <pre className="text-xs text-zinc-400 font-mono">{`[
  {"group_id": 12345678, "token": "community_access_token"},
  {"group_id": 87654321, "token": "another_token"}
]`}</pre>
      </div>

      <Field label="Paste JSON" hint="Paste a JSON array of community accounts. Each entry must have group_id (number) and token (string).">
        <Textarea value={jsonText} onChange={setJsonText} placeholder='[{"group_id": 123, "token": "..."}]' rows={8} />
      </Field>

      <button onClick={handleImport} disabled={!jsonText.trim()}
        className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 disabled:opacity-50">
        Parse & Preview
      </button>

      {importResult && (
        <div className={`px-4 py-3 rounded-lg text-sm ${importResult.errors.length ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"}`}>
          <p>{importResult.success} accounts ready to import</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-xs text-rose-400">{importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
          )}
        </div>
      )}

      <SectionActions onSave={() => onSave({ bulk_accounts: jsonText })} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Auto-Reply ──────────────────────────────────────────
function AutoReplySection({ settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    enabled: settings.auto_reply?.enabled ?? false,
    mode: settings.auto_reply?.mode ?? "ai",
    greeting: settings.auto_reply?.greeting ?? "Hello! How can I help you?",
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Bot} title="VK Auto-Reply" desc="Automatically reply to incoming messages in VK communities." />

      <Toggle value={cfg.enabled} onChange={(v) => set("enabled", v)} label="Enable Auto-Reply" />

      <Field label="Reply Mode" hint="AI mode uses LLM to generate contextual replies. Template mode uses predefined messages.">
        <select value={cfg.mode} onChange={(e) => set("mode", e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
          <option value="ai">AI (LLM-based)</option>
          <option value="template">Template</option>
        </select>
      </Field>

      <Field label="Default Greeting" hint="First message sent to new contacts.">
        <Input value={cfg.greeting} onChange={(v) => set("greeting", v)} />
      </Field>

      <SectionActions onSave={() => onSave({ auto_reply: cfg })} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Posting ─────────────────────────────────────────────
function PostingSection({ settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    enabled: settings.vk_posting?.enabled ?? false,
    spinntax: settings.vk_posting?.spinntax ?? true,
    utm_tracking: settings.vk_posting?.utm_tracking ?? true,
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Bot} title="VK Posting" desc="Configure automatic posting to VK community walls." />

      <Toggle value={cfg.enabled} onChange={(v) => set("enabled", v)} label="Enable VK Posting" />

      <Toggle value={cfg.spinntax} onChange={(v) => set("spinntax", v)} label="Spintax Support" />
      <p className="text-xs text-zinc-500 -mt-4">Use {`{variant1|variant2}`} syntax in posts for random text variations.</p>

      <Toggle value={cfg.utm_tracking} onChange={(v) => set("utm_tracking", v)} label="UTM Tracking" />
      <p className="text-xs text-zinc-500 -mt-4">Automatically add UTM parameters to links in posts for analytics.</p>

      <SectionActions onSave={() => onSave({ vk_posting: cfg })} onReset={onReset} saving={saving} />
    </div>
  );
}
