'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Ticket,
  GraduationCap,
  Share2,
  Mail,
  StickyNote,
  Activity,
  Users,
  ShieldCheck,
  Building2,
  ListTodo,
  BarChart3,
  FileSpreadsheet,
  MessageCircle,
  CalendarDays,
  Plus,
  X,
} from 'lucide-react';
import { UserSession } from '@/types';
import { useI18n } from '@/lib/i18n/context';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useState } from 'react';
import { TicketFormModal } from '@/components/tickets/TicketFormModal';
import { ChatClient } from '@/components/chat/ChatClient';

interface SidebarProps {
  user: UserSession;
  schools?: Array<{ id: string; name: string }>;
  taskTypes?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string; email: string; reportsToUserId?: string | null; department?: { name: string } | null }>;
  directManager?: { id: string; name: string; isActive: boolean } | null;
}

export function Sidebar({ user, schools = [], taskTypes = [], users = [], directManager }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const mainNav = [
    { label: t('nav.dashboard'), href: '/', icon: LayoutDashboard, exact: true },
    { label: t('nav.myTickets'), href: '/tickets', icon: Ticket },
    { label: t('nav.calendar'), href: '/calendar', icon: CalendarDays },
    {
      label: t('nav.schools'),
      href: '/schools',
      icon: GraduationCap,
      show: hasPermission(user, PERMISSIONS.SCHOOLS_VIEW),
    },
    {
      label: t('nav.schoolAssignments'),
      href: '/assignments',
      icon: Share2,
      show: hasPermission(user, PERMISSIONS.SCHOOLS_ASSIGN),
    },
    { label: t('nav.messages'), href: '/messages', icon: Mail },
    { label: t('nav.myTodo'), href: '/todos', icon: StickyNote },
    { label: t('nav.activityChanges'), href: '/activity', icon: Activity },
  ];

  const adminNav = [
    {
      label: t('nav.users'),
      href: '/admin/users',
      icon: Users,
      show: hasPermission(user, PERMISSIONS.USERS_VIEW),
    },
    {
      label: t('nav.roles'),
      href: '/admin/roles',
      icon: ShieldCheck,
      show: hasPermission(user, PERMISSIONS.ROLES_VIEW),
    },
    {
      label: t('nav.departments'),
      href: '/admin/departments',
      icon: Building2,
      show: hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE),
    },
    {
      label: t('nav.taskTypes'),
      href: '/admin/task-types',
      icon: ListTodo,
      show: hasPermission(user, PERMISSIONS.TASK_TYPES_MANAGE),
    },
    {
      label: t('nav.analytics'),
      href: '/admin/analytics',
      icon: BarChart3,
      show: hasPermission(user, PERMISSIONS.ANALYTICS_VIEW),
    },
    {
      label: t('nav.auditLogs'),
      href: '/admin/audit-logs',
      icon: FileSpreadsheet,
      show: hasPermission(user, PERMISSIONS.AUDIT_LOGS_VIEW),
    },
    {
      label: 'Approval Requests / طلبات الموافقة',
      href: '/admin/approval-requests',
      icon: ShieldCheck,
      show: hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_EDIT) || hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_DELETE),
    },
  ];

  const filteredMainNav = mainNav.filter((item) => item.show !== false);
  const filteredAdminNav = adminNav.filter((item) => item.show !== false);

  return (
    <>
    <aside className="w-64 bg-white dark:bg-slate-900 border-r rtl:border-r-0 rtl:border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-30">
      <div>
        {/* Brand Logo */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-brand-500/20">
            CL
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white block">CodeLine JO</span>
            <span className="text-[11px] text-brand-600 dark:text-brand-400 font-medium -mt-1 block">
              {t('app.subtitle')}
            </span>
          </div>
        </div>

        {/* Quick New Ticket Button */}
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => setIsNewTicketOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('tickets.createTicket')}</span>
          </button>
        </div>

        {/* Navigation links */}
        <div className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('nav.mainMenu')}
            </div>
            <nav className="space-y-1">
              {filteredMainNav.map((item) => {
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {filteredAdminNav.length > 0 && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('nav.administration')}
              </div>
              <nav className="space-y-1">
                {filteredAdminNav.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Live Chat is intentionally the only footer action. */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <button onClick={() => setIsChatOpen(true)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors">
          <MessageCircle className="w-4 h-4" />
          <span>Live Chat / المحادثة المباشرة</span>
        </button>
      </div>

      {/* New Ticket Modal */}
      {isNewTicketOpen && (
        <TicketFormModal
          isOpen={isNewTicketOpen}
          onClose={() => setIsNewTicketOpen(false)}
          directManager={directManager}
        />
      )}
    </aside>
    {isChatOpen && <div className="fixed inset-0 z-50 pointer-events-none"><div className="pointer-events-auto absolute end-3 bottom-3 w-[min(42rem,calc(100vw-1.5rem))] max-h-[calc(100vh-1.5rem)]"><button onClick={() => setIsChatOpen(false)} aria-label="Close chat" className="absolute top-2 end-2 z-10 p-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 shadow text-slate-600 dark:text-slate-200"><X className="w-4 h-4" /></button><ChatClient currentUserId={user.id} /></div></div>}
    </>
  );
}
