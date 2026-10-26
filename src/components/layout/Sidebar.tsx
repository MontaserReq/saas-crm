"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  GraduationCap,
  Sparkles,
  Share2,
  Mail,
  MessageCircle,
  StickyNote,
  Activity,
  Users,
  ShieldCheck,
  Building2,
  ListTodo,
  BarChart3,
  FileSpreadsheet,
  CalendarDays,
  FileText,
  Plus,
  Settings,
  KeyRound,
  ScrollText,
  BellRing,
  SlidersHorizontal,
  LifeBuoy,
  LockKeyhole,
} from "lucide-react";
import { UserSession } from "@/types";
import { useI18n } from "@/lib/i18n/context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isPlatformSuperAdmin } from "@/lib/security/platform";
import { useState } from "react";
import { TicketFormModal } from "@/components/tickets/TicketFormModal";
import { useMobileLayout } from "@/components/layout/MobileLayout";
import { visibleSetupNavigation } from '@/lib/onboarding/templates';
import { hasPlanFeature, isRouteIncluded } from '@/lib/platform/entitlements';
import { BrandLogo } from '@/components/brand/BrandLogo';

interface SidebarProps {
  enabledModules?: string[];
  organizationBrand?: { name: string; logoUrl: string | null };
  user: UserSession;
  schools?: Array<{ id: string; name: string }>;
  taskTypes?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string; email: string; reportsToUserId?: string | null; department?: { name: string } | null }>;
  directManager?: { id: string; name: string; isActive: boolean } | null;
  onNavigate?: () => void;
}

