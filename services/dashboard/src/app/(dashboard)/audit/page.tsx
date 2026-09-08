"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { FieldHint } from "@/components/FieldHint";
import { getOwnerAuditLog, getAuditLog } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";

type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  created_at: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  tenant_id?: string;
  tenant_name?: string;
};

const ACTION_STYLES: Record<string, string> = {
  status_change: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  created: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  deleted: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  updated: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  joined: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  logged_in: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  exported: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
};

const ENTITY_FILTERS = ["all", "lead", "campaign", "account", "target", "subscription", "user", "billing"] as const;
const ACTION_FILTERS = ["all", "created", "updated", "deleted", "status_change", "joined", "logged_in"] as const;

export default function AuditPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, users: 0, tenants: 0, today: 0 });

  const isOwner = auth?.user?.email === "rf24krsk@gmail.com" || auth?.user?.role === "owner";

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);

    if (isOwner) {
      const params: any = { limit: 500 };
      if (entityFilter !== "all") params.entity_type = entityFilter;
      if (actionFilter !== "all") params.action = actionFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo + "T23:59:59";

      getOwnerAuditLog(auth.token, params)
        .then((data) => {
          setEntries(data);
          const uniqueUsers = new Set(data.map((e) => e.user_id).filter(Boolean));
          const uniqueTenants = new Set(data.map((e) => e.tenant_id).filter(Boolean));
          const today = new Date().toISOString().slice(0, 10);
          const todayCount = data.filter((e) => e.created_at?.startsWith(today)).length;
          setStats({ total: data.length, users: uniqueUsers.size, tenants: uniqueTenants.size, today: todayCount });
        })
        .catch(() => setEntries([]))
        .finally(() => setLoading(false));
    } else {
      getAuditLog(auth.token, entityFilter !== "all" ? { entity_type: entityFilter, limit: 100 } : { limit: 100 })
        .then((data) => {
          setEntries(data);
          setStats({ total: data.length, users: 1, tenants: 1, today: 0 });
        })
        .catch(() => setEntries([]))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => { load(); }, [auth?.token, entityFilter, actionFilter, dateFrom, dateTo]);

  const filteredEntries = searchUser
    ? entries.filter((e) =>
        (e.user_email?.toLowerCase().includes(searchUser.toLowerCase())) ||
        (e.user_name?.toLowerCase().includes(searchUser.toLowerCase())) ||
        (e.tenant_name?.toLowerCase().includes(searchUser.toLowerCase()))
      )
    : entries;

  return (
    <div className={`space-y-6 animate-fade-slide-in`}>
      {/* Owner badge */}
      {isOwner && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg w-fit">
          <span className="text-amber-400 text-sm font-medium">Owner Mode</span>
          <span className="text-amber-500/60 text-xs">Cross-tenant view</span>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">{t("audit.title")}</h1>
      </div>

      {/* Stats cards */}
      {isOwner && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Events", value: stats.total, color: "text-zinc-100" },
            { label: "Active Users", value: stats.users, color: "text-sky-400" },
            { label: "Tenants", value: stats.tenants, color: "text-violet-400" },
            { label: "Today", value: stats.today, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-1">
          {ENTITY_FILTERS.map((f) => (
            <button key={f} onClick={() => setEntityFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition capitalize ${entityFilter === f ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
              {f}
            </button>
          ))}
        </div>

        {isOwner && (
          <>
            <div className="flex flex-wrap gap-1">
              {ACTION_FILTERS.map((f) => (
                <button key={f} onClick={() => setActionFilter(f)}
                  className={`px-2 py-1 rounded text-xs transition ${actionFilter === f ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
                  {f.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">Search user</label>
                <input type="text" placeholder="email or name..." value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 w-48" />
              </div>
              <button onClick={() => { setDateFrom(""); setDateTo(""); setSearchUser(""); setActionFilter("all"); }}
                className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300">Reset</button>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Time</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Action</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Entity</th>
              {isOwner && <th className="text-left px-4 py-3 text-zinc-400 font-medium">User</th>}
              {isOwner && <th className="text-left px-4 py-3 text-zinc-400 font-medium">Tenant</th>}
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Details</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isOwner ? 7 : 5} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </td></tr>
            ) : filteredEntries.length === 0 ? (
              <tr><td colSpan={isOwner ? 7 : 5} className="px-4 py-8 text-center text-zinc-500">{t("audit.empty")}</td></tr>
            ) : (
              filteredEntries.map((e) => (
                <>
                  <tr key={e.id}
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${ACTION_STYLES[e.action] ?? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"}`}>
                        {e.action.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 capitalize">{e.entity_type}</td>
                    {isOwner && (
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {e.user_email || <span className="text-zinc-600">—</span>}
                      </td>
                    )}
                    {isOwner && (
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {e.tenant_name || <span className="text-zinc-600">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-zinc-400 text-xs max-w-[200px] truncate">
                      {e.old_value && e.new_value ? (
                        <span className="truncate block">
                          <span className="text-rose-400 line-through">{typeof e.old_value === "object" ? JSON.stringify(e.old_value) : String(e.old_value).slice(0, 50)}</span>
                          {" → "}
                          <span className="text-emerald-400">{typeof e.new_value === "object" ? JSON.stringify(e.new_value) : String(e.new_value).slice(0, 50)}</span>
                        </span>
                      ) : e.new_value ? (
                        <span className="text-emerald-400 truncate block">{typeof e.new_value === "object" ? JSON.stringify(e.new_value) : String(e.new_value).slice(0, 80)}</span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{e.ip_address || "—"}</td>
                  </tr>
                  {expandedId === e.id && (
                    <tr key={e.id + "-detail"}>
                      <td colSpan={isOwner ? 7 : 5} className="px-4 py-3 bg-zinc-800/50">
                        <div className="space-y-1 text-xs">
                          <div className="text-zinc-400">
                            <span className="text-zinc-500">Entity ID:</span>{" "}
                            <span className="font-mono text-zinc-300">{e.entity_id || "—"}</span>
                          </div>
                          {e.user_id && (
                            <div className="text-zinc-400">
                              <span className="text-zinc-500">User ID:</span>{" "}
                              <span className="font-mono text-zinc-300">{e.user_id}</span>
                              {e.user_name && <span className="text-zinc-500 ml-2">({e.user_name})</span>}
                            </div>
                          )}
                          {e.tenant_id && (
                            <div className="text-zinc-400">
                              <span className="text-zinc-500">Tenant ID:</span>{" "}
                              <span className="font-mono text-zinc-300">{e.tenant_id}</span>
                            </div>
                          )}
                          {e.old_value && (
                            <div className="text-zinc-400">
                              <span className="text-zinc-500">Old:</span>{" "}
                              <pre className="inline text-zinc-300 whitespace-pre-wrap">{JSON.stringify(e.old_value, null, 2)}</pre>
                            </div>
                          )}
                          {e.new_value && (
                            <div className="text-zinc-400">
                              <span className="text-zinc-500">New:</span>{" "}
                              <pre className="inline text-zinc-300 whitespace-pre-wrap">{JSON.stringify(e.new_value, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Access denied for non-owner */}
      {!isOwner && (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-sm">Full audit log requires owner access.</p>
          <p className="text-xs mt-1">Contact your administrator for access.</p>
        </div>
      )}
    </div>
  );
}
