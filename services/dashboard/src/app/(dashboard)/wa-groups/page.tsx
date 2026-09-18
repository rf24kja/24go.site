"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getWaAccounts, parseWaGroups, getWaGroups } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { FieldHint } from "@/components/FieldHint";

type WaAccount = {
  id: string;
  phone_number: string;
  status: string;
};

type WaGroup = {
  id: string;
  group_id: string;
  name: string;
  members_count: number;
  last_scan_at: string | null;
  status: string;
};

const STATUS_STYLES: Record<string, string> = {
  idle: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
  parsing: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  error: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
};

export default function WaGroupsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState("");
  const [geoTag, setGeoTag] = useState("");
  const [tags, setTags] = useState("");
  const [parsing, setParsing] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [parseResults, setParseResults] = useState<{ group: string; status: string; count?: number }[]>([]);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    Promise.all([
      getWaGroups(auth.token).catch(() => ({ items: [] })),
      getWaAccounts(auth.token).catch((_) => {
        // fallback: try generic accounts endpoint
        return import("@/lib/api").then(m => m.getAccounts(auth.token!, { platform: "whatsapp" }));
      }),
    ]).then(([g, a]) => {
      setGroups(g.items || []);
      const items = a.items || a;
      setAccounts(items.filter((acc: WaAccount) => acc.status === "active" || acc.status === "warming_up"));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleParse = async () => {
    if (!auth?.token || !selectedAccount || !links.trim()) return;
    setParsing(true);
    const linkLines = links.split("\n").map(l => l.trim()).filter(Boolean);
    setParseResults(linkLines.map(l => ({ group: l, status: "parsing" })));
    try {
      const result = await parseWaGroups(auth.token, { account_id: selectedAccount });
      setParseResults(prev => prev.map(r => ({ ...r, status: "completed", count: Math.floor(result.total_members / Math.max(prev.length, 1)) })));
      toast(t("waGroups.parseSuccess").replace("{created}", String(result.created_contacts)), "success");
      setLinks("");
      load();
    } catch (e: any) {
      toast(e.message || t("waGroups.parseFailed"), "error");
      setParseResults(prev => prev.map(r => ({ ...r, status: "error" })));
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("waGroups.title")}</h1>
      </div>

      {/* Parse form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-zinc-300">{t("waGroups.parseTitle")}</h2>
          <FieldHint hint={t("waGroups.hint.parse")} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">{t("waGroups.linksLabel")}</label>
            <textarea
              rows={6}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder={t("waGroups.linksPlaceholder")}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono resize-none"
            />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">{t("waGroups.accountLabel")}</label>
              <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                <option value="">{t("waGroups.selectAccount")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.phone_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">{t("waGroups.geoLabel")}</label>
              <input type="text" value={geoTag} onChange={(e) => setGeoTag(e.target.value)}
                placeholder={t("waGroups.geoPlaceholder")}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">{t("waGroups.tagsLabel")}</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
                placeholder={t("waGroups.tagsPlaceholder")}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
            </div>
            <button onClick={handleParse}
              disabled={parsing || !selectedAccount || !links.trim()}
              className="w-full px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 btn-press">
              {parsing ? t("waGroups.parsing") : t("waGroups.parseBtn")}
            </button>
          </div>
        </div>

        {/* Parse results */}
        {parseResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">{t("waGroups.parseResults")}</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {parseResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-zinc-800 rounded px-3 py-2 text-xs">
                  <span className="text-zinc-300 font-mono truncate max-w-[60%]">{r.group}</span>
                  <div className="flex items-center gap-2">
                    {r.count !== undefined && <span className="text-zinc-500">{r.count}</span>}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[r.status]}`}>{t(`waGroups.status.${r.status}`)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Groups list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("waGroups.colName")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("waGroups.colGroupId")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("waGroups.colMembers")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("waGroups.colLastScan")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /></div>
                  ))}
                </div>
              </td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                <p className="text-zinc-300 font-medium mb-2">{t("waGroups.empty")}</p>
                <p className="text-xs text-zinc-500">{t("waGroups.emptyDesc")}</p>
              </td></tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-100 font-medium">{g.name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs hidden md:table-cell">{g.group_id}</td>
                  <td className="px-4 py-3 text-zinc-400">{(g.members_count || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">
                    {g.last_scan_at ? new Date(g.last_scan_at).toLocaleString() : <span className="text-zinc-600">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
