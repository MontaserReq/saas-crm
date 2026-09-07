'use client';

import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { TicketActionButtons } from '@/components/tickets/TicketActionButtons';
import { RejectedTicketCorrection } from '@/components/tickets/RejectedTicketCorrection';
import { NoteStream } from '@/components/tickets/NoteStream';
import { TimelineView } from '@/components/tickets/TimelineView';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import Link from 'next/link';
import {
  Building2,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  ChevronLeft,
  GraduationCap,
  PhoneCall,
} from 'lucide-react';

interface TicketDetailClientViewProps {
  ticket: any;
  teamMembers: any[];
  departmentsWithUsers: any[];
  currentUser?: any;
}

export function TicketDetailClientView({
  ticket,
  teamMembers,
  departmentsWithUsers,
  currentUser,
}: TicketDetailClientViewProps) {
  const { t, language, getStatusLabel } = useI18n();
  const currentAssignee = ticket.assignees.find((a: any) => a.isCurrent)?.user;
  
  const userAssigneeRecord = currentUser ? ticket.assignees.find((a: any) => a.userId === currentUser.id) : null;
  const isViewer = currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN'
    ? userAssigneeRecord ? (!userAssigneeRecord.isCurrent || userAssigneeRecord.role === 'VIEWER') : true
    : false;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/tickets" className="hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('tickets.title')}</span>
        </Link>
        <span>/</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">{ticket.ticketNumber}</span>
      </div>

      {/* Main Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-brand-700 dark:text-brand-300 font-extrabold text-sm tracking-tight">
                {ticket.ticketNumber}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {ticket.subject}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <GraduationCap className="w-4 h-4 text-brand-600" />
              <span>{ticket.school ? `${ticket.school.name} • ${ticket.school.city}` : 'General Ticket'}{ticket.taskType ? ` • ${ticket.taskType.name}` : ''}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <TicketActionButtons ticket={ticket} teamMembers={teamMembers} />
        </div>

        {/* Rejection notice if status is REJECTED */}
        {ticket.status === 'REJECTED' && ticket.rejectionReason && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-300">
            <span className="font-bold block mb-0.5">{t('tickets.rejectionReason')}:</span>
            <p className="italic">&ldquo;{ticket.rejectionReason}&rdquo;</p>
            {currentUser?.id === ticket.createdById && <RejectedTicketCorrection ticket={ticket} />}
          </div>
        )}
      </div>

      {/* Two Column Grid: Main Content & Metadata Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 spans): School Info, Notes, Communication Attempts */}
        <div className="lg:col-span-2 space-y-8">
          {/* School Contact Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Building2 className="w-5 h-5 text-brand-600" />
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{t('tickets.schoolInfo')}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">{t('schools.schoolName')}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{ticket.school?.name || 'General Ticket'}</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">{t('schools.contactPerson')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {ticket.school?.contactPerson || '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">{t('schools.phone')}</span>
                {ticket.school?.phone ? (
                  <a href={`tel:${ticket.school.phone}`} className="font-semibold text-brand-600 hover:underline flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{ticket.school.phone}</span>
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">{t('schools.whatsapp')}</span>
                {ticket.school?.whatsapp ? (
                  <a
                    href={`https://wa.me/${ticket.school.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{ticket.school.whatsapp}</span>
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">{t('schools.city')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{ticket.school?.city || '—'} {ticket.school?.area ? `(${ticket.school.area})` : ''}</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">{t('schools.email')}</span>
                {ticket.school?.email ? (
                  <a href={`mailto:${ticket.school.email}`} className="font-semibold text-brand-600 hover:underline flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{ticket.school.email}</span>
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
          </div>

          <NoteStream
            ticketId={ticket.id}
            notes={ticket.notes}
            canAddNote={ticket.status !== 'CLOSED' && ticket.status !== 'REJECTED' && !isViewer}
            ticketStatus={ticket.status}
            isViewer={isViewer}
            departments={departmentsWithUsers}
          />

          {/* Communication Attempts Card */}
          {ticket.communicationAttempts.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <PhoneCall className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {t('tickets.contactAttempts')} ({ticket.communicationAttempts.length})
                </h3>
              </div>

              <div className="space-y-3">
                {ticket.communicationAttempts.map((att: any) => (
                  <div key={att.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        #{att.attemptNumber} &bull; {getStatusLabel(att.method)}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDate(att.createdAt, language)}</span>
                    </div>
                    <p className="font-semibold text-brand-600 dark:text-brand-400">{t('tickets.status')}: {getStatusLabel(att.result)}</p>
                    {att.note && <p className="text-slate-600 dark:text-slate-300 italic">&ldquo;{att.note}&rdquo;</p>}
                    <span className="text-[10px] text-slate-400 block pt-1">{att.performedBy.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Ticket Metadata & Timeline */}
        <div className="space-y-6">
          {/* Ticket Metadata Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
              {t('tickets.ticketDetails')}
            </h3>

            <div>
              <span className="text-slate-400 block mb-1">{t('tickets.currentAssignee')}</span>
              {currentAssignee ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40">
                  <div className="w-7 h-7 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
                    {currentAssignee.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">{currentAssignee.name}</span>
                    <span className="text-[10px] text-slate-400">{currentAssignee.email}</span>
                  </div>
                </div>
              ) : (
                <span className="text-slate-400 italic">—</span>
              )}
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">{t('tickets.taskType')}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{ticket.taskType?.name || 'General'}</span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">{t('tickets.department')}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{ticket.department.name}</span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">{t('admin.auditLogs.user')}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{ticket.createdBy.name}</span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">{t('tickets.createdAt')}</span>
              <span className="text-slate-700 dark:text-slate-300">{formatDate(ticket.createdAt, language)}</span>
            </div>

            {ticket.dueDate && (
              <div>
                <span className="text-slate-400 block mb-0.5">{t('tickets.dueDate')}</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">{formatDate(ticket.dueDate, language)}</span>
              </div>
            )}
          </div>

          {/* Timeline and History View */}
          <TimelineView
            activityEvents={ticket.activityEvents as any}
            assignmentHistory={ticket.assignmentHistory as any}
          />
        </div>
      </div>
    </div>
  );
}
