"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getProxies, createProxy, deleteProxy, testProxy, updateProxy, bulkImportProxies, bulkAssignProxies } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";

type Proxy = {
  id: string;
  proxy_url: string;
  geo_location: string;
  rotation_api_url: string;
  is_active: boolean;
  last_rotated_at: string | null;
  assigned_accounts: number;
};

export default function ProxiesPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formGeo, setFormGeo] = useState("");
  const [formRotation, setFormRotation] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editGeo, setEditGeo] = useState("");

  // Bulk import state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkGeo, setBulkGeo] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  // Bulk assign state
  const [assignBusy, setAssignBusy] = useState(false);

  const load = async () => {
    if (!auth.token) return;
    setLoading(true);
    try {
      setProxies(await getProxies(auth.token!));
    } catch (e: any) {
      toast(e.message, "error");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [auth.token]);

  const handleCreate = async () => {
    if (!formUrl.trim()) { toast(t("proxies.urlRequired"), "error"); return; }
    setSaving(true);
    try {
      await createProxy(auth.token!, { proxy_url: formUrl.trim(), geo_location: formGeo.trim() || undefined, rotation_api_url: formRotation.trim() || undefined });
      toast(t("proxies.created"), "success");
      setShowAdd(false);
      setFormUrl(""); setFormGeo(""); setFormRotation("");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("proxies.confirmDelete"))) return;
    try {
      await deleteProxy(auth.token!, id);
      toast(t("proxies.deleted"), "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await testProxy(auth.token!, id);
      toast(res.message, res.status === "ok" ? "success" : "error");
    } catch (e: any) {
      toast(e.message, "error");
    }
    setTestingId(null);
  };

  const handleToggle = async (p: Proxy) => {
    try {
      await updateProxy(auth.token!, p.id, { is_active: !p.is_active });
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await updateProxy(auth.token!, editingId, { proxy_url: editUrl, geo_location: editGeo });
      toast(t("proxies.updated"), "success");
      setEditingId(null);
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  // ── Bulk import ──
  const handleBulkImport = async () => {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) { toast(t("proxies.bulkEmpty"), "error"); return; }
    setBulkSaving(true);
    try {
      const res = await bulkImportProxies(auth.token!, lines, bulkGeo.trim() || undefined);
      setBulkResult(res);
      toast(`${t("proxies.bulkCreated")}: ${res.created}, ${t("proxies.bulkSkipped")}: ${res.skipped}`, "success");
      if (res.created > 0) await load();
      if (res.errors.length === 0) { setShowBulk(false); setBulkText(""); setBulkGeo(""); }
    } catch (e: any) {
      toast(e.message, "error");
    }
    setBulkSaving(false);
  };

  // ── Bulk assign ──
  const handleBulkAssign = async () => {
    if (!confirm(t("proxies.bulkAssignConfirm"))) return;
    setAssignBusy(true);
    try {
      const res = await bulkAssignProxies(auth.token!, true);
      toast(`${t("proxies.bulkAssigned")}: ${res.assigned}/${res.total_accounts}`, "success");
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
    setAssignBusy(false);
  };

  const maskUrl = (url: string) => {
    try {
      const u = new URL(url);
      const pass = u.password ? "****" : "";
      const user = u.username || "";
      return `${u.protocol}//${user}${pass ? ":" + pass : ""}@${u.hostname}:${u.port || "1080"}`;
    } catch {
      return url.replace(/:[^:]+@/, ":****@");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{t("proxies.title")}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t("proxies.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleBulkAssign()} disabled={assignBusy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
            {assignBusy ? "..." : t("proxies.bulkAssign")}
          </button>
          <button onClick={() => { setShowBulk(!showBulk); setShowAdd(false); }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition">
            {t("proxies.bulkImport")}
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setShowBulk(false); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition">
            {t("proxies.add")}
          </button>
        </div>
      </div>

      {/* Bulk import form */}
      {showBulk && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-zinc-300">{t("proxies.bulkImportTitle")}</h3>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">{t("proxies.bulkInputLabel")}</label>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={8}
              placeholder={"socks5://user1:pass1@host1:1080\nsocks5://user2:pass2@host2:1080\nhttp://user3:pass3@host3:8080"}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">{t("proxies.geoLabel")}</label>
              <input value={bulkGeo} onChange={e => setBulkGeo(e.target.value)} placeholder="RU, US, NL..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
            </div>
          </div>
          <p className="text-xs text-zinc-500">{t("proxies.bulkHint")}</p>
          {bulkResult && (
            <div className="text-xs space-y-1">
              <p className="text-emerald-400">{t("proxies.bulkCreated")}: {bulkResult.created}</p>
              <p className="text-zinc-400">{t("proxies.bulkSkipped")}: {bulkResult.skipped}</p>
              {bulkResult.errors.length > 0 && (
                <div className="text-rose-400">{bulkResult.errors.map((e, i) => <p key={i}>{e}</p>)}</div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleBulkImport} disabled={bulkSaving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
              {bulkSaving ? "..." : t("proxies.bulkImportBtn")}
            </button>
            <button onClick={() => { setShowBulk(false); setBulkText(""); setBulkResult(null); }}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-sm transition">
              {t("proxies.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">{t("proxies.urlLabel")}</label>
            <input value={formUrl} onChange={e => setFormUrl(e.target.value)}
              placeholder="socks5://user:pass@host:port"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">{t("proxies.geoLabel")}</label>
              <input value={formGeo} onChange={e => setFormGeo(e.target.value)}
                placeholder="RU, US, NL..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">{t("proxies.rotationLabel")}</label>
              <input value={formRotation} onChange={e => setFormRotation(e.target.value)}
                placeholder="https://..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
              {saving ? "..." : t("proxies.save")}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-sm transition">
              {t("proxies.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="text-left px-4 py-3 font-medium">{t("proxies.colUrl")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("proxies.colGeo")}</th>
              <th className="text-center px-4 py-3 font-medium">{t("proxies.colAccounts")}</th>
              <th className="text-center px-4 py-3 font-medium">{t("proxies.colStatus")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("proxies.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">{t("proxies.loading")}</td></tr>
            ) : proxies.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">{t("proxies.empty")}</td></tr>
            ) : proxies.map(p => (
              <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-4 py-3">
                  {editingId === p.id ? (
                    <input value={editUrl} onChange={e => setEditUrl(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500" />
                  ) : (
                    <code className="text-xs text-zinc-300 break-all">{maskUrl(p.proxy_url)}</code>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === p.id ? (
                    <input value={editGeo} onChange={e => setEditGeo(e.target.value)}
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500" />
                  ) : (
                    <span className="text-zinc-400 text-xs">{p.geo_location || "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.assigned_accounts > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-700 text-zinc-500"}`}>
                    {p.assigned_accounts}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggle(p)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition ${p.is_active ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-zinc-700 text-zinc-500 hover:bg-zinc-600"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${p.is_active ? "bg-emerald-400" : "bg-zinc-500"}`} />
                    {p.is_active ? t("proxies.active") : t("proxies.inactive")}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {editingId === p.id ? (
                      <>
                        <button onClick={handleSaveEdit}
                          className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition">{t("proxies.save")}</button>
                        <button onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition">{t("proxies.cancel")}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(p.id); setEditUrl(p.proxy_url); setEditGeo(p.geo_location); }}
                          className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition">{t("proxies.edit")}</button>
                        <button onClick={() => handleTest(p.id)} disabled={testingId === p.id}
                          className="px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded transition disabled:opacity-50">
                          {testingId === p.id ? "..." : t("proxies.test")}
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          className="px-2 py-1 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded transition">{t("proxies.delete")}</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs text-zinc-500">{t("proxies.hint")}</p>
      </div>
    </div>
  );
}
