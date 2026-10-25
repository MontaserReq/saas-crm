"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

const labels: Record<string, [string, string]> = {
  activity: ["Activity log", "سجل النشاط"],
  admin: ["Administration", "الإدارة والنظام"],
  analytics: ["Analytics & reports", "التحليلات والتقارير"],
  "approval-requests": ["Approval requests", "طلبات الموافقة"],
  assignments: ["Assignments", "التعيينات"],
  calendar: ["Calendar & appointments", "التقويم والمواعيد"],
  chat: ["Team chat", "محادثة الفريق"],
  clients: ["Clients", "العملاء"],
  contacts: ["Contacts", "جهات الاتصال"],
  deals: ["Deals", "الصفقات"],
  departments: ["Departments", "الأقسام"],
  imports: ["Data imports", "استيراد البيانات"],
  leads: ["Leads", "العملاء المحتملون"],
  messages: ["Messages", "الرسائل"],
  notifications: ["Notifications", "الإشعارات"],
  pipelines: ["Sales pipelines", "مسارات المبيعات"],
  proposals: ["Proposals & agreements", "العروض والاتفاقيات"],
  profile: ["My profile", "ملفي الشخصي"],
  roles: ["Roles & permissions", "الأدوار والصلاحيات"],
  settings: ["Settings", "الإعدادات"],
  schools: ["Customers", "العملاء"],
  subscription: ["My plan & upgrades", "خطتي وطلبات الترقية"],
  support: ["Platform support", "دعم المنصة"],
  tasks: ["Tasks", "المهام"],
  tickets: ["Tickets", "التذاكر"],
  todos: ["My notes & tasks", "ملاحظاتي ومهامي الخاصة"],
  users: ["Team & users", "فريق العمل والمستخدمين"],
  workflows: ["Workflow automation", "أتمتة سير العمل"],
  "message-templates": ["Message templates", "قوالب الرسائل"],
  "ticket-priorities": ["Ticket priorities", "تصنيفات أولوية التذاكر"],
  "audit-logs": ["Audit log", "سجل التدقيق والرقابة"],
  "task-types": ["Task types", "أنواع المهام"],
  "ai-school-research": ["Smart research", "البحث الذكي"],
};

function labelFor(segment: string, ar: boolean) {
  const label = labels[segment];
  if (label) return ar ? label[1] : label[0];
  return ar ? "التفاصيل" : "Details";
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const { language } = useI18n();
  const ar = language === "ar";
  if (!pathname || pathname === "/dashboard") return null;

  const segments = pathname.split("/").filter(Boolean);
  const items = segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join("/")}`,
    label: labelFor(segment, ar),
    current: index === segments.length - 1,
  }));
  const Separator = ar ? ChevronLeft : ChevronRight;

  return (
    <nav
      aria-label={ar ? "مسار التنقل" : "Breadcrumb"}
      dir={ar ? "rtl" : "ltr"}
      className="mb-5 flex min-w-0 items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5 text-sm shadow-sm shadow-slate-200/30 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none"
    >
      <Link
        href="/dashboard"
        aria-label={ar ? "العودة إلى لوحة التحكم" : "Back to dashboard"}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-slate-500 transition hover:bg-brand-50 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">{ar ? "الرئيسية" : "Dashboard"}</span>
      </Link>
      {items.map((item) => (
        <span key={item.href} className="flex min-w-0 shrink-0 items-center gap-1.5">
          <Separator className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          {item.current ? (
            <span aria-current="page" className="max-w-[220px] truncate rounded-lg bg-brand-50 px-2.5 py-1.5 font-bold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
              {item.label}
            </span>
          ) : (
            <Link
              href={item.href}
              className="max-w-[220px] truncate rounded-lg px-2.5 py-1.5 font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
