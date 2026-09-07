'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/context';
import { formatDate } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

interface AuditLogItem {
  id: string;
  createdAt: Date | string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | null;
  actor: {
    name: string;
    email: string;
  } | null;
}

interface AuditLogsClientViewProps {
  logs: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
}

export function AuditLogsClientView({ logs, total, page, totalPages }: AuditLogsClientViewProps) {
  const { t, language } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('admin.auditLogs.title')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('admin.auditLogs.description')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">{t('admin.auditLogs.timestamp')}</th>
                <th className="py-3 px-4">{t('admin.auditLogs.user')}</th>
                <th className="py-3 px-4">{t('admin.auditLogs.action')}</th>
                <th className="py-3 px-4">{t('admin.auditLogs.entity')}</th>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">{t('admin.auditLogs.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-sans">
                    {formatDate(log.createdAt, language)}
                  </td>
                  <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-slate-200">
                    {log.actor ? log.actor.name : t('admin.auditLogs.systemActor')}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-brand-700 dark:text-brand-300 font-bold text-[10px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-sans">
                    {log.entityType}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-[120px]">
                    {log.entityId || '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[10px] truncate max-w-[240px]">
                    {log.metadata || '-'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    {t('admin.auditLogs.noLogsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-sans">
            <span>
              {t('admin.auditLogs.pageOfTotal')
                .replace('{page}', String(page))
                .replace('{totalPages}', String(totalPages))
                .replace('{total}', String(total))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
