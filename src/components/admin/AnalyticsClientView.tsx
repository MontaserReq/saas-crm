'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/context';
import { BarChart3, Users, Building, PhoneCall, Clock, Activity } from 'lucide-react';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { formatDuration, formatNumber } from '@/lib/formatters';
import { formatDate } from '@/lib/utils';
import { MobileCardField } from '@/components/ui/MobileCard';

interface UserTimeStat {
  userId: string;
  name: string;
  email: string;
  department: string;
  totalMinutes: number;
  sessionsCount: number;
  lastLogin: Date | string | null;
  lastLogout: Date | string | null;
  avgSessionMinutes: number;
}

interface AnalyticsData {
  ticketsByDepartment: { name: string; count: number }[];
  ticketsByMember: { name: string; count: number }[];
  communicationByResult: { result: string; count: number }[];
  ticketsByTaskType: { name: string; count: number }[];
  userTimeStats?: UserTimeStat[];
}

interface AnalyticsClientViewProps {
  data: AnalyticsData;
}

export function AnalyticsClientView({ data }: AnalyticsClientViewProps) {
  const { t, language, getStatusLabel } = useI18n();

  const userTimeStats = data.userTimeStats || [];

  const totalSystemMinutes = userTimeStats.reduce((acc, u) => acc + u.totalMinutes, 0);
  const totalSystemSessions = userTimeStats.reduce((acc, u) => acc + u.sessionsCount, 0);

  const exportColumns = [
    { header: t('admin.analytics.employee'), accessor: (u: UserTimeStat) => u.name },
    { header: t('admin.users.email'), accessor: (u: UserTimeStat) => u.email },
    { header: t('admin.analytics.department'), accessor: (u: UserTimeStat) => u.department },
    { header: t('admin.analytics.totalTimeMin'), accessor: (u: UserTimeStat) => u.totalMinutes },
    { header: t('admin.analytics.sessionsCount'), accessor: (u: UserTimeStat) => u.sessionsCount },
    { header: t('admin.analytics.avgSessionMin'), accessor: (u: UserTimeStat) => u.avgSessionMinutes },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('admin.analytics.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('admin.analytics.description')}
          </p>
        </div>

        {userTimeStats.length > 0 && (
          <ExportDropdown
            filename="system-analytics-sessions"
            title={t('admin.analytics.title')}
            data={userTimeStats}
            columns={exportColumns}
          />
        )}
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.analytics.totalWorkTime')}</span>
          <span className="text-lg font-black text-brand-600">{formatDuration(totalSystemMinutes, language)}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.analytics.totalSessions')}</span>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100">{formatNumber(totalSystemSessions, language)}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.departments.totalDepts')}</span>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100">{formatNumber(data.ticketsByDepartment.length, language)}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.taskTypes.totalTaskTypes')}</span>
          <span className="text-xl font-black text-indigo-600">{formatNumber(data.ticketsByTaskType.length, language)}</span>
        </div>
      </div>

      {/* User Session & Time Spent Table */}
      {userTimeStats.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden space-y-3 p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Clock className="w-5 h-5 text-brand-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {t('admin.analytics.timeSpentStats')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('admin.analytics.timeSpentSubtitle')}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="hidden md:table-row bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">{t('admin.analytics.employee')}</th>
                  <th className="py-2.5 px-3">{t('admin.analytics.department')}</th>
                  <th className="py-2.5 px-3">{t('admin.analytics.totalTime')}</th>
                  <th className="py-2.5 px-3">{t('admin.analytics.sessions')}</th>
                  <th className="py-2.5 px-3">{t('admin.analytics.avgSession')}</th>
                  <th className="py-2.5 px-3">{t('admin.analytics.lastActivity')}</th>
                </tr>
              </thead>
              <tbody>
                {userTimeStats.map((u) => (
                  <React.Fragment key={u.userId}>
                    {/* Desktop row */}
                    <tr className="hidden md:table-row border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{u.name}</span>
                          <span className="text-[10px] text-slate-400 block">{u.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        {u.department}
                      </td>
                      <td className="py-3 px-3 font-bold text-brand-600 dark:text-brand-400">
                        {formatDuration(u.totalMinutes, language)}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {formatNumber(u.sessionsCount, language)}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {formatDuration(u.avgSessionMinutes, language)}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {formatDate(u.lastLogin, language)}
                      </td>
                    </tr>

                    {/* Mobile card */}
                    <tr className="md:hidden border-b border-slate-100 dark:border-slate-800">
                      <td colSpan={6} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{u.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{u.email}</div>
                          </div>
                          <span className="font-bold text-brand-600 dark:text-brand-400 shrink-0">{formatDuration(u.totalMinutes, language)}</span>
                        </div>
                        <MobileCardField label={t('admin.analytics.department')}>{u.department}</MobileCardField>
                        <MobileCardField label={t('admin.analytics.sessions')}>{formatNumber(u.sessionsCount, language)}</MobileCardField>
                        <MobileCardField label={t('admin.analytics.avgSession')}>{formatDuration(u.avgSessionMinutes, language)}</MobileCardField>
                        <MobileCardField label={t('admin.analytics.lastActivity')}>{formatDate(u.lastLogin, language)}</MobileCardField>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid of charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tickets by Department */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Building className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {t('admin.analytics.ticketsByDepartment')}
            </h3>
          </div>

          <div className="space-y-3">
            {data.ticketsByDepartment.map((d) => (
              <div key={d.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{d.name}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatNumber(d.count, language)}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full"
                    style={{ width: `${Math.min(100, d.count * 15)}%` }}
                  />
                </div>
              </div>
            ))}
            {data.ticketsByDepartment.length === 0 && (
              <p className="text-xs text-slate-400 py-2">{t('common.noData')}</p>
            )}
          </div>
        </div>

        {/* Tickets by Member */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Users className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {t('admin.analytics.assignedLoadByMember')}
            </h3>
          </div>

          <div className="space-y-3">
            {data.ticketsByMember.map((u) => (
              <div key={u.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{u.name}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatNumber(u.count, language)} {t('admin.analytics.activeCount')}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{ width: `${Math.min(100, u.count * 20)}%` }}
                  />
                </div>
              </div>
            ))}
            {data.ticketsByMember.length === 0 && (
              <p className="text-xs text-slate-400 py-2">{t('common.noData')}</p>
            )}
          </div>
        </div>

        {/* Contact Attempts by Result */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <PhoneCall className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {t('admin.analytics.commResultsBreakdown')}
            </h3>
          </div>

          <div className="space-y-3">
            {data.communicationByResult.map((c) => (
              <div key={c.result} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{getStatusLabel(c.result)}</span>
                <span className="font-black text-slate-900 dark:text-slate-100">
                  {formatNumber(c.count, language)} {t('admin.analytics.callsCount')}
                </span>
              </div>
            ))}
            {data.communicationByResult.length === 0 && (
              <p className="text-xs text-slate-400 py-2">{t('common.noData')}</p>
            )}
          </div>
        </div>

        {/* Task Type Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {t('admin.analytics.taskTypeDistribution')}
            </h3>
          </div>

          <div className="space-y-3">
            {data.ticketsByTaskType.map((tItem) => (
              <div key={tItem.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{tItem.name}</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">
                  {formatNumber(tItem.count, language)} {t('admin.analytics.ticketsCount')}
                </span>
              </div>
            ))}
            {data.ticketsByTaskType.length === 0 && (
              <p className="text-xs text-slate-400 py-2">{t('common.noData')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
