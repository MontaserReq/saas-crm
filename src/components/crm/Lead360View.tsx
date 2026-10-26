"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil } from "lucide-react";
import { ActivityTimeline } from "./ActivityTimeline";
import { Modal } from "@/components/ui/Modal";
import { deleteLeadAction, updateLeadAction } from "@/server/actions/crm";
import { useDialog } from "@/lib/dialog/context";
import { useI18n } from "@/lib/i18n/context";
import { CustomerEmailComposer } from "./CustomerEmailComposer";

export function Lead360View({
  lead,
  timeline,
  statuses,
  canUpdate,
  canDelete,
  canSendCustomerEmail = false,
}: {
  lead: any;
  timeline: any[];
  statuses: string[];
  canUpdate: boolean;
  canDelete: boolean;
  canSendCustomerEmail?: boolean;
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const { language, getStatusLabel, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    name: lead.name || "",
    companyName: lead.companyName || "",
    email: lead.email || "",
    phone: lead.phone || "",
    source: lead.source || "",
    status: lead.status || statuses[0] || "NEW",
    notes: lead.notes || "",
  });
  const inputClass =
    "mt-1.5 w-full rounded-xl border bg-white p-2.5 text-sm dark:bg-slate-950";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const result = await updateLeadAction(lead.id, draft);
    setBusy(false);
    if (!result.success) {
      setError(
        errorMessage(
          result.error,
          text("Unable to update the lead.", "تعذر تحديث العميل المحتمل."),
        ),
      );
      return;
    }
    setEditing(false);
    setMessage(
      result.pendingApproval
        ? text(
            "The update was sent for approval.",
            "تم إرسال التعديل للموافقة.",
          )
        : text("Lead updated successfully.", "تم تحديث العميل المحتمل."),
    );
    router.refresh();
  }

  async function archiveLead() {
    if (
      !(await confirm({
        title: text("Archive lead", "أرشفة العميل المحتمل"),
        message: text(`Archive ${lead.name}?`, `هل تريد أرشفة ${lead.name}؟`),
        isDestructive: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    const result = await deleteLeadAction(lead.id);
    setBusy(false);
    if (!result.success) {
      setError(
        errorMessage(
          result.error,
          text("Unable to archive the lead.", "تعذر أرشفة العميل المحتمل."),
        ),
      );
      return;
    }
    if (result.pendingApproval) {
      setMessage(
        text(
          "The archive request was sent for approval.",
          "تم إرسال طلب الأرشفة للموافقة.",
        ),
      );
      return;
    }
    router.push("/leads");
    router.refresh();
  }

  return (
    <main dir={ar ? "rtl" : "ltr"} className="space-y-6">
      <header className="rounded-2xl bg-slate-900 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-300">
              Lead
            </p>
            <h1 className="text-3xl font-bold">{lead.name}</h1>
            <p className="mt-2 text-sm text-slate-300">
              {getStatusLabel(lead.status)} ·{" "}
              {lead.email ||
                lead.phone ||
                text("No contact information", "لا توجد بيانات تواصل")}
            </p>
            {lead.convertedClient && (
              <p className="mt-3 text-sm">
                {text("Converted to", "تم تحويله إلى")}{" "}
                <Link
                  className="underline"
                  href={`/clients/${lead.convertedClient.id}`}
                >
                  {lead.convertedClient.name}
                </Link>
                {lead.convertedContact && (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      className="underline"
                      href={`/contacts/${lead.convertedContact.id}`}
                    >
                      {text("Contact", "جهة الاتصال")}
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {canUpdate && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded bg-white/10 px-3 py-2 text-sm"
              >
                <Pencil className="h-4 w-4" />
                {text("Edit", "تعديل")}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={archiveLead}
                className="inline-flex items-center gap-1.5 rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-100"
              >
                <Archive className="h-4 w-4" />
                {text("Archive", "أرشفة")}
              </button>
            )}
            <CustomerEmailComposer recordType="LEAD" recordId={lead.id} recipientEmail={lead.email} canSend={canSendCustomerEmail} />
          </div>
        </div>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded border p-4">
          <h2 className="font-semibold">
            {text("Lead information", "بيانات العميل المحتمل")}
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">{text("Source", "المصدر")}</dt>
              <dd>{lead.source || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{text("Owner", "المسؤول")}</dt>
              <dd>{lead.assignedUser?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{text("Company", "الشركة")}</dt>
              <dd>{lead.companyName || "—"}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded border p-4">
          <h2 className="font-semibold">
            {text("Deals and tasks", "الصفقات والمهام")}
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            {lead.deals?.length || 0} {text("deals", "صفقات")} ·{" "}
            {lead.crmTasks?.length || 0} {text("tasks", "مهام")}
          </p>
        </section>
        <section className="rounded border p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">
            {text("Activities", "النشاطات")}
          </h2>
          <ActivityTimeline events={timeline} />
        </section>
      </div>
      <Modal
        isOpen={editing}
        onClose={() => !busy && setEditing(false)}
        title={text("Edit lead", "تعديل العميل المحتمل")}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="2xl"
      >
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold">
              {text("Company", "الشركة")}
              <input
                value={draft.companyName}
                onChange={(event) =>
                  setDraft({ ...draft, companyName: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold">
              {text("Source", "المصدر")}
              <input
                value={draft.source}
                onChange={(event) =>
                  setDraft({ ...draft, source: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold sm:col-span-2">
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
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border px-4 py-2 text-sm"
            >
              {text("Cancel", "إلغاء")}
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? text("Saving...", "جاري الحفظ...") : text("Save", "حفظ")}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
