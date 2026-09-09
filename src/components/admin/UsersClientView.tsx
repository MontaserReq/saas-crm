'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserModal } from './UserModal';
import { OffboardingModal } from './OffboardingModal';
import { AdminPasswordConfirmModal } from './AdminPasswordConfirmModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, Check, X, ArrowRightLeft, Trash2, Edit2, Shield, UserX } from 'lucide-react';
import { LoginSessionsModal } from './LoginSessionsModal';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { deleteUserAction, disableUserAction, enableUserAction } from '@/server/actions/users';
import { updateUserPermissionsAction } from '@/server/actions/admin';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

interface UsersClientViewProps {
  users: any[];
  roles: any[];
  departments: any[];
  permissions: any[];
}

export function UsersClientView({ users, roles, departments, permissions }: UsersClientViewProps) {
  const { t, language } = useI18n();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const [offboardingUser, setOffboardingUser] = useState<any | null>(null);
  const [isOffboardingOpen, setIsOffboardingOpen] = useState(false);

  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [securityUser, setSecurityUser] = useState<any | null>(null);
  const [disablingUser, setDisablingUser] = useState<any | null>(null);
  const [enablingUser, setEnablingUser] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<any | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    const res = await deleteUserAction(deletingUser.id);
    if (!res.success) {
      throw new Error(res.error || 'Failed to delete user');
    }
  };

  const handleDisableConfirm = async () => {
    if (!disablingUser) return;
    const res = await disableUserAction(disablingUser.id);
    if (!res.success) throw new Error(res.error || (language === 'ar' ? 'فشل تعطيل الحساب' : 'Failed to disable account'));
  };

  const handleEnableConfirm = async () => {
    if (!enablingUser) return;
    const res = await enableUserAction(enablingUser.id);
    if (!res.success) throw new Error(res.error || 'Failed to enable account');
    router.refresh();
  };

  const exportColumns = [
    { header: t('admin.users.name'), accessor: (u: any) => u.name },
    { header: t('admin.users.email'), accessor: (u: any) => u.email },
    { header: t('admin.users.role'), accessor: (u: any) => u.role?.displayName || u.role?.name || '' },
    { header: t('admin.users.department'), accessor: (u: any) => u.department?.name || '' },
    { header: t('admin.users.phone'), accessor: (u: any) => u.phone || '' },
    { header: t('admin.users.status'), accessor: (u: any) => (u.isActive ? t('admin.users.active') : t('admin.users.disabled')) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('admin.users.title')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('admin.users.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            filename="system-users"
            title={t('admin.users.title')}
            data={users}
            columns={exportColumns}
          />
          <button
            onClick={() => {
              setEditingUser(null);
              setIsOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('admin.users.addMember')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="hidden md:table-row bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">{t('admin.users.tableUser')}</th>
                <th className="py-3 px-4">{t('admin.users.tableRole')}</th>
                <th className="py-3 px-4">{t('admin.users.tableDepartment')}</th>
                <th className="py-3 px-4">{t('admin.users.tablePhone')}</th>
                <th className="py-3 px-4">{t('admin.users.tableStatus')}</th>
                <th className="py-3 px-4">{t('admin.users.tableLastLogin')}</th>
                <th className="py-3 px-4 text-center">{t('admin.users.tableAction')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const statusBadge = u.isActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('admin.users.active')}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                    <X className="w-3.5 h-3.5" />
                    <span>{t('admin.users.disabled')}</span>
                  </span>
                );
                const actionButtons = (
                  <>
                    {/* Offboarding / Transfer Work */}
                    <button
                      onClick={() => u.isActive ? setDisablingUser(u) : setEnablingUser(u)}
                      title={language === 'ar' ? 'تعطيل الحساب' : 'Disable Account'}
                      className={`inline-flex items-center gap-1 p-2 rounded-lg ${u.isActive ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 hover:bg-orange-100' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100'} transition-colors`}
                    ><UserX className="w-3.5 h-3.5" /><span className="sr-only">{language === 'ar' ? 'تعطيل الحساب' : 'Disable Account'}</span></button>
                    <button
                      onClick={() => setSecurityUser(u)}
                      title="Security & Access"
                      className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 hover:bg-blue-100 transition-colors"
                    ><Shield className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setPermissionsUser(u); setSelectedPermissions((u.userPermissions || []).map((p: any) => p.permissionId)); }} title="Permissions" className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 hover:bg-indigo-100 transition-colors"><Shield className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => {
                        setOffboardingUser(u);
                        setIsOffboardingOpen(true);
                      }}
                      title={t('admin.users.transferWorkTooltip')}
                      className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setIsOpen(true);
                      }}
                      title={t('common.edit')}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete / Archive */}
                    <button
                      onClick={() => {
                        setDeletingUser(u);
                        setIsDeleteOpen(true);
                      }}
                      title={t('common.delete')}
                      className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                );
                return (
                <React.Fragment key={u.id}>
                  {/* Desktop row */}
                  <tr className="hidden md:table-row border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{u.name}</span>
                          <span className="text-[11px] text-slate-400 block">{u.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-brand-700 dark:text-brand-300 font-bold text-[10px] border border-purple-200/50 dark:border-purple-800/40">
                        {u.role.displayName || u.role.name}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {u.department?.name || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {u.phone || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      {statusBadge}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {formatDate(u.lastLoginAt, language)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {actionButtons}
                      </div>
                    </td>
                  </tr>

                  {/* Mobile card */}
                  <tr className="md:hidden border-b border-slate-100 dark:border-slate-800">
                    <td colSpan={7} className="p-4 space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 shrink-0 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
                          {u.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{u.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                        </div>
                        {statusBadge}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 font-semibold shrink-0">{t('admin.users.tableRole')}</span>
                          <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-brand-700 dark:text-brand-300 font-bold text-[10px] truncate">
                            {u.role.displayName || u.role.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="text-slate-400 font-semibold shrink-0">{t('admin.users.tableDepartment')}</span>
                          <span className="truncate text-slate-700 dark:text-slate-300">{u.department?.name || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="text-slate-400 font-semibold shrink-0">{t('admin.users.tablePhone')}</span>
                          <span className="truncate text-slate-700 dark:text-slate-300">{u.phone || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="text-slate-400 font-semibold shrink-0">{t('admin.users.tableLastLogin')}</span>
                          <span className="truncate text-slate-700 dark:text-slate-300">{formatDate(u.lastLoginAt, language)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {actionButtons}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {t('admin.users.noUsersFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setEditingUser(null);
        }}
        onSaved={() => router.refresh()}
        user={editingUser}
        roles={roles}
        departments={departments}
        users={users}
        permissions={permissions}
      />

      <OffboardingModal
        isOpen={isOffboardingOpen}
        onClose={() => {
          setIsOffboardingOpen(false);
          setOffboardingUser(null);
        }}
        user={offboardingUser}
        allUsers={users}
      />

      <AdminPasswordConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingUser(null);
        }}
        title={t('admin.users.confirmDeleteTitle', { name: deletingUser?.name || '' })}
        itemDescription={t('admin.users.confirmDeleteDesc', {
          name: deletingUser?.name || '',
          email: deletingUser?.email || '',
        })}
        onConfirm={handleDeleteConfirm}
      />
      <ConfirmDialog
        isOpen={!!disablingUser}
        onClose={() => setDisablingUser(null)}
        onConfirm={async () => { await handleDisableConfirm(); setDisablingUser(null); router.refresh(); }}
        title={language === 'ar' ? 'تعطيل الحساب — ليس حذفًا' : 'Disable account — not delete'}
        description={language === 'ar' ? `سيتم تعطيل حساب ${disablingUser?.name || ''} وإبطال الجلسات الفعالة. ستبقى جميع التذاكر والملاحظات والرسائل والتعيينات والسجل التاريخي محفوظة.` : `The account for ${disablingUser?.name || ''} will be disabled and active sessions revoked. All tickets, notes, messages, assignments, and audit history will be preserved.`}
        confirmText={language === 'ar' ? 'تعطيل الحساب' : 'Disable Account'}
        cancelText={t('common.cancel')}
        confirmVariant="warning"
      />
      <ConfirmDialog isOpen={!!enablingUser} onClose={() => setEnablingUser(null)} onConfirm={async () => { await handleEnableConfirm(); setEnablingUser(null); }} title="Enable Account / تفعيل الحساب" description={`The account for ${enablingUser?.name || ''} will become active and may sign in again.`} confirmText="Enable Account" cancelText={t('common.cancel')} confirmVariant="primary" />
      <LoginSessionsModal user={securityUser} isOpen={!!securityUser} onClose={() => setSecurityUser(null)} />
      <ConfirmDialog
        isOpen={!!permissionsUser}
        onClose={() => setPermissionsUser(null)}
        onConfirm={async () => {
          if (!permissionsUser) return;
          setSavingPermissions(true);
          const result = await updateUserPermissionsAction(permissionsUser.id, selectedPermissions);
          setSavingPermissions(false);
          if (!result.success) throw new Error(result.error || 'Failed to update permissions');
          setPermissionsUser(null);
          router.refresh();
        }}
        title={`Permissions / الصلاحيات — ${permissionsUser?.name || ''}`}
        description={savingPermissions ? 'Saving permissions…' : 'Select the direct permissions granted to this user. Role permissions remain independent.'}
        confirmText="Save Permissions"
        cancelText={t('common.cancel')}
      >
        <div className="max-h-72 overflow-y-auto space-y-3 text-start">
          {Object.entries(permissions.reduce((groups: Record<string, any[]>, permission: any) => { (groups[permission.module] ||= []).push(permission); return groups; }, {})).map(([module, group]) => (
            <fieldset key={module} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <legend className="px-1 text-xs font-bold capitalize">{module.replace('_', ' ')}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {group.map((permission: any) => <label key={permission.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedPermissions.includes(permission.id)} onChange={(event) => setSelectedPermissions((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} /> <span>{permission.name} <code className="text-[10px] text-slate-400">{permission.code}</code></span></label>)}
              </div>
            </fieldset>
          ))}
        </div>
      </ConfirmDialog>
    </div>
  );
}
