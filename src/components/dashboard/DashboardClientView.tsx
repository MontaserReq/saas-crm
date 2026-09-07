'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Archive,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Ticket,
  Plus,
  ArrowRightLeft,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { useI18n } from '@/lib/i18n/context';
import { TicketFormModal } from '@/components/tickets/TicketFormModal';

interface DashboardClientViewProps {
  user: any;
  data: {
    metrics: {
      total: number;
      pending: number;
      seen: number;
      accepted: number;
      transferred: number;
      inProgress: number;
      rejected: number;
      unreachable: number;
      completed: number;
      closed: number;
    };
    needsAttention: any[];
    recentActivity: any[];
  };
  schools?: Array<{ id: string; name: string }>;
  taskTypes?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string; email: string; reportsToUserId?: string | null; department?: { name: string } | null }>;
  managerName?: string | null;
}

export function DashboardClientView({
  user,
  data,
  schools = [],
  taskTypes = [],
  users = [],
  managerName,
}: DashboardClientViewProps) {
  const { t, language, getStatusLabel } = useI18n();
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);

  // Simplified status cards: PENDING, ACCEPTED, TRANSFERRED, REJECTED, CLOSED
  const statusCards = [
    {
      label: getStatusLabel('PENDING'),
      status: 'PENDING',
      count: data.metrics.pending,
      icon: Clock,
      color: 'border-amber-400 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
    },
    {
      label: getStatusLabel('ACCEPTED'),
      status: 'ACCEPTED',
      count: data.metrics.accepted,
      icon: CheckCircle2,
      color: 'border-emerald-400 dark:border-emerald-700/60 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20',
    },
    {
      label: getStatusLabel('TRANSFERRED'),
      status: 'TRANSFERRED',
      count: data.metrics.transferred,
      icon: ArrowRightLeft,
      color: 'border-purple-400 dark:border-purple-700/60 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20',
    },
    {
      label: getStatusLabel('REJECTED'),
      status: 'REJECTED',
      count: data.metrics.rejected,
      icon: XCircle,
      color: 'border-rose-400 dark:border-rose-700/60 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20',
    },
    {
      label: getStatusLabel('CLOSED'),
      status: 'CLOSED',
      count: data.metrics.closed,
      icon: Archive,
      color: 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 via-purple-800 to-brand-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{user.roleDisplayName || user.role}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {t('dashboard.welcome')}, {user.name}
          </h2>
          <p className="text-xs text-purple-200">
            {user.departmentName} &bull; {t('app.title')} - {t('app.subtitle')}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setIsNewTicketOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-brand-900 bg-amber-300 hover:bg-amber-200 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>{t('tickets.createTicket')}</span>
          </button>
          <Link
            href="/tickets"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-brand-900 bg-white hover:bg-purple-50 transition-all shadow-md"
          >
            <Ticket className="w-4 h-4" />
            <span>
              {t('dashboard.myTicketsBtn')} ({formatNumber(data.metrics.total, language)})
            </span>
          </Link>
          <Link
            href="/todos"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-all"
          >
            <span>{t('dashboard.myTodoBtn')}</span>
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('dashboard.myMetricsTitle')}</h3>
          <span className="text-xs text-slate-400">{t('dashboard.clickToFilter')}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {statusCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.status}
                href={`/tickets?status=${card.status}`}
                className={`p-4 rounded-2xl border ${card.color} hover:shadow-md transition-all group block`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold opacity-90 truncate">{card.label}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                    {formatNumber(card.count, language)}
                  </span>
                  <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 group-hover:underline flex items-center gap-0.5">
                    {t('dashboard.view')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Two Column Section: Needs Attention & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Needs Attention Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('dashboard.needsAttention')}
              </h3>
            </div>
            <Link
              href="/tickets?status=PENDING"
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              {t('dashboard.viewPendingTickets')}
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
            {data.needsAttention.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {t('dashboard.noAttentionNeeded')}
              </div>
            ) : (
              data.needsAttention.map((tItem) => (
                <Link
                  key={tItem.id}
                  href={`/tickets/${tItem.id}`}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors block"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-brand-600 dark:text-brand-400">
                        {tItem.ticketNumber}
                      </span>
                      <TicketStatusBadge status={tItem.status} showIcon={false} />
                      <PriorityBadge priority={tItem.priority} />
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{tItem.subject}</h4>
                    <p className="text-xs text-slate-400">
                      {tItem.school ? `${tItem.school.name} • ${tItem.school.city}` : 'General Ticket'}{tItem.taskType ? ` • ${tItem.taskType.name}` : ''}
                    </p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 rtl:rotate-180" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('dashboard.recentActivity')}</h3>
            <Link
              href="/activity"
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
            {data.recentActivity.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">{t('dashboard.noRecentActivity')}</div>
            ) : (
              data.recentActivity.map((act) => (
                <div key={act.id} className="text-xs space-y-0.5 pb-3 border-b last:border-0 border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{act.actor.name}</span>
                    <span className="text-[10px] text-slate-400">{formatDate(act.createdAt, language)}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{act.title}</p>
                  {act.ticket && (
                    <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 block truncate">
                      {act.ticket.ticketNumber} &bull; {act.ticket.subject}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Global New Ticket Modal */}
      {isNewTicketOpen && (
        <TicketFormModal
          isOpen={isNewTicketOpen}
          onClose={() => setIsNewTicketOpen(false)}
          managerName={managerName}
        />
      )}
    </div>
  );
}
