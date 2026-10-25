'use client';
import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { getLoginSessionsAction } from '@/server/actions/users';
import { MobileCardField } from '@/components/ui/MobileCard';
import { useI18n } from '@/lib/i18n/context';

export function LoginSessionsModal({ user, isOpen, onClose }: { user: any; isOpen: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const { t, language } = useI18n();
  useEffect(() => { if (isOpen && user) getLoginSessionsAction(user.id).then(r => setRows(r.sessions || [])); }, [isOpen, user]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.auditLogs.loginSessionsTitle').replace('{name}', user?.name || '')} maxWidth="xl">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{t('admin.auditLogs.loginSessionsDescription')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="hidden md:table-row text-start border-b">
                <th className="p-2">{t('admin.auditLogs.ipAddress')}</th>
                <th className="p-2">{t('admin.auditLogs.device')}</th>
                <th className="p-2">{t('admin.auditLogs.browserOs')}</th>
                <th className="p-2">{t('admin.auditLogs.login')}</th>
                <th className="p-2">{t('admin.auditLogs.logoutTime')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  {/* Desktop row */}
                  <tr className="hidden md:table-row border-b">
                    <td className="p-2 font-mono">{r.ipAddress || '—'}</td>
                    <td className="p-2 max-w-[16rem] truncate">{r.deviceInfo || '—'}</td>
                    <td className="p-2">{r.browser} / {r.operatingSystem}</td>
                    <td className="p-2">{new Date(r.loginAt).toLocaleString(language === 'ar' ? 'ar-JO' : 'en-US')}</td>
                    <td className="p-2">{r.logoutAt ? new Date(r.logoutAt).toLocaleString(language === 'ar' ? 'ar-JO' : 'en-US') : t('admin.auditLogs.activeDenied')}</td>
                  </tr>

                  {/* Mobile card */}
                  <tr className="md:hidden border-b">
                    <td colSpan={5} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold">{r.ipAddress || '—'}</span>
                        <span className="text-slate-500">{r.browser} / {r.operatingSystem}</span>
                      </div>
                      <MobileCardField label={t('admin.auditLogs.device')}>
                        <span className="break-words">{r.deviceInfo || '—'}</span>
                      </MobileCardField>
                      <MobileCardField label={t('admin.auditLogs.login')}>{new Date(r.loginAt).toLocaleString(language === 'ar' ? 'ar-JO' : 'en-US')}</MobileCardField>
                      <MobileCardField label={t('admin.auditLogs.logoutTime')}>{r.logoutAt ? new Date(r.logoutAt).toLocaleString(language === 'ar' ? 'ar-JO' : 'en-US') : t('admin.auditLogs.activeDenied')}</MobileCardField>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
