"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Mail,
  Plus,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createContactAction } from "@/server/actions/crm";
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

type ClientOption = { id: string; name: string };

interface ContactItem {
  id: string;
  firstName: string;
  lastName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  isPrimary?: boolean;
  client?: { name: string } | null;
  assignedUser?: { name: string } | null;
}

export function ContactsView({
  contacts,
  clients,
  canCreate,
}: {
  contacts: ContactItem[];
  clients: ClientOption[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const initialDraft = {
    firstName: "",
    lastName: "",
    clientId: "",
    jobTitle: "",
    email: "",
    phone: "",
    mobile: "",
    notes: "",
    isPrimary: false,
  };
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState(initialDraft);

  const primaryCount = contacts.filter((contact) => contact.isPrimary).length;
  const linkedCount = contacts.filter((contact) => contact.client).length;
  const emailCount = contacts.filter((contact) => contact.email).length;

  async function createContact(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const result = await createContactAction({
      ...draft,
      clientId: draft.clientId || null,
    });
    setBusy(false);
    if (!result.success) {
      setError(
        errorMessage(
          result.error,
          text("Unable to create the contact.", "تعذر إنشاء جهة الاتصال."),
        ),
      );
      return;
    }
    setOpen(false);
    setDraft(initialDraft);
    setMessage(
      result.pendingApproval
        ? text(
            "The contact was sent for approval.",
            "تم إرسال جهة الاتصال للموافقة.",
          )
        : text("Contact created successfully.", "تم إنشاء جهة الاتصال."),
    );
    router.refresh();
  }

  const inputClass = `${workspaceInput} mt-1.5`;

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <WorkspaceHeader
        icon={Users}
        eyebrow={text("PEOPLE BEHIND EVERY RELATIONSHIP", "الأشخاص خلف كل علاقة")}
        title={text("Contacts", "جهات الاتصال")}
        subtitle={text(
          "Keep the people connected to your customers and opportunities close at hand.",
          "احتفظ ببيانات الأشخاص المرتبطين بعملائك وفرص البيع في مكان واحد.",
        )}
        action={canCreate ? () => setOpen(true) : undefined}
        actionLabel={text("Add contact", "إضافة جهة اتصال")}
      />

      <WorkspaceStats
        items={[
          {
            label: text("All contacts", "إجمالي جهات الاتصال"),
            value: formatNumber(contacts.length, language),
            icon: Users,
          },
          {
            label: text("Primary contacts", "جهات الاتصال الرئيسية"),
            value: formatNumber(primaryCount, language),
            icon: CheckCircle2,
            tone: "green",
          },
          {
            label: text("Linked to customers", "مرتبطون بعملاء"),
            value: formatNumber(linkedCount, language),
            icon: Building2,
            tone: "purple",
          },
          {
            label: text("With email", "لديهم بريد إلكتروني"),
            value: formatNumber(emailCount, language),
            icon: Mail,
            tone: "amber",
          },
        ]}
      />

      <WorkspaceNotice
        message={error || message}
        error={Boolean(error)}
      />

      {contacts.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <WorkspaceEmpty
            icon={Users}
            title={text("No contacts yet", "لا توجد جهات اتصال بعد")}
            description={text(
              "Add your first contact and connect them to the right customer.",
              "أضف أول جهة اتصال واربطها بالعميل المناسب.",
            )}
            action={
              canCreate ? (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className={workspaceButton}
                >
                  <Plus className="h-4 w-4" />
                  {text("Add contact", "إضافة جهة اتصال")}
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
                {text("Contact list", "قائمة جهات الاتصال")}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {text(
                  "People connected to your customers and opportunities.",
                  "الأشخاص المرتبطون بعملائك وفرص البيع.",
                )}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
              <Users className="h-3.5 w-3.5" />
              {formatNumber(contacts.length, language)} {text("records", "سجل")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-start text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <th className="px-5 py-3.5">{text("Name", "الاسم")}</th>
                  <th className="px-5 py-3.5">{text("Customer", "العميل")}</th>
                  <th className="px-5 py-3.5">{text("Job title", "المسمى الوظيفي")}</th>
                  <th className="px-5 py-3.5">{text("Email", "البريد الإلكتروني")}</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-4">
                      <Link
                        className="font-bold text-slate-900 transition hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                        href={`/contacts/${contact.id}`}
                      >
                        {contact.firstName} {contact.lastName || ""}
                      </Link>
                      {contact.isPrimary && (
                        <span className="mt-1 block text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                          {text("Primary contact", "جهة اتصال رئيسية")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {contact.client?.name || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {contact.jobTitle || "—"}
                    </td>
                    <td className="px-5 py-4">
                      {contact.email ? (
                        <span dir="ltr" className="text-sm text-slate-700 dark:text-slate-200">
                          {contact.email}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
        title={text("Add contact", "إضافة جهة اتصال")}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="2xl"
      >
        <form onSubmit={createContact} className="space-y-4">
          <fieldset
            disabled={busy}
            className="grid gap-4 sm:grid-cols-2"
          >
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {text("Last name", "اسم العائلة")}
              <input
                value={draft.lastName}
                onChange={(event) =>
                  setDraft({ ...draft, lastName: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {text("Job title", "المسمى الوظيفي")}
              <input
                value={draft.jobTitle}
                onChange={(event) =>
                  setDraft({ ...draft, jobTitle: event.target.value })
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
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
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
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={draft.isPrimary}
                onChange={(event) =>
                  setDraft({ ...draft, isPrimary: event.target.checked })
                }
              />
              {text("Primary contact", "جهة الاتصال الرئيسية")}
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
