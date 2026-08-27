"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSubscription, getUsage, updateTenant, changePassword } from "@/lib/api";

export default function SettingsPage() {
  const { auth } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sub, setSub] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    if (!auth?.token) return;
    setCompanyName(auth.user?.company_name || "");
    getSubscription(auth.token).then(setSub).catch(() => {});
    getUsage(auth.token).then(setUsage).catch(() => {});
  }, [auth?.token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateTenant(auth.token, { company_name: companyName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Company profile */}
      <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">Company Profile</h2>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Company Name</label>
          <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && <span className="text-emerald-400 text-sm">Saved!</span>}
        </div>
      </form>

      {/* Plan info */}
      {sub && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-zinc-400">Current Plan</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Plan:</span>
              <span className="text-zinc-200 ml-2 font-medium capitalize">{sub.plan}</span>
            </div>
            <div>
              <span className="text-zinc-500">Status:</span>
              <span className={`ml-2 font-medium ${sub.status === "active" ? "text-emerald-400" : "text-rose-400"}`}>{sub.status}</span>
            </div>
            <div>
              <span className="text-zinc-500">Posts Used:</span>
              <span className="text-zinc-200 ml-2">{sub.monthly_posts_used} / {sub.monthly_posts_limit}</span>
            </div>
            <div>
              <span className="text-zinc-500">Token Credits:</span>
              <span className="text-zinc-200 ml-2">{(sub.token_credits_balance || 0).toLocaleString()}</span>
            </div>
            <div className="col-span-2">
              <span className="text-zinc-500">Renews:</span>
              <span className="text-zinc-200 ml-2">{new Date(sub.current_period_end).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Usage */}
      {usage && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-zinc-400">Usage This Period</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Tokens Used:</span>
              <span className="text-zinc-200 ml-2">{(usage.total_tokens_used || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-zinc-500">Cost:</span>
              <span className="text-zinc-200 ml-2">${(usage.total_cost_usd || 0).toFixed(4)}</span>
            </div>
          </div>
        </div>
      )}

      {/* API Keys info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">API Configuration</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Telegram API:</span>
            <span className="text-zinc-400">{process.env.NEXT_PUBLIC_TG_API_ID ? "Configured" : "Not set"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">DeepSeek/OpenAI:</span>
            <span className="text-zinc-400">{process.env.NEXT_PUBLIC_LLM_KEY ? "Configured" : "Not set (using keyword heuristic)"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Stripe:</span>
            <span className="text-zinc-400">{process.env.NEXT_PUBLIC_STRIPE_KEY ? "Configured" : "Mock mode"}</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <ChangePasswordForm />
    </div>
  );
}

function ChangePasswordForm() {
  const { auth } = useAuth();
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    if (newPass !== confirm) { setError("Passwords don't match"); return; }
    if (newPass.length < 8) { setError("Min 8 characters"); return; }
    setSaving(true); setError(""); setMsg("");
    try {
      await changePassword(auth.token, current, newPass);
      setMsg("Password changed!");
      setCurrent(""); setNewPass(""); setConfirm("");
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <h2 className="text-sm font-medium text-zinc-400">Change Password</h2>
      <input type="password" placeholder="Current password" required value={current} onChange={(e) => setCurrent(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
      <input type="password" placeholder="New password (min 8 chars)" required value={newPass} onChange={(e) => setNewPass(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
      <input type="password" placeholder="Confirm new password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
          {saving ? "Changing..." : "Change Password"}
        </button>
        {msg && <span className="text-emerald-400 text-sm">{msg}</span>}
        {error && <span className="text-rose-400 text-sm">{error}</span>}
      </div>
    </form>
  );
}
