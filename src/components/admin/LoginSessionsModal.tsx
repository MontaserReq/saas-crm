'use client';
import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { getLoginSessionsAction } from '@/server/actions/users';
import { MobileCardField } from '@/components/ui/MobileCard';

export function LoginSessionsModal({ user, isOpen, onClose }: { user: any; isOpen: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (isOpen && user) getLoginSessionsAction(user.id).then(r => setRows(r.sessions || [])); }, [isOpen, user]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Security & Access — ${user?.name || ''}`} maxWidth="xl">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Immutable login history. Location is approximate only and is not collected as GPS.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="hidden md:table-row text-start border-b">
                <th className="p-2">IP</th>
                <th className="p-2">Device</th>
                <th className="p-2">Browser / OS</th>
                <th className="p-2">Login</th>
                <th className="p-2">Logout</th>
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
                    <td className="p-2">{new Date(r.loginAt).toLocaleString()}</td>
                    <td className="p-2">{r.logoutAt ? new Date(r.logoutAt).toLocaleString() : 'Active / denied'}</td>
                  </tr>

                  {/* Mobile card */}
                  <tr className="md:hidden border-b">
                    <td colSpan={5} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold">{r.ipAddress || '—'}</span>
                        <span className="text-slate-500">{r.browser} / {r.operatingSystem}</span>
                      </div>
                      <MobileCardField label="Device">
                        <span className="break-words">{r.deviceInfo || '—'}</span>
                      </MobileCardField>
                      <MobileCardField label="Login">{new Date(r.loginAt).toLocaleString()}</MobileCardField>
                      <MobileCardField label="Logout">{r.logoutAt ? new Date(r.logoutAt).toLocaleString() : 'Active / denied'}</MobileCardField>
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
