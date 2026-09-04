"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getLeads, qualifyLead, updateLeadStatus, exportLeadsCsv, importLeadsCsv, getLead } from "@/lib/api";
import { useWebSocket } from "@/lib/useWebSocket";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { useI18n } from "@/lib/i18n";

type Lead = {
  id: string;
  user_handle: string;
  user_full_name?: string;
  intent_score: "HOT" | "WARM" | "COLD" | "SPAM";
  platform?: string;
  message_text: string;
  geo_tag: string;
  status: string;
  source?: string;
  post_id?: string;
  dialog_url?: string;
  target_name?: string;
  created_at: string;
};

type LeadDetail = Lead & {
  events?: { action: string; old_value?: any; new_value?: any; created_at?: string }[];
};

const INTENT_STYLES: Record<string, string> = {
  HOT: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  WARM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  COLD: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  SPAM: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

const COLUMNS = [
  { key: "new", label: "New", color: "border-sky-500/30" },
  { key: "in_progress", label: "In Progress", color: "border-amber-500/30" },
  { key: "converted", label: "Converted", color: "border-emerald-500/30" },
  { key: "rejected", label: "Rejected", color: "border-zinc-500/30" },
] as const;

const STATUS_OPTIONS = ["new", "in_progress", "converted", "rejected"] as const;

const SOURCE_ICONS: Record<string, string> = { dm: "💬", comment: "💭", manual: "✏️", import: "📥", webhook: "🔗" };

export default function LeadsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [testHandle, setTestHandle] = useState("@test_user");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [qualifying, setQualifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const { connected, lastEvent } = useWebSocket(auth?.user?.tenant_id ?? null, auth?.token ?? null);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const PAGE_SIZE = 50;

  const STATUS_LABELS: Record<string, string> = {
    new: t("leads.status.new"),
    in_progress: t("leads.status.inProgress"),
    converted: t("leads.status.converted"),
    rejected: t("leads.status.rejected"),
  };

  const columns = COLUMNS.map((c) => ({
    ...c,
    label: c.key === "new" ? t("leads.status.new") : c.key === "in_progress" ? t("leads.status.inProgress") : c.key === "converted" ? t("leads.status.converted") : t("leads.status.rejected"),
  }));

  // Real-time: when a new lead event arrives, add it to the list
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "lead_created" || lastEvent.type === "lead_qualified") {
      const newLead = lastEvent.data as Lead;
      setLeads((prev) => {
        if (prev.some((l) => l.id === newLead.id)) return prev;
        return [newLead, ...prev];
      });
    }
  }, [lastEvent]);

  useEffect(() => {
    if (!auth?.token) return;
    const token = auth.token;
    const timer = setTimeout(() => {
      setLeads([]);
      setLoading(true);
      getLeads(token, {
        intent_score: filter === "ALL" ? undefined : filter,
        limit: PAGE_SIZE, offset: 0,
      } as any).then((res) => {
        let items = res.items || res;
        if (sourceFilter !== "all") items = items.filter((l: Lead) => (l.source || "dm") === sourceFilter);
        setLeads(items);
        setTotal(res.total || items.length);
      }).catch((e) => { console.error("Failed to load leads:", e); setLeads([]); setTotal(0); }).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [auth?.token, filter, sourceFilter]);

  function loadMore() {
    if (!auth?.token || loadingMore) return;
    setLoadingMore(true);
    getLeads(auth.token, { intent_score: filter === "ALL" ? undefined : filter, limit: PAGE_SIZE, offset: leads.length })
      .then((res) => { setLeads((prev) => [...prev, ...(res.items || res)]); setTotal(res.total || total); })
      .catch((e) => console.error("Failed to load more leads:", e))
      .finally(() => setLoadingMore(false));
  }

  // Keep selected lead in sync with list
  useEffect(() => {
    if (selectedLead) {
      const updated = leads.find((l) => l.id === selectedLead.id);
      if (updated) setSelectedLead((prev) => prev ? { ...prev, ...updated } : prev);
    }
  }, [leads, selectedLead?.id]);

  async function openLeadDetail(lead: Lead) {
    setSelectedLead({ ...lead, events: [] } as LeadDetail);
    if (!auth?.token) return;
    setLoadingDetail(true);
    try {
      const detail = await getLead(auth.token, lead.id);
      setSelectedLead(detail);
    } catch (e) {
      console.error("Failed to load lead detail:", e);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleQualify(e: React.FormEvent) {
    e.preventDefault();
    if (!auth?.token || !testMessage.trim()) return;
    setQualifying(true);
    setTestResult(null);
    try {
      const result = await qualifyLead(auth.token, {
        user_handle: testHandle,
        message_text: testMessage,
      });
      setTestResult(result);
      setTestMessage("");
    } finally {
      setQualifying(false);
    }
  }

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId);
    setDraggingId(leadId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(colKey);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverCol(null), []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setDragOverCol(null);
    if (!auth?.token || !leadId) return;
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    try {
      await updateLeadStatus(auth.token, leadId, newStatus);
    } catch {
      getLeads(auth.token, filter === "ALL" ? undefined : { intent_score: filter }).then((res) => setLeads(res.items || res));
    }
  }, [auth?.token, filter]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    if (!auth?.token) return;
    setDetailSaving(true);
    try {
      await updateLeadStatus(auth.token, leadId, newStatus);
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    } finally {
      setDetailSaving(false);
    }
  };

  function groupedLeads(colKey: string) {
    return leads.filter((l) => l.status === colKey);
  }

  const summaryCounts = {
    HOT: leads.filter((l) => l.intent_score === "HOT").length,
    WARM: leads.filter((l) => l.intent_score === "WARM").length,
    COLD: leads.filter((l) => l.intent_score === "COLD").length,
    SPAM: leads.filter((l) => l.intent_score === "SPAM").length,
    total: leads.length,
  };

  return (
    <div className={`space-y-6 animate-fade-slide-in`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("leads.title")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {[{ key: "ALL", label: t("leads.filterAll") }, { key: "HOT", label: t("leads.filterHot") }, { key: "WARM", label: t("leads.filterWarm") }, { key: "COLD", label: t("leads.filterCold") }, { key: "SPAM", label: t("leads.filterSpam") }].map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${filter === f.key ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 text-xs">
            {[
              { key: "all", label: t("leads.sourceAll") },
              { key: "dm", label: t("leads.sourceDm") },
              { key: "comment", label: t("leads.sourceComment") },
              { key: "manual", label: t("leads.sourceManual") },
            ].map((s) => (
              <button key={s.key} onClick={() => setSourceFilter(s.key)}
                className={`px-2 py-1 rounded transition ${sourceFilter === s.key ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            <button onClick={() => setView("table")}
              className={`px-3 py-1 rounded-md text-sm transition ${view === "table" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"}`}>
              {t("leads.viewTable")}
            </button>
            <button onClick={() => setView("kanban")}
              className={`px-3 py-1 rounded-md text-sm transition ${view === "kanban" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"}`}>
              {t("leads.viewKanban")}
            </button>
          </div>
          <button onClick={async () => {
              if (!auth?.token) return;
              try {
                const blob = await exportLeadsCsv(auth.token, filter !== "ALL" ? { intent_score: filter } : undefined);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
                a.click(); URL.revokeObjectURL(url);
              } catch (e) { console.error("Failed to export CSV:", e); }
            }}
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition">
            {t("leads.exportCsv")}
          </button>
          <label className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition cursor-pointer">
            {t("leads.import")}
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !auth?.token) return;
              try {
                const text = await file.text();
                const result = await importLeadsCsv(auth.token, text);
                const msg = t("leads.importResult").replace("{imported}", String(result.imported)).replace("{skipped}", String(result.skipped)) + (result.errors?.length ? ` — ${result.errors.slice(0,3).join("; ")}` : "");
                toast(msg, result.errors?.length ? "info" : "success");
                getLeads(auth.token, filter === "ALL" ? undefined : { intent_score: filter }).then((res) => setLeads(res.items || res));
              } catch (e) { console.error("Failed to import CSV:", e); }
              e.target.value = "";
            }} />
          </label>
        </div>
      </div>

      {/* Quick stats */}
      {leads.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-zinc-500">{t("leads.totalCount").replace("{total}", String(summaryCounts.total))}</span>
          <span className="text-rose-400">{t("leads.hotCount").replace("{hot}", String(summaryCounts.HOT))}</span>
          <span className="text-amber-400">{t("leads.warmCount").replace("{warm}", String(summaryCounts.WARM))}</span>
          <span className="text-sky-400">{t("leads.coldCount").replace("{cold}", String(summaryCounts.COLD))}</span>
        </div>
      )}

      {/* Qualify form */}
      <form onSubmit={handleQualify} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <input type="text" value={testHandle} onChange={(e) => setTestHandle(e.target.value)}
          className="w-40 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500" placeholder={t("leads.qualifyHandle")} />
        <input type="text" value={testMessage} onChange={(e) => setTestMessage(e.target.value)}
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          placeholder={t("leads.qualifyPlaceholder")} />
        <button type="submit" disabled={qualifying || !testMessage.trim()}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 btn-press">
          {qualifying ? "..." : t("leads.qualify")}
        </button>
      </form>

      {testResult && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-2">{t("leads.lastResult")}</p>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${INTENT_STYLES[testResult.intent_score] ?? ""}`}>
              {testResult.intent_score}
            </span>
            <span className="text-sm text-zinc-400">{t("leads.confidence").replace("{confidence}", String(testResult.confidence))}</span>
            <span className="text-sm text-zinc-300">{testResult.summary}</span>
          </div>
        </div>
      )}

      {view === "table" ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leads.tableHandle")}</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leads.tableIntent")}</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leads.tableMessage")}</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leads.tableGeo")}</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leads.tableStatus")}</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leads.tableCreated")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8">
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                </td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  <p className="text-zinc-300 font-medium mb-2">{t("leads.empty")}</p>
                  <p className="text-xs text-zinc-500 mb-1">{t("leads.emptyDesc")}</p>
                  <p className="text-xs text-zinc-600">{t("leads.emptyHint")}</p>
                </td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 cursor-pointer"
                    onClick={() => openLeadDetail(lead)}>
                    <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{lead.user_handle}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${INTENT_STYLES[lead.intent_score] ?? ""}`}>
                        {lead.intent_score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 max-w-[300px] truncate">{lead.message_text}</td>
                    <td className="px-4 py-3 text-zinc-400">{lead.geo_tag}</td>
                    <td className="px-4 py-3 text-zinc-400">{STATUS_LABELS[lead.status] ?? lead.status}</td>
                    <td className="px-4 py-3 text-zinc-400">{new Date(lead.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {leads.length < total && (
            <div className="p-4 text-center">
              <button onClick={loadMore} disabled={loadingMore}
                className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition disabled:opacity-50">
                {loadingMore ? t("leads.loading") : t("leads.loadMore").replace("{loaded}", String(leads.length)).replace("{total}", String(total))}
              </button>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-h-[500px]">
          {columns.map((col) => (
            <div key={col.key} className={`rounded-xl border-t-2 ${col.color} bg-zinc-900/50 p-3 flex flex-col gap-2 min-h-[200px]`}>
              <div className="flex items-center justify-between mb-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-h-[500px]">
          {columns.map((col) => {
            const colLeads = groupedLeads(col.key);
            const isOver = dragOverCol === col.key;
            return (
              <div key={col.key}
                className={`rounded-xl border-t-2 ${col.color} bg-zinc-900/50 p-3 flex flex-col gap-2 min-h-[200px] transition-colors ${isOver ? "bg-zinc-800/50" : ""}`}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-zinc-300">{col.label}</h3>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{colLeads.length}</span>
                </div>
                {colLeads.map((lead) => (
                  <div key={lead.id}
                    className={`bg-zinc-800 border border-zinc-700 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-opacity hover:border-zinc-600 ${draggingId === lead.id ? "opacity-40" : ""}`}
                    draggable onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                    onClick={(e) => { e.stopPropagation(); openLeadDetail(lead); }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs text-zinc-200 truncate">
                        <span className="mr-1">{SOURCE_ICONS[lead.source || "dm"] || "💬"}</span>
                        {lead.user_handle}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${INTENT_STYLES[lead.intent_score] ?? ""}`}>
                        {lead.intent_score}
                      </span>
                    </div>
                    {lead.platform && (
                      <span className="text-[10px] text-zinc-500 bg-zinc-700/50 px-1.5 py-0.5 rounded mb-1.5 inline-block">
                        {lead.platform}
                      </span>
                    )}
                    {lead.geo_tag && (
                      <span className="text-[10px] text-zinc-500 ml-1">{lead.geo_tag}</span>
                    )}
                    <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">{lead.message_text}</p>
                  </div>
                ))}
                {colLeads.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
                    {t("leads.dropHere")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lead detail drawer */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setSelectedLead(null)}>
          <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-6 space-y-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100">{t("leads.detail")}</h2>
              <div className="flex items-center gap-3">
                <Link href={`/leads/${selectedLead.id}`} className="text-xs text-emerald-400 hover:text-emerald-300 underline">{t("leads.fullPage")}</Link>
                <button onClick={() => setSelectedLead(null)} className="text-zinc-500 hover:text-zinc-300 text-xl">&times;</button>
              </div>
            </div>

            {loadingDetail && <p className="text-xs text-zinc-500">{t("leads.loadingDetails")}</p>}

            {/* Handle + intent + source */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm text-zinc-100 bg-zinc-800 px-3 py-1.5 rounded-lg">{selectedLead.user_handle}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${INTENT_STYLES[selectedLead.intent_score] ?? ""}`}>
                {selectedLead.intent_score}
              </span>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                {SOURCE_ICONS[selectedLead.source || "dm"] || "💬"} {selectedLead.source || "dm"}
              </span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500 text-xs block mb-1">{t("leads.fullName")}</span>
                <span className="text-zinc-200">{selectedLead.user_full_name || "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block mb-1">{t("leads.platform")}</span>
                <span className="text-zinc-200 capitalize">{selectedLead.platform || "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block mb-1">{t("leads.geo")}</span>
                <span className="text-zinc-200">{selectedLead.geo_tag || "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block mb-1">{t("leads.created")}</span>
                <span className="text-zinc-200">{new Date(selectedLead.created_at).toLocaleString()}</span>
              </div>
              {selectedLead.target_name && (
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">{t("leads.target")}</span>
                  <span className="text-zinc-200">{selectedLead.target_name}</span>
                </div>
              )}
              {selectedLead.post_id && (
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">{t("leads.postId")}</span>
                  <span className="text-zinc-200 font-mono text-xs">{selectedLead.post_id}</span>
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <span className="text-zinc-500 text-xs block mb-1">{t("leads.message")}</span>
              <p className="text-sm text-zinc-300 bg-zinc-800 rounded-lg p-3 whitespace-pre-wrap">{selectedLead.message_text || t("leads.noMessage")}</p>
            </div>

            {/* Dialog URL */}
            {selectedLead.dialog_url && (
              <div>
                <span className="text-zinc-500 text-xs block mb-1">{t("leads.dialog")}</span>
                <a href={selectedLead.dialog_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-emerald-400 hover:text-emerald-300 underline">{selectedLead.dialog_url}</a>
              </div>
            )}

            {/* Status change */}
            <div>
              <span className="text-zinc-500 text-xs block mb-2">{t("leads.tableStatus")}</span>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button key={s} disabled={detailSaving || selectedLead.status === s}
                    onClick={() => handleStatusChange(selectedLead.id, s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-40 ${
                      selectedLead.status === s
                        ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                    }`}>
                    {STATUS_LABELS[s] ?? s}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit timeline */}
            {selectedLead.events && selectedLead.events.length > 0 && (
              <div>
                <span className="text-zinc-500 text-xs block mb-2">{t("leads.history")}</span>
                <div className="space-y-2">
                  {selectedLead.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <span className="text-zinc-600 mt-0.5">●</span>
                      <div>
                        <span className="text-zinc-300">
                          {ev.action === "status_change" ? t("leads.statusChanged") : ev.action}
                          {ev.old_value?.status && ev.new_value?.status && (
                            <>: {STATUS_LABELS[ev.old_value.status] || ev.old_value.status} → {STATUS_LABELS[ev.new_value.status] || ev.new_value.status}</>
                          )}
                        </span>
                        {ev.created_at && (
                          <span className="text-zinc-600 ml-2">{new Date(ev.created_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
