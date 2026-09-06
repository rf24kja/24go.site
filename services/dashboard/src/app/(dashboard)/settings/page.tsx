"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  getTenantSettings, updateSettingsSection, resetSettingsSection,
  getSubscription, getUsage, updateTenant, changePassword,
  getSystemInfo, seedDemoData, backupLeads,
  getNotificationStatus, testSmtp, testWebhook,
} from "@/lib/api";
import {
  BrainCircuit, Flame, Send, Bell, UsersGroup, Cog, Zap, Shield, Database, Search,
  type IconProps,
} from "@/components/Icons";
import { useI18n } from "@/lib/i18n";
import { FieldHint } from "@/components/FieldHint";

type Section = "llm" | "warmup" | "posting" | "notifications" | "auto_reply" | "groups" | "webhooks" | "security" | "data" | "account" | "tgstat";

const getSections = (t: (k: string) => string): { key: Section; label: string; Icon: React.FC<IconProps> }[] => [
  { key: "llm", label: t("settings.section.ai"), Icon: BrainCircuit },
  { key: "warmup", label: t("settings.section.warmup"), Icon: Flame },
  { key: "posting", label: t("settings.section.posting"), Icon: Send },
  { key: "notifications", label: t("settings.section.notifications"), Icon: Bell },
  { key: "auto_reply", label: t("settings.autoReply"), Icon: Send },
  { key: "groups", label: t("settings.section.groups"), Icon: UsersGroup },
  { key: "tgstat", label: t("settings.section.tgstat"), Icon: Search },
  { key: "webhooks", label: t("settings.n8nIntegration"), Icon: Zap },
  { key: "security", label: t("settings.section.security"), Icon: Shield },
  { key: "data", label: t("settings.section.data"), Icon: Database },
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
    } catch { /* settings load failed — defaults will be shown */ }
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
    } catch { /* reset failed */ }
  };

  return (
    <div className={`flex gap-6 max-w-6xl animate-fade-slide-in`}>
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
            {activeSection === "auto_reply" && <AutoReplySection settings={settings.auto_reply || {}} defaults={defaults.auto_reply || {}} onSave={(v: Record<string, any>) => handleSaveSection("auto_reply", v)} onReset={() => handleResetSection("auto_reply")} saving={saving} />}
            {activeSection === "groups" && <GroupsSection settings={settings.groups || {}} defaults={defaults.groups || {}} onSave={(v: Record<string, any>) => handleSaveSection("groups", v)} onReset={() => handleResetSection("groups")} saving={saving} />}
            {activeSection === "tgstat" && <TgStatSection settings={settings.tgstat || {}} defaults={defaults.tgstat || {}} onSave={(v: Record<string, any>) => handleSaveSection("tgstat", v)} onReset={() => handleResetSection("tgstat")} saving={saving} />}
            {activeSection === "webhooks" && <WebhooksSection settings={settings.webhooks || {}} defaults={defaults.webhooks || {}} onSave={(v: Record<string, any>) => handleSaveSection("webhooks", v)} onReset={() => handleResetSection("webhooks")} saving={saving} />}
            {activeSection === "security" && <SecuritySection settings={settings.security || {}} defaults={defaults.security || {}} onSave={(v: Record<string, any>) => handleSaveSection("security", v)} onReset={() => handleResetSection("security")} saving={saving} />}
            {activeSection === "data" && <DataSection settings={settings.data || {}} defaults={defaults.data || {}} onSave={(v: Record<string, any>) => handleSaveSection("data", v)} onReset={() => handleResetSection("data")} saving={saving} />}
            {activeSection === "account" && <AccountSection />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Shared field components ───────────────────────────────────────
function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
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
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={text} onChange={setText} placeholder={placeholder || t("settings.addItem")} />
        <button type="button" onClick={() => { if (text.trim()) { onChange([...value, text.trim()]); setText(""); } }}
          className="px-3 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 whitespace-nowrap">{t("settings.add")}</button>
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
        className="px-5 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 btn-press">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={<>{t("settings.provider")} <FieldHint hint={t("hints.llmProvider")} /></>}>
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
            <Input value={cfg.model || ""} onChange={(v) => set("model", v)} placeholder={t("settings.modelPlaceholder")} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.systemPrompt")}>
        <Field label={<>{t("settings.llmPrompt")} <FieldHint hint={t("hints.llmPrompt")} /></>}>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={t("settings.hotMinMatches")} hint={t("settings.hotMinHint")}>
            <NumberInput value={cfg.hot_threshold || 2} onChange={(v) => set("hot_threshold", v)} min={1} max={10} />
          </Field>
          <Field label={t("settings.warmMinMatches")}>
            <NumberInput value={cfg.warm_threshold || 1} onChange={(v) => set("warm_threshold", v)} min={1} max={10} />
          </Field>
          <Field label={<>{t("settings.confidenceThreshold")} <FieldHint hint={t("hints.llmThreshold")} /></>}>
            <NumberInput value={cfg.confidence_threshold || 0.5} onChange={(v) => set("confidence_threshold", v)} min={0} max={1} step={0.05} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.llmAdvanced")}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={t("settings.temperature")} hint={t("settings.temperatureHint")}>
            <NumberInput value={cfg.temperature || 0.3} onChange={(v) => set("temperature", v)} min={0} max={1} step={0.05} />
          </Field>
          <Field label={t("settings.maxTokens")}>
            <NumberInput value={cfg.max_tokens || 500} onChange={(v) => set("max_tokens", v)} min={100} max={4000} step={100} />
          </Field>
          <Field label={t("settings.fallbackModel")}>
            <Input value={cfg.fallback_model || ""} onChange={(v) => set("fallback_model", v)} placeholder="deepseek-chat" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("settings.stage1Passive")} hint={t("settings.stage1Hint")}>
            <NumberInput value={cfg.stage1_days || 3} onChange={(v) => set("stage1_days", v)} min={1} max={14} />
          </Field>
          <Field label={t("settings.stage2Engagement")} hint={t("settings.stage2Hint")}>
            <NumberInput value={cfg.stage2_days || 4} onChange={(v) => set("stage2_days", v)} min={1} max={14} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.actionLimits")}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={<>{t("settings.minDelay")} <FieldHint hint={t("hints.warmupDelay")} /></>}>
            <NumberInput value={cfg.random_delay_min_sec || 2} onChange={(v) => set("random_delay_min_sec", v)} min={1} max={30} />
          </Field>
          <Field label={t("settings.maxDelay")}>
            <NumberInput value={cfg.random_delay_max_sec || 8} onChange={(v) => set("random_delay_max_sec", v)} min={2} max={60} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.warmupAdvanced")}>
        <div className="space-y-4">
          <Field label={t("settings.activityVariety")}>
            <div className="flex flex-wrap gap-3">
              {["reactions", "replies", "dms", "posts"].map((act) => {
                const active = (cfg.activity_types || ["reactions", "replies"]).includes(act);
                return (
                  <button key={act} onClick={() => {
                    const current = cfg.activity_types || ["reactions", "replies"];
                    set("activity_types", active ? current.filter((a: string) => a !== act) : [...current, act]);
                  }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition capitalize ${active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>{act}</button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("settings.quietHoursStart")} hint={t("settings.quietHoursHint")}>
              <NumberInput value={cfg.quiet_hours_start || 23} onChange={(v) => set("quiet_hours_start", v)} min={0} max={23} />
            </Field>
            <Field label={t("settings.quietHoursEnd")}>
              <NumberInput value={cfg.quiet_hours_end || 7} onChange={(v) => set("quiet_hours_end", v)} min={0} max={23} />
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <Field label={t("settings.weekendMode")}><p className="text-xs text-zinc-500">{t("settings.weekendModeHint")}</p></Field>
            <Toggle value={cfg.reduced_weekend || false} onChange={(v) => set("reduced_weekend", v)} />
          </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <Card title={t("settings.notifWebhooks")}>
        <div className="space-y-4">
          <Field label={t("settings.notifMinIntent")} hint={t("settings.notifMinIntentHint")}>
            <Select value={cfg.notify_min_intent || "WARM"} onChange={(v) => set("notify_min_intent", v)}
              options={[
                { value: "HOT", label: "HOT" },
                { value: "WARM", label: "WARM" },
                { value: "COLD", label: "COLD" },
              ]} />
          </Field>
          <Field label={<>{t("settings.notifTelegramToken")} <FieldHint hint={t("hints.tgBotToken")} /></>}>
            <Input value={cfg.telegram_bot_token || ""} onChange={(v) => set("telegram_bot_token", v)} placeholder="123456:ABC-DEF..." type="password" />
          </Field>
          <Field label={<>{t("settings.notifTelegramChat")} <FieldHint hint={t("hints.tgChatId")} /></>}>
            <Input value={cfg.telegram_chat_id || ""} onChange={(v) => set("telegram_chat_id", v)} placeholder="-1001234567890" />
          </Field>
          <Field label={t("settings.notifSlackWebhook")} hint={t("settings.notifSlackWebhookHint")}>
            <Input value={cfg.slack_webhook_url || ""} onChange={(v) => set("slack_webhook_url", v)} placeholder="https://hooks.slack.com/services/..." />
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

      <Card title={t("settings.notifAdvanced")}>
        <div className="space-y-4">
          <Field label={t("settings.digestFrequency")}>
            <Select value={cfg.digest_frequency || "realtime"} onChange={(v) => set("digest_frequency", v)}
              options={[{ value: "realtime", label: t("settings.digestRealtime") }, { value: "hourly", label: t("settings.digestHourly") }, { value: "daily", label: t("settings.digestDaily") }]} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("settings.notifQuietStart")} hint={t("settings.notifQuietHint")}>
              <NumberInput value={cfg.notif_quiet_start || 22} onChange={(v) => set("notif_quiet_start", v)} min={0} max={23} />
            </Field>
            <Field label={t("settings.notifQuietEnd")}>
              <NumberInput value={cfg.notif_quiet_end || 8} onChange={(v) => set("notif_quiet_end", v)} min={0} max={23} />
            </Field>
          </div>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Auto-Reply ──────────────────────────────────────────
function AutoReplySection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();

  const replies = cfg.replies || [];

  const addReply = () => {
    if (replies.length >= 10) return;
    set("replies", [...replies, ""]);
  };

  const updateReply = (idx: number, value: string) => {
    const next = [...replies];
    next[idx] = value;
    set("replies", next);
  };

  const removeReply = (idx: number) => {
    set("replies", replies.filter((_: string, i: number) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Send} title={t("settings.autoReply")} desc={t("settings.autoReplyDesc")} />

      <Card title={t("settings.autoReplyConfig")}>
        <div className="space-y-4">
          <Toggle value={cfg.enabled !== false} onChange={(v) => set("enabled", v)} label={t("settings.autoReplyEnabled")} />
          <Field label={t("settings.autoReplyMinIntent")} hint={t("settings.autoReplyMinIntentHint")}>
            <Select value={cfg.min_intent || "HOT"} onChange={(v) => set("min_intent", v)}
              options={[
                { value: "HOT", label: "HOT" },
                { value: "WARM", label: "WARM" },
              ]} />
          </Field>
          <Field label={t("settings.autoReplyMode")}>
            <Select value={cfg.reply_mode || "random"} onChange={(v) => set("reply_mode", v)}
              options={[
                { value: "random", label: t("settings.autoReplyRandom") },
                { value: "cyclic", label: t("settings.autoReplyCyclic") },
              ]} />
          </Field>
          <Field label={<>{t("settings.autoReplyReplies")} <FieldHint hint={t("hints.autoReply")} /></>} hint={`${replies.length}/10`}>
            <div className="space-y-2">
              {replies.map((reply: string, idx: number) => (
                <div key={idx} className="flex gap-2">
                  <textarea value={reply} onChange={(e) => updateReply(idx, e.target.value)} rows={2}
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500" />
                  <button type="button" onClick={() => removeReply(idx)}
                    className="px-2 text-zinc-500 hover:text-rose-400 transition self-start mt-1">×</button>
                </div>
              ))}
              {replies.length < 10 && (
                <button type="button" onClick={addReply}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 border-dashed rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition w-full">
                  + {t("settings.addReply")}
                </button>
              )}
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("settings.autoReplyDelay")} hint={t("settings.autoReplyDelayHint")}>
              <NumberInput value={cfg.reply_delay_seconds || 5} onChange={(v) => set("reply_delay_seconds", v)} min={0} max={60} />
            </Field>
            <Field label={t("settings.autoReplyMaxPerHour")} hint={t("settings.autoReplyMaxPerHourHint")}>
              <NumberInput value={cfg.max_replies_per_hour || 10} onChange={(v) => set("max_replies_per_hour", v)} min={1} max={100} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title={t("settings.autoReplyAdvanced")}>
        <div className="space-y-4">
          <Field label={t("settings.blacklistUsers")} hint={t("settings.blacklistHint")}>
            <Input value={cfg.blacklist_usernames || ""} onChange={(v) => set("blacklist_usernames", v)} placeholder="user1, user2, user3" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("settings.workHoursStart")} hint={t("settings.workHoursHint")}>
              <NumberInput value={cfg.work_hours_start || 9} onChange={(v) => set("work_hours_start", v)} min={0} max={23} />
            </Field>
            <Field label={t("settings.workHoursEnd")}>
              <NumberInput value={cfg.work_hours_end || 18} onChange={(v) => set("work_hours_end", v)} min={0} max={23} />
            </Field>
          </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

// ── Section: TgStat Search ──────────────────────────────────────
function TgStatSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Search} title={t("settings.tgstatTitle")} desc={t("settings.tgstatDesc")} />

      <Card title={t("settings.tgstatApiKey")}>
        <div className="space-y-4">
          <Field label={t("settings.tgstatTokenLabel")} hint={t("hints.tgstatToken")}>
            <Input value={cfg.api_token || ""} onChange={(v) => set("api_token", v)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" type="password" />
          </Field>
          <p className="text-xs text-zinc-500">
            {t("settings.tgstatHowToGet")}{" "}
            <a href="https://tgstat.ru/ru/account/api" target="_blank" rel="noopener noreferrer"
              className="text-emerald-400 hover:underline">tgstat.ru/ru/account/api</a>
          </p>
        </div>
      </Card>

      <Card title={t("settings.tgstatSearchSettings")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("settings.tgstatDefaultCountry")}>
            <Select value={cfg.default_country || "ru"} onChange={(v) => set("default_country", v)}
              options={[
                { value: "ru", label: "Россия" },
                { value: "all", label: "All" },
                { value: "th", label: "Thailand" },
                { value: "kz", label: "Kazakhstan" },
              ]} />
          </Field>
          <Field label={t("settings.tgstatDefaultLanguage")}>
            <Select value={cfg.default_language || "russian"} onChange={(v) => set("default_language", v)}
              options={[
                { value: "russian", label: "Русский" },
                { value: "english", label: "English" },
                { value: "thai", label: "Thai" },
              ]} />
          </Field>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Webhooks & Integrations ─────────────────────────────
function WebhooksSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();
  const { auth } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  const handleTest = async () => {
    const url = cfg.url;
    if (!url || !auth?.token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testWebhook(auth.token, url);
      setTestResult(res.success ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    }
    setTesting(false);
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Zap} title={t("settings.n8nIntegration")} desc={t("settings.n8nDesc")} />

      <Card title={t("settings.n8nEnabled")}>
        <div className="space-y-4">
          <Toggle value={cfg.enabled !== false} onChange={(v) => set("enabled", v)} label={t("settings.n8nEnabled")} />
          <Field label={<>{t("settings.n8nUrl")} <FieldHint hint={t("hints.n8nUrl")} /></>}>
            <Input value={cfg.url || ""} onChange={(v) => set("url", v)} placeholder="https://n8n.example.com/webhook/..." />
          </Field>
          <Field label={<>{t("settings.n8nSecret")} <FieldHint hint={t("hints.n8nSecret")} /></>}>
            <Input value={cfg.secret || ""} onChange={(v) => set("secret", v)} placeholder="optional_hmac_secret" type="password" />
          </Field>
          <div className="flex items-center gap-3">
            <button onClick={handleTest} disabled={testing || !cfg.url}
              className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 disabled:opacity-50">
              {testing ? t("settings.n8nTesting") : t("settings.n8nTest")}
            </button>
            {testResult === "ok" && <span className="text-emerald-400 text-sm">{t("settings.n8nSuccess")}</span>}
            {testResult === "fail" && <span className="text-rose-400 text-sm">{t("settings.n8nFailed")}</span>}
          </div>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Security & Access ─────────────────────────────────
function SecuritySection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();
  const { auth } = useAuth();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");

  useEffect(() => {
    if (!auth?.token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/api-keys`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    }).then(r => r.json()).then(d => setApiKeys(d.keys || [])).catch(() => {});
  }, [auth?.token]);

  const generateKey = async () => {
    if (!auth?.token || !newKeyName.trim()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      setGeneratedKey(data.key || "");
      setNewKeyName("");
      const list = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/api-keys`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      }).then(r => r.json());
      setApiKeys(list.keys || []);
    } catch {}
  };

  const revokeKey = async (id: string) => {
    if (!auth?.token || !confirm(t("settings.confirmRevoke"))) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/api-keys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    setApiKeys(apiKeys.filter((k: any) => k.id !== id));
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Shield} title={t("settings.security.title")} desc={t("settings.security.desc")} />
      <Card title={t("settings.security.auth")}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Field label={t("settings.security.2fa")}><p className="text-xs text-zinc-500">{t("settings.security.2faHint")}</p></Field>
            <Toggle value={cfg.two_factor_enabled || false} onChange={(v) => set("two_factor_enabled", v)} />
          </div>
          <Field label={t("settings.security.sessionTimeout")}>
            <Select value={cfg.session_timeout || "30min"} onChange={(v) => set("session_timeout", v)}
              options={[{ value: "15min", label: "15 minutes" }, { value: "30min", label: "30 minutes" }, { value: "1hr", label: "1 hour" }, { value: "4hr", label: "4 hours" }, { value: "24hr", label: "24 hours" }]} />
          </Field>
          <div className="flex items-center justify-between">
            <Field label={t("settings.security.loginNotif")}><p className="text-xs text-zinc-500">{t("settings.security.loginNotifHint")}</p></Field>
            <Toggle value={cfg.login_notifications !== false} onChange={(v) => set("login_notifications", v)} />
          </div>
        </div>
      </Card>
      <Card title={t("settings.security.ipWhitelist")}>
        <Field label={t("settings.security.ipWhitelist")} hint={t("settings.security.ipWhitelistHint")}>
          <textarea value={cfg.ip_whitelist || ""} onChange={(e) => set("ip_whitelist", e.target.value)} rows={3} placeholder={"192.168.1.1\n10.0.0.1"}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500" />
        </Field>
      </Card>
      <Card title={t("settings.security.apiKeys")}>
        <div className="space-y-3">
          {apiKeys.map((k: any) => (
            <div key={k.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm text-zinc-200">{k.name}</span>
                <span className="text-xs text-zinc-500 ml-2">{k.key_preview}</span>
                <span className="text-xs text-zinc-600 ml-2">{k.created_at?.slice(0,10)}</span>
              </div>
              <button onClick={() => revokeKey(k.id)} className="text-xs text-rose-400 hover:text-rose-300">{t("settings.revoke")}</button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newKeyName} onChange={setNewKeyName} placeholder={t("settings.security.keyName")} />
            <button onClick={generateKey} disabled={!newKeyName.trim()} className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 disabled:opacity-50 whitespace-nowrap">{t("settings.security.generateKey")}</button>
          </div>
          {generatedKey && (
            <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 font-mono break-all">
              {t("settings.security.copyKey")}: {generatedKey}
            </div>
          )}
        </div>
      </Card>
      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}

// ── Section: Data & Privacy ────────────────────────────────────
function DataSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();
  const { auth } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!auth?.token) return;
    setExporting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/export`, { headers: { Authorization: `Bearer ${auth.token}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `24go_export_${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (!auth?.token) return;
    if (!confirm(t("settings.data.deleteConfirm1"))) return;
    if (!confirm(t("settings.data.deleteConfirm2"))) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/delete-account`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ confirm: true }),
      });
      window.location.href = "/login";
    } catch {}
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Database} title={t("settings.data.title")} desc={t("settings.data.desc")} />
      <Card title={t("settings.data.retention")}>
        <div className="space-y-4">
          <Field label={t("settings.data.retentionPeriod")} hint={t("settings.data.retentionHint")}>
            <Select value={cfg.data_retention_days || "90"} onChange={(v) => set("data_retention_days", v)}
              options={[{ value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" }, { value: "180", label: "180 days" }, { value: "365", label: "365 days" }]} />
          </Field>
          <div className="flex items-center justify-between">
            <Field label={t("settings.data.autoDelete")}><p className="text-xs text-zinc-500">{t("settings.data.autoDeleteHint")}</p></Field>
            <Toggle value={cfg.auto_delete_old_leads || false} onChange={(v) => set("auto_delete_old_leads", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Field label={t("settings.data.gdpr")}><p className="text-xs text-zinc-500">{t("settings.data.gdprHint")}</p></Field>
            <Toggle value={cfg.gdpr_mode || false} onChange={(v) => set("gdpr_mode", v)} />
          </div>
        </div>
      </Card>
      <Card title={t("settings.data.export")}>
        <p className="text-sm text-zinc-400 mb-3">{t("settings.data.exportDesc")}</p>
        <button onClick={handleExport} disabled={exporting} className="px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50">
          {exporting ? t("settings.exporting") : t("settings.data.exportBtn")}
        </button>
      </Card>
      <Card title={t("settings.data.dangerZone")}>
        <p className="text-sm text-zinc-400 mb-3">{t("settings.data.deleteDesc")}</p>
        <button onClick={handleDeleteAccount} className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-sm font-medium hover:bg-rose-500/20">
          {t("settings.data.deleteBtn")}
        </button>
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
    } catch { /* backup failed */ }
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
              <button type="submit" disabled={saving} className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 btn-press">
              {saving ? t("settings.saving") : t("settings.saveBtn")}
            </button>
            {saved && <span className="text-emerald-400 text-sm">{t("settings.saved")}</span>}
          </div>
        </form>
      </Card>

      {sub && (
        <Card title={t("settings.subscription")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-zinc-500">{t("settings.tokensUsed")}</span><span className="text-zinc-200 ml-2">{(usage.total_tokens_used || 0).toLocaleString()}</span></div>
            <div><span className="text-zinc-500">{t("settings.costLabel")}</span><span className="text-zinc-200 ml-2">${(usage.total_cost_usd || 0).toFixed(4)}</span></div>
          </div>
        </Card>
      )}

      {sysInfo && (
        <Card title={t("settings.systemInfo")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
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
              className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50 btn-press">
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
            <button type="submit" className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 btn-press">{t("settings.changePassword")}</button>
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
