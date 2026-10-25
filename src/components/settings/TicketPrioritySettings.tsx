"use client";

import { useState } from "react";
import { Flag, Save } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { updateOrganizationListsAction } from "@/server/actions/configuration";

type Priority = {
  key: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  label: string;
  labelAr: string;
  active?: boolean;
};

export function TicketPrioritySettings({
  initialPriorities,
}: {
  initialPriorities: Priority[];
}) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const [items, setItems] = useState<Priority[]>(initialPriorities);
  const [message, setMessage] = useState("");
  const update = (
    index: number,
    field: keyof Priority,
    value: string | boolean,
  ) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  const save = async () => {
    const result = await updateOrganizationListsAction({
      ticketPriorities: items,
    });
    setMessage(
      result.success
        ? ar
          ? "تم حفظ تصنيفات الأولوية"
          : "Priority categories saved"
        : errorMessage(result.error, ar ? "تعذر الحفظ" : "Unable to save"),
    );
  };
  return (
    <main className="mx-auto max-w-4xl space-y-6" dir={ar ? "rtl" : "ltr"}>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Flag className="h-6 w-6 text-brand-600" />
          {ar ? "تصنيفات أولوية التذاكر" : "Ticket priority categories"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {ar
            ? "عدّل أسماء التصنيفات التي تظهر عند إنشاء التذاكر وفي الفلاتر."
            : "Customize the labels shown when creating tickets and filtering the ticket list."}
        </p>
      </div>
      {message && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      <div className="space-y-3 rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900">
        {items.map((item, index) => (
          <div
            key={item.key}
            className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[110px_1fr_1fr_auto] md:items-center"
          >
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-black dark:bg-white/10">
              {item.key}
            </span>
            <input
              value={item.label}
              onChange={(event) => update(index, "label", event.target.value)}
              placeholder={ar ? "التسمية باللغة الإنجليزية" : "English label"}
              className="rounded-xl border p-2.5 text-sm"
            />
            <input
              value={item.labelAr}
              onChange={(event) => update(index, "labelAr", event.target.value)}
              placeholder={ar ? "التسمية باللغة العربية" : "Arabic label"}
              className="rounded-xl border p-2.5 text-sm"
            />
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={item.active !== false}
                onChange={(event) =>
                  update(index, "active", event.target.checked)
                }
                className="rounded text-brand-600"
              />
              {ar ? "نشط" : "Active"}
            </label>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white"
      >
        <Save className="h-4 w-4" />
        {ar ? "حفظ التصنيفات" : "Save categories"}
      </button>
    </main>
  );
}
