"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil } from "lucide-react";
import { ActivityTimeline } from "./ActivityTimeline";
import { Modal } from "@/components/ui/Modal";
import { deleteContactAction, updateContactAction } from "@/server/actions/crm";
import { useDialog } from "@/lib/dialog/context";
import { useI18n } from "@/lib/i18n/context";
import { CustomerEmailComposer } from "./CustomerEmailComposer";

type ClientOption = { id: string; name: string };

export function Contact360View({
  contact,
  timeline,
  clients,
  canUpdate,
  canDelete,
  canSendCustomerEmail = false,
}: {
  contact: any;
  timeline: any[];
  clients: ClientOption[];
  canUpdate: boolean;
  canDelete: boolean;
  canSendCustomerEmail?: boolean;
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    firstName: contact.firstName || "",
    lastName: contact.lastName || "",
    clientId: contact.clientId || "",
    jobTitle: contact.jobTitle || "",
    email: contact.email || "",
    phone: contact.phone || "",
    mobile: contact.mobile || "",
    notes: contact.notes || "",
    isPrimary: !!contact.isPrimary,
  });
  const inputClass =
    "mt-1.5 w-full rounded-xl border bg-white p-2.5 text-sm dark:bg-slate-950";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const result = await updateContactAction(contact.id, {
      ...draft,
      clientId: draft.clientId || null,
    });
    setBusy(false);
    if (!result.success) {
      setError(
        errorMessage(
          result.error,
          text("Unable to update the contact.", "تعذر تحديث جهة الاتصال."),
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
        : text("Contact updated successfully.", "تم تحديث جهة الاتصال."),
    );
    router.refresh();
  }

  async function archiveContact() {
    if (
      !(await confirm({
        title: text("Archive contact", "أرشفة جهة الاتصال"),
        message: text(
          `Archive ${contact.firstName}?`,
          `هل تريد أرشفة ${contact.firstName}؟`,
        ),
        isDestructive: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    const result = await deleteContactAction(contact.id);
    setBusy(false);
    if (!result.success) {
      setError(
        errorMessage(
          result.error,
          text("Unable to archive the contact.", "تعذر أرشفة جهة الاتصال."),
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
    router.push("/contacts");
    router.refresh();
  }

  return (
    <main dir={ar ? "rtl" : "ltr"} className="space-y-6">
      <header className="rounded-2xl bg-slate-900 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-300">
              Contact
            </p>
            <h1 className="text-3xl font-bold">
              {contact.firstName} {contact.lastName || ""}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {contact.jobTitle || text("Contact", "جهة اتصال")} ·{" "}
              {contact.email ||
                contact.phone ||
                text("No contact information", "لا توجد بيانات تواصل")}
            </p>
            {contact.client && (
              <p className="mt-3 text-sm">
                {text("Customer", "العميل")}:{" "}
                <Link
                  className="underline"
                  href={`/clients/${contact.client.id}`}
                >
                  {contact.client.name}
                </Link>
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
                onClick={archiveContact}
                className="inline-flex items-center gap-1.5 rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-100"
              >
                <Archive className="h-4 w-4" />
                {text("Archive", "أرشفة")}
              </button>
            )}
            <CustomerEmailComposer recordType="CONTACT" recordId={contact.id} recipientEmail={contact.email} canSend={canSendCustomerEmail} />
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
            {text("Contact information", "بيانات جهة الاتصال")}
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">
                {text("Email", "البريد الإلكتروني")}
              </dt>
              <dd>{contact.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{text("Phone", "الهاتف")}</dt>
              <dd>{contact.phone || contact.mobile || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{text("Owner", "المسؤول")}</dt>
              <dd>{contact.assignedUser?.name || "—"}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded border p-4">
          <h2 className="font-semibold">
            {text("Relationships", "العلاقات المرتبطة")}
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            {contact.deals?.length || 0} {text("deals", "صفقات")} ·{" "}
            {contact.crmTasks?.length || 0} {text("tasks", "مهام")}
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
        title={text("Edit contact", "تعديل جهة الاتصال")}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="2xl"
      >
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              {text("First name", "الاسم الأول")}
              <input
                required
                maxLength={100}
                value={draft.firstName}
                onChange={(event) =>
                  setDraft({ ...draft, firstName: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              {text("Last name", "اسم العائلة")}
              <input
                value={draft.lastName}
                onChange={(event) =>
                  setDraft({ ...draft, lastName: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              {text("Linked customer", "العميل المرتبط")}
              <select
                value={draft.clientId}
                onChange={(event) =>
                  setDraft({ ...draft, clientId: event.target.value })
                }
                className={inputClass}
              >
                <option value="">{text("No customer", "بدون عميل")}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              {text("Job title", "المسمى الوظيفي")}
              <input
                value={draft.jobTitle}
                onChange={(event) =>
                  setDraft({ ...draft, jobTitle: event.target.value })
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
              {text("International phone", "الهاتف الدولي")}
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
              {text("International mobile", "الموبايل الدولي")}
              <input
                type="tel"
                dir="ltr"
                placeholder="+962790000000"
                value={draft.mobile}
                onChange={(event) =>
                  setDraft({ ...draft, mobile: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.isPrimary}
                onChange={(event) =>
                  setDraft({ ...draft, isPrimary: event.target.checked })
                }
              />
              {text("Primary contact", "جهة الاتصال الرئيسية")}
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
