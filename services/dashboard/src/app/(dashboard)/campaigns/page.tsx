"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, getCampaignStats, runCampaign, previewCron } from "@/lib/api";
import { CardSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";

type Campaign = {
  id: string;
  name: string;
  base_text: string;
  target_geos: string[];
  target_niches: string[];
  is_active: boolean;
  schedule_cron: string | null;
  posts_per_day: number | null;
  timezone: string;
  last_posted_at: string | null;
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", base_text: "", target_geos: "", target_niches: "", schedule: "", posts_per_day: "5", timezone: "UTC" });
  const [saving, setSaving] = useState(false);
  const [statsCampaign, setStatsCampaign] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [cronPreview, setCronPreview] = useState<string[]>([]);

  const scheduleOptions = getScheduleOptions(t);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getCampaigns(auth.token).then((res) => setCampaigns(res.items || res)).catch(() => setCampaigns([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

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
    setForm({ name: "", base_text: "", target_geos: "", target_niches: "", schedule: "", posts_per_day: "5", timezone: "UTC" });
  };

  const openEdit = (c: Campaign) => {
    setModalMode("edit");
    setEditingId(c.id);
    setForm({
      name: c.name,
      base_text: c.base_text,
      target_geos: (c.target_geos || []).join(", "),
      target_niches: (c.target_niches || []).join(", "),
      schedule: c.schedule_cron || "",
      posts_per_day: String(c.posts_per_day || 5),
      timezone: c.timezone || "UTC",
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
        base_text: form.base_text,
        target_geos: form.target_geos.split(",").map((s) => s.trim()).filter(Boolean),
        target_niches: form.target_niches.split(",").map((s) => s.trim()).filter(Boolean),
        schedule_cron: form.schedule || null,
        posts_per_day: parseInt(form.posts_per_day) || 5,
        timezone: form.timezone,
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

  return (
    <div className={`space-y-6${!loading ? " animate-fade-in" : ""}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("campaigns.title")}</h1>
        <button onClick={openCreate}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">
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
                <h2 className="text-zinc-100 font-medium truncate">{c.name}</h2>
                <button onClick={() => toggleActive(c)}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition ${c.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20"}`}>
                  {c.is_active ? t("campaigns.active") : t("campaigns.paused")}
                </button>
              </div>
              <p className="text-zinc-400 text-sm line-clamp-2">{c.base_text}</p>
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
                <span>{c.posts_per_day || 5}/day</span>
                <span className="text-zinc-600">·</span>
                <span>🕐 {c.timezone || "UTC"}</span>
              </div>
              {c.last_posted_at && (
                <p className="text-[10px] text-zinc-600 mt-1">{t("campaigns.lastPosted", { date: new Date(c.last_posted_at).toLocaleString() })}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => openEdit(c)} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700 transition">{t("campaigns.edit")}</button>
                <button onClick={() => openStats(c)} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700 transition">{t("campaigns.stats")}</button>

                <button onClick={async () => {
                  if (!auth?.token || !confirm(t("campaigns.runConfirm"))) return;
                  try {
                    const result = await runCampaign(auth.token, c.id);
                    toast(t("campaigns.runSuccess", { target: result.target, account: result.account }), "success");
                  } catch (err: any) {
                    toast(err.message || t("campaigns.runFailed"), "error");
                  }
                }} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 transition">{t("campaigns.run")}</button>
                <button onClick={() => handleDelete(c.id)} className="px-3 py-1 text-rose-400 hover:bg-rose-500/10 rounded text-xs transition">{t("campaigns.delete")}</button>
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
              <input type="text" placeholder={t("campaigns.namePlaceholder")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              <textarea placeholder={t("campaigns.textPlaceholder")} required rows={4} value={form.base_text} onChange={(e) => setForm({ ...form, base_text: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none" />
              <input type="text" placeholder={t("campaigns.geosPlaceholder")} value={form.target_geos} onChange={(e) => setForm({ ...form, target_geos: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              <input type="text" placeholder={t("campaigns.nichesPlaceholder")} value={form.target_niches} onChange={(e) => setForm({ ...form, target_niches: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />

              {/* Schedule */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.schedule")}</label>
                  <select value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                    {scheduleOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.postsPerDay")}</label>
                  <input type="number" min="1" max="50" value={form.posts_per_day} onChange={(e) => setForm({ ...form, posts_per_day: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("campaigns.timezone")}</label>
                  <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                    <option value="UTC">{t("campaigns.tz.utc")}</option>
                    <option value="Europe/Moscow">{t("campaigns.tz.moscow")}</option>
                    <option value="Asia/Bangkok">{t("campaigns.tz.bangkok")}</option>
                    <option value="Asia/Phuket">{t("campaigns.tz.phuket")}</option>
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

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalMode(null)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("accounts.cancel")}</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50">
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
                    <p className="text-xs text-zinc-500">HOT</p>
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

                {/* Posts chart (simple bar) */}
                {statsCampaign.posts_by_day && statsCampaign.posts_by_day.length > 0 && (
                  <div>
                    <h3 className="text-xs text-zinc-500 mb-2">{t("campaigns.postsLast7")}</h3>
                    <div className="flex items-end gap-1 h-16">
                      {statsCampaign.posts_by_day.map((d: any) => {
                        const maxCount = Math.max(...statsCampaign.posts_by_day.map((x: any) => x.count), 1);
                        const height = Math.max(4, (d.count / maxCount) * 100);
                        return (
                          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[10px] text-zinc-500">{d.count}</span>
                            <div className="w-full bg-emerald-500/30 rounded-sm" style={{ height: `${height}%` }} />
                            <span className="text-[10px] text-zinc-600">{d.date.slice(5)}</span>
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
