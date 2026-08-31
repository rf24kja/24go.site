"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  getTenantSettings, updateSettingsSection, resetSettingsSection,
  getSubscription, getUsage, updateTenant, changePassword,
  getSystemInfo, seedDemoData, backupLeads,
  getNotificationStatus, testSmtp,
} from "@/lib/api";
import {
  BrainCircuit, Flame, Send, Bell, UsersGroup, Cog,
  type IconProps,
} from "@/components/Icons";
import { useI18n } from "@/lib/i18n";

type Section = "llm" | "warmup" | "posting" | "notifications" | "groups" | "account";

const getSections = (t: (k: string) => string): { key: Section; label: string; Icon: React.FC<IconProps> }[] => [
  { key: "llm", label: t("settings.section.ai"), Icon: BrainCircuit },
  { key: "warmup", label: t("settings.section.warmup"), Icon: Flame },
  { key: "posting", label: t("settings.section.posting"), Icon: Send },
  { key: "notifications", label: t("settings.section.notifications"), Icon: Bell },
  { key: "groups", label: t("settings.section.groups"), Icon: UsersGroup },
  { key: "account", label: t("settings.section.account"), Icon: Cog },
];

export default function SettingsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState<Section>("llm");
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [defaults, setDefaults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const SECTIONS = getSections(t);

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
      setError(e.message || t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleResetSection = async (section: string) => {
    if (!auth?.token || !confirm(t("settings.resetConfirm").replace("{section}", section))) return;
    try {
      await resetSettingsSection(auth.token, section);
      await loadSettings();
    } catch { /* empty */ }
  };

  return (
    <div className={`flex gap-6 max-w-6xl${!loading ? " animate-fade-in" : ""}`}>
      {/* Sidebar nav */}
      <nav className="w-52 shrink-0 space-y-1">
        <h1 className="text-lg font-bold mb-4">{t("settings.title")}</h1>
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => { setActiveSection(s.key); setSaved(false); setError(""); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
              activeSection === s.key ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}>
            <span className="mr-2"><s.Icon className="w-4 h-4" /></span>{s.label}
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
            {saved && <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">{t("settings.saved")}</div>}
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

function SectionActions({ onSave, onReset, saving, t }: { onSave: () => void; onReset: () => void; saving: boolean; t: (k: string) => string }) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
      <button onClick={onSave} disabled={saving}
        className="px-5 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
        {saving ? t("settings.saving") : t("settings.save")}
      </button>
      <button onClick={onReset} className="px-4 py-2 text-zinc-500 text-sm hover:text-zinc-300 transition">{t("settings.resetDefaults")}</button>
    </div>
  );
}

// ── Section: LLM & Classification ────────────────────────────────
function LLMSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SectionHeader Icon={BrainCircuit} title={t("settings.aiClassification")} desc={t("settings.aiDesc")} />

      <Card title={t("settings.llmProvider")}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.provider")} hint={t("settings.providerHint")}>
            <Select value={cfg.provider || "auto"} onChange={(v) => set("provider", v)}
              options={[
                { value: "auto", label: t("settings.providerAuto") },
                { value: "openrouter", label: t("settings.providerOpenrouter") },
                { value: "deepseek", label: t("settings.providerDeepseek") },
                { value: "openai", label: t("settings.providerOpenai") },
                { value: "keyword_only", label: t("settings.providerKeyword") },
              ]} />
          </Field>
          <Field label={t("settings.model")}>
            <Input value={cfg.model || ""} onChange={(v) => set("model", v)} placeholder="deepseek-chat" />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.systemPrompt")}>
        <Field label={t("settings.llmPrompt")} hint={t("settings.llmPromptHint")}>
          <textarea value={cfg.system_prompt || ""} onChange={(e) => set("system_prompt", e.target.value)} rows={8}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500" />
        </Field>
      </Card>

      <Card title={t("settings.keywordRules")}>
        <div className="space-y-4">
          <Field label={t("settings.hotKeywords")} hint={t("settings.hotKeywordsHint").replace("{threshold}", String(cfg.hot_threshold || 2))}>
            <ListInput value={cfg.hot_keywords || []} onChange={(v) => set("hot_keywords", v)} placeholder={t("settings.addKeyword")} />
          </Field>
          <Field label={t("settings.warmKeywords")} hint={t("settings.warmKeywordsHint").replace("{threshold}", String(cfg.warm_threshold || 1))}>
            <ListInput value={cfg.warm_keywords || []} onChange={(v) => set("warm_keywords", v)} placeholder={t("settings.addKeyword")} />
          </Field>
          <Field label={t("settings.spamKeywords")}>
            <ListInput value={cfg.spam_keywords || []} onChange={(v) => set("spam_keywords", v)} placeholder={t("settings.addKeyword")} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.thresholds")}>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t("settings.hotMinMatches")} hint={t("settings.hotMinHint")}>
            <NumberInput value={cfg.hot_threshold || 2} onChange={(v) => set("hot_threshold", v)} min={1} max={10} />
          </Field>
          <Field label={t("settings.warmMinMatches")}>
            <NumberInput value={cfg.warm_threshold || 1} onChange={(v) => set("warm_threshold", v)} min={1} max={10} />
          </Field>
          <Field label={t("settings.confidenceThreshold")} hint={t("settings.confidenceHint")}>
            <NumberInput value={cfg.confidence_threshold || 0.5} onChange={(v) => set("confidence_threshold", v)} min={0} max={1} step={0.05} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Warmup ──────────────────────────────────────────────
function WarmupSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Flame} title={t("settings.accountWarmup")} desc={t("settings.warmupDesc")} />

      <Card title={t("settings.warmupChannels")}>
        <Field label={t("settings.readingChannels")} hint={t("settings.readingChannelsHint")}>
          <ListInput value={cfg.channels || []} onChange={(v) => set("channels", v)} placeholder={t("settings.channelPlaceholder")} />
        </Field>
        <div className="mt-4">
          <Field label={t("settings.reactions")} hint={t("settings.reactionsHint")}>
            <ListInput value={cfg.reactions || []} onChange={(v) => set("reactions", v)} placeholder={t("settings.addEmoji")} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.stageDuration")}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.stage1Passive")} hint={t("settings.stage1Hint")}>
            <NumberInput value={cfg.stage1_days || 3} onChange={(v) => set("stage1_days", v)} min={1} max={14} />
          </Field>
          <Field label={t("settings.stage2Engagement")} hint={t("settings.stage2Hint")}>
            <NumberInput value={cfg.stage2_days || 4} onChange={(v) => set("stage2_days", v)} min={1} max={14} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.actionLimits")}>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t("settings.stage1Actions")}>
            <NumberInput value={cfg.stage1_actions_per_day || 5} onChange={(v) => set("stage1_actions_per_day", v)} min={1} max={20} />
          </Field>
          <Field label={t("settings.stage2Actions")}>
            <NumberInput value={cfg.stage2_actions_per_day || 10} onChange={(v) => set("stage2_actions_per_day", v)} min={1} max={30} />
          </Field>
          <Field label={t("settings.stage3Limit")}>
            <NumberInput value={cfg.stage3_daily_limit || 20} onChange={(v) => set("stage3_daily_limit", v)} min={5} max={50} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.timing")}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.minDelay")}>
            <NumberInput value={cfg.random_delay_min_sec || 2} onChange={(v) => set("random_delay_min_sec", v)} min={1} max={30} />
          </Field>
          <Field label={t("settings.maxDelay")}>
            <NumberInput value={cfg.random_delay_max_sec || 8} onChange={(v) => set("random_delay_max_sec", v)} min={2} max={60} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Posting ─────────────────────────────────────────────
function PostingSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Send} title={t("settings.postingUtm")} desc={t("settings.postingDesc")} />

      <Card title={t("settings.utmDefaults")}>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t("settings.utmSource")}>
            <Input value={cfg.utm_source || "leadgen"} onChange={(v) => set("utm_source", v)} />
          </Field>
          <Field label={t("settings.utmMedium")}>
            <Input value={cfg.utm_medium || "social"} onChange={(v) => set("utm_medium", v)} />
          </Field>
          <Field label={t("settings.utmCampaign")}>
            <Input value={cfg.utm_campaign || "auto"} onChange={(v) => set("utm_campaign", v)} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.postingBehavior")}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.delayBetweenPosts")} hint={t("settings.delayHint")}>
            <NumberInput value={cfg.delay_between_posts_sec || 30} onChange={(v) => set("delay_between_posts_sec", v)} min={5} max={300} />
          </Field>
          <Field label={t("settings.maxCommentReplies")}>
            <NumberInput value={cfg.max_comment_replies_per_post || 10} onChange={(v) => set("max_comment_replies_per_post", v)} min={1} max={50} />
          </Field>
          <Field label={t("settings.commentScrapeDelay")} hint={t("settings.commentScrapeHint")}>
            <NumberInput value={cfg.comment_scrape_delay_sec || 120} onChange={(v) => set("comment_scrape_delay_sec", v)} min={30} max={600} />
          </Field>
          <Field label={t("settings.spintaxDepth")}>
            <NumberInput value={cfg.spintax_max_depth || 10} onChange={(v) => set("spintax_max_depth", v)} min={1} max={20} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Notifications ───────────────────────────────────────
function NotificationsSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Bell} title={t("settings.notifications")} desc={t("settings.notifDesc")} />

      <Card title={t("settings.emailNotifications")}>
        <div className="space-y-4">
          <Field label={t("settings.notifyOnScores")} hint={t("settings.notifyHint")}>
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
          <Field label={t("settings.emailSubjectPrefix")}>
            <Input value={cfg.email_subject_prefix || "[LeadGen]"} onChange={(v) => set("email_subject_prefix", v)} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.dailySummary")}>
        <div className="space-y-4">
          <Toggle value={cfg.daily_summary !== false} onChange={(v) => set("daily_summary", v)} label={t("settings.sendDailySummary")} />
          <Field label={t("settings.summaryHour")}>
            <NumberInput value={cfg.daily_summary_hour || 9} onChange={(v) => set("daily_summary_hour", v)} min={0} max={23} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Groups ──────────────────────────────────────────────
function GroupsSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SectionHeader Icon={UsersGroup} title={t("settings.groupScanning")} desc={t("settings.groupsDesc")} />

      <Card title={t("settings.scanBehavior")}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("settings.scanInterval")} hint={t("settings.scanIntervalHint")}>
            <NumberInput value={cfg.scan_interval_min || 30} onChange={(v) => set("scan_interval_min", v)} min={5} max={180} />
          </Field>
          <Field label={t("settings.maxMessagesPerScan")}>
            <NumberInput value={cfg.max_messages_per_scan || 50} onChange={(v) => set("max_messages_per_scan", v)} min={10} max={200} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.autoDiscovery")}>
        <div className="space-y-4">
          <Toggle value={cfg.auto_discover_enabled !== false} onChange={(v) => set("auto_discover_enabled", v)} label={t("settings.enableAutoDiscover")} />
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("settings.discoverInterval")}>
              <NumberInput value={cfg.auto_discover_interval_hours || 6} onChange={(v) => set("auto_discover_interval_hours", v)} min={1} max={48} />
            </Field>
            <Field label={t("settings.minMembers")} hint={t("settings.minMembersHint")}>
              <NumberInput value={cfg.min_members_count || 100} onChange={(v) => set("min_members_count", v)} min={10} max={10000} />
            </Field>
          </div>
          <Toggle value={cfg.prefer_open_comments !== false} onChange={(v) => set("prefer_open_comments", v)} label={t("settings.preferOpenComments")} />
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Account & Billing ───────────────────────────────────
function AccountSection() {
  const { auth } = useAuth();
  const { t } = useI18n();
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
    if (!auth?.token || !confirm(t("settings.loadDemoConfirm"))) return;
    setSeeding(true);
    try { const r = await seedDemoData(auth.token); setSeedResult(r); getSystemInfo(auth.token).then(setSysInfo); }
    finally { setSeeding(false); }
  };

  const handleBackup = async () => {
    if (!auth?.token) return;
    try {
      const blob = await backupLeads(auth.token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `backup_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { /* empty */ }
  };

  const handlePassChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    if (newPass !== confirmPass) { setPassErr(t("settings.passwordsMismatch")); return; }
    if (newPass.length < 8) { setPassErr(t("settings.minChars")); return; }
    setPassErr(""); setPassMsg("");
    try { await changePassword(auth.token, currentPass, newPass); setPassMsg(t("settings.changed")); setCurrentPass(""); setNewPass(""); setConfirmPass(""); }
    catch (err: any) { setPassErr(err.message || t("settings.saveFailed")); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Cog} title={t("settings.accountBilling")} desc={t("settings.accountDesc")} />

      <Card title={t("settings.companyProfile")}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label={t("settings.companyName")}>
            <Input value={companyName} onChange={setCompanyName} />
          </Field>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
              {saving ? t("settings.saving") : t("settings.saveBtn")}
            </button>
            {saved && <span className="text-emerald-400 text-sm">{t("settings.saved")}</span>}
          </div>
        </form>
      </Card>

      {sub && (
        <Card title={t("settings.subscription")}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-zinc-500">{t("settings.planLabel")}</span><span className="text-zinc-200 ml-2 font-medium capitalize">{sub.plan}</span></div>
            <div><span className="text-zinc-500">{t("settings.statusLabel")}</span>
              <span className={`ml-2 font-medium ${sub.status === "active" ? "text-emerald-400" : "text-rose-400"}`}>{sub.status}</span></div>
            <div><span className="text-zinc-500">{t("settings.postsUsed")}</span><span className="text-zinc-200 ml-2">{sub.monthly_posts_used} / {sub.monthly_posts_limit}</span></div>
            <div><span className="text-zinc-500">{t("settings.tokenCredits")}</span><span className="text-zinc-200 ml-2">{(sub.token_credits_balance || 0).toLocaleString()}</span></div>
            <div className="col-span-2"><span className="text-zinc-500">{t("settings.renewsLabel")}</span><span className="text-zinc-200 ml-2">{new Date(sub.current_period_end).toLocaleDateString()}</span></div>
          </div>
        </Card>
      )}

      {usage && (
        <Card title={t("settings.usagePeriod")}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-zinc-500">{t("settings.tokensUsed")}</span><span className="text-zinc-200 ml-2">{(usage.total_tokens_used || 0).toLocaleString()}</span></div>
            <div><span className="text-zinc-500">{t("settings.costLabel")}</span><span className="text-zinc-200 ml-2">${(usage.total_cost_usd || 0).toFixed(4)}</span></div>
          </div>
        </Card>
      )}

      {sysInfo && (
        <Card title={t("settings.systemInfo")}>
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

      <Card title={t("settings.demoBackup")}>
        <div className="flex gap-3">
          <button onClick={handleSeed} disabled={seeding}
            className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50">
            {seeding ? t("settings.loading") : t("settings.loadDemo")}
          </button>
          <button onClick={handleBackup}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700">
            {t("settings.downloadBackup")}
          </button>
        </div>
        {seedResult && (
          <div className="mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400">
            {seedResult.status === "already_seeded" ? t("settings.alreadySeeded").replace("{leads}", String(seedResult.leads)) :
              t("settings.seeded").replace("{targets}", String(seedResult.targets)).replace("{accounts}", String(seedResult.accounts)).replace("{campaigns}", String(seedResult.campaigns)).replace("{leads}", String(seedResult.leads))}
          </div>
        )}
      </Card>

      <Card title={t("settings.changePassword")}>
        <form onSubmit={handlePassChange} className="space-y-3">
          <Input type="password" value={currentPass} onChange={setCurrentPass} placeholder={t("settings.currentPassword")} />
          <Input type="password" value={newPass} onChange={setNewPass} placeholder={t("settings.newPassword")} />
          <Input type="password" value={confirmPass} onChange={setConfirmPass} placeholder={t("settings.confirmPassword")} />
          <div className="flex items-center gap-3">
            <button type="submit" className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">{t("settings.changePassword")}</button>
            {passMsg && <span className="text-emerald-400 text-sm">{passMsg}</span>}
            {passErr && <span className="text-rose-400 text-sm">{passErr}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────
function SectionHeader({ Icon, title, desc }: { Icon: React.FC<IconProps>; title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold flex items-center gap-2"><Icon className="w-5 h-5 text-emerald-400" />{title}</h2>
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
