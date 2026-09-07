'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { createDepartmentAction, updateDepartmentAction } from '@/server/actions/admin';
import { AlertCircle, UserCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department?: any;
  users?: Array<{ id: string; name: string; email: string }>;
}

export function DepartmentModal({ isOpen, onClose, department, users = [] }: DepartmentModalProps) {
  const { t, language } = useI18n();
  const isEditing = !!department;

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true,
  });
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        code: department.code || '',
        description: department.description || '',
        isActive: department.isActive !== undefined ? department.isActive : true,
      });
      const currentMgrIds = department.managers?.map((m: any) => m.userId || m.user?.id) || [];
      setSelectedManagerIds(currentMgrIds);
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        isActive: true,
      });
      setSelectedManagerIds([]);
    }
    setError(null);
  }, [department, isOpen]);

  const toggleManager = (userId: string) => {
    if (selectedManagerIds.includes(userId)) {
      setSelectedManagerIds(selectedManagerIds.filter((id) => id !== userId));
    } else {
      setSelectedManagerIds([...selectedManagerIds, userId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      description: formData.description.trim() || null,
      isActive: formData.isActive,
    };

    const res = isEditing
      ? await updateDepartmentAction(department.id, payload, selectedManagerIds)
      : await createDepartmentAction(payload, selectedManagerIds);

    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || t('common.error'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('admin.departments.editDept') : t('admin.departments.addDept')}
      description={t('admin.departments.subtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.departments.name')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t('admin.departments.name')}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.departments.code')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder={t('admin.departments.code')}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-mono uppercase focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.departments.description')}
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t('admin.departments.description')}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Multi-Manager Selector */}
        {users.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-brand-500" />
              <span>{t('admin.departments.managers')}</span>
            </label>
            <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1 bg-slate-50/50 dark:bg-slate-800/50">
              {users.map((u) => {
                const isSelected = selectedManagerIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    onClick={() => toggleManager(u.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-950/50 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>{u.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({u.email})</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="dept-active-checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="rounded text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="dept-active-checkbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('admin.departments.activeStatus')}
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : isEditing ? t('admin.departments.updateDept') : t('admin.departments.saveDept')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
