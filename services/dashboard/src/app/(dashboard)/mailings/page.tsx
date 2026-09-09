"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { PlanGuard } from "@/components/PlanGuard";
import { usePlatform } from "@/lib/platform";
import { FieldHint } from "@/components/FieldHint";
import { Spinner } from "@/components/Spinner";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getMailings, createMailing, getMailing, importMailingRecipients,
  startMailing, pauseMailing, stopMailing, deleteMailing,
} from "@/lib/api";

type Mailing = {
  id: string;
  name: string;
  message_text: string;
  platform: string;
  status: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  delay_seconds: number;
  created_at: string | null;
  started_at: string | null;
  recipient_counts?: Record<string, number>;
};

export default function MailingsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { platform } = usePlatform();
  const [mailings, setMailings] = useState<Mailing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importMailId, setImportMailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Mailing | null>(null);
  const [form, setForm] = useState({ name: "", message_text: "", platform: "telegram", delay_seconds: "30" });
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getMailings(auth.token, { platform }).then((res) => setMailings(res.items || [])).catch(() => setMailings([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token, platform]);

  useEffect(() => { setForm((f) => ({ ...f, platform })); }, [platform]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    try {
      await createMailing(auth.token, {
        name: form.name,
        message_text: form.message_text,
        platform: form.platform,
        delay_seconds: parseInt(form.delay_seconds) || 30,
      });
      setShowCreate(false);
      setForm({ name: "", message_text: "", platform: "telegram", delay_seconds: "30" });
      load();
      toast(t("mailings.created"), "success");
    } catch (e: any) {
      toast(e.message || t("mailings.createFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (file: File) => {
    if (!auth?.token) return;
    const text = await file.text();
    try {
      const res = await importMailingRecipients(auth.token, text, importMailId || undefined);
      toast(t("mailings.importResult", { imported: res.imported, skipped: res.skipped }), "success");
      setShowImport(false);
      setImportMailId(null);
      if (res.imported > 0) load();
    } catch (e: any) {
      toast(e.message || t("mailings.importFailed"), "error");
    }
  };

  const openDetail = async (id: string) => {
    if (!auth?.token) return;
    try {
      const data = await getMailing(auth.token, id);
      setDetail(data);
    } catch (e: any) {
      toast(e.message || t("mailings.loadFailed"), "error");
    }
  };

  const handleStart = async (id: string) => {
    if (!auth?.token) return;
    try { await startMailing(auth.token, id); toast(t("mailings.started"), "success"); load(); } catch (e: any) { toast(e.message, "error"); }
  };

  const handlePause = async (id: string) => {
    if (!auth?.token) return;
    try { await pauseMailing(auth.token, id); toast(t("mailings.paused"), "success"); load(); } catch (e: any) { toast(e.message, "error"); }
  };

  const handleStop = async (id: string) => {
    if (!auth?.token) return;
    try { await stopMailing(auth.token, id); toast(t("mailings.stopped"), "success"); load(); } catch (e: any) { toast(e.message, "error"); }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm(t("mailings.deleteConfirm"))) return;
    try { await deleteMailing(auth.token, id); toast(t("mailings.deleted"), "success"); load(); setDetail(null); } catch (e: any) { toast(e.message, "error"); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImport(file);
  };

  const statusColor = (s: string) => {
    if (s === "running") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s === "paused") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (s === "completed") return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  };

  const progress = (m: Mailing) => m.total_count > 0 ? Math.round(((m.sent_count + m.failed_count) / m.total_count) * 100) : 0;

  return (
    <PlanGuard feature="mailings">
      <div className="space-y-6 animate-fade-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("mailings.title")}</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(true); setImportMailId(null); }}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 btn-press">
            {t("mailings.import")}
          </button>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 btn-press">
            {t("mailings.newMailing")}
          </button>
        </div>
      </div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : mailings.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-300 font-medium mb-2">{t("mailings.empty")}</p>
          <p className="text-xs text-zinc-500 mb-4">{t("mailings.emptyDesc")}</p>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">
            {t("mailings.createFirst")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mailings.map((m) => (
            <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3 cursor-pointer hover:border-zinc-700 transition"
              onClick={() => openDetail(m.id)}>
              <div className="flex items-start justify-between">
                <h2 className="text-zinc-100 font-medium truncate">{m.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColor(m.status)}`}>
                  {t(`mailings.status.${m.status}`)}
                </span>
              </div>
              <p className="text-zinc-400 text-sm line-clamp-2">{m.message_text}</p>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{m.platform === "telegram" ? "✈️" : "🔵"} {m.platform}</span>
                <span>·</span>
                <span>{m.total_count} {t("mailings.recipients")}</span>
                <span>·</span>
                <span>{t("mailings.delay")}: {m.delay_seconds}s</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5">
                <div className="bg-emerald-500/50 h-1.5 rounded-full transition-all" style={{ width: `${progress(m)}%` }} />
              </div>
              <div className="flex gap-2 text-xs text-zinc-500">
                <span className="text-emerald-400">{m.sent_count} {t("mailings.sent")}</span>
                <span className="text-rose-400">{m.failed_count} {t("mailings.failed")}</span>
                <span>{m.total_count - m.sent_count - m.failed_count} {t("mailings.pending")}</span>
              </div>
              <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                {m.status === "draft" && (
                  <button onClick={() => handleStart(m.id)} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 transition">
                    ▶ {t("mailings.start")}
                  </button>
                )}
                {m.status === "running" && (
                  <button onClick={() => handlePause(m.id)} className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs hover:bg-amber-500/20 transition">
                    ⏸ {t("mailings.pause")}
                  </button>
                )}
                {m.status === "paused" && (
                  <button onClick={() => handleStart(m.id)} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 transition">
                    ▶ {t("mailings.resume")}
                  </button>
                )}
                {(m.status === "running" || m.status === "paused") && (
                  <button onClick={() => handleStop(m.id)} className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-xs hover:bg-rose-500/20 transition">
                    ⏹ {t("mailings.stop")}
                  </button>
                )}
                {(m.status === "draft" || m.status === "completed") && (
                  <button onClick={() => handleDelete(m.id)} className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-xs hover:bg-rose-500/20 transition">
                    🗑 {t("mailings.delete")}
                  </button>
                )}
                <button onClick={() => { setShowImport(true); setImportMailId(m.id); }}
                  className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700 transition">
                  + {t("mailings.addRecipients")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("mailings.createTitle")}</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("mailings.nameLabel")} <FieldHint hint={t("hints.mailings.name")} /></label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                  placeholder={t("mailings.namePlaceholder")} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("mailings.messageLabel")} <FieldHint hint={t("hints.mailings.message")} /></label>
                <textarea required rows={4} value={form.message_text} onChange={(e) => setForm({ ...form, message_text: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none"
                  placeholder={t("mailings.messagePlaceholder")} />
                <p className="text-[10px] text-zinc-600 mt-1">{t("mailings.messageHint")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("mailings.platform")} <FieldHint hint={t("hints.mailings.platform")} /></label>
                  <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400 capitalize">
                    {platform === "vkontakte" ? "VKontakte" : "Telegram"}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("mailings.delayLabel")} <FieldHint hint={t("hints.mailings.delay")} /></label>
                  <input type="number" min="5" max="300" value={form.delay_seconds}
                    onChange={(e) => setForm({ ...form, delay_seconds: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
                  {t("mailings.cancel")}
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50 btn-press">
                  {saving ? t("mailings.creating") : t("mailings.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowImport(false); setImportMailId(null); }}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("mailings.importTitle")}</h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-700"
              }`}>
              <p className="text-zinc-400 text-sm mb-2">{t("mailings.dropCsv")}</p>
              <p className="text-zinc-600 text-xs mb-4">{t("mailings.csvHint")}</p>
              <input ref={fileRef} type="file" accept=".csv,.txt,.json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
              <button onClick={() => fileRef.current?.click()}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition">
                {t("mailings.selectFile")}
              </button>
            </div>
            <button onClick={() => { setShowImport(false); setImportMailId(null); }}
              className="w-full py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
              {t("mailings.cancel")}
            </button>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-6 space-y-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100">{detail.name}</h2>
              <button onClick={() => setDetail(null)} className="text-zinc-500 hover:text-zinc-300 text-xl">&times;</button>
            </div>
            <div className="bg-zinc-800 rounded-lg p-3 text-sm space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>{t("mailings.status")}</span>
                <span className={`font-medium ${statusColor(detail.status).split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                  {t(`mailings.status.${detail.status}`)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t("mailings.platform")}</span>
                <span className="text-zinc-200">{detail.platform}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t("mailings.delay")}</span>
                <span className="text-zinc-200">{detail.delay_seconds}s</span>
              </div>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2.5">
              <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${progress(detail)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{detail.sent_count}</p>
                <p className="text-xs text-zinc-500">{t("mailings.sent")}</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-rose-400">{detail.failed_count}</p>
                <p className="text-xs text-zinc-500">{t("mailings.failed")}</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-zinc-100">{detail.total_count}</p>
                <p className="text-xs text-zinc-500">{t("mailings.total")}</p>
              </div>
            </div>
            <div>
              <h3 className="text-xs text-zinc-500 mb-2">{t("mailings.message")}</h3>
              <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300 whitespace-pre-wrap">{detail.message_text}</div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PlanGuard>
  );
}