export function Sidebar({ user, schools = [], taskTypes = [], users = [], directManager, onNavigate, enabledModules, organizationBrand }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, language } = useI18n();
  const labels = language === 'ar'
    ? { clients: 'العملاء', deals: 'الصفقات', tasks: 'المهام', pipelines: 'مسارات المبيعات', leads: 'العملاء المحتملون', contacts: 'جهات الاتصال', imports: 'استيراد البيانات', assignments: 'التعيينات', aiResearch: 'البحث الذكي', assistant: 'المساعد الذكي', approvals: 'طلبات الموافقة', workflows: 'أتمتة سير العمل', messageTemplates: 'قوالب الرسائل', ticketPriorities: 'تصنيفات أولوية التذاكر', superAdmin: 'مدير المنصة', organizations: 'الشركات', signups: 'التسجيلات وبدء الاستخدام', billing: 'الخطط والفوترة', integrations: 'التكاملات', health: 'صحة المنصة', support: 'الدعم والمشاكل', platformAnalytics: 'تحليلات المنصة', globalSettings: 'الإعدادات العامة' }
    : { clients: 'Clients', deals: 'Deals', tasks: 'Tasks', pipelines: 'Sales Pipelines', leads: 'Leads', contacts: 'Contacts', imports: 'Import data', assignments: 'Assignments', aiResearch: 'Smart research', assistant: 'AI Assistant', approvals: 'Approval Requests', workflows: 'Workflow automation', messageTemplates: 'Message Templates', ticketPriorities: 'Ticket Priority Categories', superAdmin: 'Platform Admin', organizations: 'Organizations', signups: 'Signups & Onboarding', billing: 'Plans & Billing', integrations: 'Integrations', health: 'Platform Health', support: 'Support & Issues', platformAnalytics: 'Platform Analytics', globalSettings: 'Global Settings' };
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);

  const mainNav = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard, exact: true },
    { label: language === 'ar' ? 'خطتي وطلبات الترقية' : 'My plan & upgrades', href: '/settings/subscription', icon: BarChart3, show: user.role === 'SUPER_ADMIN' },
    { label: t("nav.myTickets"), href: "/tickets", icon: Ticket, exact: true, show: hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED) || hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL) },
    {
      label: t("nav.allTickets"),
      href: "/tickets?view=all",
      icon: Ticket,
      show: hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL),
    },
    { label: t("nav.calendar"), href: "/calendar", icon: CalendarDays, show: hasPermission(user, PERMISSIONS.CALENDAR_VIEW) },
    {
      label: t("nav.proposals"),
      href: "/proposals",
      icon: FileText,
      show: hasPermission(user, PERMISSIONS.PROPOSALS_VIEW),
    },
    {
      label: labels.clients,
      href: "/clients",
      icon: Building2,
      show: hasPermission(user, PERMISSIONS.SCHOOLS_VIEW),
    },
    { label: labels.deals, href: "/deals", icon: FileText, show: hasPermission(user, PERMISSIONS.DEALS_VIEW) },
    { label: labels.tasks, href: "/tasks", icon: ListTodo, show: hasPermission(user, PERMISSIONS.TASKS_VIEW) },
    { label: labels.pipelines, href: "/pipelines", icon: BarChart3, show: hasPermission(user, PERMISSIONS.PIPELINES_VIEW) },
    { label: labels.leads, href: "/leads", icon: Users, show: hasPermission(user, PERMISSIONS.SCHOOLS_VIEW) },
    { label: labels.contacts, href: "/contacts", icon: Users, show: hasPermission(user, PERMISSIONS.SCHOOLS_VIEW) },
    { label: labels.imports, href: "/imports", icon: FileSpreadsheet, show: hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT) },
    {
      label: labels.aiResearch,
      href: "/ai-school-research",
      icon: Sparkles,
      show: hasPermission(user, PERMISSIONS.AI_RESEARCH_VIEW) || hasPermission(user, PERMISSIONS.SCHOOLS_VIEW),
      comingSoon: true,
    },
    {
      label: labels.assignments,
      href: "/assignments",
      icon: Share2,
      show: hasPermission(user, PERMISSIONS.SCHOOLS_ASSIGN),
    },
    { label: t("nav.messages"), href: "/messages", icon: Mail, show: hasPermission(user, PERMISSIONS.MESSAGES_VIEW) },
    { label: t("nav.internalMessages"), href: "/chat", icon: MessageCircle, show: hasPermission(user, PERMISSIONS.CHAT_VIEW) },
    { label: language === 'ar' ? 'دعم المنصة' : 'Platform support', href: '/support', icon: LifeBuoy },
    { label: labels.assistant, href: "#assistant", icon: Sparkles, action: "openAssistant", show: hasPlanFeature(user, 'ai_assistant') && hasPermission(user, PERMISSIONS.AI_ASSISTANT_VIEW) },
    { label: t("nav.myTodo"), href: "/todos", icon: StickyNote, show: hasPermission(user, PERMISSIONS.TODO_VIEW) },
    { label: t("nav.activityChanges"), href: "/activity", icon: Activity, show: hasPermission(user, PERMISSIONS.ACTIVITY_VIEW) },
  ];

  const adminNav = [
    {
      label: t("nav.users"),
      href: "/admin/users",
      icon: Users,
      show: hasPermission(user, PERMISSIONS.USERS_VIEW),
    },
    {
      label: t("nav.roles"),
      href: "/admin/roles",
      icon: ShieldCheck,
      show: hasPermission(user, PERMISSIONS.ROLES_VIEW),
    },
    {
      label: t("nav.departments"),
      href: "/admin/departments",
      icon: Building2,
      show: hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE),
    },
    {
      label: t("nav.taskTypes"),
      href: "/admin/task-types",
      icon: ListTodo,
      show: hasPermission(user, PERMISSIONS.TASK_TYPES_MANAGE),
    },
    {
      label: t("nav.analytics"),
      href: "/admin/analytics",
      icon: BarChart3,
      show: hasPermission(user, PERMISSIONS.ANALYTICS_VIEW),
    },
    {
      label: t("nav.auditLogs"),
      href: "/admin/audit-logs",
      icon: FileSpreadsheet,
      show: hasPermission(user, PERMISSIONS.AUDIT_LOGS_VIEW),
    },
    {
      label: labels.approvals,
      href: "/admin/approval-requests",
      icon: ShieldCheck,
      show: hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_VIEW)
        || hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_DECIDE)
        || hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_EDIT)
        || hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_DELETE)
        || hasPermission(user, PERMISSIONS.TICKETS_CORRECTION_APPROVE)
        || hasPermission(user, PERMISSIONS.TICKETS_RESUBMIT_APPROVE),
    },
    {
      label: t("nav.settings"),
      href: "/settings",
      icon: Settings,
      show: isPlatformSuperAdmin(user) || hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_VIEW),
    },
    {
      label: labels.workflows,
      href: "/settings/workflows",
      icon: SlidersHorizontal,
      show: hasPermission(user, PERMISSIONS.WORKFLOWS_VIEW),
    },
    {
      label: labels.messageTemplates,
      href: "/settings/message-templates",
      icon: Mail,
      show: isPlatformSuperAdmin(user) || hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_VIEW),
    },
    {
      label: labels.ticketPriorities,
      href: "/settings/ticket-priorities",
      icon: ShieldCheck,
      show: isPlatformSuperAdmin(user) || hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_VIEW),
    },
  ];

  // Platform Admins need governance and health controls, not day-to-day CRM work.
  // Operational modules remain available to the right roles, but do not
  // compete with the executive control surface in this navigation.
  const superAdminNav = [
    { label: labels.superAdmin, href: "/admin", icon: LayoutDashboard, exact: true },
    { label: labels.organizations, href: "/admin/platform/organizations", icon: Building2 },
    { label: labels.signups, href: "/admin/platform/signups", icon: Users },
    { label: labels.billing, href: "/admin/platform/billing", icon: BarChart3 },
    { label: language === 'ar' ? 'طلبات ترقية الخطط' : 'Plan upgrade requests', href: '/admin/platform/upgrade-requests', icon: BellRing },
    { label: t("nav.users"), href: "/admin/platform/users", icon: Users },
    { label: t("nav.roles"), href: "/admin/roles", icon: KeyRound },
    { label: labels.integrations, href: "/admin/platform/integrations", icon: Share2 },
    { label: t("nav.auditLogs"), href: "/admin/audit-logs", icon: ScrollText },
    { label: labels.health, href: "/admin/platform/health", icon: Activity },
    { label: labels.support, href: "/admin/platform/support", icon: BellRing },
    { label: labels.platformAnalytics, href: "/admin/platform/analytics", icon: BarChart3 },
    { label: labels.globalSettings, href: "/admin/platform/settings", icon: Settings },
  ];

  const isCompanySuperAdmin = user.role === 'SUPER_ADMIN' && !isPlatformSuperAdmin(user);
  const planAllows = (href: string) => isCompanySuperAdmin || isRouteIncluded(href.split('?')[0], user.planFeatures ?? null);
  const filteredMainNav = isPlatformSuperAdmin(user)
    ? superAdminNav
    : mainNav.filter((item) => item.show !== false && planAllows(item.href) && (isCompanySuperAdmin || visibleSetupNavigation(item.href, enabledModules)));
  const filteredAdminNav = isPlatformSuperAdmin(user) ? [] : adminNav.filter((item) => item.show !== false && planAllows(item.href) && (user.planFeatures !== null && user.planFeatures !== undefined ? true : (!enabledModules || ['/admin/users', '/settings'].includes(item.href) || (item.href === '/admin/analytics' && enabledModules.includes('reports')))));

  // Handle link click - close mobile menu if navigating
  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <>
      <aside className="w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full shrink-0 select-none">
        <div>
          {/* Brand Logo */}
          <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
            {organizationBrand?.logoUrl
              ? <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border bg-white"><Image src={organizationBrand.logoUrl} alt={organizationBrand.name} width={40} height={40} unoptimized className="h-full w-full object-contain p-1" /></div>
              : <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center shadow-md shadow-brand-500/20"><BrandLogo variant="symbol" tone="white" className="h-6 w-6" /></div>}
            <div className="min-w-0">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white block truncate">{organizationBrand?.name || 'SatrCRM'}</span>
              <span className="text-[11px] text-brand-600 dark:text-brand-400 font-medium -mt-1 block truncate">
                {t("app.subtitle")}
              </span>
            </div>
          </div>

          {/* Quick New Ticket Button */}
          {!isPlatformSuperAdmin(user) && hasPermission(user, PERMISSIONS.TICKETS_CREATE) && (!enabledModules || enabledModules.includes('tickets')) && <div className="px-4 pt-3 pb-1">
            <button
              onClick={() => setIsNewTicketOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("tickets.createTicket")}</span>
            </button>
          </div>}

          {/* Navigation links */}
          <div className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t("nav.mainMenu")}
              </div>
              <nav className="space-y-1">
                {filteredMainNav.map((item) => {
                  const itemPath = item.href.split('?')[0];
                  const isActive = itemPath === "/tickets"
                    ? (item.href.includes("view=all")
                      ? pathname === "/tickets" && searchParams.get("view") === "all"
                      : pathname === "/tickets" && searchParams.get("view") !== "all")
                    : item.exact ? pathname === itemPath : pathname.startsWith(itemPath);
                  const Icon = item.icon;
                  if ("comingSoon" in item && item.comingSoon) {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        disabled
                        title={language === 'ar' ? 'هذه الميزة ستتوفر قريبًا' : 'This feature will be available soon'}
                        className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm font-medium text-slate-400 opacity-75"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
                          <LockKeyhole className="h-2.5 w-2.5" />
                          {language === 'ar' ? 'قريبًا' : 'Soon'}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(event) => {
                        if ("action" in item && item.action === "openAssistant") {
                          event.preventDefault();
                          window.dispatchEvent(new CustomEvent("satrbot:open"));
                        }
                        handleLinkClick();
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {filteredAdminNav.length > 0 && (
              <div>
                <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t("nav.administration")}
                </div>
                <nav className="space-y-1">
                  {filteredAdminNav.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? "bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400"}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* New Ticket Modal */}
        {isNewTicketOpen && (
          <TicketFormModal
            isOpen={isNewTicketOpen}
            onClose={() => setIsNewTicketOpen(false)}
            users={users}
            canAssign={user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'SCHOOL_MANAGER'}
            directManager={directManager}
          />
        )}
      </aside>
    </>
  );
}
