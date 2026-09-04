"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { PlanGuard } from "@/components/PlanGuard";
import { Spinner } from "@/components/Spinner";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getAutoReplies, createAutoReply, getAutoReply, updateAutoReply,
  deleteAutoReply, addAutoReplyAnswer, deleteAutoReplyAnswer,
  importAutoReplyAnswers, toggleAutoReply,
} from "@/lib/api";

type AutoReply = {
  id: string;
  name: string;
  mode: string;
  keywords: string;
  prompt: string;
  model: string;
  is_active: boolean;
  answers_count: number;
  answers?: { id: string; text: string; sort_order: number }[];
  created_at: string | null;
};

const MODE_COLORS: Record<string, string> = {
  keyword: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  ai_agent: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  rotation: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export default function AutoRepliesPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [items, setItems] = useState<AutoReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AutoReply | null>(null);
  const [detail, setDetail] = useState<AutoReply | null>(null);
  const [saving, setSaving] = useState(false);
  const [answerInput, setAnswerInput] = useState("");
  const [showImportTxt, setShowImportTxt] = useState(false);
  const [importTxt, setImportTxt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    mode: "keyword",
    keywords: "",
    prompt: "",
    model: "deepseek-chat",
    api_key: "",
  });
  const [answers, setAnswers] = useState<string[]>([]);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getAutoReplies(auth.token)
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", mode: "keyword", keywords: "", prompt: "", model: "deepseek-chat", api_key: "" });
    setAnswers([]);
    setShowModal(true);
  };

  const openEdit = async (id: string) => {
    if (!auth?.token) return;
    try {
      const data = await getAutoReply(auth.token, id);
      setEditing(data);
      setForm({
        name: data.name,
        mode: data.mode,
        keywords: data.keywords || "",
        prompt: data.prompt || "",
        model: data.model || "deepseek-chat",
        api_key: "",
      });
      setAnswers((data.answers || []).map((a: any) => a.text));
      setShowModal(true);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const openDetail = async (id: string) => {
    if (!auth?.token) return;
    try {
      const data = await getAutoReply(auth.token, id);
      setDetail(data);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    try {
      if (editing) {
        await updateAutoReply(auth.token, editing.id, {
          name: form.name,
          mode: form.mode,
          keywords: form.keywords,
          prompt: form.prompt,
          model: form.model,
          api_key: form.api_key || undefined,
        });
        toast(t("autoReplies.updated"), "success");
      } else {
        await createAutoReply(auth.token, {
          name: form.name,
          mode: form.mode,
          keywords: form.keywords,
          prompt: form.prompt,
          model: form.model,
          api_key: form.api_key,
          answers,
        });
        toast(t("autoReplies.created"), "success");
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast(e.message || t("autoReplies.createFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm(t("autoReplies.deleteConfirm"))) return;
    try {
      await deleteAutoReply(auth.token, id);
      toast(t("autoReplies.deleted"), "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleToggle = async (id: string) => {
    if (!auth?.token) return;
    try {
      await toggleAutoReply(auth.token, id);
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const addAnswer = () => {
    const text = answerInput.trim();
    if (!text) return;
    setAnswers([...answers, text]);
    setAnswerInput("");
  };

  const removeAnswer = (idx: number) => {
    setAnswers(answers.filter((_, i) => i !== idx));
  };

  const handleImportTxt = async () => {
    if (!auth?.token || !detail) return;
    try {
      const res = await importAutoReplyAnswers(auth.token, detail.id, importTxt);
      toast(t("autoReplies.imported", { count: res.imported }), "success");
      setShowImportTxt(false);
      setImportTxt("");
      const updated = await getAutoReply(auth.token, detail.id);
      setDetail(updated);
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleAddAnswerApi = async () => {
    if (!auth?.token || !detail) return;
    const text = answerInput.trim();
    if (!text) return;
    try {
      await addAutoReplyAnswer(auth.token, detail.id, text);
      setAnswerInput("");
      const updated = await getAutoReply(auth.token, detail.id);
      setDetail(updated);
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleDeleteAnswerApi = async (answerId: string) => {
    if (!auth?.token || !detail) return;
    try {
      await deleteAutoReplyAnswer(auth.token, detail.id, answerId);
      const updated = await getAutoReply(auth.token, detail.id);
      setDetail(updated);
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportTxt(reader.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <PlanGuard feature="auto-replies">
      <div className="space-y-6 animate-fade-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("autoReplies.title")}</h1>
        <button onClick={openCreate}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 btn-press">
          {t("autoReplies.newAutoReply")}
        </button>
      </div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : items.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-300 font-medium mb-2">{t("autoReplies.empty")}</p>
          <p className="text-xs text-zinc-500 mb-4">{t("autoReplies.emptyDesc")}</p>
          <button onClick={openCreate}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">
            {t("autoReplies.createFirst")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((ar) => (
            <div key={ar.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3 cursor-pointer hover:border-zinc-700 transition"
              onClick={() => openDetail(ar.id)}>
              <div className="flex items-start justify-between">
                <h2 className="text-zinc-100 font-medium truncate">{ar.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${MODE_COLORS[ar.mode] || MODE_COLORS.keyword}`}>
                  {t(`autoReplies.mode.${ar.mode}`)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{ar.mode === "keyword" || ar.mode === "ai_agent" ? `${(ar.keywords || "").split(",").filter(Boolean).length} keywords` : t("autoReplies.mode.rotation")}</span>
                <span>·</span>
                <span>{ar.answers_count} {t("autoReplies.answers")}</span>
              </div>
              <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleToggle(ar.id)}
                  className={`px-3 py-1 rounded text-xs border transition ${
                    ar.is_active
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                  }`}>
                  {ar.is_active ? t("autoReplies.active") : t("autoReplies.inactive")}
                </button>
                <button onClick={() => openEdit(ar.id)}
                  className="px-3 py-1 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded text-xs hover:bg-zinc-700 transition">
                  ✏️
                </button>
                <button onClick={() => handleDelete(ar.id)}
                  className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-xs hover:bg-rose-500/20 transition">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">
              {editing ? t("autoReplies.editTitle") : t("autoReplies.createTitle")}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("autoReplies.nameLabel")}</label>
                <input type="text" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                  placeholder={t("autoReplies.namePlaceholder")} />
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-2 block">{t("autoReplies.modeLabel")}</label>
                <div className="space-y-2">
                  {(["keyword", "ai_agent", "rotation"] as const).map((mode) => (
                    <label key={mode} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      form.mode === mode ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-700 hover:border-zinc-600"
                    }`}>
                      <input type="radio" name="mode" value={mode} checked={form.mode === mode}
                        onChange={(e) => setForm({ ...form, mode: e.target.value })}
                        className="mt-0.5 accent-emerald-500" />
                      <div>
                        <span className="text-sm text-zinc-200 font-medium">{t(`autoReplies.mode${mode === "keyword" ? "Keyword" : mode === "ai_agent" ? "AiAgent" : "Rotation"}`)}</span>
                        <p className="text-xs text-zinc-500 mt-0.5">{t(`autoReplies.mode${mode === "keyword" ? "KeywordDesc" : mode === "ai_agent" ? "AiAgentDesc" : "RotationDesc"}`)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {(form.mode === "keyword" || form.mode === "ai_agent") && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("autoReplies.keywordsLabel")}</label>
                  <input type="text" value={form.keywords}
                    onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                    placeholder={t("autoReplies.keywordsPlaceholder")} />
                  <p className="text-[10px] text-zinc-600 mt-1">{t("autoReplies.keywordsHint")}</p>
                </div>
              )}

              {form.mode === "ai_agent" && (
                <>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">{t("autoReplies.promptLabel")}</label>
                    <textarea rows={4} value={form.prompt}
                      onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none"
                      placeholder={t("autoReplies.promptPlaceholder")} />
                    <p className="text-[10px] text-zinc-600 mt-1">{t("autoReplies.promptHint")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">{t("autoReplies.modelLabel")}</label>
                      <input type="text" value={form.model}
                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                        placeholder={t("autoReplies.modelPlaceholder")} />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">{t("autoReplies.apiKeyLabel")}</label>
                      <input type="password" value={form.api_key}
                        onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                        placeholder={editing ? "••••••••" : t("autoReplies.apiKeyPlaceholder")} />
                      <p className="text-[10px] text-zinc-600 mt-1">{t("autoReplies.apiKeyHint")}</p>
                    </div>
                  </div>
                </>
              )}

              {form.mode !== "ai_agent" && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("autoReplies.answersLabel")}</label>
                  <div className="space-y-2">
                    {answers.map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 truncate">{a}</span>
                        <button type="button" onClick={() => removeAnswer(i)}
                          className="text-rose-400 hover:text-rose-300 text-xs px-2">✕</button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input type="text" value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAnswer(); } }}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                        placeholder={t("autoReplies.addAnswerPlaceholder")} />
                      <button type="button" onClick={addAnswer}
                        className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700">+</button>
                    </div>
                    <p className="text-[10px] text-zinc-600">{t("autoReplies.answersHint")}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
                  {t("autoReplies.cancel")}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50 btn-press">
                  {saving ? t("autoReplies.saving") : editing ? t("autoReplies.update") : t("autoReplies.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail slide-over */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-6 space-y-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100">{detail.name}</h2>
              <button onClick={() => setDetail(null)} className="text-zinc-500 hover:text-zinc-300 text-xl">&times;</button>
            </div>
            <div className="bg-zinc-800 rounded-lg p-3 text-sm space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>{t("autoReplies.modeLabel")}</span>
                <span className={`font-medium ${MODE_COLORS[detail.mode]?.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                  {t(`autoReplies.mode.${detail.mode}`)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t("autoReplies.nameLabel")}</span>
                <span className="text-zinc-200">{detail.is_active ? t("autoReplies.active") : t("autoReplies.inactive")}</span>
              </div>
            </div>

            {(detail.mode === "keyword" || detail.mode === "ai_agent") && detail.keywords && (
              <div>
                <h3 className="text-xs text-zinc-500 mb-2">{t("autoReplies.keywordsLabel")}</h3>
                <div className="flex flex-wrap gap-1">
                  {detail.keywords.split(",").filter(Boolean).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300">{kw.trim()}</span>
                  ))}
                </div>
              </div>
            )}

            {detail.mode === "ai_agent" && (
              <div>
                <h3 className="text-xs text-zinc-500 mb-2">{t("autoReplies.promptLabel")}</h3>
                <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300 whitespace-pre-wrap">{detail.prompt || "—"}</div>
                <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                  <span>{t("autoReplies.modelLabelDetail")}: {detail.model || "—"}</span>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs text-zinc-500">{t("autoReplies.answersLabel")} ({(detail.answers || []).length})</h3>
                <button onClick={() => setShowImportTxt(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300">{t("autoReplies.importFromTxt")}</button>
              </div>
              {(detail.answers || []).length === 0 ? (
                <p className="text-xs text-zinc-600">{t("autoReplies.noAnswers")}</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.answers!.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 group">
                      <span className="flex-1 px-3 py-2 bg-zinc-800 rounded text-sm text-zinc-300 truncate">{a.text}</span>
                      <button onClick={() => handleDeleteAnswerApi(a.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <input type="text" value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAnswerApi(); } }}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                  placeholder={t("autoReplies.addAnswerPlaceholder")} />
                <button onClick={handleAddAnswerApi}
                  className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700">+</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import txt modal */}
      {showImportTxt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setShowImportTxt(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("autoReplies.importFromTxt")}</h2>
            <p className="text-xs text-zinc-500">{t("autoReplies.importTxtHint")}</p>
            <textarea rows={8} value={importTxt}
              onChange={(e) => setImportTxt(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none font-mono"
              placeholder={t("autoReplies.importTxtDrop")} />
            <div>
              <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFileImport} />
              <button onClick={() => fileRef.current?.click()}
                className="text-xs text-emerald-400 hover:text-emerald-300">{t("autoReplies.importFromTxt")}</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowImportTxt(false)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
                {t("autoReplies.cancel")}
              </button>
              <button onClick={handleImportTxt} disabled={!importTxt.trim()}
                className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50 btn-press">
                {t("autoReplies.importTxtBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PlanGuard>
  );
}
