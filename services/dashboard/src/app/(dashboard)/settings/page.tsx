"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  getTenantSettings, updateSettingsSection, resetSettingsSection,
  getSubscription, getUsage, updateTenant, changePassword,
  getSystemInfo, seedDemoData, backupLeads,
  getNotificationStatus, testSmtp,
} from "@/lib/api";

type Section = "llm" | "warmup" | "posting" | "notifications" | "groups" | "account";

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: "llm", label: "AI & Classification", icon: "🧠" },
  { key: "warmup", label: "Account Warmup", icon: "🔥" },
  { key: "posting", label: "Posting & UTM", icon: "📝" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "groups", label: "Group Scanning", icon: "👥" },
  { key: "account", label: "Account & Billing", icon: "⚙️" },
];

export default function SettingsPage() {
  const { auth } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("llm");
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
    } catch { /* empty */ }
    setLoading(false);
  }, [auth?.token]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSaveSection = async (section: string, values: Record<string, any>) => {
    if (!auth?.token) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      await updateSettingsSection(auth.token, section, values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadSettings();
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleResetSection = async (section: string) => {
    if (!auth?.token || !confirm(`Reset ${section} to defaults?`)) return;
    try {
      await resetSettingsSection(auth.token, section);
      await loadSettings();
    } catch { /* empty */ }
  };

  return (
    <div className="flex gap-6 max-w-6xl">
      {/* Sidebar nav */}
      <nav className="w-52 shrink-0 space-y-1">
        <h1 className="text-lg font-bold mb-4">Settings</h1>
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => { setActiveSection(s.key); setSaved(false); setError(""); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
              activeSection === s.key ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}>
            <span className="mr-2">{s.icon}</span>{s.label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <div className="flex-1 space-y-6 min-w-0">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {saved && <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">Saved!</div>}
            {error && <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400">{error}</div>}

            {activeSection === "llm" && <LLMSection settings={settings.llm || {}} defaults={defaults.llm || {}} onSave={(v: Record<string, any>) => handleSaveSection("llm", v)} onReset={() => handleResetSection("llm")} saving={saving} />}
            {activeSection === "warmup" && <WarmupSection settings={settings.warmup || {}} defaults={defaults.warmup || {}} onSave={(v: Record<string, any>) => handleSaveSection("warmup", v)} onReset={() => handleResetSection("warmup")} saving={saving} />}
            {activeSection === "posting" && <PostingSection settings={settings.posting || {}} defaults={defaults.posting || {}} onSave={(v: Record<string, any>) => handleSaveSection("posting", v)} onReset={() => handleResetSection("posting")} saving={saving} />}
            {activeSection === "notifications" && <NotificationsSection settings={settings.notifications || {}} defaults={defaults.notifications || {}} onSave={(v: Record<string, any>) => handleSaveSection("notifications", v)} onReset={() => handleResetSection("notifications")} saving={saving} />}
            {activeSection === "groups" && <GroupsSection settings={settings.groups || {}} defaults={defaults.groups || {}} onSave={(v: Record<string, any>) => handleSaveSection("groups", v)} onReset={() => handleResetSection("groups")} saving={saving} />}
            {activeSection === "account" && <AccountSection />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Shared field components ───────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
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

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
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

function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={text} onChange={setText} placeholder={placeholder || "Add item..."} />
        <button type="button" onClick={() => { if (text.trim()) { onChange([...value, text.trim()]); setText(""); } }}
          className="px-3 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 whitespace-nowrap">Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {value.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300">
            {item}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-zinc-300">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionActions({ onSave, onReset, saving }: { onSave: () => void; onReset: () => void; saving: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
      <button onClick={onSave} disabled={saving}
        className="px-5 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
        {saving ? "Saving..." : "Save Settings"}
      </button>
      <button onClick={onReset} className="px-4 py-2 text-zinc-500 text-sm hover:text-zinc-300 transition">Reset to defaults</button>
    </div>
  );
}

// ── Section: LLM & Classification ────────────────────────────────
function LLMSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader icon="🧠" title="AI & Classification" desc="Configure how incoming messages are classified into HOT / WARM / COLD / SPAM" />

      <Card title="LLM Provider">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Provider" hint="DeepSeek is cheaper, keyword_only skips LLM entirely">
            <Select value={cfg.provider || "deepseek"} onChange={(v) => set("provider", v)}
              options={[{ value: "deepseek", label: "DeepSeek (recommended)" }, { value: "openai", label: "OpenAI" }, { value: "keyword_only", label: "Keywords only (no LLM)" }]} />
          </Field>
          <Field label="Model">
            <Input value={cfg.model || ""} onChange={(v) => set("model", v)} placeholder="deepseek-chat" />
          </Field>
        </div>
      </Card>

      <Card title="System Prompt">
        <Field label="LLM System Prompt" hint="Instructions sent to the LLM for classification">
          <textarea value={cfg.system_prompt || ""} onChange={(e) => set("system_prompt", e.target.value)} rows={8}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500" />
        </Field>
      </Card>

      <Card title="Keyword Rules">
        <div className="space-y-4">
          <Field label="HOT Keywords" hint={`Minimum ${cfg.hot_threshold || 2} matches = HOT`}>
            <ListInput value={cfg.hot_keywords || []} onChange={(v) => set("hot_keywords", v)} placeholder="Add keyword..." />
          </Field>
          <Field label="WARM Keywords" hint={`Minimum ${cfg.warm_threshold || 1} matches = WARM`}>
            <ListInput value={cfg.warm_keywords || []} onChange={(v) => set("warm_keywords", v)} placeholder="Add keyword..." />
          </Field>
          <Field label="SPAM Keywords">
            <ListInput value={cfg.spam_keywords || []} onChange={(v) => set("spam_keywords", v)} placeholder="Add keyword..." />
          </Field>
        </div>
      </Card>

      <Card title="Thresholds">
        <div className="grid grid-cols-3 gap-4">
          <Field label="HOT min matches" hint="Keyword matches needed for HOT">
            <NumberInput value={cfg.hot_threshold || 2} onChange={(v) => set("hot_threshold", v)} min={1} max={10} />
          </Field>
          <Field label="WARM min matches">
            <NumberInput value={cfg.warm_threshold || 1} onChange={(v) => set("warm_threshold", v)} min={1} max={10} />
          </Field>
          <Field label="LLM confidence threshold" hint="Min confidence to accept LLM result">
            <NumberInput value={cfg.confidence_threshold || 0.5} onChange={(v) => set("confidence_threshold", v)} min={0} max={1} step={0.05} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Warmup ──────────────────────────────────────────────
function WarmupSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader icon="🔥" title="Account Warmup" desc="Configure how new Telegram accounts are warmed up before production use" />

      <Card title="Warmup Channels">
        <Field label="Reading Channels" hint="Safe channels for passive reading during warmup">
          <ListInput value={cfg.channels || []} onChange={(v) => set("channels", v)} placeholder="https://t.me/s/channelname" />
        </Field>
        <div className="mt-4">
          <Field label="Reactions" hint="Emoji used for passive reactions">
            <ListInput value={cfg.reactions || []} onChange={(v) => set("reactions", v)} placeholder="Add emoji..." />
          </Field>
        </div>
      </Card>

      <Card title="Stage Duration">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Stage 1 (Passive)" hint="Days of read-only activity">
            <NumberInput value={cfg.stage1_days || 3} onChange={(v) => set("stage1_days", v)} min={1} max={14} />
          </Field>
          <Field label="Stage 2 (Soft Engagement)" hint="Days of light interactions">
            <NumberInput value={cfg.stage2_days || 4} onChange={(v) => set("stage2_days", v)} min={1} max={14} />
          </Field>
        </div>
      </Card>

      <Card title="Action Limits">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Stage 1 actions/day">
            <NumberInput value={cfg.stage1_actions_per_day || 5} onChange={(v) => set("stage1_actions_per_day", v)} min={1} max={20} />
          </Field>
          <Field label="Stage 2 actions/day">
            <NumberInput value={cfg.stage2_actions_per_day || 10} onChange={(v) => set("stage2_actions_per_day", v)} min={1} max={30} />
          </Field>
          <Field label="Stage 3 (Production) limit">
            <NumberInput value={cfg.stage3_daily_limit || 20} onChange={(v) => set("stage3_daily_limit", v)} min={5} max={50} />
          </Field>
        </div>
      </Card>

      <Card title="Timing">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Min delay between actions (sec)">
            <NumberInput value={cfg.random_delay_min_sec || 2} onChange={(v) => set("random_delay_min_sec", v)} min={1} max={30} />
          </Field>
          <Field label="Max delay between actions (sec)">
            <NumberInput value={cfg.random_delay_max_sec || 8} onChange={(v) => set("random_delay_max_sec", v)} min={2} max={60} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Posting ─────────────────────────────────────────────
function PostingSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader icon="📝" title="Posting & UTM" desc="Configure default posting behavior and UTM tracking parameters" />

      <Card title="UTM Defaults">
        <div className="grid grid-cols-3 gap-4">
          <Field label="UTM Source">
            <Input value={cfg.utm_source || "leadgen"} onChange={(v) => set("utm_source", v)} />
          </Field>
          <Field label="UTM Medium">
            <Input value={cfg.utm_medium || "social"} onChange={(v) => set("utm_medium", v)} />
          </Field>
          <Field label="UTM Campaign">
            <Input value={cfg.utm_campaign || "auto"} onChange={(v) => set("utm_campaign", v)} />
          </Field>
        </div>
      </Card>

      <Card title="Posting Behavior">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Delay between posts (sec)" hint="Minimum time between posts from same account">
            <NumberInput value={cfg.delay_between_posts_sec || 30} onChange={(v) => set("delay_between_posts_sec", v)} min={5} max={300} />
          </Field>
          <Field label="Max comment replies per post">
            <NumberInput value={cfg.max_comment_replies_per_post || 10} onChange={(v) => set("max_comment_replies_per_post", v)} min={1} max={50} />
          </Field>
          <Field label="Comment scrape delay (sec)" hint="Wait before scraping comments on own post">
            <NumberInput value={cfg.comment_scrape_delay_sec || 120} onChange={(v) => set("comment_scrape_delay_sec", v)} min={30} max={600} />
          </Field>
          <Field label="Spintax max depth">
            <NumberInput value={cfg.spintax_max_depth || 10} onChange={(v) => set("spintax_max_depth", v)} min={1} max={20} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Notifications ───────────────────────────────────────
function NotificationsSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader icon="🔔" title="Notifications" desc="Configure when and how you receive notifications about new leads" />

      <Card title="Email Notifications">
        <div className="space-y-4">
          <Field label="Notify on intent scores" hint="Which lead scores trigger email notifications">
            <div className="flex gap-3">
              {["HOT", "WARM", "COLD", "SPAM"].map((score) => {
                const active = (cfg.notify_on || ["HOT", "WARM"]).includes(score);
                return (
                  <button key={score} onClick={() => {
                    const current = cfg.notify_on || ["HOT", "WARM"];
                    set("notify_on", active ? current.filter((s: string) => s !== score) : [...current, score]);
                  }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                    }`}>{score}</button>
                );
              })}
            </div>
          </Field>
          <Field label="Email subject prefix">
            <Input value={cfg.email_subject_prefix || "[LeadGen]"} onChange={(v) => set("email_subject_prefix", v)} />
          </Field>
        </div>
      </Card>

      <Card title="Daily Summary">
        <div className="space-y-4">
          <Toggle value={cfg.daily_summary !== false} onChange={(v) => set("daily_summary", v)} label="Send daily summary email" />
          <Field label="Summary hour (UTC)">
            <NumberInput value={cfg.daily_summary_hour || 9} onChange={(v) => set("daily_summary_hour", v)} min={0} max={23} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Groups ──────────────────────────────────────────────
function GroupsSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-6">
      <SectionHeader icon="👥" title="Group Scanning" desc="Configure how monitored Telegram groups and VK communities are scanned for leads" />

      <Card title="Scan Behavior">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Scan interval (minutes)" hint="How often groups are checked for new messages">
            <NumberInput value={cfg.scan_interval_min || 30} onChange={(v) => set("scan_interval_min", v)} min={5} max={180} />
          </Field>
          <Field label="Max messages per scan">
            <NumberInput value={cfg.max_messages_per_scan || 50} onChange={(v) => set("max_messages_per_scan", v)} min={10} max={200} />
          </Field>
        </div>
      </Card>

      <Card title="Auto-Discovery">
        <div className="space-y-4">
          <Toggle value={cfg.auto_discover_enabled !== false} onChange={(v) => set("auto_discover_enabled", v)} label="Enable auto-discovery of groups" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Discovery interval (hours)">
              <NumberInput value={cfg.auto_discover_interval_hours || 6} onChange={(v) => set("auto_discover_interval_hours", v)} min={1} max={48} />
            </Field>
            <Field label="Min members count" hint="Only discover groups with this many members">
              <NumberInput value={cfg.min_members_count || 100} onChange={(v) => set("min_members_count", v)} min={10} max={10000} />
            </Field>
          </div>
          <Toggle value={cfg.prefer_open_comments !== false} onChange={(v) => set("prefer_open_comments", v)} label="Prefer groups with open comments" />
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} />
    </div>
  );
}

// ── Section: Account & Billing ───────────────────────────────────
function AccountSection() {
  const { auth } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sub, setSub] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState("");

  useEffect(() => {
    if (!auth?.token) return;
    setCompanyName(auth.user?.company_name || "");
    getSubscription(auth.token).then(setSub).catch(() => {});
    getUsage(auth.token).then(setUsage).catch(() => {});
    getSystemInfo(auth.token).then(setSysInfo).catch(() => {});
  }, [auth?.token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    try {
      await updateTenant(auth.token, { company_name: companyName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const handleSeed = async () => {
    if (!auth?.token || !confirm("Load demo data?")) return;
    setSeeding(true);
    try { const r = await seedDemoData(auth.token); setSeedResult(r); getSystemInfo(auth.token).then(setSysInfo); }
    finally { setSeeding(false); }
  };

  const handleBackup = async () => {
    if (!auth?.token) return;
    const blob = await backupLeads(auth.token);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `backup_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handlePassChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    if (newPass !== confirmPass) { setPassErr("Passwords don't match"); return; }
    if (newPass.length < 8) { setPassErr("Min 8 characters"); return; }
    setPassErr(""); setPassMsg("");
    try { await changePassword(auth.token, currentPass, newPass); setPassMsg("Changed!"); setCurrentPass(""); setNewPass(""); setConfirmPass(""); }
    catch (err: any) { setPassErr(err.message || "Failed"); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon="⚙️" title="Account & Billing" desc="Company profile, subscription, and security" />

      <Card title="Company Profile">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Company Name">
            <Input value={companyName} onChange={setCompanyName} />
          </Field>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && <span className="text-emerald-400 text-sm">Saved!</span>}
          </div>
        </form>
      </Card>

      {sub && (
        <Card title="Subscription">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-zinc-500">Plan:</span><span className="text-zinc-200 ml-2 font-medium capitalize">{sub.plan}</span></div>
            <div><span className="text-zinc-500">Status:</span>
              <span className={`ml-2 font-medium ${sub.status === "active" ? "text-emerald-400" : "text-rose-400"}`}>{sub.status}</span></div>
            <div><span className="text-zinc-500">Posts Used:</span><span className="text-zinc-200 ml-2">{sub.monthly_posts_used} / {sub.monthly_posts_limit}</span></div>
            <div><span className="text-zinc-500">Token Credits:</span><span className="text-zinc-200 ml-2">{(sub.token_credits_balance || 0).toLocaleString()}</span></div>
            <div className="col-span-2"><span className="text-zinc-500">Renews:</span><span className="text-zinc-200 ml-2">{new Date(sub.current_period_end).toLocaleDateString()}</span></div>
          </div>
        </Card>
      )}

      {usage && (
        <Card title="Usage This Period">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-zinc-500">Tokens Used:</span><span className="text-zinc-200 ml-2">{(usage.total_tokens_used || 0).toLocaleString()}</span></div>
            <div><span className="text-zinc-500">Cost:</span><span className="text-zinc-200 ml-2">${(usage.total_cost_usd || 0).toFixed(4)}</span></div>
          </div>
        </Card>
      )}

      {sysInfo && (
        <Card title="System Info">
          <div className="grid grid-cols-3 gap-3 text-sm">
            {Object.entries(sysInfo.record_counts || {}).map(([table, count]) => (
              <div key={table} className="bg-zinc-800 rounded-lg px-3 py-2">
                <div className="text-zinc-400 text-xs">{table}</div>
                <div className="text-zinc-100 font-medium">{String(count)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Demo & Backup">
        <div className="flex gap-3">
          <button onClick={handleSeed} disabled={seeding}
            className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50">
            {seeding ? "Loading..." : "Load Demo Data"}
          </button>
          <button onClick={handleBackup}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700">
            Download Backup
          </button>
        </div>
        {seedResult && (
          <div className="mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400">
            {seedResult.status === "already_seeded" ? `Already seeded (${seedResult.leads} leads)` :
              `Seeded: ${seedResult.targets} targets, ${seedResult.accounts} accounts, ${seedResult.campaigns} campaigns, ${seedResult.leads} leads`}
          </div>
        )}
      </Card>

      <Card title="Change Password">
        <form onSubmit={handlePassChange} className="space-y-3">
          <Input type="password" value={currentPass} onChange={setCurrentPass} placeholder="Current password" />
          <Input type="password" value={newPass} onChange={setNewPass} placeholder="New password (min 8 chars)" />
          <Input type="password" value={confirmPass} onChange={setConfirmPass} placeholder="Confirm new password" />
          <div className="flex items-center gap-3">
            <button type="submit" className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">Change Password</button>
            {passMsg && <span className="text-emerald-400 text-sm">{passMsg}</span>}
            {passErr && <span className="text-rose-400 text-sm">{passErr}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────
function SectionHeader({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold flex items-center gap-2"><span>{icon}</span>{title}</h2>
      <p className="text-sm text-zinc-500 mt-1">{desc}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}
