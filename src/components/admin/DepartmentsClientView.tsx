'use client';

import { useState } from 'react';
import { DepartmentModal } from './DepartmentModal';
import { AdminPasswordConfirmModal } from './AdminPasswordConfirmModal';
import { deleteDepartmentAction, toggleDepartmentStatusAction } from '@/server/actions/admin';
import { useI18n } from '@/lib/i18n/context';
import {
  Building2,
  Plus,
  Users,
  Ticket,
  Edit2,
  Trash2,
  Power,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  UserCheck,
} from 'lucide-react';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string | Date;
  managers?: Array<{
    user: { id: string; name: string; email: string };
  }>;
  _count: {
    users: number;
    tickets: number;
  };
}

interface DepartmentsClientViewProps {
  departments: DepartmentItem[];
  users?: Array<{ id: string; name: string; email: string; department?: { name: string } | null }>;
}

export function DepartmentsClientView({ departments, users = [] }: DepartmentsClientViewProps) {
  const { t, language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const [deletingDept, setDeletingDept] = useState<DepartmentItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const filteredDepartments = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(search.toLowerCase()))
  );

  const totalMembers = departments.reduce((acc, d) => acc + (d._count?.users || 0), 0);
  const totalTickets = departments.reduce((acc, d) => acc + (d._count?.tickets || 0), 0);
  const activeCount = departments.filter((d) => d.isActive).length;

  const handleDeleteConfirm = async () => {
    if (!deletingDept) return;
    setActionLoading(deletingDept.id);
    const res = await deleteDepartmentAction(deletingDept.id);
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
    const res = await toggleDepartmentStatusAction(id);
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
    { header: t('admin.departments.code'), accessor: (d: any) => d.code },
    { header: t('admin.departments.name'), accessor: (d: any) => d.name },
    { header: t('admin.departments.description'), accessor: (d: any) => d.description || '' },
    { header: t('admin.departments.membersCount'), accessor: (d: any) => d._count?.users || 0 },
    { header: t('admin.departments.ticketsCount'), accessor: (d: any) => d._count?.tickets || 0 },
    { header: t('admin.departments.status'), accessor: (d: any) => (d.isActive ? t('admin.departments.active') : t('admin.departments.inactive')) },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('admin.departments.title')}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-brand-700 dark:text-brand-300 text-xs font-extrabold border border-purple-200 dark:border-purple-800">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('admin.departments.description')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filename="departments"
            title={t('admin.departments.title')}
            data={departments}
            columns={exportColumns}
          />
          <button
            onClick={() => {
              setEditingDept(null);
              setIsOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('admin.departments.addDepartment')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.departments.totalDepts')}</span>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100">{departments.length}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.departments.activeUnits')}</span>
          <span className="text-xl font-black text-emerald-600">{activeCount}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.departments.totalMembers')}</span>
          <span className="text-xl font-black text-brand-600">{totalMembers}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('admin.departments.totalTickets')}</span>
          <span className="text-xl font-black text-indigo-600">{totalTickets}</span>
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
            ×
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
            placeholder={t('admin.departments.searchPlaceholder')}
            className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredDepartments.map((dept) => (
          <div
            key={dept.id}
            className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-3 transition-all ${
              dept.isActive
                ? 'border-slate-200 dark:border-slate-800 hover:shadow-md'
                : 'border-slate-200/50 dark:border-slate-800/50 opacity-70 bg-slate-50/50 dark:bg-slate-900/50'
            }`}
          >
            {/* Header / Code & Status */}
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center font-extrabold text-xs font-mono">
                {dept.code}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    dept.isActive
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                  }`}
                >
                  {dept.isActive ? t('admin.departments.active') : t('admin.departments.inactive')}
                </span>
              </div>
            </div>

            {/* Name & Description */}
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{dept.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                {dept.description || '—'}
              </p>
            </div>

            {/* Managers */}
            {dept.managers && dept.managers.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  <UserCheck className="w-3 h-3 text-brand-500" />
                  <span>{t('admin.departments.managers')}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {dept.managers.map((m) => (
                    <span
                      key={m.user.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-brand-700 dark:text-brand-300 text-[10px] font-semibold"
                    >
                      {m.user.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Headcount and Tickets */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{dept._count?.users || 0} {t('admin.departments.members')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-slate-400" />
                <span>{dept._count?.tickets || 0} {t('admin.departments.tickets')}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleToggleStatus(dept.id)}
                disabled={actionLoading === dept.id}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  dept.isActive
                    ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
                title={dept.isActive ? t('admin.departments.deactivate') : t('admin.departments.activate')}
              >
                <Power className="w-3 h-3" />
                <span>{dept.isActive ? t('admin.departments.deactivate') : t('admin.departments.activate')}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDept(dept);
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
                    setDeletingDept(dept);
                    setIsDeleteOpen(true);
                  }}
                  disabled={actionLoading === dept.id}
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

      {filteredDepartments.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Building2 className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('admin.departments.noDeptsFound')}</p>
        </div>
      )}

      {/* Modal */}
      <DepartmentModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setEditingDept(null);
        }}
        department={editingDept}
        users={users}
      />

      {/* Admin Password Confirm Modal for Department Deletion */}
      <AdminPasswordConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingDept(null);
        }}
        title={t('admin.departments.confirmDeleteTitle', { name: deletingDept?.name || '' })}
        itemDescription={t('admin.departments.confirmDeleteDesc', {
          name: deletingDept?.name || '',
          code: deletingDept?.code || '',
        })}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
