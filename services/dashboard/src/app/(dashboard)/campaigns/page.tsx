"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePlatform } from "@/lib/platform";
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, getCampaignStats, runCampaign, previewCron } from "@/lib/api";
import { CardSkeleton } from "@/components/Skeleton";
import { GlassBarStatic } from "@/components/GlassChart";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";
import { FieldHint } from "@/components/FieldHint";
import { Paperclip, Image, Film, Smile, X, Upload } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  base_text: string;
  target_geos: string[];
  target_niches: string[];
  media_urls: string[];
  is_active: boolean;
  schedule_cron: string | null;
  posts_per_day: number | null;
  timezone: string;
  last_posted_at: string | null;
  ab_enabled: boolean;
  ab_variants: { name: string; text: string; weight: number; posts: number; leads: number }[];
  created_at: string;
};

const getScheduleOptions = (t: (k: string) => string) => [
  { label: t("campaigns.schedule.every30m"), value: "*/30 * * * *" },
  { label: t("campaigns.schedule.everyHour"), value: "0 * * * *" },
  { label: t("campaigns.schedule.every2h"), value: "0 */2 * * *" },
  { label: t("campaigns.schedule.every4h"), value: "0 */4 * * *" },
  { label: t("campaigns.schedule.every6h"), value: "0 */6 * * *" },
  { label: t("campaigns.schedule.threeTimes"), value: "0 8,14,20 * * *" },
  { label: t("campaigns.schedule.manual"), value: "" },
];

type ModalMode = "create" | "edit" | null;

