'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { formatDate } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { useI18n } from '@/lib/i18n/context';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { TicketFormModal } from '@/components/tickets/TicketFormModal';
import { MeetingFormModal } from '@/components/tickets/MeetingFormModal';
import { Search, Ticket, ArrowRight, Plus, Calendar } from 'lucide-react';

interface TicketsClientViewProps {
  user: any;
  ticketsData: {
    data: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  taskTypes: any[];
  schools?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string; email: string; reportsToUserId?: string | null; department?: { name: string } | null }>;
  departments?: Array<{ id: string; name: string }>;
  directManager?: { id: string; name: string; isActive: boolean } | null;
  initialSearch?: string;
  initialStatus?: string;
  initialPriority?: string;
  initialTaskTypeId?: string;
  initialDepartmentId?: string;
  initialAssigneeId?: string;
  isAllTicketsView?: boolean;
}

export function TicketsClientView({
  user,
  ticketsData,
  taskTypes,
  schools = [],
  users = [],
  departments = [],
  directManager,
  initialSearch = '',
  initialStatus = 'ALL',
  initialPriority = 'ALL',
  initialTaskTypeId = 'ALL',
  initialDepartmentId = 'ALL',
  initialAssigneeId = 'ALL',
  isAllTicketsView = false,
}: TicketsClientViewProps) {
  const router = useRouter();
  const { t, language, getStatusLabel, getPriorityLabel } = useI18n();
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);

  const exportColumns = [
    { header: t('tickets.ticketNumber'), accessor: (item: any) => item.ticketNumber },
    { header: t('tickets.school'), accessor: (item: any) => item.school?.name },
    { header: t('tickets.taskType'), accessor: (item: any) => item.taskType?.name },
    { header: t('tickets.status'), accessor: (item: any) => getStatusLabel(item.status) },
    { header: t('tickets.priority'), accessor: (item: any) => getPriorityLabel(item.priority) },
    {
      header: t('tickets.assignedTo'),
      accessor: (item: any) => item.assignees?.[0]?.user?.name || '—',
    },
    { header: t('tickets.createdAt'), accessor: (item: any) => formatDate(item.createdAt, language) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {isAllTicketsView ? t('tickets.allTicketsTitle') : t('tickets.myTicketsTitle')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAllTicketsView ? t('tickets.allTicketsSubtitle') : t('tickets.myTicketsSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportDropdown
            data={ticketsData.data}
            columns={exportColumns}
            filename="tickets_list"
            title={t('tickets.title')}
          />

          <button
            onClick={() => setIsNewMeetingOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-brand-700 dark:text-brand-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/60 transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('tickets.newMeeting')}</span>
          </button>

          <button
            onClick={() => setIsNewTicketOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('tickets.createTicket')}</span>
          </button>

          <span className="text-xs font-semibold px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-brand-700 dark:text-brand-300 border border-purple-200/60 dark:border-purple-800/40">
            {formatNumber(ticketsData.total, language)} {t('tickets.title')}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {isAllTicketsView && <input type="hidden" name="view" value="all" />}
          {/* Search input */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="search"
              defaultValue={initialSearch}
              placeholder={t('tickets.searchPlaceholder')}
              className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              name="status"
              defaultValue={initialStatus}
              className="w-full py-2 px-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">{t('tickets.allStatuses')}</option>
              <option value="PENDING">{getStatusLabel('PENDING')}</option>
              <option value="SEEN">{getStatusLabel('SEEN')}</option>
              <option value="ACCEPTED">{getStatusLabel('ACCEPTED')}</option>
              <option value="IN_PROGRESS">{getStatusLabel('IN_PROGRESS')}</option>
              <option value="TRANSFERRED">{getStatusLabel('TRANSFERRED')}</option>
              <option value="UNREACHABLE">{getStatusLabel('UNREACHABLE')}</option>
              <option value="COMPLETED">{getStatusLabel('COMPLETED')}</option>
              <option value="REJECTED">{getStatusLabel('REJECTED')}</option>
              <option value="CLOSED">{getStatusLabel('CLOSED')}</option>
            </select>
          </div>

          {isAllTicketsView && (
            <>
              <div>
                <select name="assigneeId" defaultValue={initialAssigneeId} className="w-full py-2 px-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500">
                  <option value="ALL">{t('tickets.filterAssignee')}: {t('tickets.all')}</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <select name="departmentId" defaultValue={initialDepartmentId} className="w-full py-2 px-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500">
                  <option value="ALL">{t('tickets.filterDepartment')}: {t('tickets.all')}</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Priority Filter */}
          <div>
            <select
              name="priority"
              defaultValue={initialPriority}
              className="w-full py-2 px-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">{t('tickets.allPriorities')}</option>
              <option value="URGENT">{getStatusLabel('URGENT')}</option>
              <option value="HIGH">{getStatusLabel('HIGH')}</option>
              <option value="MEDIUM">{getStatusLabel('MEDIUM')}</option>
              <option value="LOW">{getStatusLabel('LOW')}</option>
            </select>
          </div>

          <div>
            <select name="taskTypeId" defaultValue={initialTaskTypeId} className="w-full py-2 px-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500">
              <option value="ALL">{t('tickets.filterTaskType')}: {t('tickets.all')}</option>
              {taskTypes.map((taskType) => <option key={taskType.id} value={taskType.id}>{taskType.name}</option>)}
            </select>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="w-full py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-sm"
            >
              {t('common.filter')}
            </button>
            <Link
              href={isAllTicketsView ? '/tickets?view=all' : '/tickets'}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.reset')}
            </Link>
          </div>
        </form>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {ticketsData.data.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Ticket className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold">{t('tickets.noTicketsFound')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right border-collapse text-xs">
              <thead>
                <tr className="hidden md:table-row bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">{t('tickets.ticketNumber')}</th>
                  <th className="py-3 px-4">{t('tickets.school')}</th>
                  <th className="py-3 px-4">{t('tickets.taskType')}</th>
                  <th className="py-3 px-4">{t('tickets.status')}</th>
                  <th className="py-3 px-4">{t('tickets.priority')}</th>
                  <th className="py-3 px-4">{t('tickets.assignedTo')}</th>
                  <th className="py-3 px-4">{t('tickets.createdAt')}</th>
                  <th className="py-3 px-4 text-center">{t('tickets.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {ticketsData.data.map((tItem) => {
                  const currentAssignee = tItem.assignees?.[0]?.user;
                  const rowProps = {
                    onClick: () => router.push(`/tickets/${tItem.id}`),
                    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') router.push(`/tickets/${tItem.id}`); },
                    tabIndex: 0,
                  };
                  return (
                    <React.Fragment key={tItem.id}>
                      {/* Desktop row */}
                      <tr
                        {...rowProps}
                        className="hidden md:table-row cursor-pointer border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 focus:bg-brand-50/50 dark:focus:bg-brand-950/30 focus:outline-none transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                          <Link href={`/tickets/${tItem.id}`} className="hover:underline">
                            {tItem.ticketNumber}
                          </Link>
                          {tItem.meetingDetails && (
                            <span className="ms-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-brand-700 dark:text-brand-300 text-[10px] font-bold align-middle">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>{t('tickets.meetingBadge')}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block truncate max-w-[200px]">
                            {tItem.school?.name || 'General Ticket'}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {tItem.school ? `${tItem.school.city} ${tItem.school.contactPerson ? `• ${tItem.school.contactPerson}` : ''}` : 'No school linked'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {tItem.taskType?.name || 'General'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <TicketStatusBadge status={tItem.status} />
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <PriorityBadge priority={tItem.priority} />
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {currentAssignee ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-bold text-[10px] flex items-center justify-center">
                                {currentAssignee.name.charAt(0)}
                              </div>
                              <span className="text-slate-800 dark:text-slate-200 font-medium">
                                {currentAssignee.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDate(tItem.createdAt, language)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <Link
                            href={`/tickets/${tItem.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                          >
                            <span>{t('tickets.open')}</span>
                            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                          </Link>
                        </td>
                      </tr>

                      {/* Mobile card */}
                      <tr className="md:hidden border-b border-slate-100 dark:border-slate-800">
                        <td colSpan={8} className="p-0">
                          <div
                            {...rowProps}
                            className="cursor-pointer p-4 space-y-2.5 active:bg-slate-50 dark:active:bg-slate-800/40"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <Link href={`/tickets/${tItem.id}`} className="font-bold text-brand-600 dark:text-brand-400 text-sm hover:underline">
                                  {tItem.ticketNumber}
                                </Link>
                                {tItem.meetingDetails && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-brand-700 dark:text-brand-300 text-[10px] font-bold">
                                    <Calendar className="w-2.5 h-2.5" />
                                    <span>{t('tickets.meetingBadge')}</span>
                                  </span>
                                )}
                              </span>
                              <TicketStatusBadge status={tItem.status} />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                                {tItem.school?.name || 'General Ticket'}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {tItem.taskType?.name || 'General'}
                                {tItem.school ? ` • ${tItem.school.city}${tItem.school.contactPerson ? ` • ${tItem.school.contactPerson}` : ''}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <PriorityBadge priority={tItem.priority} />
                              <span className="text-slate-400">{formatDate(tItem.createdAt, language)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              {currentAssignee ? (
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 shrink-0 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-bold text-[10px] flex items-center justify-center">
                                    {currentAssignee.name.charAt(0)}
                                  </div>
                                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{currentAssignee.name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">—</span>
                              )}
                              <Link
                                href={`/tickets/${tItem.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0"
                              >
                                <span>{t('tickets.open')}</span>
                                <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {ticketsData.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {t('common.page')} {ticketsData.page} {t('common.of')} {ticketsData.totalPages}
            </span>
            <div className="flex items-center gap-2">
              {ticketsData.page > 1 && (
                <Link
                  href={`/tickets?page=${ticketsData.page - 1}&search=${encodeURIComponent(
                    initialSearch
                  )}&status=${initialStatus}&priority=${initialPriority}&taskTypeId=${initialTaskTypeId}&departmentId=${initialDepartmentId}&assigneeId=${initialAssigneeId}${isAllTicketsView ? '&view=all' : ''}`}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 font-semibold"
                >
                  {t('common.previous')}
                </Link>
              )}
              {ticketsData.page < ticketsData.totalPages && (
                <Link
                  href={`/tickets?page=${ticketsData.page + 1}&search=${encodeURIComponent(
                    initialSearch
                  )}&status=${initialStatus}&priority=${initialPriority}&taskTypeId=${initialTaskTypeId}&departmentId=${initialDepartmentId}&assigneeId=${initialAssigneeId}${isAllTicketsView ? '&view=all' : ''}`}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 font-semibold"
                >
                  {t('common.next')}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Global New Ticket Modal */}
      {isNewTicketOpen && (
        <TicketFormModal
          isOpen={isNewTicketOpen}
          onClose={() => setIsNewTicketOpen(false)}
          schools={schools}
          taskTypes={taskTypes}
          users={users}
          canAssign={user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'SCHOOL_MANAGER'}
          directManager={directManager}
        />
      )}

      {/* Global New Meeting Modal */}
      {isNewMeetingOpen && (
        <MeetingFormModal
          isOpen={isNewMeetingOpen}
          onClose={() => setIsNewMeetingOpen(false)}
          schools={schools}
          taskTypes={taskTypes}
          users={users}
          directManager={directManager}
        />
      )}
    </div>
  );
}
