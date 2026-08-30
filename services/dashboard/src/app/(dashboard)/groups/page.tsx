"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getGroups, addGroup, startGroupScanner, stopGroupScanner, removeGroup, getAccounts, discoverGroups } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

type Group = {
  id: string;
  platform: string;
  group_identifier: string;
  title: string;
  members_count: number;
  status: string;
  account_id: string | null;
  last_scan_at: string | null;
  created_at: string;
};

type Account = {
  id: string;
  account_identifier: string;
  platform: string;
  status: string;
};

const STATUS_STYLES: Record<string, string> = {
  scanning: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  idle: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
  error: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
};

export default function GroupsPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addPlatform, setAddPlatform] = useState("telegram");
  const [addIdentifier, setAddIdentifier] = useState("");
  const [addAccountId, setAddAccountId] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Auto-discover state
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverGeo, setDiscoverGeo] = useState("");
  const [discoverNiche, setDiscoverNiche] = useState("");
  const [discoverPlatform, setDiscoverPlatform] = useState("telegram");
  const [discoverResults, setDiscoverResults] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discovered, setDiscovered] = useState(false);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    Promise.all([
      getGroups(auth.token).catch(() => ({ items: [] })),
      getAccounts(auth.token).catch(() => ({ items: [] })),
    ]).then(([g, a]) => {
      setGroups(g.items || []);
      setAccounts((a.items || []).filter((acc: Account) => acc.status === "active"));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleDiscover = async () => {
    if (!auth?.token || !discoverGeo.trim() || !discoverNiche.trim()) return;
    setDiscoverLoading(true);
    setDiscovered(true);
    try {
      const res = await discoverGroups(auth.token, {
        geo_tag: discoverGeo.trim(),
        niche: discoverNiche.trim(),
        platform: discoverPlatform,
      });
      setDiscoverResults(res.results || []);
    } catch (e: any) {
      toast(e.message || "Discovery failed", "error");
      setDiscoverResults([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleAddDiscovered = async (identifier: string, platform: string, title: string) => {
    if (!auth?.token || !addAccountId) {
      toast("Select an account first", "error");
      return;
    }
    try {
      await addGroup(auth.token, { platform, group_identifier: identifier, account_id: addAccountId });
      toast(`Added: ${title}`, "success");
      load();
    } catch (e: any) {
      toast(e.message || "Failed to add", "error");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token || !addIdentifier.trim() || !addAccountId) return;
    setAddSaving(true);
    try {
      await addGroup(auth.token, {
        platform: addPlatform,
        group_identifier: addIdentifier.trim(),
        account_id: addAccountId,
      });
      toast("Group added successfully", "success");
      setShowAdd(false);
      setAddIdentifier("");
      load();
    } catch (e: any) {
      toast(e.message || "Failed to add group", "error");
    } finally {
      setAddSaving(false);
    }
  };

  const handleStart = async (groupId: string) => {
    if (!auth?.token) return;
    setActionBusy(groupId);
    try {
      await startGroupScanner(auth.token, groupId);
      toast("Scanner started", "success");
      setTimeout(load, 2000);
    } catch (e: any) {
      toast(e.message || "Failed to start scanner", "error");
    } finally {
      setActionBusy(null);
    }
  };

  const handleStop = async (groupId: string) => {
    if (!auth?.token) return;
    setActionBusy(groupId);
    try {
      await stopGroupScanner(auth.token, groupId);
      toast("Scanner stopped", "success");
      setTimeout(load, 2000);
    } catch (e: any) {
      toast(e.message || "Failed to stop scanner", "error");
    } finally {
      setActionBusy(null);
    }
  };

  const handleRemove = async (groupId: string) => {
    if (!auth?.token || !confirm("Remove this group from monitoring?")) return;
    setActionBusy(groupId);
    try {
      await removeGroup(auth.token, groupId);
      toast("Group removed", "success");
      load();
    } catch (e: any) {
      toast(e.message || "Failed to remove group", "error");
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className={`space-y-6${!loading ? " animate-fade-in" : ""}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monitored Groups</h1>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">
          + Add Group
        </button>
      </div>

      {/* How it works */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-2">How group monitoring works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-zinc-400">
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">1</span>
            <div><strong className="text-zinc-300">Add group</strong> — enter @username (Telegram) or group ID (VK)</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">2</span>
            <div><strong className="text-zinc-300">Connect account</strong> — select an active account to join the group</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">3</span>
            <div><strong className="text-zinc-300">Start scanner</strong> — system joins the group and listens 24/7</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold text-sm">4</span>
            <div><strong className="text-zinc-300">Get leads</strong> — messages with buying intent are classified and sent to you</div>
          </div>
        </div>
      </div>

      {/* Auto-Discovery */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-300">🔍 Auto-Discover Groups</h2>
          <button onClick={() => setShowDiscover(!showDiscover)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            {showDiscover ? "Hide" : "Show"}
          </button>
        </div>
        {showDiscover && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Enter your GEO and niche — the system will find relevant public groups automatically.
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">GEO</label>
                <input type="text" value={discoverGeo} onChange={(e) => setDiscoverGeo(e.target.value)}
                  placeholder="Phuket, Moscow, Bangkok..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Niche</label>
                <input type="text" value={discoverNiche} onChange={(e) => setDiscoverNiche(e.target.value)}
                  placeholder="real_estate, tourism, IT..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              </div>
              <div className="w-32">
                <label className="text-xs text-zinc-500 mb-1 block">Platform</label>
                <select value={discoverPlatform} onChange={(e) => setDiscoverPlatform(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                  <option value="telegram">Telegram</option>
                  <option value="vkontakte">VKontakte</option>
                </select>
              </div>
              <div className="w-48">
                <label className="text-xs text-zinc-500 mb-1 block">Use Account</label>
                <select value={addAccountId} onChange={(e) => setAddAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                  <option value="">Select...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.account_identifier}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleDiscover} disabled={discoverLoading || !discoverGeo.trim() || !discoverNiche.trim()}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 whitespace-nowrap">
                {discoverLoading ? "Searching..." : "🔍 Discover"}
              </button>
            </div>

            {/* Results */}
            {discovered && (
              <div className="mt-3">
                {discoverLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : discoverResults.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">
                    No groups found. Try different GEO or niche keywords.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {discoverResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 truncate">{r.title}</p>
                          <p className="text-xs text-zinc-500 font-mono">{r.group_identifier} · {(r.members_count || 0).toLocaleString()} members</p>
                        </div>
                        <button onClick={() => handleAddDiscovered(r.group_identifier, r.platform, r.title)}
                          disabled={!addAccountId}
                          className="px-3 py-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition disabled:opacity-40 ml-3 whitespace-nowrap">
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Group Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">Add Group for Monitoring</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Platform</label>
              <select value={addPlatform} onChange={(e) => setAddPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                <option value="telegram">Telegram</option>
                <option value="vkontakte">VKontakte</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                {addPlatform === "telegram" ? "Group @username" : "VK Group ID"}
              </label>
              <input type="text" required value={addIdentifier}
                placeholder={addPlatform === "telegram" ? "@phuket_rentals" : "12345678"}
                onChange={(e) => setAddIdentifier(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Account</label>
              <select value={addAccountId} onChange={(e) => setAddAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_identifier} ({a.platform})</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-zinc-600">
            {addPlatform === "telegram"
              ? "The account will join this group and listen for messages. Use public groups only."
              : "Enter the VK community ID (numeric). The system will monitor wall posts and comments."}
          </p>
          <div className="flex gap-3">
            <button type="submit" disabled={addSaving || !addIdentifier.trim() || !addAccountId}
              className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50">
              {addSaving ? "Adding..." : "Add Group"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Groups table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Platform</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Group</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Members</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Last Scan</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                <p className="text-zinc-300 font-medium mb-2">No groups being monitored</p>
                <p className="text-xs text-zinc-500 mb-1">Add a Telegram group or VK community to start monitoring for leads.</p>
                <p className="text-xs text-zinc-600">The system will join the group and listen for messages 24/7.</p>
              </td></tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <span className="text-xs">{g.platform === "telegram" ? "✈️ Telegram" : "🔵 VKontakte"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-zinc-100 font-medium text-sm">{g.title}</p>
                      <p className="text-zinc-500 text-xs font-mono">{g.group_identifier}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{(g.members_count || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[g.status] ?? STATUS_STYLES.idle}`}>
                      {g.status === "scanning" ? "🟢 Scanning" : g.status === "error" ? "❌ Error" : "⏸ Idle"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {g.last_scan_at ? new Date(g.last_scan_at).toLocaleString() : <span className="text-zinc-600">never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {g.status === "scanning" ? (
                        <button onClick={() => handleStop(g.id)}
                          disabled={actionBusy === g.id}
                          className="px-2.5 py-1 text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded hover:bg-rose-500/20 transition disabled:opacity-40">
                          {actionBusy === g.id ? "..." : "Stop"}
                        </button>
                      ) : (
                        <button onClick={() => handleStart(g.id)}
                          disabled={actionBusy === g.id || !g.account_id}
                          className="px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition disabled:opacity-40"
                          title={!g.account_id ? "No account assigned" : "Start monitoring"}>
                          {actionBusy === g.id ? "..." : "Start"}
                        </button>
                      )}
                      <button onClick={() => handleRemove(g.id)}
                        disabled={actionBusy === g.id || g.status === "scanning"}
                        className="px-2.5 py-1 text-xs text-zinc-500 hover:text-rose-400 transition disabled:opacity-40"
                        title="Remove from monitoring">
                        Remove
                      </button>
                    </div>
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
