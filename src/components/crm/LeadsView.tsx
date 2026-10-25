"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  CircleDot,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createLeadAction } from "@/server/actions/crm";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/formatters";
import {
  StatusPill,
  WorkspaceEmpty,
  WorkspaceHeader,
  WorkspaceNotice,
  WorkspaceStats,
  workspaceButton,
  workspaceInput,
  workspaceSecondary,
} from "@/components/crm/WorkspaceUI";

interface LeadItem {
  id: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  assignedUser?: { name: string } | null;
}

export function LeadsView({
  leads,
  statuses,
  canCreate,
}: {
  leads: LeadItem[];
  statuses: string[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const { language, getStatusLabel, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const initialDraft = {
    name: "",
    companyName: "",
    email: "",
    phone: "",
    source: "",
    status: statuses[0] || "NEW",
    notes: "",
  };
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState(initialDraft);

  const convertedCount = leads.filter(
    (lead) => lead.status === "CONVERTED",
  ).length;
  const assignedCount = leads.filter((lead) => lead.assignedUser).length;
  const companiesCount = new Set(
    leads
      .map((lead) => lead.companyName?.trim())
      .filter(Boolean),
  ).size;

  function statusTone(status: string) {
    if (status === "CONVERTED" || status === "WON") return "green" as const;
    if (status === "LOST") return "red" as const;
    if (status === "QUALIFIED") return "amber" as const;
    return "purple" as const;
  }

  async function createLead(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const result = await createLeadAction(draft);
    setBusy(false);
    if (!result.success) {
      setError(
        errorMessage(
          result.error,
          text("Unable to create the lead.", "تعذر إنشاء العميل المحتمل."),
        ),
      );
      return;
    }
    setOpen(false);
    setDraft(initialDraft);
    setMessage(
      result.pendingApproval
        ? text(
            "The lead was sent for approval.",
            "تم إرسال العميل المحتمل للموافقة.",
          )
        : text("Lead created successfully.", "تم إنشاء العميل المحتمل."),
    );
    router.refresh();
  }

  const inputClass = `${workspaceInput} mt-1.5`;

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <WorkspaceHeader
        icon={Users}
        eyebrow={text("BEFORE THE CUSTOMER RELATIONSHIP", "قبل بناء العلاقة")}
        title={text("Leads", "العملاء المحتملون")}
        subtitle={text(
          "Track prospects from the first signal until they become customers.",
          "تابع العملاء المحتملين من أول اهتمام حتى تحويلهم إلى عملاء.",
        )}
        action={canCreate ? () => setOpen(true) : undefined}
        actionLabel={text("Add lead", "إضافة عميل محتمل")}
      />

      <WorkspaceStats
        items={[
          {
            label: text("All leads", "إجمالي العملاء المحتملين"),
            value: formatNumber(leads.length, language),
            icon: Users,
          },
          {
            label: text("Converted", "تم تحويلهم"),
            value: formatNumber(convertedCount, language),
            icon: CheckCircle2,
            tone: "green",
          },
          {
            label: text("Assigned", "مسندون لمسؤول"),
            value: formatNumber(assignedCount, language),
            icon: UserPlus,
            tone: "purple",
          },
          {
            label: text("Companies", "الشركات"),
            value: formatNumber(companiesCount, language),
            icon: Building2,
            tone: "amber",
          },
        ]}
      />

      <WorkspaceNotice
        message={error || message}
        error={Boolean(error)}
      />

      {leads.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <WorkspaceEmpty
            icon={Users}
            title={text("No leads yet", "لا يوجد عملاء محتملون بعد")}
            description={text(
              "Add your first prospect to start building a clear follow-up path.",
              "أضف أول عميل محتمل لتبدأ مسار متابعة واضحًا لفريقك.",
            )}
            action={
              canCreate ? (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className={workspaceButton}
                >
                  <Plus className="h-4 w-4" />
                  {text("Add lead", "إضافة عميل محتمل")}
                </button>
              ) : undefined
            }
          />
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {text("Prospect list", "قائمة العملاء المحتملين")}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {text(
                  "Keep every prospect and next step visible to the team.",
                  "احتفظ بكل عميل محتمل وخطوة متابعة ظاهرة للفريق.",
                )}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
              <CircleDot className="h-3.5 w-3.5" />
              {formatNumber(leads.length, language)} {text("records", "سجل")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-start text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <th className="px-5 py-3.5">{text("Name", "الاسم")}</th>
                  <th className="px-5 py-3.5">{text("Company", "الشركة")}</th>
                  <th className="px-5 py-3.5">{text("Status", "الحالة")}</th>
                  <th className="px-5 py-3.5">{text("Owner", "المسؤول")}</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-4">
                      <Link
                        className="font-bold text-slate-900 transition hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                        href={`/leads/${lead.id}`}
                      >
                        {lead.name}
                      </Link>
                      {lead.email && (
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                          {lead.email}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {lead.companyName || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill
                        label={getStatusLabel(lead.status)}
                        tone={statusTone(lead.status)}
                      />
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {lead.assignedUser?.name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        isOpen={open}
        onClose={() => !busy && setOpen(false)}
        title={text("Add lead", "إضافة عميل محتمل")}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="2xl"
      >
        <form onSubmit={createLead} className="space-y-4">
          <fieldset
            disabled={busy}
            className="grid gap-4 sm:grid-cols-2"
          >
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {text("Name", "الاسم")}
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {text("Company", "الشركة")}
              <input
                value={draft.companyName}
                onChange={(event) =>
                  setDraft({ ...draft, companyName: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {text("Email", "البريد الإلكتروني")}
              <input
                type="email"
                dir="ltr"
                value={draft.email}
                onChange={(event) =>
                  setDraft({ ...draft, email: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {text("International phone number", "رقم الهاتف الدولي")}
              <input
                type="tel"
                dir="ltr"
                placeholder="+962790000000"
                value={draft.phone}
                onChange={(event) =>
                  setDraft({ ...draft, phone: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {text("Source", "المصدر")}
              <input
                value={draft.source}
                onChange={(event) =>
                  setDraft({ ...draft, source: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {text("Status", "الحالة")}
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value })
                }
                className={inputClass}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
              {text("Notes", "ملاحظات")}
              <textarea
                rows={4}
                value={draft.notes}
                onChange={(event) =>
                  setDraft({ ...draft, notes: event.target.value })
                }
                className={inputClass}
              />
            </label>
          </fieldset>
          {error && <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={workspaceSecondary}
            >
              {text("Cancel", "إلغاء")}
            </button>
            <button
              disabled={busy}
              className={`${workspaceButton} disabled:opacity-50`}
            >
              {busy
                ? text("Saving...", "جاري الحفظ...")
                : text("Create", "إنشاء")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
