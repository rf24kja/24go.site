"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getScoringRules, createScoringRule, deleteScoringRule } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";

type Rule = {
  id: string;
  name: string;
  intent: string;
  keywords: string[];
  min_confidence: number;
  priority: number;
  is_active: boolean;
};

const INTENT_STYLES: Record<string, string> = {
  HOT: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  WARM: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  COLD: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  SPAM: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

export default function ScoringPage() {
  const { auth } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", intent: "HOT", keywords: "", confidence: "0.5", priority: "5" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getScoringRules(auth.token).then(setRules).catch(() => setRules([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    try {
      await createScoringRule(auth.token, {
        name: form.name,
        intent: form.intent,
        keywords: form.keywords.split(",").map((s) => s.trim()).filter(Boolean),
        min_confidence: parseFloat(form.confidence),
        priority: parseInt(form.priority),
      });
      setShowModal(false);
      setForm({ name: "", intent: "HOT", keywords: "", confidence: "0.5", priority: "5" });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm("Delete this rule?")) return;
    try { await deleteScoringRule(auth.token, id); } catch { /* empty */ }
    load();
  };

  return (
    <div className={`space-y-6${!loading ? " animate-fade-in" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Scoring Rules</h1>
          <p className="text-zinc-500 text-sm mt-1">Customize how leads are classified into HOT/WARM/COLD/SPAM</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">
          New Rule
        </button>
      </div>

      {/* How it works */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-2">How Scoring Works</h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Rules are evaluated by <strong className="text-zinc-300">priority</strong> (highest first).
          When a message matches keywords in a rule with sufficient confidence, that intent is assigned.
          If no rules match, the built-in keyword heuristic is used as fallback.
        </p>
      </div>

      {/* Rules table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Priority</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Intent</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Keywords</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Min Confidence</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                  ))}
                </div>
              </td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No rules yet. Create one to customize scoring.</td></tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{r.priority}</td>
                  <td className="px-4 py-3 text-zinc-100">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${INTENT_STYLES[r.intent] ?? ""}`}>
                      {r.intent}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[300px]">
                      {(r.keywords || []).slice(0, 5).map((kw) => (
                        <span key={kw} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">{kw}</span>
                      ))}
                      {(r.keywords || []).length > 5 && (
                        <span className="text-zinc-600 text-[10px]">+{r.keywords.length - 5}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{r.min_confidence}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(r.id)}
                      className="px-2 py-1 text-rose-400 hover:bg-rose-500/10 rounded text-xs transition">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">New Scoring Rule</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input type="text" placeholder="Rule name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Intent</label>
                  <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                    <option value="HOT">🔥 HOT</option>
                    <option value="WARM">🟡 WARM</option>
                    <option value="COLD">❄️ COLD</option>
                    <option value="SPAM">🗑 SPAM</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Confidence</label>
                  <input type="number" step="0.1" min="0" max="1" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Priority</label>
                  <input type="number" min="0" max="100" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
              </div>
              <textarea placeholder="Keywords (comma-separated)" required rows={3} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
