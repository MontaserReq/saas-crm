'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/context';
import { formatDate } from '@/lib/utils';
import { MobileCardField } from '@/components/ui/MobileCard';
import { getAuditActionLabel, getEntityTypeLabel } from '@/lib/i18n/auditLabels';

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
  organization?: { name: string } | null;
}

interface AuditLogsClientViewProps {
  logs: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
  platformView?: boolean;
}

export function AuditLogsClientView({ logs, total, page, totalPages, platformView = false }: AuditLogsClientViewProps) {
  const { t, language } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('admin.auditLogs.title')}
          </h2>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {language === 'ar' ? 'للقراءة فقط' : 'View only'}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {platformView
            ? language === 'ar'
              ? 'سجل رقابي غير قابل للتعديل يشمل جميع الشركات.'
              : 'An immutable oversight log across all companies.'
            : t('admin.auditLogs.description')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="hidden md:table-row bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">{t('admin.auditLogs.timestamp')}</th>
                <th className="py-3 px-4">{t('admin.auditLogs.user')}</th>
                {platformView && <th className="py-3 px-4">{language === 'ar' ? 'الشركة' : 'Company'}</th>}
                <th className="py-3 px-4">{t('admin.auditLogs.action')}</th>
                <th className="py-3 px-4">{t('admin.auditLogs.entity')}</th>
                <th className="py-3 px-4">{t('admin.auditLogs.entityId')}</th>
                <th className="py-3 px-4">{t('admin.auditLogs.details')}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  {/* Desktop row */}
                  <tr className="hidden md:table-row border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-sans">
                      {formatDate(log.createdAt, language)}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-slate-200">
                      {log.actor ? log.actor.name : t('admin.auditLogs.systemActor')}
                    </td>
                    {platformView && <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-300">{log.organization?.name ?? '—'}</td>}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-brand-700 dark:text-brand-300 font-bold text-[10px]">
                        {getAuditActionLabel(log.action, language)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-sans">
                      {getEntityTypeLabel(log.entityType, language)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-[120px]">
                      {log.entityId || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[10px] truncate max-w-[240px]">
                      {log.metadata || '-'}
                    </td>
                  </tr>

                  {/* Mobile card */}
                  <tr className="md:hidden border-b border-slate-100 dark:border-slate-800">
                    <td colSpan={platformView ? 7 : 6} className="p-4 space-y-2 font-sans">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {log.actor ? log.actor.name : t('admin.auditLogs.systemActor')}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-brand-700 dark:text-brand-300 font-bold text-[10px] font-mono shrink-0">
                          {getAuditActionLabel(log.action, language)}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px]">{formatDate(log.createdAt, language)}</div>
                      {platformView && <MobileCardField label={language === 'ar' ? 'الشركة' : 'Company'}>{log.organization?.name ?? '—'}</MobileCardField>}
                      <MobileCardField label={t('admin.auditLogs.entity')}>{getEntityTypeLabel(log.entityType, language)}</MobileCardField>
                      {log.entityId && (
                        <MobileCardField label={t('admin.auditLogs.entityId')}>
                          <span className="font-mono break-all">{log.entityId}</span>
                        </MobileCardField>
                      )}
                      {log.metadata && (
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                          <div className="text-slate-400 font-semibold text-[11px] mb-0.5">{t('admin.auditLogs.details')}</div>
                          <div className="text-slate-500 text-[10px] font-mono whitespace-pre-wrap break-words">{log.metadata}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={platformView ? 7 : 6} className="py-8 text-center text-slate-400 font-sans">
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
