"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost } from "@/lib/api";
import { TableSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";

type BlogPost = {
  id: string;
  title_ru: string;
  title_en: string;
  slug: string;
  published: boolean;
  created_at: string;
};

type Tab = "ru" | "en";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const emptyForm = {
  title_ru: "", title_en: "",
  slug: "",
  excerpt_ru: "", excerpt_en: "",
  content_ru: "", content_en: "",
  tags: "",
  meta_description_ru: "", meta_description_en: "",
  published: false,
};

export default function BlogAdminPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState<Tab>("en");
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    listBlogPosts(auth.token)
      .then((res) => setPosts(Array.isArray(res) ? res : res.items || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setTab("en");
    setModalOpen(true);
  };

  const openEdit = (p: BlogPost) => {
    setEditingId(p.id);
    setForm({
      title_ru: p.title_ru || "",
      title_en: p.title_en || "",
      slug: p.slug || "",
      excerpt_ru: "", excerpt_en: "",
      content_ru: "", content_en: "",
      tags: "",
      meta_description_ru: "", meta_description_en: "",
      published: p.published,
    });
    setTab("en");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    const data: any = {
      title_ru: form.title_ru,
      title_en: form.title_en,
      slug: form.slug || slugify(form.title_en),
      excerpt_ru: form.excerpt_ru,
      excerpt_en: form.excerpt_en,
      content_ru: form.content_ru,
      content_en: form.content_en,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      meta_description_ru: form.meta_description_ru,
      meta_description_en: form.meta_description_en,
      published: form.published,
    };
    try {
      if (editingId) {
        await updateBlogPost(auth.token, editingId, data);
        toast(t("blogAdmin.postUpdated"), "success");
      } else {
        await createBlogPost(auth.token, data);
        toast(t("blogAdmin.postCreated"), "success");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast(e.message || t("blogAdmin.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth?.token || !confirm(t("blogAdmin.deleteConfirm"))) return;
    try {
      await deleteBlogPost(auth.token, id);
      toast(t("blogAdmin.postDeleted"), "success");
      load();
    } catch {
      toast(t("blogAdmin.deleteFailed"), "error");
    }
  };

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("blogAdmin.title")}</h1>
        <button onClick={openCreate}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200">
          {t("blogAdmin.newPost")}
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : posts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-300 font-medium mb-2">{t("blogAdmin.empty")}</p>
          <button onClick={openCreate}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">
            {t("blogAdmin.createFirst")}
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">{t("blogAdmin.colTitle")}</th>
                <th className="px-4 py-3 font-medium">{t("blogAdmin.colSlug")}</th>
                <th className="px-4 py-3 font-medium">{t("blogAdmin.colPublished")}</th>
                <th className="px-4 py-3 font-medium">{t("blogAdmin.colCreated")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("blogAdmin.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-100">{p.title_en || p.title_ru || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{p.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.published ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`}>
                      {p.published ? t("blogAdmin.yes") : t("blogAdmin.draft")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(p)} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700 transition">{t("blogAdmin.edit")}</button>
                    <button onClick={() => handleDelete(p.id)} className="px-3 py-1 text-rose-400 hover:bg-rose-500/10 rounded text-xs transition">{t("blogAdmin.delete")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-zinc-100">{editingId ? t("blogAdmin.editTitle") : t("blogAdmin.createTitle")}</h2>

              <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
                <button onClick={() => setTab("en")} className={`flex-1 py-1.5 rounded text-sm font-medium transition ${tab === "en" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>{t("common.langEn")}</button>
                <button onClick={() => setTab("ru")} className={`flex-1 py-1.5 rounded text-sm font-medium transition ${tab === "ru" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-300"}`}>{t("common.langRu")}</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {tab === "en" ? (
                  <>
                    <input type="text" placeholder={t("blogAdmin.titleEn")} required value={form.title_en} onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => ({
                        ...f,
                        title_en: val,
                        slug: f.slug === slugify(f.title_en) || f.slug === "" ? slugify(val) : f.slug,
                      }));
                    }}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                    <input type="text" placeholder={t("blogAdmin.excerptEn")} value={form.excerpt_en} onChange={(e) => set("excerpt_en", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                    <textarea placeholder={t("blogAdmin.contentEn")} rows={10} value={form.content_en} onChange={(e) => set("content_en", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none font-mono" />
                    <input type="text" placeholder={t("blogAdmin.metaEn")} value={form.meta_description_en} onChange={(e) => set("meta_description_en", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                  </>
                ) : (
                  <>
                    <input type="text" placeholder={t("blogAdmin.titleRu")} required value={form.title_ru} onChange={(e) => set("title_ru", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                    <input type="text" placeholder={t("blogAdmin.excerptRu")} value={form.excerpt_ru} onChange={(e) => set("excerpt_ru", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                    <textarea placeholder={t("blogAdmin.contentRu")} rows={10} value={form.content_ru} onChange={(e) => set("content_ru", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none font-mono" />
                    <input type="text" placeholder={t("blogAdmin.metaRu")} value={form.meta_description_ru} onChange={(e) => set("meta_description_ru", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                  </>
                )}

                <input type="text" placeholder={t("blogAdmin.tagsPlaceholder")} value={form.tags} onChange={(e) => set("tags", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />

                <input type="text" placeholder={t("blogAdmin.slugPlaceholder") || "Slug"} value={form.slug} onChange={(e) => set("slug", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono" />

                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500" />
                  {t("blogAdmin.published")}
                </label>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">{t("blogAdmin.cancel")}</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? t("blogAdmin.saving") : editingId ? t("blogAdmin.update") : t("blogAdmin.create")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
