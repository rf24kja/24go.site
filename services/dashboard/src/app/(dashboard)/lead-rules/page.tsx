"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getScoringRules, createScoringRule, deleteScoringRule } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { useI18n } from "@/lib/i18n";
import { FieldHint } from "@/components/FieldHint";

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
  const { t } = useI18n();
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
    if (!auth?.token || !confirm(t("leadRules.deleteConfirm"))) return;
    try { await deleteScoringRule(auth.token, id); } catch { /* empty */ }
    load();
  };

  return (
    <div className={`space-y-6 animate-fade-slide-in`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("leadRules.title")}</h1>
          <p className="text-zinc-500 text-sm mt-1">{t("leadRules.subtitle")}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 btn-press">
          {t("leadRules.newRule")}
        </button>
      </div>

      {/* How it works */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-2">{t("leadRules.howItWorks")}</h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          {t("leadRules.howPriority")}{" "}
          {t("leadRules.howMatch")}{" "}
          {t("leadRules.howFallback")}
        </p>
      </div>

      {/* Rules table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leadRules.colPriority")} <FieldHint hint={t("hints.scoring.priority")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leadRules.colName")} <FieldHint hint={t("hints.scoring.ruleName")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leadRules.colIntent")} <FieldHint hint={t("hints.scoring.intent")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leadRules.colKeywords")} <FieldHint hint={t("hints.scoring.keywords")} /></th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">{t("leadRules.colConfidence")} <FieldHint hint={t("hints.scoring.confidence")} /></th>
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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">{t("leadRules.empty")}</td></tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{r.priority}</td>
                  <td className="px-4 py-3 text-zinc-100">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${INTENT_STYLES[r.intent] ?? ""}`}>
                      {r.intent === "HOT" ? t("leadRules.intentHot") : r.intent === "WARM" ? t("leadRules.intentWarm") : r.intent === "COLD" ? t("leadRules.intentCold") : t("leadRules.intentSpam")}
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
                      {t("leadRules.delete")}
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
            <h2 className="text-lg font-bold text-zinc-100">{t("leadRules.newRuleTitle")}</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("leadRules.ruleNamePlaceholder")} <FieldHint hint={t("hints.leadRules.ruleName")} /></label>
                <input type="text" placeholder={t("leadRules.ruleNamePlaceholder")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("leadRules.colIntent")} <FieldHint hint={t("hints.leadRules.intent")} /></label>
                  <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                    <option value="HOT">{t("leadRules.intentHot")}</option>
                    <option value="WARM">{t("leadRules.intentWarm")}</option>
                    <option value="COLD">{t("leadRules.intentCold")}</option>
                    <option value="SPAM">{t("leadRules.intentSpam")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("leadRules.confidence")} <FieldHint hint={t("hints.leadRules.confidence")} /></label>
                  <input type="number" step="0.1" min="0" max="1" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("leadRules.colPriority")} <FieldHint hint={t("hints.leadRules.priority")} /></label>
                  <input type="number" min="0" max="100" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("leadRules.keywordsPlaceholder")} <FieldHint hint={t("hints.leadRules.keywords")} /></label>
                <textarea placeholder={t("leadRules.keywordsPlaceholder")} required rows={3} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("leadRules.cancel")}</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50 btn-press">
                  {saving ? t("leadRules.creating") : t("leadRules.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
