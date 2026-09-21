'use client';

import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { createCalendarEventAction, updateCalendarEventAction, deleteCalendarEventAction } from '@/server/actions/calendar';
import { Modal } from '@/components/ui/Modal';
import { Clock, Building2, Ticket, Users, Trash2, CheckCircle2, Check } from 'lucide-react';
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
  /** Ref to the element that opened this modal; focus is restored there on close. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
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
  returnFocusRef,
}: CalendarEventModalProps) {
  const { t, language } = useI18n();
  const { confirm } = useDialog();
  const isEditing = !!event;

  // Formats date in local timezone for datetime-local input without UTC conversion drift
  const formatDateForInput = (d?: Date | string | null) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
    assigneeIds: [] as string[],
  });

  useEffect(() => {
    if (event) {
      // Resolve existing assignees from relation or legacy field
      const existingAssignees: string[] = [];
      if (Array.isArray(event.assignees) && event.assignees.length > 0) {
        event.assignees.forEach((a: any) => {
          const uid = a.userId || a.user?.id;
          if (uid && !existingAssignees.includes(uid)) existingAssignees.push(uid);
        });
      }
      if (event.userId && !existingAssignees.includes(event.userId)) {
        existingAssignees.push(event.userId);
      }

      setFormData({
        title: event.title || '',
        type: event.type || 'MEETING',
        startDate: formatDateForInput(event.startDate),
        endDate: formatDateForInput(event.endDate),
        description: event.description || '',
        location: event.location || '',
        schoolId: event.schoolId || '',
        ticketId: event.ticketId || '',
        assigneeIds: existingAssignees,
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
        assigneeIds: [],
      });
    }
    setError(null);
  }, [event, initialDate, isOpen]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAssignee = (userId: string) => {
    setFormData((prev) => {
      const exists = prev.assigneeIds.includes(userId);
      return {
        ...prev,
        assigneeIds: exists
          ? prev.assigneeIds.filter((id) => id !== userId)
          : [...prev.assigneeIds, userId],
      };
    });
  };

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

    // Validate End Date >= Start Date
    if (formData.endDate) {
      const start = new Date(formData.startDate).getTime();
      const end = new Date(formData.endDate).getTime();
      if (end < start) {
        setError(
          language === 'ar'
            ? 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء أو مساويًا له.'
            : 'End date must be on or after the start date.'
        );
        return;
      }
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
      assigneeIds: formData.assigneeIds,
      assignedToUserId: formData.assigneeIds[0] || null,
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
    const approved = await confirm({
      title: t('calendar.deleteEvent'),
      message: t('calendar.deleteEventConfirm'),
      isDestructive: true,
    });
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

  // Localized close button label
  const closeLabel = language === 'ar' ? 'إغلاق النافذة' : 'Close dialog';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('calendar.editEvent') : t('calendar.addEvent')}
      description={t('calendar.subtitle')}
      maxWidth="lg"
      returnFocusRef={returnFocusRef}
      closeLabel={closeLabel}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs"
          >
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label
            htmlFor="cal-event-title"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            {t('calendar.eventTitle')} <span className="text-rose-500" aria-hidden="true">*</span>
          </label>
          <input
            id="cal-event-title"
            type="text"
            required
            aria-required="true"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t('calendar.eventTitlePlaceholder')}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Type & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="cal-event-type"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t('calendar.eventType')}
            </label>
            <select
              id="cal-event-type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="MEETING">{t('calendar.MEETING')}</option>
              <option value="CALL">{t('calendar.CALL')}</option>
              <option value="FOLLOW_UP">{t('calendar.FOLLOW_UP')}</option>
              <option value="CONTRACT_SIGNING">{t('calendar.CONTRACT_SIGNING')}</option>
              <option value="APPOINTMENT">{t('calendar.APPOINTMENT')}</option>
              <option value="SCHEDULED_TASK">{t('calendar.SCHEDULED_TASK')}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cal-event-location"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t('calendar.location')}
            </label>
            <input
              id="cal-event-location"
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
            <label
              htmlFor="cal-event-start"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
              <span>{t('calendar.startDate')} <span aria-hidden="true">*</span></span>
            </label>
            <input
              id="cal-event-start"
              type="datetime-local"
              required
              aria-required="true"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label
              htmlFor="cal-event-end"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>{t('calendar.endDate')}</span>
            </label>
            <input
              id="cal-event-end"
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
            <label
              htmlFor="cal-event-school"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
              <span>{t('calendar.linkedSchool')}</span>
            </label>
            <select
              id="cal-event-school"
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
            <label
              htmlFor="cal-event-ticket"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
            >
              <Ticket className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
              <span>{t('calendar.linkedTicket')}</span>
            </label>
            <select
              id="cal-event-ticket"
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

        {/* Multi-Assignee Selection */}
        <div>
          <div
            id="cal-assignees-label"
            className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between"
          >
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
              <span>{t('calendar.assignedEmployees')}</span>
            </span>
            <span className="text-[11px] font-normal text-slate-400" aria-live="polite">
              {formData.assigneeIds.length} {language === 'ar' ? 'مكلفين' : 'selected'}
            </span>
          </div>
          <div
            role="group"
            aria-labelledby="cal-assignees-label"
            className="max-h-36 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-1"
          >
            {users.map((u) => {
              const isSelected = formData.assigneeIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleAssignee(u.id)}
                  aria-pressed={isSelected}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-start ${
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-900 dark:text-brand-200 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-[10px] text-slate-400 ms-1.5">({u.email})</span>
                  </div>
                  {isSelected && (
                    <span
                      className="w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 ms-2"
                      aria-hidden="true"
                    >
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="cal-event-description"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            {t('calendar.eventDescription')}
          </label>
          <textarea
            id="cal-event-description"
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
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{loading ? t('common.loading') : isEditing ? t('common.update') : t('calendar.addEvent')}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
