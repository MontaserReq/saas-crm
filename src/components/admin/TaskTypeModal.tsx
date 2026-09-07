'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { createTaskTypeAction, updateTaskTypeAction } from '@/server/actions/admin';
import { AlertCircle, Plus, Trash2, Users } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

interface DepartmentOption {
  id: string;
  name: string;
  users: Array<{ id: string; name: string; email: string }>;
}

interface TaskTypeMemberInput {
  userId: string;
  responsibility: string;
  user?: { id: string; name: string; email: string };
}

interface TaskTypeInput {
  id: string;
  name: string;
  departmentId: string;
  description?: string | null;
  isActive: boolean;
  members?: TaskTypeMemberInput[];
}

interface TaskTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskType?: TaskTypeInput | null;
  departments: DepartmentOption[];
}

type Member = { userId: string; responsibility: string };

export function TaskTypeModal({ isOpen, onClose, taskType, departments }: TaskTypeModalProps) {
  const { t } = useI18n();
  const isEditing = !!taskType;

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [newUserId, setNewUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const department = useMemo(
    () => departments.find((item) => item.id === departmentId) || null,
    [departments, departmentId]
  );

  const availableUsers = useMemo(
    () =>
      (department?.users || []).filter(
        (item) => !members.some((member) => member.userId === item.id)
      ),
    [department, members]
  );

  // Reset / hydrate form whenever the modal opens or the editing target changes.
  useEffect(() => {
    if (!isOpen) return;
    setName(taskType?.name || '');
    setDepartmentId(taskType?.departmentId || '');
    setMembers(
      (taskType?.members || []).map((member) => ({
        userId: member.userId,
        responsibility: member.responsibility || '',
      }))
    );
    setDescription(taskType?.description || '');
    setIsActive(taskType?.isActive !== undefined ? taskType.isActive : true);
    setNewUserId('');
    setError(null);
  }, [taskType, isOpen]);

  const changeDepartment = (value: string) => {
    setDepartmentId(value);
    setMembers([]);
    setNewUserId('');
    setError(null);
  };

  const addMember = () => {
    if (!newUserId) return;
    if (members.some((member) => member.userId === newUserId)) {
      setNewUserId('');
      return;
    }
    setMembers((current) => [...current, { userId: newUserId, responsibility: '' }]);
    setNewUserId('');
  };

  const updateMember = (userId: string, responsibility: string) =>
    setMembers((current) =>
      current.map((member) => (member.userId === userId ? { ...member, responsibility } : member))
    );

  const removeMember = (userId: string) =>
    setMembers((current) => current.filter((member) => member.userId !== userId));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      departmentId,
      members,
      description: description.trim() || null,
      isActive,
    };

    const result = isEditing
      ? await updateTaskTypeAction(taskType!.id, payload)
      : await createTaskTypeAction(payload);

    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || t('common.error'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('admin.taskTypes.editType') : t('admin.taskTypes.addType')}
      description={t('admin.taskTypes.subtitle')}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Task Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.taskTypes.name')} <span className="text-rose-500">*</span>
          </label>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('admin.taskTypes.name')}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* 2. Department Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.taskTypes.department')} <span className="text-rose-500">*</span>
          </label>
          <select
            required
            value={departmentId}
            onChange={(event) => changeDepartment(event.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">{t('admin.taskTypes.selectDepartment')}</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Team Members Section */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              {t('admin.taskTypes.teamMembers')}
            </h3>
            <span className="text-xs font-semibold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {members.length}
            </span>
          </div>

          {!departmentId ? (
            <p className="text-xs text-slate-500 italic">{t('admin.taskTypes.selectDepartment')}</p>
          ) : (
            <div className="flex gap-2">
              <select
                value={newUserId}
                onChange={(event) => setNewUserId(event.target.value)}
                disabled={availableUsers.length === 0}
                className="flex-1 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">{t('admin.taskTypes.selectEmployee')}</option>
                {availableUsers.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addMember}
                disabled={!newUserId}
                className="px-3 rounded-lg bg-brand-600 text-white disabled:opacity-50 hover:bg-brand-700 transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.taskTypes.addMember')}</span>
              </button>
            </div>
          )}

          {departmentId && members.length === 0 && (
            <p className="text-xs text-slate-500 italic">{t('admin.taskTypes.noMembers')}</p>
          )}

          {/* 4. Selected Members with individual responsibilities */}
          <div className="space-y-2">
            {members.map((member) => {
              const employee = department?.users.find((item) => item.id === member.userId);
              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800"
                >
                  <span
                    className="w-32 shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate"
                    title={employee?.name}
                  >
                    {employee?.name || member.userId}
                  </span>
                  <input
                    required
                    value={member.responsibility}
                    onChange={(event) => updateMember(member.userId, event.target.value)}
                    placeholder={t('admin.taskTypes.responsibility')}
                    className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeMember(member.userId)}
                    className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                    title={t('admin.taskTypes.removeMember')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.taskTypes.description')}
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Active Status */}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="rounded text-brand-600"
          />
          {t('admin.taskTypes.activeStatus')}
        </label>

        {/* Actions */}
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
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? t('common.loading')
              : isEditing
              ? t('admin.taskTypes.updateType')
              : t('admin.taskTypes.saveType')}
          </button>
        </div>
      </form>
    </Modal>
  );
}