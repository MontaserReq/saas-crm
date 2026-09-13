'use client';

import { useI18n } from '@/lib/i18n/context';
import { formatDate } from '@/lib/utils';
import { Calendar, Clock, Users, ListChecks } from 'lucide-react';

interface ParticipantEntry {
  name: string;
  userId?: string | null;
}

interface ActionItemEntry {
  text: string;
  assigneeId?: string | null;
  done?: boolean;
}

interface MeetingDetailsCardProps {
  meetingDetails: {
    meetingDate: string | Date;
    meetingTime: string;
    participants: string;
    actionItems?: string | null;
  };
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function MeetingDetailsCard({ meetingDetails }: MeetingDetailsCardProps) {
  const { t, language } = useI18n();
  const participants = parseJsonArray<ParticipantEntry>(meetingDetails.participants);
  const actionItems = parseJsonArray<ActionItemEntry>(meetingDetails.actionItems);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <Calendar className="w-5 h-5 text-brand-600" />
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{t('tickets.meetingDetails')}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('tickets.meetingDate')}</span>
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {formatDate(meetingDetails.meetingDate, language)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('tickets.meetingTime')}</span>
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{meetingDetails.meetingTime}</span>
        </div>
      </div>

      <div>
        <span className="text-slate-400 text-xs block mb-1.5 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          <span>{t('tickets.participants')}</span>
        </span>
        {participants.length === 0 ? (
          <span className="text-slate-400 italic text-xs">—</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map((p, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-semibold text-brand-700 dark:text-brand-300"
              >
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {actionItems.length > 0 && (
        <div>
          <span className="text-slate-400 text-xs block mb-1.5 flex items-center gap-1">
            <ListChecks className="w-3.5 h-3.5" />
            <span>{t('tickets.actionItems')}</span>
          </span>
          <ul className="space-y-1.5">
            {actionItems.map((item, idx) => (
              <li
                key={idx}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
