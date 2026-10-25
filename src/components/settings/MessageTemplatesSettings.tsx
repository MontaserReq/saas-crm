"use client";

import { useState } from "react";
import { BookOpen, Plus, Save, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  createOrganizationMessageTemplateAction,
  updateOrganizationMessageTemplateAction,
} from "@/server/actions/configuration";

type Template = {
  id: string;
  code: string;
  title: string;
  titleAr: string;
  subject: string;
  subjectAr: string;
  content: string;
  contentAr: string;
  category: string;
  isActive: boolean;
};

export function MessageTemplatesSettings({
  initialTemplates,
}: {
  initialTemplates: Template[];
}) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const [items, setItems] = useState(initialTemplates);
  const [draft, setDraft] = useState<Partial<Template>>({
    category: "GENERAL",
    isActive: true,
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key: keyof Template, value: string | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    setMessage("");
    const result = draft.id
      ? await updateOrganizationMessageTemplateAction(draft.id, draft)
      : await createOrganizationMessageTemplateAction({
          code: String(draft.code || ""),
          title: String(draft.title || ""),
          titleAr: String(draft.titleAr || ""),
          subject: String(draft.subject || ""),
          subjectAr: String(draft.subjectAr || ""),
          content: String(draft.content || ""),
          contentAr: String(draft.contentAr || ""),
          category: String(draft.category || "GENERAL"),
        });
    setSaving(false);
    if (!result.success) {
      setMessage(
        errorMessage(
          result.error,
          ar ? "تعذر حفظ القالب" : "Unable to save template",
        ),
      );
      return;
    }
    setMessage(ar ? "تم حفظ القالب" : "Template saved");
    window.location.reload();
  };
  const edit = (template: Template) => setDraft(template);
  const archive = async (template: Template) => {
    const result = await updateOrganizationMessageTemplateAction(template.id, {
      isActive: false,
    });
    if (result.success)
      setItems(items.filter((item) => item.id !== template.id));
  };
  return (
    <section
      className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-5"
      dir={ar ? "rtl" : "ltr"}
    >
      <div>
        <h3 className="font-bold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-600" />
          {ar ? "قوالب رسائل الفريق" : "Team message templates"}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {ar
            ? "أنشئ قوالب عربية وإنجليزية تظهر للفريق عند كتابة الرسائل."
            : "Create Arabic and English templates that appear when the team composes messages."}
        </p>
      </div>
      {message && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={draft.code || ""}
          onChange={(e) => set("code", e.target.value)}
          placeholder={ar ? "رمز القالب" : "Template code"}
          className="rounded-xl border p-2.5 text-sm"
        />
        <input
          value={draft.category || ""}
          onChange={(e) => set("category", e.target.value)}
          placeholder={ar ? "التصنيف" : "Category"}
          className="rounded-xl border p-2.5 text-sm"
        />
        <input
          value={draft.title || ""}
          onChange={(e) => set("title", e.target.value)}
          placeholder={ar ? "العنوان باللغة الإنجليزية" : "English title"}
          className="rounded-xl border p-2.5 text-sm"
        />
        <input
          value={draft.titleAr || ""}
          onChange={(e) => set("titleAr", e.target.value)}
          placeholder={ar ? "العنوان باللغة العربية" : "Arabic title"}
          className="rounded-xl border p-2.5 text-sm"
        />
        <input
          value={draft.subject || ""}
          onChange={(e) => set("subject", e.target.value)}
          placeholder={ar ? "الموضوع باللغة الإنجليزية" : "English subject"}
          className="rounded-xl border p-2.5 text-sm"
        />
        <input
          value={draft.subjectAr || ""}
          onChange={(e) => set("subjectAr", e.target.value)}
          placeholder={ar ? "الموضوع باللغة العربية" : "Arabic subject"}
          className="rounded-xl border p-2.5 text-sm"
        />
        <textarea
          value={draft.content || ""}
          onChange={(e) => set("content", e.target.value)}
          placeholder={
            ar ? "نص الرسالة باللغة الإنجليزية" : "English message body"
          }
          rows={4}
          className="rounded-xl border p-2.5 text-sm"
        />
        <textarea
          value={draft.contentAr || ""}
          onChange={(e) => set("contentAr", e.target.value)}
          placeholder={ar ? "نص الرسالة باللغة العربية" : "Arabic message body"}
          rows={4}
          className="rounded-xl border p-2.5 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white"
        >
          <Save className="h-4 w-4" />
          {saving
            ? ar
              ? "جاري الحفظ..."
              : "Saving..."
            : draft.id
              ? ar
                ? "تحديث القالب"
                : "Update template"
              : ar
                ? "إضافة القالب"
                : "Add template"}
        </button>
        <button
          type="button"
          onClick={() => setDraft({ category: "GENERAL", isActive: true })}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"
        >
          <Plus className="h-4 w-4" />
          {ar ? "قالب جديد" : "New template"}
        </button>
      </div>
      <div className="space-y-2">
        {items
          .filter((item) => item.isActive)
          .map((template) => (
            <div
              key={template.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <p className="font-bold text-sm">
                  {ar ? template.titleAr : template.title}
                </p>
                <p className="text-xs text-slate-500">
                  {template.code} · {template.category}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => edit(template)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  {ar ? "تعديل" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => archive(template)}
                  className="rounded-lg border px-3 py-1.5 text-xs text-rose-600"
                >
                  <Trash2 className="inline h-3.5 w-3.5" />{" "}
                  {ar ? "تعطيل" : "Disable"}
                </button>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
