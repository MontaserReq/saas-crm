'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n/context';
import { resubmitRejectedTicketAction, updateRejectedTicketAction } from '@/server/actions/tickets';
import { AlertCircle, Pencil, Send } from 'lucide-react';

interface Props {
  ticket: { id: string; ticketNumber: string; subject: string; priority: string; schoolId?: string | null; taskTypeId?: string | null; dueDate?: string | Date | null; followUpAt?: string | Date | null };
  schools?: Array<{ id: string; name: string; contactPerson?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null; city?: string | null; area?: string | null }>;
  taskTypes?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string; code: string; users?: Array<{ id: string; name: string; email: string }> }>;
}

function dateValue(value: string | Date | null | undefined, length: 10 | 16) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, length);
}

export function RejectedTicketCorrection({ ticket, schools = [], taskTypes = [], departments = [] }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [schoolId, setSchoolId] = useState(ticket.schoolId || '');
  const initialSchool = schools.find((school) => school.id === (ticket.schoolId || ''));
  const [phone, setPhone] = useState(initialSchool?.phone || '');
  const [whatsapp, setWhatsapp] = useState(initialSchool?.whatsapp || '');
  const [email, setEmail] = useState(initialSchool?.email || '');
  const [taskTypeId, setTaskTypeId] = useState(ticket.taskTypeId || '');
  const [subject, setSubject] = useState(ticket.subject);
  const [priority, setPriority] = useState(ticket.priority);
  const [dueDate, setDueDate] = useState(dateValue(ticket.dueDate, 10));
  const [followUpAt, setFollowUpAt] = useState(dateValue(ticket.followUpAt, 16));
  const [correctionNote, setCorrectionNote] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedSchool = schools.find((school) => school.id === schoolId);
  const targetUsers = departments.find((department) => department.id === targetDepartmentId)?.users || [];

  const handleSchoolChange = (value: string) => {
    setSchoolId(value);
    const school = schools.find((item) => item.id === value);
    setPhone(school?.phone || '');
    setWhatsapp(school?.whatsapp || '');
    setEmail(school?.email || '');
  };

  const handleDepartmentChange = (value: string) => {
    setTargetDepartmentId(value);
    setTargetUserId(departments.find((department) => department.id === value)?.users?.[0]?.id || '');
  };

  const submitCorrection = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await updateRejectedTicketAction({ ticketId: ticket.id, schoolId: schoolId || null, phone: phone || null, whatsapp: whatsapp || null, email: email || null, taskTypeId: taskTypeId || null, subject, priority, dueDate: dueDate || null, followUpAt: followUpAt || null, correctionNote: correctionNote || null });
    setLoading(false);
    if (!result.success) { setError(result.error || t('common.error')); return false; }
    setIsOpen(false);
    setCorrectionNote('');
    router.refresh();
    return true;
  };

  const resubmit = async () => {
    setLoading(true);
    setError(null);
    if (!targetDepartmentId || !targetUserId) {
      setIsOpen(true);
      setError(t('tickets.selectRecipientPrompt'));
      setLoading(false);
      return;
    }
    const result = await resubmitRejectedTicketAction(ticket.id, targetDepartmentId, targetUserId);
    setLoading(false);
    if (!result.success) { setError(result.error || t('common.error')); return; }
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      {error && <div className="basis-full flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300"><AlertCircle className="w-4 h-4" />{error}</div>}
      <button type="button" onClick={() => setIsOpen(true)} disabled={loading} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"><Pencil className="w-3.5 h-3.5" />{t('tickets.rejectedCorrectInfo')}</button>
      <button type="button" onClick={() => setIsOpen(true)} disabled={loading} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50"><Send className="w-3.5 h-3.5" />{t('tickets.resubmitTicket')}</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('tickets.rejectedCorrectTitle')} description={t('tickets.oldNewValuesSavedInActivity')}>
        <form onSubmit={submitCorrection} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold mb-1">{t('tickets.schoolOptional')}</label><select value={schoolId} onChange={(event) => handleSchoolChange(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="">{t('tickets.schoolOptional')}</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
            <div><label className="block text-xs font-bold mb-1">{t('tickets.taskTypeOptional')}</label><select value={taskTypeId} onChange={(event) => setTaskTypeId(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="">{t('tickets.taskTypeOptional')}</option>{taskTypes.map((taskType) => <option key={taskType.id} value={taskType.id}>{taskType.name}</option>)}</select></div>
          </div>
          {selectedSchool && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 p-3 text-xs">
              <div><span className="text-slate-400 block mb-0.5">{t('schools.contactPerson')}</span><span className="font-semibold">{selectedSchool.contactPerson || '—'}</span></div>
              <label><span className="text-slate-400 block mb-0.5">{t('schools.phone')}</span><input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" /></label>
              <label><span className="text-slate-400 block mb-0.5">{t('schools.whatsapp')}</span><input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" /></label>
              <label><span className="text-slate-400 block mb-0.5">{t('schools.email')}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" /></label>
              <div><span className="text-slate-400 block mb-0.5">{t('schools.city')}</span><span className="font-semibold">{selectedSchool.city || '—'}</span></div>
              <div><span className="text-slate-400 block mb-0.5">{t('schools.area')}</span><span className="font-semibold">{selectedSchool.area || '—'}</span></div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-950/30 p-3">
            <div><label className="block text-xs font-bold mb-1">{t('tickets.selectDepartmentPrompt')}</label><select value={targetDepartmentId} onChange={(event) => handleDepartmentChange(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="">{t('tickets.selectDepartmentPrompt')}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}</select></div>
            <div><label className="block text-xs font-bold mb-1">{t('tickets.selectRecipientPrompt')}</label><select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} disabled={!targetDepartmentId || targetUsers.length === 0} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="">{targetUsers.length ? t('tickets.selectRecipientPrompt') : t('tickets.noActiveMembersInDept')}</option>{targetUsers.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.email})</option>)}</select></div>
          </div>
          <div><label className="block text-xs font-bold mb-1">{t('tickets.subject')}</label><input required minLength={3} value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></div>
          <div><label className="block text-xs font-bold mb-1">{t('tickets.priority')}</label><select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="LOW">{t('tickets.priorityLow')}</option><option value="MEDIUM">{t('tickets.priorityMedium')}</option><option value="HIGH">{t('tickets.priorityHigh')}</option><option value="URGENT">{t('tickets.priorityUrgent')}</option></select></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-xs font-bold mb-1">{t('tickets.dueDate')}</label><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></div><div><label className="block text-xs font-bold mb-1">{t('tickets.followUp')}</label><input type="datetime-local" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></div></div>
          <div><label className="block text-xs font-bold mb-1">{t('tickets.initialNote')}</label><textarea rows={3} value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder={t('tickets.initialNotePlaceholder')} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></div>
          <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3"><button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg text-sm">{t('tickets.cancel')}</button><button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 disabled:opacity-50">{loading ? t('common.loading') : t('tickets.save')}</button><button type="button" onClick={async () => { const saved = await submitCorrection({ preventDefault: () => undefined } as React.FormEvent); if (saved) await resubmit(); }} disabled={loading || !targetDepartmentId || !targetUserId} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 disabled:opacity-50">{loading ? t('common.loading') : t('tickets.resubmitTicket')}</button></div>
        </form>
      </Modal>
    </div>
  );
}
