"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getUsers, inviteUser, updateUserRole, removeUser } from "@/lib/api";

type User = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  admin: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  member: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  viewer: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
};

export default function UsersPage() {
  const { auth } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getUsers(auth.token).then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token || !inviteEmail.trim()) return;
    setInviting(true);
    setError("");
    try {
      await inviteUser(auth.token, inviteEmail, inviteRole);
      setInviteEmail("");
      load();
    } catch (err: any) {
      setError(err.message || "Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!auth?.token) return;
    try {
      await updateUserRole(auth.token, userId, newRole);
      load();
    } catch {}
  };

  const handleRemove = async (userId: string) => {
    if (!auth?.token || !confirm("Remove this user?")) return;
    try {
      await removeUser(auth.token, userId);
      load();
    } catch {}
  };

  const isOwner = auth?.user?.role === "owner";
  const isAdmin = auth?.user?.role === "admin" || isOwner;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team Members</h1>

      {/* Invite form */}
      {isAdmin && (
        <form onSubmit={handleInvite} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-3">
          <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500"
            placeholder="colleague@company.com" required />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" disabled={inviting || !inviteEmail.trim()}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
            {inviting ? "..." : "Invite"}
          </button>
        </form>
      )}
      {error && <p className="text-rose-400 text-sm">{error}</p>}

      {/* Users table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Joined</th>
              {isAdmin && <th className="text-left px-4 py-3 text-zinc-400 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No users found.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-100">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${ROLE_STYLES[u.role] ?? ""}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {u.role !== "owner" && (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300">
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        )}
                        {u.role !== "owner" && u.id !== auth?.user?.id && (
                          <button onClick={() => handleRemove(u.id)}
                            className="px-2 py-1 text-rose-400 hover:bg-rose-500/10 rounded text-xs transition">
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Role descriptions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Role Permissions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-amber-400 font-medium">Owner</span><p className="text-zinc-500 mt-1">Full access, billing, delete tenant</p></div>
          <div><span className="text-sky-400 font-medium">Admin</span><p className="text-zinc-500 mt-1">Manage users, all CRUD, settings</p></div>
          <div><span className="text-emerald-400 font-medium">Member</span><p className="text-zinc-500 mt-1">Leads, campaigns, accounts</p></div>
          <div><span className="text-zinc-400 font-medium">Viewer</span><p className="text-zinc-500 mt-1">Read-only access to dashboard</p></div>
        </div>
      </div>
    </div>
  );
}