export default function CampaignsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { platform } = usePlatform();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", emoji: "", base_text: "", target_geos: "", target_niches: "", media_urls: [] as string[], schedule: "", posts_per_day: "5", timezone: "UTC", ab_enabled: false, ab_variants: [] as { name: string; text: string; weight: number; posts: number; leads: number }[] });
  const [saving, setSaving] = useState(false);
  const [statsCampaign, setStatsCampaign] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [cronPreview, setCronPreview] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scheduleOptions = getScheduleOptions(t);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getCampaigns(auth.token, { platform }).then((res) => setCampaigns(res.items || res)).catch(() => setCampaigns([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token, platform]);

  // Cron preview: show next 5 run times when editing schedule
  useEffect(() => {
    const token = auth?.token;
    if (!token || !modalMode || !form.schedule) { setCronPreview([]); return; }
    const timer = setTimeout(() => {
      previewCron(token, form.schedule, form.timezone).then((res) => setCronPreview(res.runs || [])).catch(() => setCronPreview([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [auth?.token, modalMode, form.schedule, form.timezone]);

  const openCreate = () => {
    setModalMode("create");
    setEditingId(null);
    setForm({ name: "", description: "", emoji: "", base_text: "", target_geos: "", target_niches: "", media_urls: [], schedule: "", posts_per_day: "5", timezone: "UTC", ab_enabled: false, ab_variants: [] });
  };

  const openEdit = (c: Campaign) => {
    setModalMode("edit");
    setEditingId(c.id);
    setForm({
      name: c.name,
      description: c.description || "",
      emoji: c.emoji || "",
      base_text: c.base_text,
      target_geos: (c.target_geos || []).join(", "),
      target_niches: (c.target_niches || []).join(", "),
      media_urls: c.media_urls || [],
      schedule: c.schedule_cron || "",
      posts_per_day: String(c.posts_per_day || 5),
      timezone: c.timezone || "UTC",
      ab_enabled: c.ab_enabled || false,
      ab_variants: c.ab_variants || [],
    });
  };

  async function openStats(c: Campaign) {
    if (!auth?.token) return;
    setLoadingStats(true);
    setStatsCampaign(null);
    try {
      const stats = await getCampaignStats(auth.token, c.id);
      setStatsCampaign(stats);
    } catch {
      setStatsCampaign({ error: true });
    } finally {
      setLoadingStats(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    try {
      const data = {
        name: form.name,
        description: form.description || null,
        emoji: form.emoji || null,
        base_text: form.base_text,
        target_geos: form.target_geos.split(",").map((s) => s.trim()).filter(Boolean),
        target_niches: form.target_niches.split(",").map((s) => s.trim()).filter(Boolean),
        media_urls: form.media_urls,
        schedule_cron: form.schedule || null,
        posts_per_day: parseInt(form.posts_per_day) || 5,
        timezone: form.timezone,
        ab_enabled: form.ab_enabled,
        ab_variants: form.ab_enabled ? form.ab_variants : [],
      };
      if (modalMode === "edit" && editingId) {
        await updateCampaign(auth.token, editingId, data);
      } else {
        await createCampaign(auth.token, data);
      }
      setModalMode(null);
      load();
    } catch (e: any) {
      toast(e.message || t("campaigns.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm(t("campaigns.deleteConfirm"))) return;
    try { await deleteCampaign(auth.token, id); } catch { toast(t("campaigns.deleteFailed"), "error"); }
    load();
  };

  const toggleActive = async (c: Campaign) => {
    if (!auth?.token) return;
    try { await updateCampaign(auth.token, c.id, { is_active: !c.is_active }); } catch { toast(t("campaigns.toggleFailed"), "error"); }
    load();
  };

  const COMMON_EMOJI = [
    "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘",
    "😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🤫","🤔",
    "🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪",
    "🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸",
    "😎","🤓","🧐","😕","🫤","😟","🙁","😮","😯","😲","😳","🥺","🥹","😦","😧",
    "😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡",
    "😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖",
    "👍","👎","👊","✊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✌️","🤞","🫰",
    "🤟","🤘","👌","🤌","🤏","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","🫱",
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓",
    "💗","💖","💘","💝","💟","🔥","💯","⭐","🌟","✨","⚡","💥","🎉","🎊","🏆",
    "📱","💻","🌐","🔗","📊","📈","🔍","📝","📌","🎯","🚀","💡","📢","📣","💰",
    "🎁","✅","❌","⚠️","💬","🕐","📅","🔑","🔒","🔓","🎵","🎶","🏷️","📍","🔔",
  ];

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setForm((prev) => ({ ...prev, media_urls: [...prev.media_urls, base64] }));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className={`space-y-6 animate-fade-slide-in`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("campaigns.title")}</h1>
        <button onClick={openCreate}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 btn-press">
          {t("campaigns.newCampaign")}
        </button>
      </div>

      {/* How campaigns work */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-2">{t("campaigns.howPosting")}</h2>
        <p className="text-xs text-zinc-500">
          {t("campaigns.howPostingDesc")}{" "}
          <strong className="text-zinc-400">spintax</strong> {t("campaigns.spintaxHint")}{" "}
          <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">{'{Hello|Hi|Hey}'}</code> {t("campaigns.spintaxRotate")}{" "}
          {t("campaigns.scrapeHint")}
        </p>
      </div>

      {loading ? (
        <CardSkeleton count={6} />
      ) : campaigns.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-300 font-medium mb-2">{t("campaigns.empty")}</p>
          <p className="text-xs text-zinc-500 mb-4 max-w-md mx-auto">
            {t("campaigns.emptyDesc")}
          </p>
          <button onClick={openCreate}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">
            {t("campaigns.createFirst")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {c.emoji && <span className="text-lg">{c.emoji}</span>}
                  <h2 className="text-zinc-100 font-medium truncate">{c.name}</h2>
                  {c.ab_enabled && (
                    <span className="px-1.5 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded text-[10px] font-medium shrink-0">A/B</span>
                  )}
                </div>
                <button onClick={() => toggleActive(c)}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition ${c.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20"}`}>
                  {c.is_active ? t("campaigns.active") : t("campaigns.paused")}
                </button>
              </div>
              {c.description && <p className="text-zinc-500 text-xs line-clamp-1">{c.description}</p>}
              <p className="text-zinc-400 text-sm line-clamp-2">{c.base_text}</p>
              {(c.media_urls || []).length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {c.media_urls.slice(0, 4).map((url, i) => (
                    <div key={i} className="w-10 h-10 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                      {url.startsWith("data:image") ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : url.startsWith("data:video") ? (
                        <Film size={14} className="text-zinc-500" />
                      ) : (
                        <Paperclip size={14} className="text-zinc-500" />
                      )}
                    </div>
                  ))}
                  {c.media_urls.length > 4 && (
                    <div className="w-10 h-10 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <span className="text-[10px] text-zinc-500">+{c.media_urls.length - 4}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {(c.target_geos || []).map((geo) => (
                  <span key={geo} className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded text-xs">{geo}</span>
                ))}
                {(c.target_niches || []).map((niche) => (
                  <span key={niche} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs">{niche}</span>
                ))}
              </div>
              {/* Schedule info */}
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>📅</span>
                <span>{c.schedule_cron ? scheduleOptions.find((o) => o.value === c.schedule_cron)?.label || c.schedule_cron : t("campaigns.manual")}</span>
                <span className="text-zinc-600">·</span>
                <span>{c.posts_per_day || 5}{t("campaigns.perDaySuffix")}</span>
                <span className="text-zinc-600">·</span>
                <span>🕐 {c.timezone || "UTC"}</span>
              </div>
              {c.last_posted_at && (
                <p className="text-[10px] text-zinc-600 mt-1">{t("campaigns.lastPosted", { date: new Date(c.last_posted_at).toLocaleString() })}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => openEdit(c)} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700 transition min-h-[36px]">{t("campaigns.edit")}</button>
                <button onClick={() => openStats(c)} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700 transition min-h-[36px]">{t("campaigns.stats")}</button>

                <button onClick={async () => {
                  if (!auth?.token || !confirm(t("campaigns.runConfirm"))) return;
                  try {
                    const result = await runCampaign(auth.token, c.id);
                    toast(t("campaigns.runSuccess", { target: result.target, account: result.account }), "success");
                  } catch (err: any) {
                    toast(err.message || t("campaigns.runFailed"), "error");
                  }
                }} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 transition min-h-[36px]">{t("campaigns.run")}</button>
                <button onClick={() => handleDelete(c.id)} className="px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 rounded text-xs transition min-h-[36px]">{t("campaigns.delete")}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalMode(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{modalMode === "edit" ? t("campaigns.editTitle") : t("campaigns.createTitle")}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.namePlaceholder")} <FieldHint hint={t("campaigns.hint.name")} /></label>
                <input type="text" placeholder={t("campaigns.namePlaceholder")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.descriptionLabel")}</label>
                <textarea placeholder={t("campaigns.descriptionPlaceholder")} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none" />
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition">
                    <Smile size={14} />
                    {form.emoji || "Emoji"}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 z-10 grid grid-cols-6 sm:grid-cols-8 gap-1 max-w-[280px] sm:w-72 shadow-xl">
                      {COMMON_EMOJI.map((em) => (
                        <button key={em} type="button" onClick={() => { setForm({ ...form, emoji: em }); setShowEmojiPicker(false); }}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-700 text-sm transition">
                          {em}
                        </button>
                      ))}
                      {form.emoji && (
                        <button type="button" onClick={() => setForm({ ...form, emoji: "" })}
                          className="col-span-8 text-center text-xs text-zinc-500 hover:text-zinc-300 py-1 mt-1 border-t border-zinc-700">
                          {t("campaigns.removeEmoji")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.textPlaceholder")} <FieldHint hint={t("campaigns.hint.text")} /></label>
                <textarea placeholder={t("campaigns.textPlaceholder")} required rows={4} value={form.base_text} onChange={(e) => setForm({ ...form, base_text: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none" />
              </div>

              {/* Attachments */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.attachmentsLabel")}</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-700 hover:border-zinc-600"}`}>
                  <Upload size={18} className="mx-auto mb-1 text-zinc-500" />
                  <p className="text-xs text-zinc-500">{t("campaigns.dropFiles")}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{t("campaigns.dropFilesHint")}</p>
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden"
                  onChange={(e) => handleFiles(e.target.files)} />
                {form.media_urls.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {form.media_urls.map((url, i) => (
                      <div key={i} className="relative group w-14 h-14 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden">
                        {url.startsWith("data:image") ? (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        ) : url.startsWith("data:video") ? (
                          <div className="w-full h-full flex items-center justify-center"><Film size={16} className="text-zinc-500" /></div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Paperclip size={16} className="text-zinc-500" /></div>
                        )}
                        <button type="button" onClick={() => setForm({ ...form, media_urls: form.media_urls.filter((_, j) => j !== i) })}
                          className="absolute top-0.5 right-0.5 bg-zinc-900/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                          <X size={10} className="text-zinc-300" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.geosPlaceholder")} <FieldHint hint={t("campaigns.hint.geos")} /></label>
                <input type="text" placeholder={t("campaigns.geosPlaceholder")} value={form.target_geos} onChange={(e) => setForm({ ...form, target_geos: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.nichesPlaceholder")} <FieldHint hint={t("campaigns.hint.niches")} /></label>
                <input type="text" placeholder={t("campaigns.nichesPlaceholder")} value={form.target_niches} onChange={(e) => setForm({ ...form, target_niches: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.schedule")} <FieldHint hint={t("campaigns.hint.schedule")} /></label>
                  <select value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                    {scheduleOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.postsPerDay")} <FieldHint hint={t("campaigns.hint.postsPerDay")} /></label>
                  <input type="number" min="1" max="50" value={form.posts_per_day} onChange={(e) => setForm({ ...form, posts_per_day: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.timezone")} <FieldHint hint={t("campaigns.hint.timezone")} /></label>
                  <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                    <option value="UTC">{t("campaigns.tz.utc")}</option>
                    <option value="Europe/Moscow">{t("campaigns.tz.moscow")}</option>
                    <option value="Asia/Bangkok">{t("campaigns.tz.bangkok")}</option>

                    <option value="Europe/London">{t("campaigns.tz.london")}</option>
                    <option value="America/New_York">{t("campaigns.tz.newYork")}</option>
                    <option value="Asia/Dubai">{t("campaigns.tz.dubai")}</option>
                  </select>
                </div>
              </div>

              {/* Cron Preview */}
              {cronPreview.length > 0 && (
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-zinc-500 mb-1">{t("campaigns.nextRuns", { timezone: form.timezone })}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {cronPreview.map((tt, i) => (
                      <span key={i} className="text-[11px] text-zinc-400 font-mono">
                        {new Date(tt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* A/B Testing */}
              <div className="border border-zinc-700 rounded-lg p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.ab_enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setForm({
                        ...form,
                        ab_enabled: enabled,
                        ab_variants: enabled && form.ab_variants.length === 0
                          ? [
                              { name: "Variant A", text: form.base_text, weight: 50, posts: 0, leads: 0 },
                              { name: "Variant B", text: "", weight: 50, posts: 0, leads: 0 },
                            ]
                          : form.ab_variants,
                      });
                    }}
                    className="rounded border-zinc-600 bg-zinc-800" />
                  <span className="text-sm text-zinc-300 font-medium">{t("campaigns.abTest")}</span>
                </label>
                <p className="text-[11px] text-zinc-500">{t("campaigns.abTestDesc")}</p>

                {form.ab_enabled && (
                  <div className="space-y-3">
                    {form.ab_variants.map((v, i) => (
                      <div key={i} className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <input type="text" value={v.name} placeholder={`${t("campaigns.variantName")} ${String.fromCharCode(65 + i)}`}
                            onChange={(e) => {
                              const variants = [...form.ab_variants];
                              variants[i] = { ...variants[i], name: e.target.value };
                              setForm({ ...form, ab_variants: variants });
                            }}
                            className="bg-transparent text-sm text-zinc-200 font-medium border-b border-zinc-700 focus:border-zinc-500 outline-none w-32" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500">{t("campaigns.variantWeight")}:</span>
                            <input type="number" min="1" max="100" value={v.weight}
                              onChange={(e) => {
                                const variants = [...form.ab_variants];
                                variants[i] = { ...variants[i], weight: parseInt(e.target.value) || 50 };
                                setForm({ ...form, ab_variants: variants });
                              }}
                              className="w-14 px-1 py-0.5 bg-zinc-700 border border-zinc-600 rounded text-xs text-zinc-200 text-center" />
                            {form.ab_variants.length > 2 && (
                              <button type="button" onClick={() => setForm({ ...form, ab_variants: form.ab_variants.filter((_, j) => j !== i) })}
                                className="text-rose-400 hover:text-rose-300 text-xs">{t("campaigns.removeVariant")}</button>
                            )}
                          </div>
                        </div>
                        <textarea rows={2} value={v.text} placeholder={`${t("campaigns.variantName")} ${String.fromCharCode(65 + i)} — ${t("campaigns.textPlaceholder")}`}
                          onChange={(e) => {
                            const variants = [...form.ab_variants];
                            variants[i] = { ...variants[i], text: e.target.value };
                            setForm({ ...form, ab_variants: variants });
                          }}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 resize-none" />
                        {/* Show stats if editing existing campaign */}
                        {modalMode === "edit" && (v.posts > 0 || v.leads > 0) && (
                          <div className="flex gap-3 text-[10px] text-zinc-500">
                            <span>{t("campaigns.variantPosts")}: {v.posts}</span>
                            <span>{t("campaigns.variantLeads")}: {v.leads}</span>
                            <span>{t("campaigns.variantConversion")}: {v.posts > 0 ? ((v.leads / v.posts) * 100).toFixed(1) : "0"}%</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {form.ab_variants.length < 4 && (
                      <button type="button" onClick={() => setForm({
                        ...form,
                        ab_variants: [...form.ab_variants, { name: `Variant ${String.fromCharCode(65 + form.ab_variants.length)}`, text: "", weight: 50, posts: 0, leads: 0 }],
                      })}
                        className="w-full py-1.5 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition">
                        + {t("campaigns.addVariant")}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalMode(null)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("accounts.cancel")}</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50 btn-press">
                  {saving ? t("campaigns.saving") : modalMode === "edit" ? t("campaigns.update") : t("campaigns.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign stats drawer */}
      {statsCampaign && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setStatsCampaign(null)}>
          <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-6 space-y-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100">{statsCampaign.campaign_name || t("campaigns.statsTitle")}</h2>
              <button onClick={() => setStatsCampaign(null)} className="text-zinc-500 hover:text-zinc-300 text-xl">&times;</button>
            </div>

            {loadingStats ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Spinner size={14} /> {t("campaigns.loading")}
              </div>
            ) : statsCampaign.error ? (
              <p className="text-rose-400 text-sm">{t("campaigns.statsFailed")}</p>
            ) : (
              <>
                {/* Key metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-zinc-100">{statsCampaign.total_posts || 0}</p>
                    <p className="text-xs text-zinc-500">{t("campaigns.posts")}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-zinc-100">{statsCampaign.total_leads || 0}</p>
                    <p className="text-xs text-zinc-500">{t("campaigns.leads")}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-rose-400">{statsCampaign.hot_leads || 0}</p>
                    <p className="text-xs text-zinc-500">{t("campaigns.hotStats")}</p>
                  </div>
                </div>

                {/* Schedule info */}
                <div className="bg-zinc-800 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>{t("campaigns.schedule")}</span>
                    <span className="text-zinc-200">{statsCampaign.schedule_cron || t("campaigns.manual")}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>{t("campaigns.timezone")}</span>
                    <span className="text-zinc-200">{statsCampaign.timezone}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>{t("campaigns.lastPostedLabel")}</span>
                    <span className="text-zinc-200">{statsCampaign.last_posted_at ? new Date(statsCampaign.last_posted_at).toLocaleString() : t("campaigns.never")}</span>
                  </div>
                </div>

                {/* Intent breakdown */}
                {statsCampaign.intent_breakdown && Object.keys(statsCampaign.intent_breakdown).length > 0 && (
                  <div>
                    <h3 className="text-xs text-zinc-500 mb-2">{t("campaigns.intentBreakdown")}</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(statsCampaign.intent_breakdown).map(([k, v]) => (
                        <span key={k} className={`px-2 py-1 rounded text-xs font-medium ${
                          k === "HOT" ? "bg-rose-500/10 text-rose-400" :
                          k === "WARM" ? "bg-amber-500/10 text-amber-400" :
                          k === "COLD" ? "bg-sky-500/10 text-sky-400" :
                          "bg-zinc-700 text-zinc-400"
                        }`}>
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Geo breakdown */}
                {statsCampaign.geo_breakdown && statsCampaign.geo_breakdown.length > 0 && (
                  <div>
                    <h3 className="text-xs text-zinc-500 mb-2">{t("campaigns.leadsByGeo")}</h3>
                    <div className="space-y-1">
                      {statsCampaign.geo_breakdown.slice(0, 5).map((g: any) => (
                        <div key={g.geo} className="flex justify-between text-sm">
                          <span className="text-zinc-300">{g.geo}</span>
                          <span className="text-zinc-500">{g.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posts chart (glass 3D bar) */}
                {statsCampaign.posts_by_day && statsCampaign.posts_by_day.length > 0 && (
                  <div>
                    <h3 className="text-xs text-zinc-500 mb-2">{t("campaigns.postsLast7")}</h3>
                    <GlassBarStatic data={statsCampaign.posts_by_day} />
                  </div>
                )}

                {/* A/B Test Variants */}
                {statsCampaign.ab_enabled && statsCampaign.ab_variants && statsCampaign.ab_variants.length > 0 && (
                  <div>
                    <h3 className="text-xs text-zinc-500 mb-2">{t("campaigns.abTest")}</h3>
                    <div className="space-y-2">
                      {statsCampaign.ab_variants.map((v: any, i: number) => {
                        const maxPosts = Math.max(...statsCampaign.ab_variants.map((x: any) => x.posts || 0), 1);
                        const width = Math.max(4, ((v.posts || 0) / maxPosts) * 100);
                        const conv = v.posts > 0 ? ((v.leads / v.posts) * 100).toFixed(1) : "0";
                        return (
                          <div key={i} className="bg-zinc-800 rounded-lg p-2 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-300 font-medium">{v.name}</span>
                              <span className="text-zinc-500">w:{v.weight}</span>
                            </div>
                            <div className="w-full bg-zinc-700 rounded-full h-1.5">
                              <div className="bg-violet-500/50 h-1.5 rounded-full" style={{ width: `${width}%` }} />
                            </div>
                            <div className="flex gap-3 text-[10px] text-zinc-500">
                              <span>{t("campaigns.variantPosts")}: {v.posts || 0}</span>
                              <span>{t("campaigns.variantLeads")}: {v.leads || 0}</span>
                              <span>{t("campaigns.variantConversion")}: {conv}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
