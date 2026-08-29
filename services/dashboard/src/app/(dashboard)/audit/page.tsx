"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getAuditLog } from "@/lib/api";

type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  created_at: string;
};

const ACTION_STYLES: Record<string, string> = {
  status_change: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  created: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  deleted: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  updated: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

const ENTITY_FILTERS = ["all", "lead", "campaign", "account", "target", "subscription"] as const;

export default function AuditPage() {
  const { auth } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>("all");

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    getAuditLog(auth.token, entityFilter !== "all" ? { entity_type: entityFilter, limit: 100 } : { limit: 100 })
      .then(setEntries).catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [auth?.token, entityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <div className="flex gap-1">
          {ENTITY_FILTERS.map((f) => (
            <button key={f} onClick={() => setEntityFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition capitalize ${entityFilter === f ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Time</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Action</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Entity</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Details</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No audit entries yet.</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${ACTION_STYLES[e.action] ?? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"}`}>
                      {e.action.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 capitalize">{e.entity_type}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs max-w-[300px]">
                    {e.old_value && e.new_value ? (
                      <span>
                        <span className="text-rose-400 line-through">{typeof e.old_value === "object" ? JSON.stringify(e.old_value) : e.old_value}</span>
                        {" → "}
                        <span className="text-emerald-400">{typeof e.new_value === "object" ? JSON.stringify(e.new_value) : e.new_value}</span>
                      </span>
                    ) : e.new_value ? (
                      <span className="text-emerald-400">{typeof e.new_value === "object" ? JSON.stringify(e.new_value) : e.new_value}</span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{e.ip_address || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
