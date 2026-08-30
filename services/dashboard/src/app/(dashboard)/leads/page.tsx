"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getLeads, qualifyLead, updateLeadStatus, exportLeadsCsv, importLeadsCsv, getLead } from "@/lib/api";
import { useWebSocket } from "@/lib/useWebSocket";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

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

const STATUS_LABELS: Record<string, string> = {
  new: "New", in_progress: "In Progress", converted: "Converted", rejected: "Rejected",
};

const FILTERS = ["ALL", "HOT", "WARM", "COLD"] as const;
const SOURCE_FILTERS = ["all", "dm", "comment", "manual"] as const;
const SOURCE_ICONS: Record<string, string> = { dm: "💬", comment: "💭", manual: "✏️", import: "📥", webhook: "🔗" };

export default function LeadsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
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
    setLoading(true);
    getLeads(auth.token, {
      intent_score: filter === "ALL" ? undefined : filter,
      limit: PAGE_SIZE, offset: 0,
    } as any).then((res) => {
      let items = res.items || res;
      if (sourceFilter !== "all") items = items.filter((l: Lead) => (l.source || "dm") === sourceFilter);
      setLeads(items);
      setTotal(res.total || items.length);
    }).catch(() => { setLeads([]); setTotal(0); }).finally(() => setLoading(false));
  }, [auth?.token, filter, sourceFilter]);

  function loadMore() {
    if (!auth?.token || loadingMore) return;
    setLoadingMore(true);
    getLeads(auth.token, { intent_score: filter === "ALL" ? undefined : filter, limit: PAGE_SIZE, offset: leads.length })
      .then((res) => { setLeads((prev) => [...prev, ...(res.items || res)]); setTotal(res.total || total); })
      .catch(() => {})
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
    } catch {
      // Keep the basic data from list
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
    total: leads.length,
  };

  return (
    <div className={`space-y-6${!loading ? " animate-fade-in" : ""}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${filter === f ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-1 text-xs">
            {SOURCE_FILTERS.map((s) => (
              <button key={s} onClick={() => setSourceFilter(s)}
                className={`px-2 py-1 rounded transition ${sourceFilter === s ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}>
                {s === "all" ? "All sources" : s === "dm" ? "💬 DM" : s === "comment" ? "💭 Comments" : "✏️ Manual"}
              </button>
            ))}
          </div>
          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            <button onClick={() => setView("table")}
              className={`px-3 py-1 rounded-md text-sm transition ${view === "table" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"}`}>
              ☰ Table
            </button>
            <button onClick={() => setView("kanban")}
              className={`px-3 py-1 rounded-md text-sm transition ${view === "kanban" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"}`}>
              ▦ Kanban
            </button>
          </div>
          <button onClick={async () => {
              if (!auth?.token) return;
              try {
                const blob = await exportLeadsCsv(auth.token, filter !== "ALL" ? { intent_score: filter } : undefined);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
                a.click(); URL.revokeObjectURL(url);
              } catch { /* empty */ }
            }}
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition">
            ⬇ CSV
          </button>
          <label className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition cursor-pointer">
            ⬆ Import
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !auth?.token) return;
              try {
                const text = await file.text();
                const result = await importLeadsCsv(auth.token, text);
                const msg = `Imported: ${result.imported}, Skipped: ${result.skipped}` + (result.errors?.length ? ` — ${result.errors.slice(0,3).join("; ")}` : "");
                toast(msg, result.errors?.length ? "info" : "success");
                getLeads(auth.token, filter === "ALL" ? undefined : { intent_score: filter }).then((res) => setLeads(res.items || res));
              } catch { /* empty */ }
              e.target.value = "";
            }} />
          </label>
        </div>
      </div>

      {/* Quick stats */}
      {leads.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-zinc-500">{summaryCounts.total} total</span>
          <span className="text-rose-400">{summaryCounts.HOT} hot</span>
          <span className="text-amber-400">{summaryCounts.WARM} warm</span>
          <span className="text-sky-400">{summaryCounts.COLD} cold</span>
        </div>
      )}

      {/* Qualify form */}
      <form onSubmit={handleQualify} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-3">
        <input type="text" value={testHandle} onChange={(e) => setTestHandle(e.target.value)}
          className="w-40 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500" placeholder="@handle" />
        <input type="text" value={testMessage} onChange={(e) => setTestMessage(e.target.value)}
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          placeholder="Type a message to classify..." />
        <button type="submit" disabled={qualifying || !testMessage.trim()}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
          {qualifying ? "..." : "Qualify"}
        </button>
      </form>

      {testResult && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-2">Last Qualification Result</p>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${INTENT_STYLES[testResult.intent_score] ?? ""}`}>
              {testResult.intent_score}
            </span>
            <span className="text-sm text-zinc-400">confidence: {testResult.confidence}</span>
            <span className="text-sm text-zinc-300">{testResult.summary}</span>
          </div>
        </div>
      )}

      {view === "table" ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Handle</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Intent</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Message</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Geo</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Created</th>
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
                  <p className="text-zinc-300 font-medium mb-2">No leads yet</p>
                  <p className="text-xs text-zinc-500 mb-1">Leads appear here when someone sends a DM to your connected Telegram account, or when comments are scraped from your posts.</p>
                  <p className="text-xs text-zinc-600">You can also test with the qualify form above, or import leads from a CSV file.</p>
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
                {loadingMore ? "Loading..." : `Load more (${leads.length} / ${total})`}
              </button>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-h-[500px]">
          {COLUMNS.map((col) => (
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
          {COLUMNS.map((col) => {
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
                    Drop leads here
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
              <h2 className="text-lg font-bold text-zinc-100">Lead Detail</h2>
              <div className="flex items-center gap-3">
                <Link href={`/leads/${selectedLead.id}`} className="text-xs text-emerald-400 hover:text-emerald-300 underline">Full page ↗</Link>
                <button onClick={() => setSelectedLead(null)} className="text-zinc-500 hover:text-zinc-300 text-xl">&times;</button>
              </div>
            </div>

            {loadingDetail && <p className="text-xs text-zinc-500">Loading details...</p>}

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
                <span className="text-zinc-500 text-xs block mb-1">Full Name</span>
                <span className="text-zinc-200">{selectedLead.user_full_name || "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block mb-1">Platform</span>
                <span className="text-zinc-200 capitalize">{selectedLead.platform || "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block mb-1">Geo</span>
                <span className="text-zinc-200">{selectedLead.geo_tag || "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-xs block mb-1">Created</span>
                <span className="text-zinc-200">{new Date(selectedLead.created_at).toLocaleString()}</span>
              </div>
              {selectedLead.target_name && (
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">Target</span>
                  <span className="text-zinc-200">{selectedLead.target_name}</span>
                </div>
              )}
              {selectedLead.post_id && (
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">Post ID</span>
                  <span className="text-zinc-200 font-mono text-xs">{selectedLead.post_id}</span>
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <span className="text-zinc-500 text-xs block mb-1">Message</span>
              <p className="text-sm text-zinc-300 bg-zinc-800 rounded-lg p-3 whitespace-pre-wrap">{selectedLead.message_text || "No message"}</p>
            </div>

            {/* Dialog URL */}
            {selectedLead.dialog_url && (
              <div>
                <span className="text-zinc-500 text-xs block mb-1">Dialog</span>
                <a href={selectedLead.dialog_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-emerald-400 hover:text-emerald-300 underline">{selectedLead.dialog_url}</a>
              </div>
            )}

            {/* Status change */}
            <div>
              <span className="text-zinc-500 text-xs block mb-2">Status</span>
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
                <span className="text-zinc-500 text-xs block mb-2">History</span>
                <div className="space-y-2">
                  {selectedLead.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <span className="text-zinc-600 mt-0.5">●</span>
                      <div>
                        <span className="text-zinc-300">
                          {ev.action === "status_change" ? "Status changed" : ev.action}
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
