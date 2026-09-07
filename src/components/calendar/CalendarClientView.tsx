'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { CalendarEventModal } from './CalendarEventModal';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Building2,
  Ticket,
  User,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CalendarClientViewProps {
  events: any[];
  schools: Array<{ id: string; name: string }>;
  tickets: Array<{ id: string; ticketNumber: string; subject: string }>;
  users: Array<{ id: string; name: string; email: string }>;
}

export function CalendarClientView({
  events,
  schools,
  tickets,
  users,
}: CalendarClientViewProps) {
  const { t, language } = useI18n();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week index for day 1 (0: Sunday, 1: Monday, ...)
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesAr = [
    'كانون الثاني (يناير)', 'شباط (فبراير)', 'آذار (مارس)', 'نيسان (أبريل)',
    'أيار (مايو)', 'حزيران (يونيو)', 'تموز (يوليو)', 'آب (أغسطس)',
    'أيلول (سبتمبر)', 'تشرين الأول (أكتوبر)', 'تشرين الثاني (نوفمبر)', 'كانون الأول (ديسمبر)'
  ];

  const currentMonthName = language === 'ar' ? monthNamesAr[month] : monthNamesEn[month];

  const daysOfWeekEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysOfWeekAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const daysOfWeek = language === 'ar' ? daysOfWeekAr : daysOfWeekEn;

  // Filter events
  const filteredEvents = events.filter((e) => {
    if (selectedType === 'ALL') return true;
    return e.type === selectedType;
  });

  const getEventsForDay = (day: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEvents.filter((e) => {
      const eDate = new Date(e.startDate);
      const eStr = `${eDate.getFullYear()}-${String(eDate.getMonth() + 1).padStart(2, '0')}-${String(eDate.getDate()).padStart(2, '0')}`;
      return eStr === dStr;
    });
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'MEETING':
        return 'bg-purple-100 dark:bg-purple-950/80 text-brand-700 dark:text-brand-300 border-purple-200 dark:border-purple-800';
      case 'FOLLOW_UP':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'DUE_DATE':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'TASK':
        return 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'EVENT':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  // Generate calendar grid slots
  const calendarCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand-600" />
            <span>{t('calendar.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('calendar.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter by Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="py-2 px-3 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
          >
            <option value="ALL">{t('calendar.allTypes')}</option>
            <option value="MEETING">{t('calendar.MEETING')}</option>
            <option value="FOLLOW_UP">{t('calendar.FOLLOW_UP')}</option>
            <option value="DUE_DATE">{t('calendar.DUE_DATE')}</option>
            <option value="TASK">{t('calendar.TASK')}</option>
            <option value="EVENT">{t('calendar.EVENT')}</option>
          </select>

          <button
            onClick={() => {
              setSelectedEvent(null);
              setModalInitialDate(new Date());
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('calendar.addEvent')}</span>
          </button>
        </div>
      </div>

      {/* Calendar Controls & Month Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180 text-slate-700 dark:text-slate-300" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180 text-slate-700 dark:text-slate-300" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-brand-700 dark:text-brand-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"
          >
            {t('calendar.today')}
          </button>
        </div>

        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
          {currentMonthName} {year}
        </h3>

        <div className="text-xs text-slate-400 font-medium">
          {filteredEvents.length} {t('calendar.title')}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center text-xs font-bold text-slate-600 dark:text-slate-400 py-3">
          {daysOfWeek.map((dow, idx) => (
            <div key={idx}>{dow}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800 rtl:divide-x-reverse min-h-[520px]">
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return (
                <div key={idx} className="bg-slate-50/50 dark:bg-slate-900/40 p-2 min-h-[90px]" />
              );
            }

            const dayEvents = getEventsForDay(day);
            const today = isToday(day);

            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedEvent(null);
                  setModalInitialDate(new Date(year, month, day, 10, 0));
                  setIsModalOpen(true);
                }}
                className={`p-2 min-h-[95px] flex flex-col justify-between transition-colors cursor-pointer hover:bg-purple-50/30 dark:hover:bg-purple-950/20 ${
                  today ? 'bg-purple-50/50 dark:bg-purple-950/30' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      today
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[80px]">
                  {dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(evt);
                        setIsModalOpen(true);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold truncate border ${getEventBadgeColor(
                        evt.type
                      )} shadow-2xs hover:opacity-90`}
                      title={`${evt.title} (${new Date(evt.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                    >
                      {evt.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar Event Modal */}
      {isModalOpen && (
        <CalendarEventModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          schools={schools}
          tickets={tickets}
          users={users}
          initialDate={modalInitialDate}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
