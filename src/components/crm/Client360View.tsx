"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Handshake,
  ListTodo,
  Mail,
  Pencil,
  Phone,
  Ticket,
  UsersRound,
} from "lucide-react";
import { ActivityTimeline } from "./ActivityTimeline";
import { CustomFieldDisplay } from "./CustomFieldDisplay";
import { Modal } from "@/components/ui/Modal";
import { deleteClientAction, updateClientAction } from "@/server/actions/crm";
import { useDialog } from "@/lib/dialog/context";
import { useI18n } from "@/lib/i18n/context";
export function Client360View({
  client,
  timeline,
  customFields = [],
  clientTypes = [],
  canUpdate = false,
  canDelete = false,
  canCreateDeal = false,
  canCreateTask = false,
  canCreateTicket = false,
  canCreateCalendar = false,
}: {
  client: any;
  timeline: any[];
  customFields?: any[];
  clientTypes?: string[];
  canUpdate?: boolean;
  canDelete?: boolean;
  canCreateDeal?: boolean;
  canCreateTask?: boolean;
  canCreateTicket?: boolean;
  canCreateCalendar?: boolean;
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const { language, getStatusLabel, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    name: client.name || "",
    type: client.type || clientTypes[0] || "OTHER",
    status: client.status || "ACTIVE",
    email: client.email || "",
    phone: client.phone || "",
    website: client.website || "",
    address: client.address || "",
    description: client.description || "",
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const result = await updateClientAction(client.id, draft);
    setBusy(false);
    if (!result.success) {
      setError(
        errorMessage(
          result.error,
          text("Unable to update the customer.", "تعذر تحديث العميل."),
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
        : text("Customer details updated.", "تم تحديث بيانات العميل."),
    );
    router.refresh();
  }

  async function archiveClient() {
    const approved = await confirm({
      title: text("Archive customer", "أرشفة العميل"),
      message: text(
        `Archive ${client.name}? Linked records will be preserved.`,
        `هل تريد أرشفة ${client.name}؟ ستبقى السجلات المرتبطة محفوظة.`,
      ),
      isDestructive: true,
    });
    if (!approved) return;
    setBusy(true);
    setError("");
    setMessage("");
    const result = await deleteClientAction(client.id);
    setBusy(false);
    if (!result.success) {
      setError(
        errorMessage(
          result.error,
          text("Unable to archive the customer.", "تعذر أرشفة العميل."),
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
    router.push("/clients");
    router.refresh();
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border bg-white p-2.5 text-sm dark:bg-slate-950";
  const stats = [
    {
      label: text("Contacts", "جهات الاتصال"),
      value: client.contacts?.length || 0,
      icon: UsersRound,
      tone: "text-brand-600 bg-brand-50 dark:bg-brand-950/40",
    },
    {
      label: text("Deals", "الصفقات"),
      value: client.deals?.length || 0,
      icon: Handshake,
      tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: text("Tasks", "المهام"),
      value: client.crmTasks?.length || 0,
      icon: ListTodo,
      tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: text("Activities", "النشاطات"),
      value: timeline.length,
      icon: Activity,
      tone: "text-violet-600 bg-violet-50 dark:bg-violet-950/30",
    },
  ];

  const cardClass =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none";

  return (
    <main dir={ar ? "rtl" : "ltr"} className="space-y-5 pb-6">
      <header className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 text-white shadow-xl shadow-slate-900/10">
        <div className="pointer-events-none absolute -end-20 -top-28 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -start-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-brand-200 sm:flex">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <span>{client.type || "Company"}</span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium tracking-normal text-emerald-200">
                    {getStatusLabel(client.status)}
                  </span>
                </div>
                <h1 className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  {client.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
                  {client.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-brand-300" />
                      <span dir="ltr">{client.email}</span>
                    </span>
                  )}
                  {client.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-brand-300" />
                      <span dir="ltr">{client.phone}</span>
                    </span>
                  )}
                  {!client.email && !client.phone && (
                    <span>{text("No contact information", "لا توجد بيانات تواصل")}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[45%] lg:justify-end">
            {canUpdate && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3.5 py-2.5 text-sm font-semibold transition hover:bg-white/15"
              >
                <Pencil className="h-4 w-4" />
                {text("Edit", "تعديل")}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={archiveClient}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300/10 bg-rose-500/15 px-3.5 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-50"
              >
                <Archive className="h-4 w-4" />
                {text("Archive", "أرشفة")}
              </button>
            )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-400">
              {text("Quick actions", "إجراءات سريعة")}
            </p>
            <div className="flex flex-wrap gap-2">
              {canCreateDeal && (
                <Link
                  href={`/deals?clientId=${encodeURIComponent(client.id)}&create=1`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/15"
                >
                  <BriefcaseBusiness className="h-3.5 w-3.5 text-brand-200" />
                  {text("Create deal", "إنشاء صفقة")}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                </Link>
              )}
              {canCreateTask && (
                <Link
                  href={`/tasks?clientId=${encodeURIComponent(client.id)}&create=1`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/15"
                >
                  <ListTodo className="h-3.5 w-3.5 text-brand-200" />
                  {text("Create task", "إنشاء مهمة")}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                </Link>
              )}
              {canCreateTicket && (
                <Link
                  href={`/tickets?clientId=${encodeURIComponent(client.id)}&create=1`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/15"
                >
                  <Ticket className="h-3.5 w-3.5 text-brand-200" />
                  {text("Create ticket", "إنشاء تذكرة")}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                </Link>
              )}
              {canCreateCalendar && (
                <Link
                  href={`/calendar?clientId=${encodeURIComponent(client.id)}&create=1`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/15"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-brand-200" />
                  {text("Add appointment", "إضافة موعد")}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      {message && (
        <div
          role="status"
          className="flex items-center rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-700"
        >
          {message}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-end">
                  <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                <UsersRound className="h-4 w-4" />
              </div>
              <h2 className="font-bold text-slate-950 dark:text-white">{text("Contacts", "جهات الاتصال")}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{client.contacts?.length || 0}</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {client.contacts?.length ? (
              client.contacts.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-sm transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-brand-900 dark:hover:bg-brand-950/20"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{c.firstName} {c.lastName || ""}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{c.jobTitle || c.email || text("Contact", "جهة اتصال")}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-brand-600" />
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-800">
                {text("No contacts yet.", "لا توجد جهات اتصال بعد.")}
              </p>
            )}
          </div>
        </section>
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
                <Handshake className="h-4 w-4" />
              </div>
              <h2 className="font-bold text-slate-950 dark:text-white">{text("Deals", "الصفقات")}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{client.deals?.length || 0}</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {client.deals?.length ? (
              client.deals.map((d: any) => (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-sm transition hover:border-amber-200 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-amber-900 dark:hover:bg-amber-950/20"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{d.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{d.stage?.name || d.status}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-amber-600" />
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-800">
                {text("No deals yet.", "لا توجد صفقات بعد.")}
              </p>
            )}
          </div>
        </section>
        <section className={cardClass}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
              <ListTodo className="h-4 w-4" />
            </div>
            <h2 className="font-bold text-slate-950 dark:text-white">{text("Tasks", "المهام")}</h2>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/30">
            <p className="text-2xl font-bold text-slate-950 dark:text-white">{client.crmTasks?.length || 0}</p>
            <p className="mt-1 text-sm text-slate-500">{text("Tasks linked to this customer", "المهام المرتبطة بهذا العميل")}</p>
          </div>
        </section>
        <section className={`${cardClass} lg:col-span-2`}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-300">
              <Activity className="h-4 w-4" />
            </div>
            <h2 className="font-bold text-slate-950 dark:text-white">{text("Activities", "النشاطات")}</h2>
          </div>
          <ActivityTimeline events={timeline} />
        </section>
        <CustomFieldDisplay values={customFields} />
      </div>
      <Modal
        isOpen={editing}
        onClose={() => !busy && setEditing(false)}
        title={text("Edit customer details", "تعديل بيانات العميل")}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="2xl"
      >
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              {text("Customer name", "اسم العميل")}
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
              {text("Customer type", "نوع العميل")}
              <select
                value={draft.type}
                onChange={(event) =>
                  setDraft({ ...draft, type: event.target.value })
                }
                className={inputClass}
              >
                {clientTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
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
                <option value="ACTIVE">{text("Active", "نشط")}</option>
                <option value="INACTIVE">{text("Inactive", "غير نشط")}</option>
                <option value="PROSPECT">{text("Prospect", "محتمل")}</option>
                <option value="ARCHIVED">{text("Archived", "مؤرشف")}</option>
              </select>
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
              {text("Website", "الموقع الإلكتروني")}
              <input
                type="url"
                dir="ltr"
                value={draft.website}
                onChange={(event) =>
                  setDraft({ ...draft, website: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              {text("Address", "العنوان")}
              <input
                value={draft.address}
                onChange={(event) =>
                  setDraft({ ...draft, address: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              {text("Description", "الوصف")}
              <textarea
                rows={4}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
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
