"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { getTenantSettings, updateSettingsSection, resetSettingsSection, bulkImportVkAccounts } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { FieldHint } from "@/components/FieldHint";
import { Cog, UsersGroup, ExternalLink, Shield, TrendingUp, Bot, type IconProps } from "@/components/Icons";

type Section = "api_tokens" | "community_tokens" | "rate_limits" | "anti_ban" | "proxies" | "accounts" | "auto_reply" | "posting";

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

  const SECTIONS: { key: Section; label: string; Icon: React.FC<IconProps> }[] = [
    { key: "api_tokens", label: t("vkSettings.apiTokens"), Icon: Cog },
    { key: "community_tokens", label: t("vkSettings.communityTokens"), Icon: UsersGroup },
    { key: "rate_limits", label: t("vkSettings.rateLimits"), Icon: TrendingUp },
    { key: "anti_ban", label: t("vkSettings.antiBan"), Icon: Shield },
    { key: "proxies", label: t("vkSettings.proxySettings"), Icon: ExternalLink },
    { key: "accounts", label: t("vkSettings.bulkImport"), Icon: UsersGroup },
    { key: "auto_reply", label: t("vkSettings.autoReply"), Icon: Bot },
    { key: "posting", label: t("vkSettings.posting"), Icon: Bot },
  ];

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
      setError(e.message || t("vkSettings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (section: string) => {
    if (!auth?.token || !confirm(t("vkSettings.resetConfirm", { section }))) return;
    try {
      await resetSettingsSection(auth.token, section);
      await loadSettings();
    } catch { /* reset failed */ }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-6xl animate-fade-slide-in">
      <div className="md:hidden w-full">
        <select value={activeSection} onChange={(e) => { setActiveSection(e.target.value as Section); setSaved(false); setError(""); }}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 mb-4">
          {SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      <nav className="hidden md:block w-52 shrink-0 space-y-1">
        <h1 className="text-lg font-bold mb-4">{t("vkSettings.title")}</h1>
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => { setActiveSection(s.key); setSaved(false); setError(""); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 whitespace-nowrap transition ${
              activeSection === s.key ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}>
            <s.Icon className="w-4 h-4 shrink-0" />{s.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-6 min-w-0">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : (
          <>
            {saved && <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">{t("settings.saved")}</div>}
            {error && <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400">{error}</div>}

            {activeSection === "api_tokens" && <ApiTokensSection t={t} settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "community_tokens" && <CommunityTokensSection t={t} settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "rate_limits" && <RateLimitsSection t={t} settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "anti_ban" && <AntiBanSection t={t} settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "proxies" && <ProxiesSection t={t} settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "accounts" && <BulkAccountsSection t={t} settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "auto_reply" && <AutoReplySection t={t} settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
            {activeSection === "posting" && <PostingSection t={t} settings={settings.vk || {}} onSave={(v: Record<string, any>) => handleSave("vk", v)} onReset={() => handleReset("vk")} saving={saving} />}
          </>
        )}
      </div>
    </div>
  );
}

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

function SectionActions({ onSave, onReset, saving, t }: { onSave: () => void; onReset: () => void; saving: boolean; t: (k: string) => string }) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
      <button onClick={onSave} disabled={saving}
        className="px-5 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 btn-press">
        {saving ? t("vkSettings.saving") : t("vkSettings.save")}
      </button>
      <button onClick={onReset} className="px-4 py-2 text-zinc-500 text-sm hover:text-zinc-300 transition">{t("vkSettings.reset")}</button>
    </div>
  );
}

function ApiTokensSection({ t, settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    service_token: settings.service_token || "",
    app_id: settings.app_id || "",
    app_secret: settings.app_secret || "",
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Cog} title={t("vkSettings.apiTokens")} desc={t("vkSettings.apiTokensDesc")} />
      <Field label={t("vkSettings.serviceToken")} hint={t("hints.vk.serviceToken")}>
        <Input value={cfg.service_token} onChange={(v) => set("service_token", v)} placeholder={t("vkSettings.serviceTokenPlaceholder")} />
      </Field>
      <Field label={t("vkSettings.appId")} hint={t("hints.vk.appId")}>
        <Input value={cfg.app_id} onChange={(v) => set("app_id", v)} placeholder={t("vkSettings.appIdPlaceholder")} />
      </Field>
      <Field label={t("vkSettings.appSecret")} hint={t("hints.vk.appSecret")}>
        <Input value={cfg.app_secret} onChange={(v) => set("app_secret", v)} placeholder={t("vkSettings.appSecretPlaceholder")} type="password" />
      </Field>
      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

function CommunityTokensSection({ t, settings, onSave, onReset, saving }: any) {
  const [tokens, setTokens] = useState<string[]>(settings.community_tokens || []);
  const [newToken, setNewToken] = useState("");

  return (
    <div className="space-y-6">
      <SectionHeader Icon={UsersGroup} title={t("vkSettings.communityTokens")} desc={t("vkSettings.communityTokensDesc")} />
      <Field label={t("vkSettings.communityTokenList")} hint={t("hints.vk.communityTokens")}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={newToken} onChange={setNewToken} placeholder={t("vkSettings.tokenPlaceholder")} />
            <button onClick={() => { if (newToken.trim()) { setTokens([...tokens, newToken.trim()]); setNewToken(""); } }}
              className="px-3 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 whitespace-nowrap">{t("vkSettings.add")}</button>
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
      <SectionActions onSave={() => onSave({ community_tokens: tokens })} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

function RateLimitsSection({ t, settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    messages_per_hour: settings.rate_limits?.messages_per_hour ?? 30,
    messages_per_day: settings.rate_limits?.messages_per_day ?? 300,
    posts_per_day: settings.rate_limits?.posts_per_day ?? 10,
    comments_per_hour: settings.rate_limits?.comments_per_hour ?? 50,
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={TrendingUp} title={t("vkSettings.rateLimits")} desc={t("vkSettings.rateLimitsDesc")} />
      <Field label={t("vkSettings.msgPerHour")} hint={t("hints.vk.msgPerHour")}>
        <NumberInput value={cfg.messages_per_hour} onChange={(v) => set("messages_per_hour", v)} min={1} max={100} />
      </Field>
      <Field label={t("vkSettings.msgPerDay")} hint={t("hints.vk.msgPerDay")}>
        <NumberInput value={cfg.messages_per_day} onChange={(v) => set("messages_per_day", v)} min={1} max={1000} />
      </Field>
      <Field label={t("vkSettings.postsPerDay")} hint={t("hints.vk.postsPerDay")}>
        <NumberInput value={cfg.posts_per_day} onChange={(v) => set("posts_per_day", v)} min={1} max={50} />
      </Field>
      <Field label={t("vkSettings.commentsPerHour")} hint={t("hints.vk.commentsPerHour")}>
        <NumberInput value={cfg.comments_per_hour} onChange={(v) => set("comments_per_hour", v)} min={1} max={100} />
      </Field>
      <SectionActions onSave={() => onSave({ rate_limits: cfg })} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

function AntiBanSection({ t, settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    min_delay: settings.anti_ban?.min_delay ?? 15,
    max_delay: settings.anti_ban?.max_delay ?? 45,
    cooldown_minutes: settings.anti_ban?.cooldown_minutes ?? 5,
    warmup_days: settings.anti_ban?.warmup_days ?? 4,
    warmup_day1_actions: settings.anti_ban?.warmup_day1_actions ?? 5,
    warmup_day2_actions: settings.anti_ban?.warmup_day2_actions ?? 15,
    warmup_day3_actions: settings.anti_ban?.warmup_day3_actions ?? 30,
    flood_wait_autoretry: settings.anti_ban?.flood_wait_autoretry ?? true,
    randomize_order: settings.anti_ban?.randomize_order ?? true,
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Shield} title={t("vkSettings.antiBan")} desc={t("vkSettings.antiBanDesc")} />
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("vkSettings.minDelay")} hint={t("hints.vk.minDelay")}>
          <NumberInput value={cfg.min_delay} onChange={(v) => set("min_delay", v)} min={5} max={120} />
        </Field>
        <Field label={t("vkSettings.maxDelay")} hint={t("hints.vk.maxDelay")}>
          <NumberInput value={cfg.max_delay} onChange={(v) => set("max_delay", v)} min={10} max={180} />
        </Field>
      </div>
      <Field label={t("vkSettings.cooldown")} hint={t("hints.vk.cooldown")}>
        <NumberInput value={cfg.cooldown_minutes} onChange={(v) => set("cooldown_minutes", v)} min={1} max={30} />
      </Field>
      <div className="border border-zinc-800 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">{t("vkSettings.warmup")}</h3>
        <p className="text-xs text-zinc-500">{t("vkSettings.warmupDesc", { days: cfg.warmup_days })}</p>
        <Field label={t("vkSettings.warmupDays")} hint={t("hints.vk.warmupDays")}>
          <NumberInput value={cfg.warmup_days} onChange={(v) => set("warmup_days", v)} min={1} max={7} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t("vkSettings.day1Actions")} hint={t("hints.vk.dayActions")}>
            <NumberInput value={cfg.warmup_day1_actions} onChange={(v) => set("warmup_day1_actions", v)} min={1} max={50} />
          </Field>
          <Field label={t("vkSettings.day2Actions")} hint={t("hints.vk.dayActions")}>
            <NumberInput value={cfg.warmup_day2_actions} onChange={(v) => set("warmup_day2_actions", v)} min={1} max={50} />
          </Field>
          <Field label={t("vkSettings.day3Actions")} hint={t("hints.vk.dayActions")}>
            <NumberInput value={cfg.warmup_day3_actions} onChange={(v) => set("warmup_day3_actions", v)} min={1} max={100} />
          </Field>
        </div>
      </div>
      <Toggle value={cfg.flood_wait_autoretry} onChange={(v) => set("flood_wait_autoretry", v)} label={t("vkSettings.autoRetry")} />
      <p className="text-xs text-zinc-500 -mt-4">{t("vkSettings.autoRetryDesc")}</p>
      <Toggle value={cfg.randomize_order} onChange={(v) => set("randomize_order", v)} label={t("vkSettings.randomizeOrder")} />
      <p className="text-xs text-zinc-500 -mt-4">{t("vkSettings.randomizeOrderDesc")}</p>
      <SectionActions onSave={() => onSave({ anti_ban: cfg })} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

function ProxiesSection({ t, settings, onSave, onReset, saving }: any) {
  const [proxies, setProxies] = useState<string[]>(settings.proxy_list || []);
  const [newProxy, setNewProxy] = useState("");
  const [rotation, setRotation] = useState(settings.proxy_rotation || "round_robin");

  return (
    <div className="space-y-6">
      <SectionHeader Icon={ExternalLink} title={t("vkSettings.proxySettings")} desc={t("vkSettings.proxyDesc")} />
      <Field label={t("vkSettings.proxyRotation")} hint={t("hints.vk.proxyRotation")}>
        <select value={rotation} onChange={(e) => setRotation(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
          <option value="round_robin">{t("vkSettings.roundRobin")}</option>
          <option value="random">{t("vkSettings.random")}</option>
          <option value="least_used">{t("vkSettings.leastUsed")}</option>
        </select>
      </Field>
      <Field label={t("vkSettings.proxyList")} hint={t("hints.vk.proxyList")}>
        <Textarea value={proxies.join("\n")} onChange={(v) => setProxies(v.split("\n").filter((l) => l.trim()))} placeholder={t("vkSettings.proxyPlaceholder")} rows={6} />
      </Field>
      <div className="text-xs text-zinc-500">{proxies.length} {t("vkSettings.proxiesConfigured")}</div>
      <SectionActions onSave={() => onSave({ proxy_list: proxies, proxy_rotation: rotation })} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

function BulkAccountsSection({ t, settings, onSave, onReset, saving }: any) {
  const { auth } = useAuth();
  const [jsonText, setJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);

  const handleImport = async () => {
    if (!auth?.token) return;
    try {
      const accounts = JSON.parse(jsonText);
      if (!Array.isArray(accounts)) throw new Error(t("vkSettings.expectedArray"));
      // Client-side validation
      const validAccounts: { group_id: number; token: string }[] = [];
      const clientErrors: string[] = [];
      accounts.forEach((acc: any, i: number) => {
        if (!acc.group_id || !acc.token) {
          clientErrors.push(t("vkSettings.accountMissingFields", { n: i + 1 }));
        } else {
          validAccounts.push({ group_id: Number(acc.group_id), token: acc.token });
        }
      });
      if (clientErrors.length) {
        setImportResult({ imported: 0, failed: clientErrors.length, errors: clientErrors });
        return;
      }
      // Call actual backend import API
      setImporting(true);
      const result = await bulkImportVkAccounts(auth.token, validAccounts);
      setImportResult({
        imported: result.imported || 0,
        failed: result.failed || 0,
        errors: (result.results || []).filter((r: any) => r.status === "failed").map((r: any) => `${r.identifier}: ${r.error}`),
      });
    } catch (e: any) {
      setImportResult({ imported: 0, failed: 1, errors: [e.message] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={UsersGroup} title={t("vkSettings.bulkImport")} desc={t("vkSettings.bulkImportDesc")} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-200 mb-2">{t("vkSettings.jsonFormat")}</h3>
        <pre className="text-xs text-zinc-400 font-mono">{`[
  {"group_id": 12345678, "token": "..."},
  {"group_id": 87654321, "token": "..."}
]`}</pre>
      </div>
      <Field label={t("vkSettings.pasteJson")} hint={t("hints.vk.bulkImport")}>
        <Textarea value={jsonText} onChange={setJsonText} placeholder='[{"group_id": 123, "token": "..."}]' rows={8} />
      </Field>
      <button onClick={handleImport} disabled={!jsonText.trim() || importing}
        className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 disabled:opacity-50">
        {importing ? t("vkSettings.importing") : t("vkSettings.import")}
      </button>
      {importResult && (
        <div className={`px-4 py-3 rounded-lg text-sm ${importResult.errors.length ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"}`}>
          {importResult.imported > 0 && <p>{t("vkSettings.imported", { count: importResult.imported })}</p>}
          {importResult.failed > 0 && <p>{t("vkSettings.failed", { count: importResult.failed })}</p>}
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-xs text-rose-400">{importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}

function AutoReplySection({ t, settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    enabled: settings.auto_reply?.enabled ?? false,
    mode: settings.auto_reply?.mode ?? "ai",
    greeting: settings.auto_reply?.greeting ?? t("vkSettings.defaultGreeting"),
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Bot} title={t("vkSettings.autoReply")} desc={t("vkSettings.autoReplyDesc")} />
      <Toggle value={cfg.enabled} onChange={(v) => set("enabled", v)} label={t("vkSettings.enableAutoReply")} />
      <Field label={t("vkSettings.replyMode")} hint={t("hints.vk.replyMode")}>
        <select value={cfg.mode} onChange={(e) => set("mode", e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
          <option value="ai">{t("vkSettings.aiMode")}</option>
          <option value="template">{t("vkSettings.templateMode")}</option>
        </select>
      </Field>
      <Field label={t("vkSettings.defaultGreeting")} hint={t("hints.vk.greeting")}>
        <Input value={cfg.greeting} onChange={(v) => set("greeting", v)} />
      </Field>
      <SectionActions onSave={() => onSave({ auto_reply: cfg })} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

function PostingSection({ t, settings, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState({
    enabled: settings.vk_posting?.enabled ?? false,
    spinntax: settings.vk_posting?.spinntax ?? true,
    utm_tracking: settings.vk_posting?.utm_tracking ?? true,
  });
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Bot} title={t("vkSettings.posting")} desc={t("vkSettings.postingDesc")} />
      <Toggle value={cfg.enabled} onChange={(v) => set("enabled", v)} label={t("vkSettings.enablePosting")} />
      <Toggle value={cfg.spinntax} onChange={(v) => set("spinntax", v)} label={t("vkSettings.spintax")} />
      <p className="text-xs text-zinc-500 -mt-4">{t("vkSettings.spintaxDesc")}</p>
      <Toggle value={cfg.utm_tracking} onChange={(v) => set("utm_tracking", v)} label={t("vkSettings.utmTracking")} />
      <p className="text-xs text-zinc-500 -mt-4">{t("vkSettings.utmDesc")}</p>
      <SectionActions onSave={() => onSave({ vk_posting: cfg })} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}
