"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getOwnerUsers, getOwnerSubscriptions } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";

type OwnerUser = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  tenant_id: string;
  company_name: string;
  plan: string;
  is_active: boolean;
};

type OwnerSub = {
  id: string;
  tenant_id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  monthly_posts_limit: number;
  monthly_posts_used: number;
  token_credits_balance: number;
  created_at: string;
  company_name: string;
  owner_email: string;
};

const PLAN_COLORS: Record<string, string> = {
  trial: "bg-zinc-500/10 text-zinc-400",
  starter: "bg-emerald-500/10 text-emerald-400",
  pro: "bg-blue-500/10 text-blue-400",
  enterprise: "bg-violet-500/10 text-violet-400",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  past_due: "bg-amber-500/10 text-amber-400",
  canceled: "bg-rose-500/10 text-rose-400",
  trial: "bg-zinc-500/10 text-zinc-400",
};

export default function AdminPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [subs, setSubs] = useState<OwnerSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "subscriptions">("users");

  const isOwner = auth?.user?.email === "rf24krsk@gmail.com" || auth?.user?.role === "owner";

  useEffect(() => {
    if (!auth?.token || !isOwner) return;
    setLoading(true);
    Promise.all([
      getOwnerUsers(auth.token).catch(() => []),
      getOwnerSubscriptions(auth.token).catch(() => []),
    ]).then(([u, s]) => {
      setUsers(u);
      setSubs(s);
      setLoading(false);
    });
  }, [auth?.token, isOwner]);

  if (!isOwner) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 text-sm">Owner access required. This page is restricted to rf24krsk@gmail.com.</p>
        </div>
      </div>
    );
  }

  const totalUsers = users.length;
  const totalTenants = new Set(users.map((u) => u.tenant_id)).size;
  const activeSubs = subs.filter((s) => s.status === "active").length;
  const totalRevenue = subs.filter((s) => s.plan !== "trial").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Owner Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Platform overview — rf24krsk@gmail.com only</p>
        </div>
        <span className="text-amber-400 text-sm font-medium px-3 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">Owner Mode</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={totalUsers} color="emerald" />
        <StatCard label="Tenants" value={totalTenants} color="blue" />
        <StatCard label="Active Subs" value={activeSubs} color="violet" />
        <StatCard label="Paid Plans" value={totalRevenue} color="amber" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === "users" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Users ({totalUsers})
        </button>
        <button
          onClick={() => setTab("subscriptions")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === "subscriptions" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Subscriptions ({subs.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : tab === "users" ? (
        <UsersTable users={users} />
      ) : (
        <SubsTable subs={subs} />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className={`text-2xl font-bold text-${color}-400`}>{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

function UsersTable({ users }: { users: OwnerUser[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Company</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Registered</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition">
                <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-3 text-zinc-300">{u.company_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${u.role === "owner" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-800 text-zinc-400"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${PLAN_COLORS[u.plan] || "bg-zinc-800 text-zinc-400"}`}>
                    {u.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${u.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {u.is_active ? "active" : "inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubsTable({ subs }: { subs: OwnerSub[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Owner</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Company</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Posts Used</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Credits</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Period</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Since</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition">
                <td className="px-4 py-3 text-zinc-300 font-mono text-xs">{s.owner_email || "—"}</td>
                <td className="px-4 py-3 text-zinc-300">{s.company_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${PLAN_COLORS[s.plan] || "bg-zinc-800 text-zinc-400"}`}>
                    {s.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[s.status] || "bg-zinc-800 text-zinc-400"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{s.monthly_posts_used}/{s.monthly_posts_limit}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{(s.token_credits_balance || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {new Date(s.current_period_start).toLocaleDateString()} — {new Date(s.current_period_end).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
