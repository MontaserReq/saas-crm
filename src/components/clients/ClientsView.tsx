"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  UserCheck,
  Ticket,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Plus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/formatters";
import { createClientAction } from "@/server/actions/crm";
import type { ClientType } from "@/server/services/ClientService";
import { Modal } from "@/components/ui/Modal";
import {
  WorkspaceHeader,
  WorkspaceStats,
  WorkspaceSearch,
  WorkspaceTabs,
  WorkspaceEmpty,
  WorkspaceNotice,
  StatusPill,
  SubmitWorkspaceButton,
  WorkspaceArrow,
  workspaceInput,
  workspaceButton,
  workspaceSecondary,
} from "@/components/crm/WorkspaceUI";

type Client = {
  id: string;
  name: string;
  type: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  _count?: { contacts: number; tickets: number };
};
export function ClientsView({
  clients,
  clientTypes,
  initialSearch,
  canCreate = false,
}: {
  clients: Client[];
  clientTypes: string[];
  initialSearch: string;
  canCreate?: boolean;
}) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const router = useRouter();
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("table");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ message: "", error: false });
  const initialType = clientTypes[0] || "OTHER";
  const [draft, setDraft] = useState({
    name: "",
    type: initialType as ClientType,
    email: "",
    phone: "",
  });
  const typeLabels: Record<string, string> = {
    SCHOOL: text("Customer", "عميل"),
    COMPANY: text("Company", "شركة"),
    NGO: text("Nonprofit", "مؤسسة غير ربحية"),
    UNIVERSITY: text("University", "جامعة"),
    GOVERNMENT: text("Government", "جهة حكومية"),
    INDIVIDUAL: text("Individual", "فرد"),
    OTHER: text("Other", "أخرى"),
  };
  const typeLabel = (value: string) =>
    typeLabels[value] || value.replaceAll("_", " ");
  const statusLabels: Record<string, string> = {
    ACTIVE: text("Active", "نشط"),
    INACTIVE: text("Inactive", "غير نشط"),
    PROSPECT: text("Prospect", "عميل محتمل"),
    ARCHIVED: text("Archived", "مؤرشف"),
  };
  const active = clients.filter((client) => client.status === "ACTIVE").length;
  const shown = clients.filter(
    (client) => filter === "all" || client.status === filter,
  );
  const hasFilters = !!initialSearch || filter !== "all";
  function status(client: Client) {
    return (
      <StatusPill
        label={statusLabels[client.status] || client.status}
        tone={
          client.status === "ACTIVE"
            ? "green"
            : client.status === "PROSPECT"
              ? "amber"
              : "neutral"
        }
      />
    );
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice({ message: "", error: false });
    try {
      const result = await createClientAction({
        ...draft,
        name: draft.name.trim(),
      });
      if (!result.success) {
        setNotice({
          message: errorMessage(
            result.error,
            text(
              "Could not add the customer. Check the details and try again.",
              "تعذرت إضافة العميل. تحقق من البيانات وحاول مجدداً.",
            ),
          ),
          error: true,
        });
        return;
      }
      if (result.pendingApproval) {
        setOpen(false);
        setNotice({
          message: text(
            "Customer request sent for approval.",
            "تم إرسال طلب إنشاء العميل للموافقة.",
          ),
          error: false,
        });
        return;
      }
      setDraft({ name: "", type: initialType, email: "", phone: "" });
      setOpen(false);
      setNotice({
        message: text(
          "Customer added successfully.",
          "تمت إضافة العميل بنجاح.",
        ),
        error: false,
      });
      router.refresh();
    } catch {
      setNotice({
        message: text(
          "Connection interrupted. Check your customers before retrying.",
          "انقطع الاتصال. تحقق من قائمة العملاء قبل إعادة المحاولة.",
        ),
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  const add = () => {
    setNotice({ message: "", error: false });
    setOpen(true);
  };
  const customerCard = (client: Client) => (
    <article
      key={client.id}
      className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-md hover:shadow-brand-950/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
          {client.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("")}
        </span>
        {status(client)}
      </div>
      <Link
        href={`/clients/${client.id}`}
        className="mt-4 flex items-center justify-between gap-2 font-bold text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
      >
        <span className="min-w-0 break-words">{client.name}</span>
        <WorkspaceArrow />
      </Link>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {typeLabel(client.type)}
      </p>
      <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
        {client.email && (
          <p className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span dir="ltr" className="truncate">
              {client.email}
            </span>
          </p>
        )}
        {client.phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span dir="ltr">{client.phone}</span>
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:text-slate-400 dark:border-slate-800">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {formatNumber(client._count?.contacts ?? 0, language)}{" "}
          {text("contacts", "جهات اتصال")}
        </span>
        <span className="flex items-center gap-1.5">
          <Ticket className="h-3.5 w-3.5" />
          {formatNumber(client._count?.tickets ?? 0, language)}{" "}
          {text("requests", "طلبات")}
        </span>
      </div>
    </article>
  );
  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <WorkspaceHeader
        icon={Building2}
        eyebrow={text("CUSTOMER RELATIONSHIPS", "علاقات العملاء")}
        title={text("Customers", "العملاء")}
        subtitle={text(
          "Know your customers. Keep every relationship close.",
          "كل معلومات عملائك في مكان واحد، وعلاقات تستحق المتابعة.",
        )}
        action={canCreate ? add : undefined}
        actionLabel={text("Add customer", "إضافة عميل")}
      />
      <WorkspaceStats
        items={[
          {
            label: text(
              initialSearch ? "Customers in search" : "All customers",
              initialSearch ? "العملاء في نتائج البحث" : "إجمالي العملاء",
            ),
            value: formatNumber(clients.length, language),
            icon: Building2,
          },
          {
            label: text("Active customers", "العملاء النشطون"),
            value: formatNumber(active, language),
            icon: UserCheck,
            tone: "green",
          },
          {
            label: text("Contacts", "جهات الاتصال"),
            value: formatNumber(
              clients.reduce(
                (sum, client) => sum + (client._count?.contacts ?? 0),
                0,
              ),
              language,
            ),
            icon: Users,
            tone: "burgundy",
          },
          {
            label: text("Customer requests", "طلبات العملاء"),
            value: formatNumber(
              clients.reduce(
                (sum, client) => sum + (client._count?.tickets ?? 0),
                0,
              ),
              language,
            ),
            icon: Ticket,
            tone: "amber",
          },
        ]}
      />
      {!open && <WorkspaceNotice {...notice} />}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WorkspaceTabs
              label={text("Customer status", "حالة العملاء")}
              value={filter}
              onChange={setFilter}
              items={[
                {
                  value: "all",
                  label: text("All customers", "جميع العملاء"),
                  count: clients.length,
                },
                {
                  value: "ACTIVE",
                  label: text("Active", "النشطون"),
                  count: active,
                },
                {
                  value: "PROSPECT",
                  label: text("Prospects", "المحتملون"),
                  count: clients.filter(
                    (client) => client.status === "PROSPECT",
                  ).length,
                },
              ]}
            />
            <div
              role="group"
              aria-label={text("Display style", "طريقة العرض")}
              className="hidden gap-1 rounded-xl border border-slate-200 p-1 dark:border-slate-700 md:flex"
            >
              {[
                {
                  id: "table",
                  Icon: List,
                  label: text("Table view", "عرض الجدول"),
                },
                {
                  id: "cards",
                  Icon: LayoutGrid,
                  label: text("Card view", "عرض البطاقات"),
                },
              ].map(({ id, Icon, label }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setView(id)}
                  aria-label={label}
                  aria-pressed={view === id}
                  className={`rounded-lg p-2 ${view === id ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <form action="/clients" className="flex flex-col gap-2 sm:flex-row">
            <WorkspaceSearch
              name="search"
              label={text("Search customers", "البحث عن العملاء")}
              value={search}
              onChange={setSearch}
              placeholder={text(
                "Search by name, email, or phone…",
                "ابحث بالاسم أو البريد أو الهاتف…",
              )}
            />
            <button className={workspaceSecondary}>
              {text("Search", "بحث")}
            </button>
            {initialSearch && (
              <Link href="/clients" className={workspaceSecondary}>
                {text("Clear", "مسح")}
              </Link>
            )}
          </form>
        </div>
        {!shown.length ? (
          <WorkspaceEmpty
            icon={Building2}
            title={
              hasFilters
                ? text("No matching customers", "لا يوجد عملاء مطابقون")
                : text(
                    "Your next relationship starts here",
                    "علاقتك القادمة تبدأ من هنا",
                  )
            }
            description={
              hasFilters
                ? text(
                    "Try another search or show all customers.",
                    "جرّب بحثاً آخر أو اعرض جميع العملاء.",
                  )
                : text(
                    "Add your first customer and keep their details and follow-ups together.",
                    "أضف أول عميل واجمع بياناته ومتابعاته في مكان واحد.",
                  )
            }
            action={
              hasFilters ? (
                <Link
                  href="/clients"
                  className={workspaceSecondary}
                  onClick={() => setFilter("all")}
                >
                  {text("Show all customers", "عرض جميع العملاء")}
                </Link>
              ) : canCreate ? (
                <button onClick={add} className={workspaceButton}>
                  <Plus className="h-4 w-4" />
                  {text("Add customer", "إضافة عميل")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div
              className={`${view === "cards" ? "grid" : "grid md:hidden"} grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3`}
            >
              {shown.map(customerCard)}
            </div>
            {view === "table" && (
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-start text-sm">
                  <thead className="bg-slate-50/70 text-xs text-slate-500 dark:text-slate-400 dark:bg-slate-800/40">
                    <tr>
                      {[
                        text("Customer", "العميل"),
                        text("Type", "النوع"),
                        text("Status", "الحالة"),
                        text("Contact details", "بيانات التواصل"),
                        text("Contacts", "جهات الاتصال"),
                        text("Requests", "الطلبات"),
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="px-5 py-3.5 text-start font-semibold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {shown.map((client) => (
                      <tr
                        key={client.id}
                        className="transition hover:bg-brand-50/30 dark:hover:bg-brand-950/20"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/clients/${client.id}`}
                            className="flex items-center gap-3 font-semibold text-slate-900 hover:text-brand-700 dark:text-white"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                              {client.name[0]}
                            </span>
                            <span className="max-w-xs truncate">
                              {client.name}
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {typeLabel(client.type)}
                        </td>
                        <td className="px-5 py-4">{status(client)}</td>
                        <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                          <p dir="ltr" className="w-fit">
                            {client.email || "—"}
                          </p>
                          {client.phone && (
                            <p
                              dir="ltr"
                              className="mt-1 w-fit text-slate-500 dark:text-slate-400"
                            >
                              {client.phone}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 tabular-nums text-slate-600 dark:text-slate-300">
                          {formatNumber(client._count?.contacts ?? 0, language)}
                        </td>
                        <td className="px-5 py-4 tabular-nums text-slate-600 dark:text-slate-300">
                          {formatNumber(client._count?.tickets ?? 0, language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:text-slate-400 dark:border-slate-800">
          {formatNumber(shown.length, language)}{" "}
          {text("customers shown", "عميل معروض")}
        </p>
      </section>
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={text("Add a new customer", "إضافة عميل جديد")}
        description={text(
          "Start with a name. You can add more information anytime.",
          "ابدأ بالاسم، ويمكنك استكمال المعلومات في أي وقت.",
        )}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="lg"
      >
        <form onSubmit={create} className="space-y-5">
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm font-semibold">
              {text("Customer name", "اسم العميل")}
              <input
                autoComplete="organization"
                required
                maxLength={120}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                className={`${workspaceInput} mt-2`}
                placeholder={text(
                  "Company or customer name",
                  "اسم الشركة أو العميل",
                )}
              />
            </label>
            <label className="block text-sm font-semibold">
              {text("Customer type", "نوع العميل")}
              <select
                value={draft.type}
                onChange={(event) =>
                  setDraft({ ...draft, type: event.target.value as ClientType })
                }
                className={`${workspaceInput} mt-2`}
              >
                {clientTypes.map((value) => (
                  <option key={value} value={value}>
                    {typeLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                {text("Email (optional)", "البريد الإلكتروني (اختياري)")}
                <input
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                  className={`${workspaceInput} mt-2`}
                />
              </label>
              <label className="block text-sm font-semibold">
                {text("Phone (optional)", "الهاتف (اختياري)")}
                <input
                  type="tel"
                  dir="ltr"
                  autoComplete="tel"
                  value={draft.phone}
                  onChange={(event) =>
                    setDraft({ ...draft, phone: event.target.value })
                  }
                  className={`${workspaceInput} mt-2`}
                />
              </label>
            </div>
          </fieldset>
          <WorkspaceNotice {...notice} />
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className={workspaceSecondary}
            >
              {text("Cancel", "إلغاء")}
            </button>
            <SubmitWorkspaceButton
              busy={busy}
              label={text("Save customer", "حفظ العميل")}
              saving={text("Saving…", "جارٍ الحفظ…")}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
