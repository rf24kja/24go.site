"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/PlatformLink";
import { useAuth } from "@/lib/auth";
import { getLead, updateLeadStatus } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";

const INTENT_STYLES: Record<string, string> = {
  HOT: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  WARM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  COLD: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  SPAM: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

const STATUS_OPTIONS = ["new", "in_progress", "converted", "rejected"] as const;
const SOURCE_ICONS: Record<string, string> = { dm: "💬", comment: "💭", group: "👥", manual: "✏️", import: "📥", webhook: "🔗" };

export default function LeadDetailPage() {
  const { id } = useParams();
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const STATUS_LABELS: Record<string, string> = {
    new: t("leads.status.new"),
    in_progress: t("leads.status.inProgress"),
    converted: t("leads.status.converted"),
    rejected: t("leads.status.rejected"),
  };

  useEffect(() => {
    if (!auth?.token || !id) return;
    setLoading(true);
    getLead(auth.token, id as string)
      .then(setLead)
      .catch(() => toast(t("leads.notFound"), "error"))
      .finally(() => setLoading(false));
  }, [auth?.token, id]);

  async function handleStatusChange(newStatus: string) {
    if (!auth?.token || !lead) return;
    setSaving(true);
    try {
      await updateLeadStatus(auth.token, lead.id, newStatus);
      setLead((prev: any) => ({ ...prev, status: newStatus }));
      toast(`${t("leads.statusChanged")} — ${STATUS_LABELS[newStatus]}`, "success");
    } catch {
      toast(t("leads.statusUpdateFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/leads" className="text-sm text-zinc-400 hover:text-zinc-200">{t("leads.backToList")}</Link>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          <p className="text-zinc-500">{t("leads.loadingDetails")}</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-6">
        <Link href="/leads" className="text-sm text-zinc-400 hover:text-zinc-200">{t("leads.backToList")}</Link>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400">{t("leads.notFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/leads" className="text-zinc-400 hover:text-zinc-200">{t("leads.title")}</Link>
        <span className="text-zinc-600">/</span>
        <span className="text-zinc-200">{lead.user_handle}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-zinc-100">{lead.user_handle}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${INTENT_STYLES[lead.intent_score] ?? ""}`}>
            {lead.intent_score}
          </span>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
            {SOURCE_ICONS[lead.source || "dm"] || "💬"} {lead.source || "dm"}
          </span>
        </div>
        {lead.dialog_url && (
          <a href={lead.dialog_url} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs hover:bg-emerald-500/20 transition">
            {t("leads.openDialog")}
          </a>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard label={t("leads.fullName")} value={lead.user_full_name || "—"} />
        <InfoCard label={t("leads.platform")} value={(lead.platform || "—").charAt(0).toUpperCase() + (lead.platform || "").slice(1)} />
        <InfoCard label={t("leads.geo")} value={lead.geo_tag || "—"} />
        <InfoCard label={t("leads.created")} value={new Date(lead.created_at).toLocaleString()} />
        {lead.target_name && <InfoCard label={t("leads.target")} value={lead.target_name} />}
        {lead.post_id && <InfoCard label={t("leads.postId")} value={lead.post_id} mono />}
      </div>

      {/* Message */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">{t("leads.message")}</h2>
        <p className="text-sm text-zinc-300 bg-zinc-800 rounded-lg p-4 whitespace-pre-wrap leading-relaxed">
          {lead.message_text || t("leads.noMessage")}
        </p>
      </div>

      {/* Status Change */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">{t("leads.tableStatus")}</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button key={s} disabled={saving || lead.status === s}
              onClick={() => handleStatusChange(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition disabled:opacity-40 ${
                lead.status === s
                  ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500"
              }`}>
              {STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Timeline */}
      {lead.events && lead.events.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("leads.history")}</h2>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-800" />
            <div className="space-y-4">
              {lead.events.map((ev: any, i: number) => (
                <div key={i} className="flex items-start gap-4 relative">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs z-10 ${
                    ev.action === "status_change" ? "bg-amber-500/20 text-amber-400" :
                    ev.action === "created" ? "bg-emerald-500/20 text-emerald-400" :
                    "bg-zinc-700 text-zinc-400"
                  }`}>
                    {ev.action === "status_change" ? "↻" : ev.action === "created" ? "+" : "•"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-300">
                        {ev.action === "status_change" ? t("leads.statusChanged") :
                         ev.action === "created" ? t("leads.leadCreated") :
                         ev.action === "manual_run" ? t("leads.campaignRun") :
                         ev.action}
                      </span>
                    </div>
                    {ev.old_value?.status && ev.new_value?.status && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {STATUS_LABELS[ev.old_value.status] || ev.old_value.status}
                        {" → "}
                        {STATUS_LABELS[ev.new_value.status] || ev.new_value.status}
                      </p>
                    )}
                    {ev.created_at && (
                      <p className="text-xs text-zinc-600 mt-0.5">{new Date(ev.created_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {lead.events && lead.events.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">{t("leads.history")}</h2>
          <p className="text-xs text-zinc-600">{t("leads.noEvents")}</p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs mb-1">{label}</p>
      <p className={`text-sm text-zinc-200 truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
