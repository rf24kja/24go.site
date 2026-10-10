"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getWaAccounts, parseWaGroupsAsync, getWaParseStatus, getWaGroups } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

type WaAccount = {
  id: string;
  phone_number: string;
  status: string;
};

type WaGroup = {
  id: string;
  group_name: string;
  participant_count: number;
  parsed_at: string | null;
  source_link: string;
};

export default function WaGroupsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState("");
  const [parsing, setParsing] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0, done: false });
  const [parsingGroups, setParsingGroups] = useState<string[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    if (!auth?.token) return;
    setLoading(true);
    Promise.all([
      getWaGroups(auth.token).catch(() => ({ items: [] })),
      getWaAccounts(auth.token).catch(() => ({ items: [] })),
    ]).then(([g, a]) => {
      setGroups(g.items || []);
      const items = a.items || [];
      setAccounts(items.filter((acc: WaAccount) => acc.status === "connected" || acc.status === "active" || acc.status === "warming_up"));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [auth?.token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startPolling = useCallback((jobId: string, expectedTotal: number) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      if (!auth?.token) return;
      try {
        const job = await getWaParseStatus(auth.token, jobId);
        setProgress({
          current: Math.min(job.done_groups || 0, expectedTotal),
          total: expectedTotal,
          done: job.status === "done" || job.status === "failed",
        });
        if (job.status === "done" || job.status === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setParsing(false);
          setParsingGroups([]);
          if (job.status === "failed") {
            toast(job.error || "Parse failed", "error");
          } else {
            toast(t("waGroups.parsed"), "success");
          }
          load();
        }
      } catch {}
    }, 3000);
  }, [auth?.token]);

  const handleParse = async () => {
    if (!auth?.token || !selectedAccount || !links.trim()) return;
    // ponytail: backend caps at 5 groups per job — cut client-side with the warning shown
    const linkLines = links.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 5);
    if (linkLines.length === 0) return;

    setParsing(true);
    setParsingGroups(linkLines);
    setProgress({ current: 0, total: linkLines.length, done: false });

    try {
      const job = await parseWaGroupsAsync(auth.token, {
        account_id: selectedAccount,
        group_links: linkLines,
      });
      startPolling(job.job_id, linkLines.length);
    } catch (e: any) {
      toast(e.message || "Parse failed", "error");
      setParsing(false);
      setProgress(prev => ({ ...prev, done: true }));
      load();
    }
  };

  const showRateLimitWarning = parsingGroups.length > 5;

  const totalParticipants = groups.reduce((sum, g) => sum + (g.participant_count || 0), 0);

  return (
    <div className="space-y-6 animate-fade-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("waGroups.title")}</h1>
      </div>

      {/* Parse Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">{t("waGroups.parseButton")}</h2>

        {accounts.length === 0 && (
          <p className="text-xs text-amber-400">{t("waGroups.noAccounts")}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">{t("waGroups.groupLinks")}</label>
            <textarea
              rows={6}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder={t("waGroups.groupLinksPlaceholder")}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono resize-none"
            />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">{t("waGroups.selectAccount")}</label>
              <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                <option value="">{t("waGroups.selectAccountPlaceholder")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.phone_number}</option>
                ))}
              </select>
            </div>
            <button onClick={handleParse}
              disabled={parsing || !selectedAccount || !links.trim()}
              title={!selectedAccount || !links.trim() ? t("waGroups.parseButtonDisabled") : undefined}
              className="w-full px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 btn-press">
              {parsing ? t("waGroups.parsing") : t("waGroups.parseButton")}
            </button>
          </div>
        </div>

        {/* Rate limit warning */}
        {showRateLimitWarning && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-xs text-amber-400">
            {t("waGroups.warning.rateLimit")}
          </div>
        )}

        {/* Progress display */}
        {(parsing || (progress.total > 0 && !progress.done)) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{t("waGroups.progress").replace("{current}", String(progress.current)).replace("{total}", String(progress.total))}</span>
              <span>{Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {progress.done && progress.total > 0 && (
          <p className="text-xs text-emerald-400">{t("waGroups.progressDone")}</p>
        )}

        {/* Parsing group list */}
        {parsingGroups.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {parsingGroups.map((link, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded px-3 py-1.5 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${i < progress.current ? "bg-emerald-400" : i === progress.current && parsing ? "bg-amber-400 animate-pulse" : "bg-zinc-600"}`} />
                <span className="text-zinc-400 font-mono truncate">{link}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500">{t("waGroups.stats.totalGroups")}</p>
            <p className="text-2xl font-bold text-zinc-100">{groups.length}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500">{t("waGroups.stats.totalParticipants")}</p>
            <p className="text-2xl font-bold text-zinc-100">{totalParticipants.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Groups table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("waGroups.colName")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("waGroups.colParticipants")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("waGroups.colParsedAt")}</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">{t("waGroups.colSourceLink")}</th>
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
                  <td className="px-4 py-3 text-zinc-100 font-medium">{g.group_name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{(g.participant_count || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">
                    {g.parsed_at ? new Date(g.parsed_at).toLocaleString() : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {g.source_link ? (
                      <a href={g.source_link} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 truncate max-w-[200px] block">
                        {g.source_link}
                      </a>
                    ) : <span className="text-zinc-600">—</span>}
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
