'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { decideSchoolApprovalAction } from '@/server/actions/schools';
import { useI18n } from '@/lib/i18n/context';

export function ApprovalRequestsClient({ requests }: { requests: any[] }) {
  const { language } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    await decideSchoolApprovalAction(id, approve);
    setBusy(null);
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold">{language === 'ar' ? 'طلبات الموافقة' : 'Approval Requests'}</h2><p className="text-xs text-slate-500">{language === 'ar' ? 'مراجعة طلبات تعديل وحذف المدارس حسب صلاحياتك.' : 'Review school edit and delete requests allowed by your permissions.'}</p></div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs"><thead><tr className="bg-slate-50 dark:bg-slate-800 text-start"><th className="p-3">{language === 'ar' ? 'المدرسة' : 'School'}</th><th className="p-3">{language === 'ar' ? 'النوع' : 'Type'}</th><th className="p-3">{language === 'ar' ? 'الحالة' : 'Status'}</th><th className="p-3">{language === 'ar' ? 'مقدم الطلب' : 'Requester'}</th><th className="p-3">{language === 'ar' ? 'تاريخ الطلب' : 'Requested'}</th><th className="p-3">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th></tr></thead>
          <tbody>{requests.map((request) => <tr key={request.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-bold">{request.school.name}</td><td className="p-3">{request.type}</td><td className="p-3"><span className="inline-flex px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">🟡 {request.status === 'PENDING' ? (language === 'ar' ? 'بانتظار الموافقة' : 'Pending Approval') : request.status}</span></td><td className="p-3">{request.requester.name}</td><td className="p-3">{new Date(request.createdAt).toLocaleString()}</td><td className="p-3 flex gap-2"><button disabled={busy === request.id} onClick={() => decide(request.id, true)} className="p-2 rounded-lg bg-emerald-50 text-emerald-700"><Check className="w-4 h-4" /></button><button disabled={busy === request.id} onClick={() => decide(request.id, false)} className="p-2 rounded-lg bg-rose-50 text-rose-700"><X className="w-4 h-4" /></button></td></tr>)}</tbody>
        </table>{requests.length === 0 && <p className="p-8 text-center text-slate-400">{language === 'ar' ? 'لا توجد طلبات معلقة.' : 'No pending requests.'}</p>}
      </div>
    </div>
  );
}
