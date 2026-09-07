'use client';

import { useI18n } from '@/lib/i18n/context';
import { formatDate } from '@/lib/utils';
import {
  Activity,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  PhoneCall,
  Sparkles,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string | Date;
  actor: { name: string };
}

interface AssignmentItem {
  id: string;
  action: string;
  reason?: string | null;
  createdAt: string | Date;
  fromUser?: { name: string } | null;
  toUser: { name: string };
  performedBy: { name: string };
}

interface TimelineViewProps {
  activityEvents: ActivityItem[];
  assignmentHistory: AssignmentItem[];
}

type UnifiedTimelineItem =
  | {
      kind: 'activity';
      id: string;
      type: string;
      title: string;
      description?: string | null;
      createdAt: Date;
      actorName: string;
    }
  | {
      kind: 'assignment';
      id: string;
      action: string;
      reason?: string | null;
      createdAt: Date;
      fromUserName?: string;
      toUserName: string;
      performedByName: string;
    };

export function TimelineView({ activityEvents, assignmentHistory }: TimelineViewProps) {
  const { t, language } = useI18n();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return <Clock className="w-3.5 h-3.5 text-brand-500" />;
      case 'SEEN':
        return <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />;
      case 'ACCEPTED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'REJECTED':
        return <XCircle className="w-3.5 h-3.5 text-rose-500" />;
      case 'NOTE_ADDED':
        return <FileText className="w-3.5 h-3.5 text-amber-500" />;
      case 'TRANSFERRED':
        return <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />;
      case 'CLOSED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />;
      case 'COMMUNICATION_ATTEMPT':
        return <PhoneCall className="w-3.5 h-3.5 text-cyan-500" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Convert and combine into a unified chronological array (newest first)
  const unifiedItems: UnifiedTimelineItem[] = [
    ...activityEvents.map((a) => ({
      kind: 'activity' as const,
      id: `act-${a.id}`,
      type: a.type,
      title: a.title,
      description: a.description,
      createdAt: new Date(a.createdAt),
      actorName: a.actor.name,
    })),
    ...assignmentHistory.map((h) => ({
      kind: 'assignment' as const,
      id: `asg-${h.id}`,
      action: h.action,
      reason: h.reason,
      createdAt: new Date(h.createdAt),
      fromUserName: h.fromUser?.name,
      toUserName: h.toUser.name,
      performedByName: h.performedBy.name,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <Activity className="w-4 h-4 text-brand-600" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('activityChanges.title')}</h3>
      </div>

      {/* Stream */}
      {unifiedItems.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400">
          <Sparkles className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
          <span>{t('activityChanges.noActivity')}</span>
        </div>
      ) : (
        <div className="relative pl-6 rtl:pl-0 rtl:pr-6 space-y-4 before:absolute before:left-2.5 rtl:before:left-auto rtl:before:right-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {unifiedItems.map((item) => (
            <div key={item.id} className="relative group">
              {item.kind === 'activity' ? (
                <>
                  <div className="absolute -left-6 rtl:-left-auto rtl:-right-6 top-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
                    {getActivityIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{item.title}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(item.createdAt, language)}</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium block mt-0.5">
                      {t('tickets.byAuthor')} {item.actorName}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute -left-6 rtl:-left-auto rtl:-right-6 top-0.5 w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 border-2 border-indigo-300 dark:border-indigo-700 flex items-center justify-center shadow-xs">
                    <ArrowRightLeft className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="p-3 bg-purple-50/50 dark:bg-slate-800/70 border border-purple-100 dark:border-slate-700/60 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-brand-900 dark:text-brand-200">
                        {item.action === 'INITIAL_ASSIGNMENT'
                          ? t('tickets.initialAssignment')
                          : t('tickets.transferred')}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDate(item.createdAt, language)}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                      {item.fromUserName ? `${item.fromUserName} ➔ ` : ''}
                      <strong className="text-slate-900 dark:text-white">{item.toUserName}</strong>
                    </p>
                    {item.reason && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2 rounded-lg border border-purple-100 dark:border-slate-800">
                        &ldquo;{item.reason}&rdquo;
                      </p>
                    )}
                    <span className="text-[10px] text-slate-400 block">
                      {t('tickets.byAuthor')} {item.performedByName}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
