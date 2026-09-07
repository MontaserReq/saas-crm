'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { createCalendarEventAction, updateCalendarEventAction, deleteCalendarEventAction } from '@/server/actions/calendar';
import { Modal } from '@/components/ui/Modal';
import { Clock, Building2, Ticket, User, Trash2, CheckCircle2 } from 'lucide-react';
import { useDialog } from '@/lib/dialog/context';

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: any | null;
  schools: Array<{ id: string; name: string }>;
  tickets: Array<{ id: string; ticketNumber: string; subject: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  initialDate?: Date | null;
  onSuccess: () => void;
}

export function CalendarEventModal({
  isOpen,
  onClose,
  event,
  schools,
  tickets,
  users,
  initialDate,
  onSuccess,
}: CalendarEventModalProps) {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const isEditing = !!event;

  const formatDateForInput = (d?: Date | string | null) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    title: '',
    type: 'MEETING',
    startDate: '',
    endDate: '',
    description: '',
    location: '',
    schoolId: '',
    ticketId: '',
    assignedToUserId: '',
  });

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        type: event.type || 'MEETING',
        startDate: formatDateForInput(event.startDate),
        endDate: formatDateForInput(event.endDate),
        description: event.description || '',
        location: event.location || '',
        schoolId: event.schoolId || '',
        ticketId: event.ticketId || '',
        assignedToUserId: event.userId || '',
      });
    } else {
      const defaultStart = initialDate ? new Date(initialDate) : new Date();
      defaultStart.setHours(9, 0, 0, 0);
      const defaultEnd = new Date(defaultStart);
      defaultEnd.setHours(10, 0, 0, 0);

      setFormData({
        title: '',
        type: 'MEETING',
        startDate: formatDateForInput(defaultStart),
        endDate: formatDateForInput(defaultEnd),
        description: '',
        location: '',
        schoolId: '',
        ticketId: '',
        assignedToUserId: '',
      });
    }
    setError(null);
  }, [event, initialDate, isOpen]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError(t('calendar.titleRequired'));
      return;
    }
    if (!formData.startDate) {
      setError(t('calendar.startDateRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      title: formData.title.trim(),
      type: formData.type as any,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      description: formData.description.trim() || null,
      location: formData.location.trim() || null,
      schoolId: formData.schoolId || null,
      ticketId: formData.ticketId || null,
      assignedToUserId: formData.assignedToUserId || null,
    };

    const res = isEditing
      ? await updateCalendarEventAction(event.id, payload)
      : await createCalendarEventAction(payload);

    setLoading(false);

    if (res.success) {
      onClose();
      onSuccess();
    } else {
      setError(res.error || t('common.error'));
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const approved = await confirm({ title: t('calendar.deleteEvent'), message: t('calendar.deleteEventConfirm'), isDestructive: true });
    if (!approved) return;

    setLoading(true);
    const res = await deleteCalendarEventAction(event.id);
    setLoading(false);

    if (res.success) {
      onClose();
      onSuccess();
    } else {
      setError(res.error || t('common.error'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('calendar.editEvent') : t('calendar.addEvent')}
      description={t('calendar.subtitle')}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('calendar.eventTitle')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t('calendar.eventTitlePlaceholder')}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Type & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('calendar.eventType')}
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="MEETING">{t('calendar.typeMeeting')}</option>
              <option value="FOLLOW_UP">{t('calendar.typeFollowUp')}</option>
              <option value="DUE_DATE">{t('calendar.typeDueDate')}</option>
              <option value="TASK">{t('calendar.typeTask')}</option>
              <option value="EVENT">{t('calendar.typeEvent')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('calendar.location')}
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder={t('calendar.locationPlaceholder')}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Start Date & End Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-brand-500" />
              <span>{t('calendar.startDate')} *</span>
            </label>
            <input
              type="datetime-local"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('calendar.endDate')}</span>
            </label>
            <input
              type="datetime-local"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Linked School & Linked Ticket */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-brand-500" />
              <span>{t('calendar.linkedSchool')}</span>
            </label>
            <select
              value={formData.schoolId}
              onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">{t('calendar.none')}</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Ticket className="w-3.5 h-3.5 text-brand-500" />
              <span>{t('calendar.linkedTicket')}</span>
            </label>
            <select
              value={formData.ticketId}
              onChange={(e) => setFormData({ ...formData, ticketId: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">{t('calendar.none')}</option>
              {tickets.map((tItem) => (
                <option key={tItem.id} value={tItem.id}>
                  {tItem.ticketNumber} - {tItem.subject}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assign To User */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-brand-500" />
            <span>{t('calendar.assignedEmployee')}</span>
          </label>
          <select
            value={formData.assignedToUserId}
            onChange={(e) => setFormData({ ...formData, assignedToUserId: e.target.value })}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">{t('calendar.unassigned')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('calendar.eventDescription')}
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('common.delete')}</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md shadow-brand-500/10 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? t('common.loading') : isEditing ? t('common.update') : t('calendar.addEvent')}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
