'use client';

import { useState } from 'react';
import { TaskTypeModal } from './TaskTypeModal';
import { AdminPasswordConfirmModal } from './AdminPasswordConfirmModal';
import { deleteTaskTypeAction, toggleTaskTypeStatusAction } from '@/server/actions/admin';
import { useI18n } from '@/lib/i18n/context';
import {
  ListTodo,
  Plus,
  Ticket,
  Edit2,
  Trash2,
  Power,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

interface TaskTypeMember {
  userId: string;
  responsibility: string;
  user?: { id: string; name: string; email: string };
}

interface TaskTypeItem {
  id: string;
  name: string;
  departmentId: string;
  department?: { id: string; name: string; code?: string };
  description?: string | null;
  isActive: boolean;
  createdAt: string | Date;
  members?: TaskTypeMember[];
  _count: {
    tickets: number;
  };
}

interface TaskTypesClientViewProps {
  taskTypes: TaskTypeItem[];
  departments: Array<{ id: string; name: string; users: Array<{ id: string; name: string; email: string }> }>;
}

export function TaskTypesClientView({ taskTypes, departments }: TaskTypesClientViewProps) {
  const { t, language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [editingType, setEditingType] = useState<TaskTypeItem | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const [deletingType, setDeletingType] = useState<TaskTypeItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const filteredTaskTypes = taskTypes.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
  );

  const totalGeneratedTickets = taskTypes.reduce((acc, item) => acc + (item._count?.tickets || 0), 0);
  const activeCount = taskTypes.filter((item) => item.isActive).length;

  const handleDeleteConfirm = async () => {
    if (!deletingType) return;
    setActionLoading(deletingType.id);
    const res = await deleteTaskTypeAction(deletingType.id);
    setActionLoading(null);

    if (res.success) {
      setFeedback({
        type: res.deactivated ? 'info' : 'success',
        message: res.message || (res.deactivated ? t('common.success') : t('common.success')),
      });
    } else {
      throw new Error(res.error || t('common.error'));
    }
  };

  const handleToggleStatus = async (id: string) => {
    setActionLoading(id);
    setFeedback(null);
    const res = await toggleTaskTypeStatusAction(id);
    setActionLoading(null);

    if (res.success) {
      setFeedback({
        type: 'success',
        message: t('common.success'),
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || t('common.error'),
      });
    }
  };

  const exportColumns = [
    { header: t('admin.taskTypes.department'), accessor: (item: any) => item.department?.name || '' },
    { header: t('admin.taskTypes.name'), accessor: (item: any) => item.name },
    { header: t('admin.taskTypes.description'), accessor: (item: any) => item.description || '' },
    { header: t('admin.taskTypes.ticketsCount'), accessor: (item: any) => item._count?.tickets || 0 },
    { header: t('admin.taskTypes.status'), accessor: (item: any) => (item.isActive ? t('admin.taskTypes.active') : t('admin.taskTypes.inactive')) },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('admin.taskTypes.title')}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-brand-700 dark:text-brand-300 text-xs font-extrabold border border-purple-200 dark:border-purple-800">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('admin.taskTypes.description')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filename="task-types"
            title={t('admin.taskTypes.title')}
            data={taskTypes}
            columns={exportColumns}
          />
          <button
            onClick={() => {
              setEditingType(null);
              setIsOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('admin.taskTypes.addTaskType')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.taskTypes.totalTaskTypes')}</span>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100">{taskTypes.length}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.taskTypes.activeCategories')}</span>
          <span className="text-xl font-black text-emerald-600">{activeCount}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.taskTypes.totalTicketsGenerated')}</span>
          <span className="text-xl font-black text-brand-600">{totalGeneratedTickets}</span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : feedback.type === 'info'
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-brand-800 dark:text-brand-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
            {feedback.type === 'info' && <Info className="w-4 h-4 shrink-0 text-brand-600" />}
            {feedback.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            Ã—
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.taskTypes.searchPlaceholder')}
            className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Task Types Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredTaskTypes.map((type) => (
          <div
            key={type.id}
            className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-3 transition-all ${
              type.isActive
                ? 'border-slate-200 dark:border-slate-800 hover:shadow-md'
                : 'border-slate-200/50 dark:border-slate-800/50 opacity-70 bg-slate-50/50 dark:bg-slate-900/50'
            }`}
          >
            {/* Header / Code & Status */}
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <ListTodo className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {type.department?.name || ''}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    type.isActive
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                  }`}
                >
                  {type.isActive ? t('admin.taskTypes.active') : t('admin.taskTypes.inactive')}
                </span>
              </div>
            </div>

            {/* Name & Description */}
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{type.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                {type.description || 'â€”'}
              </p>
            </div>

            {/* Linked Tickets Count */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1 font-semibold text-brand-600 dark:text-brand-400">
                <Ticket className="w-3.5 h-3.5" />
                <span>{type._count?.tickets || 0} {t('admin.taskTypes.totalTicketsGenerated')}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleToggleStatus(type.id)}
                disabled={actionLoading === type.id}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  type.isActive
                    ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
                title={type.isActive ? t('admin.taskTypes.deactivate') : t('admin.taskTypes.activate')}
              >
                <Power className="w-3 h-3" />
                <span>{type.isActive ? t('admin.taskTypes.deactivate') : t('admin.taskTypes.activate')}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingType(type);
                    setIsOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title={t('common.edit')}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeletingType(type);
                    setIsDeleteOpen(true);
                  }}
                  disabled={actionLoading === type.id}
                  className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-colors"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTaskTypes.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <ListTodo className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('admin.taskTypes.noTaskTypesFound')}</p>
        </div>
      )}

      {/* Modal */}
      <TaskTypeModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setEditingType(null);
        }}
        taskType={editingType}
        departments={departments}
      />

      {/* Admin Password Confirm Modal for Task Type Deletion */}
      <AdminPasswordConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingType(null);
        }}
        title={t('admin.taskTypes.confirmDeleteTitle', { name: deletingType?.name || '' })}
        itemDescription={t('admin.taskTypes.confirmDeleteDesc', {
          name: deletingType?.name || '',
        })}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
