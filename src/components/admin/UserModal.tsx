'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { createUserAction, getUserForEditAction, updateUserAction } from '@/server/actions/users';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  user?: any;
  roles: any[];
  departments: any[];
  users: any[];
  permissions: any[];
}

function createBlankFormData(editing: boolean, firstRoleId = '', firstDepartmentId = '') {
  return {
    name: '', email: '', phone: '', password: '',
    roleId: editing ? '' : firstRoleId,
    departmentId: editing ? '' : firstDepartmentId,
    isActive: true, accessMode: 'ANY_IP', allowedIps: [] as string[], reportsToUserId: '',
  };
}

export function UserModal({ isOpen, onClose, onSaved, user, roles, departments, users, permissions }: UserModalProps) {
  const { t } = useI18n();
  const isEditing = !!user;

  const [formData, setFormData] = useState(() => createBlankFormData(isEditing, roles[0]?.id || '', departments[0]?.id || ''));
  const [directPermissionIds, setDirectPermissionIds] = useState<string[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(isEditing ? null : null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!user?.id) {
      setFormData(createBlankFormData(false, roles[0]?.id || '', departments[0]?.id || ''));
      setDirectPermissionIds([]);
      setLoadedUserId(null);
      setError(null);
      setLoading(false);
      return;
    }

    const targetUserId = user.id;
    let cancelled = false;
    setFormData(createBlankFormData(true));
    setDirectPermissionIds([]);
    setLoadedUserId(null);
    setError(null);
    setLoading(true);

    getUserForEditAction(targetUserId).then((result) => {
      if (cancelled) return;
      if (!result.success || !result.user) {
        setError(result.error || t('common.error'));
        return;
      }
      const loaded = result.user;
      let allowedIps: string[] = [];
      try { allowedIps = loaded.allowedIps ? JSON.parse(loaded.allowedIps) : []; } catch { allowedIps = []; }
      setFormData({
        name: loaded.name || '', email: loaded.email || '', phone: loaded.phone || '', password: '',
        roleId: loaded.roleId || '', departmentId: loaded.departmentId || '', isActive: loaded.isActive,
        accessMode: loaded.accessMode || 'ANY_IP', allowedIps, reportsToUserId: loaded.reportsToUserId || '',
      });
      setDirectPermissionIds((loaded.userPermissions || []).map((permission: any) => permission.permissionId));
      setLoadedUserId(loaded.id);
    }).catch(() => {
      if (!cancelled) setError(t('common.error'));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [isOpen, user?.id, t, roles, departments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = isEditing
      ? await updateUserAction(user.id, { ...formData, directPermissionIds })
      : await createUserAction(formData);

    setLoading(false);

    if (res.success) {
      onClose();
      onSaved?.();
    } else {
      setError(res.error || t('common.error'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('admin.users.editMember') : t('admin.users.addMember')}
      description={t('admin.users.subtitle')}
    >
      {isEditing && loadedUserId !== user?.id ? (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-10 w-full rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-10 w-full rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <p className="text-xs text-slate-500">{error || t('common.loading')}</p>
        </div>
      ) : <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.users.fullName')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reports To / المسؤول المباشر</label>
          <select value={formData.reportsToUserId} onChange={(e) => setFormData({ ...formData, reportsToUserId: e.target.value })} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none">
            <option value="">No direct manager / لا يوجد مسؤول مباشر</option>
            {users.filter((candidate) => candidate.id !== user?.id && (candidate.isActive !== false || candidate.id === formData.reportsToUserId)).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.department?.name ? ` (${candidate.department.name})` : ''}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 mt-1">Managed independently from roles and permissions.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.users.email')} <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('admin.users.phone')}
          </label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {isEditing ? t('admin.users.passwordOptional') : `${t('admin.users.password')} *`}
          </label>
          <input
            type="password"
            required={!isEditing}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="••••••••"
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('admin.users.role')} <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName || r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('admin.users.department')} <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isEditing && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('admin.users.directPermissions')}</div>
            <div className="max-h-56 overflow-y-auto space-y-3 text-start">
              {Object.entries(permissions.reduce((groups: Record<string, any[]>, permission: any) => { (groups[permission.module] ||= []).push(permission); return groups; }, {})).map(([module, group]) => (
                <fieldset key={module} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <legend className="px-1 text-xs font-bold capitalize">{module.replace('_', ' ')}</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {group.map((permission: any) => <label key={permission.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={directPermissionIds.includes(permission.id)} onChange={(event) => setDirectPermissionIds((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} /> <span>{permission.name} <code className="text-[10px] text-slate-400">{permission.code}</code></span></label>)}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        )}

        {isEditing && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="user-active-checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="user-active-checkbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('admin.users.activeStatus')} ({t('admin.users.active')})
            </label>
          </div>
        )}

        {isEditing && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('common.securityAccess')}</div>
            <select value={formData.accessMode} onChange={e => setFormData({ ...formData, accessMode: e.target.value, allowedIps: e.target.value === 'ANY_IP' ? [] : formData.allowedIps })} className="w-full p-2.5 rounded-lg border bg-white dark:bg-slate-800 text-sm">
              <option value="ANY_IP">{t('common.all')}</option><option value="RESTRICTED_IPS">{t('common.restrictedIps')}</option>
            </select>
            {formData.accessMode === 'RESTRICTED_IPS' && <textarea value={formData.allowedIps.join('\n')} onChange={e => setFormData({ ...formData, allowedIps: e.target.value.split(/[,\n]/).map(x => x.trim()).filter(Boolean) })} placeholder={t('common.oneIpPerLine')} rows={3} className="w-full p-2.5 rounded-lg border bg-white dark:bg-slate-800 text-sm" />}
            <p className="text-[11px] text-slate-500">{t('common.accessRestrictionsHint')}</p>
          </div>
        )}

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
            {loading ? t('common.loading') : isEditing ? t('admin.users.updateUser') : t('admin.users.saveUser')}
          </button>
        </div>
      </form>}
    </Modal>
  );
}
