'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { getLoginSessionsAction } from '@/server/actions/users';

export function LoginSessionsModal({ user, isOpen, onClose }: { user: any; isOpen: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (isOpen && user) getLoginSessionsAction(user.id).then(r => setRows(r.sessions || [])); }, [isOpen, user]);
  return <Modal isOpen={isOpen} onClose={onClose} title={`Security & Access — ${user?.name || ''}`} maxWidth="xl"><div className="space-y-3"><p className="text-xs text-slate-500">Immutable login history. Location is approximate only and is not collected as GPS.</p><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-start border-b"><th className="p-2">IP</th><th className="p-2">Device</th><th className="p-2">Browser / OS</th><th className="p-2">Login</th><th className="p-2">Logout</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b"><td className="p-2 font-mono">{r.ipAddress || '—'}</td><td className="p-2 max-w-[16rem] truncate">{r.deviceInfo || '—'}</td><td className="p-2">{r.browser} / {r.operatingSystem}</td><td className="p-2">{new Date(r.loginAt).toLocaleString()}</td><td className="p-2">{r.logoutAt ? new Date(r.logoutAt).toLocaleString() : 'Active / denied'}</td></tr>)}</tbody></table></div></div></Modal>;
}
