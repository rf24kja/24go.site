"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign } from "@/lib/api";
import { CardSkeleton } from "@/components/Skeleton";

type Campaign = {
  id: string;
  name: string;
  base_text: string;
  target_geos: string[];
  target_niches: string[];
  is_active: boolean;
  schedule_cron: string | null;
  posts_per_day: number | null;
  created_at: string;
};

const SCHEDULE_OPTIONS = [
  { label: "Every 30 min", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Every 4 hours", value: "0 */4 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "3 times/day", value: "0 8,14,20 * * *" },
  { label: "Manual only", value: "" },
];

type ModalMode = "create" | "edit" | null;

export default function CampaignsPage() {
  const { auth } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", base_text: "", target_geos: "", target_niches: "", schedule: "", posts_per_day: "5" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getCampaigns(auth.token).then((res) => setCampaigns(res.items || res)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const openCreate = () => {
    setModalMode("create");
    setEditingId(null);
    setForm({ name: "", base_text: "", target_geos: "", target_niches: "", schedule: "", posts_per_day: "5" });
  };

  const openEdit = (c: Campaign) => {
    setModalMode("edit");
    setEditingId(c.id);
    setForm({
      name: c.name,
      base_text: c.base_text,
      target_geos: (c.target_geos || []).join(", "),
      target_niches: (c.target_niches || []).join(", "),
      schedule: c.schedule_cron || "",
      posts_per_day: String(c.posts_per_day || 5),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    try {
      const data = {
        name: form.name,
        base_text: form.base_text,
        target_geos: form.target_geos.split(",").map((s) => s.trim()).filter(Boolean),
        target_niches: form.target_niches.split(",").map((s) => s.trim()).filter(Boolean),
        schedule_cron: form.schedule || null,
        posts_per_day: parseInt(form.posts_per_day) || 5,
      };
      if (modalMode === "edit" && editingId) {
        await updateCampaign(auth.token, editingId, data);
      } else {
        await createCampaign(auth.token, data);
      }
      setModalMode(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm("Delete this campaign?")) return;
    await deleteCampaign(auth.token, id);
    load();
  };

  const toggleActive = async (c: Campaign) => {
    if (!auth?.token) return;
    await updateCampaign(auth.token, c.id, { is_active: !c.is_active });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <button onClick={openCreate}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">
          New Campaign
        </button>
      </div>

      {loading ? (
        <CardSkeleton count={6} />
      ) : campaigns.length === 0 ? (
        <p className="text-zinc-500 text-sm">No campaigns yet. Create one to start posting.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <h2 className="text-zinc-100 font-medium truncate">{c.name}</h2>
                <button onClick={() => toggleActive(c)}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition ${c.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20"}`}>
                  {c.is_active ? "Active" : "Paused"}
                </button>
              </div>
              <p className="text-zinc-400 text-sm line-clamp-2">{c.base_text}</p>
              <div className="flex flex-wrap gap-1">
                {(c.target_geos || []).map((geo) => (
                  <span key={geo} className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded text-xs">{geo}</span>
                ))}
                {(c.target_niches || []).map((niche) => (
                  <span key={niche} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs">{niche}</span>
                ))}
              </div>
              {/* Schedule info */}
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>📅</span>
                <span>{c.schedule_cron ? SCHEDULE_OPTIONS.find((o) => o.value === c.schedule_cron)?.label || c.schedule_cron : "Manual"}</span>
                <span className="text-zinc-600">·</span>
                <span>{c.posts_per_day || 5}/day</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => openEdit(c)} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700 transition">Edit</button>
                <button onClick={() => handleDelete(c.id)} className="px-3 py-1 text-rose-400 hover:bg-rose-500/10 rounded text-xs transition">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalMode(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{modalMode === "edit" ? "Edit Campaign" : "New Campaign"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="text" placeholder="Campaign name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              <textarea placeholder="Post text (supports spintax: {option1|option2})" required rows={4} value={form.base_text} onChange={(e) => setForm({ ...form, base_text: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none" />
              <input type="text" placeholder="Target GEOs (comma-separated)" value={form.target_geos} onChange={(e) => setForm({ ...form, target_geos: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              <input type="text" placeholder="Niches (comma-separated)" value={form.target_niches} onChange={(e) => setForm({ ...form, target_niches: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Schedule</label>
                  <select value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                    {SCHEDULE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Posts/day limit</label>
                  <input type="number" min="1" max="50" value={form.posts_per_day} onChange={(e) => setForm({ ...form, posts_per_day: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalMode(null)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving..." : modalMode === "edit" ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
