"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { getLeads, qualifyLead, updateLeadStatus, exportLeadsCsv, importLeadsCsv } from "@/lib/api";
import { useWebSocket } from "@/lib/useWebSocket";

type Lead = {
  id: string;
  user_handle: string;
  user_full_name?: string;
  intent_score: "HOT" | "WARM" | "COLD" | "SPAM";
  platform?: string;
  message_text: string;
  geo_tag: string;
  status: string;
  dialog_url?: string;
  created_at: string;
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

const FILTERS = ["ALL", "HOT", "WARM", "COLD"] as const;

export default function LeadsPage() {
  const { auth } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [testHandle, setTestHandle] = useState("@test_user");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [qualifying, setQualifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const { connected, lastEvent } = useWebSocket(auth?.user?.tenant_id ?? null);

  // Real-time: when a new lead event arrives, add it to the list
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "lead_created" || lastEvent.type === "lead_qualified") {
      const newLead = lastEvent.data as Lead;
      setLeads((prev) => {
        // Deduplicate by id
        if (prev.some((l) => l.id === newLead.id)) return prev;
        return [newLead, ...prev];
      });
    }
  }, [lastEvent]);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    getLeads(auth.token, filter === "ALL" ? undefined : { intent_score: filter })
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [auth?.token, filter]);

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
    // Optimistic update
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    try {
      await updateLeadStatus(auth.token, leadId, newStatus);
    } catch {
      // Revert on error — reload
      getLeads(auth.token, filter === "ALL" ? undefined : { intent_score: filter }).then(setLeads);
    }
  }, [auth?.token, filter]);

  function groupedLeads(colKey: string) {
    return leads.filter((l) => l.status === colKey);
  }

  return (
    <div className="space-y-6">
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
              const blob = await exportLeadsCsv(auth.token, filter !== "ALL" ? { intent_score: filter } : undefined);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
            }}
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition">
            ⬇ CSV
          </button>
          <label className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition cursor-pointer">
            ⬆ Import
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !auth?.token) return;
              const text = await file.text();
              const result = await importLeadsCsv(auth.token, text);
              alert(`Imported: ${result.imported}, Skipped: ${result.skipped}` + (result.errors?.length ? `\nErrors: ${result.errors.slice(0,3).join("; ")}` : ""));
              getLeads(auth.token, filter === "ALL" ? undefined : { intent_score: filter }).then(setLeads);
              e.target.value = "";
            }} />
          </label>
        </div>
      </div>

      {/* Qualify form */}
      <form onSubmit={handleQualify} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-3">
        <input type="text" value={testHandle} onChange={(e) => setTestHandle(e.target.value)}
          className="w-40 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" placeholder="@handle" />
        <input type="text" value={testMessage} onChange={(e) => setTestMessage(e.target.value)}
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500"
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
        /* ── Table View ── */
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
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
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No leads found.</td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30"
                    draggable onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}>
                    <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{lead.user_handle}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${INTENT_STYLES[lead.intent_score] ?? ""}`}>
                        {lead.intent_score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 max-w-[300px] truncate">{lead.message_text}</td>
                    <td className="px-4 py-3 text-zinc-400">{lead.geo_tag}</td>
                    <td className="px-4 py-3 text-zinc-400">{lead.status}</td>
                    <td className="px-4 py-3 text-zinc-400">{new Date(lead.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Kanban View ── */
        <div className="grid grid-cols-4 gap-4 min-h-[500px]">
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
                    className={`bg-zinc-800 border border-zinc-700 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-opacity ${draggingId === lead.id ? "opacity-40" : ""}`}
                    draggable onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs text-zinc-200 truncate">{lead.user_handle}</span>
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
    </div>
  );
}
