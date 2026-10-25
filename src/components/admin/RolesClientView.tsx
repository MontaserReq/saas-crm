"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Pencil, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createRoleAction, deleteRoleAction, updateRoleAction, updateRolePermissionsAction } from "@/server/actions/admin";
import { useI18n } from "@/lib/i18n/context";
import { getPermissionLabel, getPermissionModuleLabel } from "@/lib/i18n/permissionLabels";

interface RolesClientViewProps {
  roles: any[];
  permissions: any[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  availablePermissionCodes?: string[];
}

export function RolesClientView({ roles, permissions, canCreate = false, canEdit = false, canDelete = false, availablePermissionCodes = [] }: RolesClientViewProps) {
  const { t, language, errorMessage } = useI18n();
  const router = useRouter();
  const isArabic = language === "ar";
  const [selectedRole, setSelectedRole] = useState(roles[0]?.id || "");
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, string[]>>(
    () => Object.fromEntries(roles.map((role) => [role.id, role.rolePermissions.map((rp: any) => rp.permissionId)])),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRolePermissionIds, setNewRolePermissionIds] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const visiblePermissions = useMemo(() => permissions.filter((permission) => permission.module !== "schools" && permission.code !== "activity.view_school" && permission.code !== "analytics.view_schools"), [permissions]);
  const modules = useMemo(() => Array.from(new Set(visiblePermissions.map((permission) => permission.module))), [visiblePermissions]);
  const currentRole = roles.find((role) => role.id === selectedRole);
  const currentPerms = rolePermissionsMap[selectedRole] || [];
  const currentRoleIsSystem = Boolean(currentRole?.isSystem);
  const availablePermissionSet = useMemo(() => new Set(availablePermissionCodes), [availablePermissionCodes]);

  const showMessage = (text: string, error = false) => { setMessage(text); setMessageIsError(error); };

  const togglePermission = (permissionId: string, target: "current" | "new") => {
    const value = target === "new" ? newRolePermissionIds : currentPerms;
    const updated = value.includes(permissionId) ? value.filter((id) => id !== permissionId) : [...value, permissionId];
    if (target === "new") setNewRolePermissionIds(updated);
    else setRolePermissionsMap((previous) => ({ ...previous, [selectedRole]: updated }));
  };

  const setModulePermissions = (module: string, target: "current" | "new", selectAll: boolean) => {
    const modulePermissions = visiblePermissions.filter((permission) => permission.module === module);
    const moduleIds = new Set(modulePermissions.map((permission) => permission.id));
    const selected = target === "new" ? newRolePermissionIds : currentPerms;
    const availableModuleIds = modulePermissions
      .filter((permission) => availablePermissionSet.has(permission.code))
      .map((permission) => permission.id);
    const preservedUnavailableIds = modulePermissions
      .filter((permission) => !availablePermissionSet.has(permission.code) && selected.includes(permission.id))
      .map((permission) => permission.id);
    const updated = selectAll
      ? Array.from(new Set([
          ...selected.filter((permissionId) => !moduleIds.has(permissionId)),
          ...availableModuleIds,
          ...preservedUnavailableIds,
        ]))
      : selected.filter((permissionId) => !moduleIds.has(permissionId));

    if (target === "new") setNewRolePermissionIds(updated);
    else setRolePermissionsMap((previous) => ({ ...previous, [selectedRole]: updated }));
  };

  const renderPermissionGroups = (target: "current" | "new") => {
    const selected = target === "new" ? newRolePermissionIds : currentPerms;
    const disabled = target === "current" && (!canEdit || currentRoleIsSystem);
    return (
      <div className="space-y-4">
        {modules.map((module) => {
          const modulePermissions = visiblePermissions.filter((permission) => permission.module === module);
          return (
            <div key={module} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("admin.roles.moduleLabel")}: {getPermissionModuleLabel(module, language)}</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setModulePermissions(module, target, true)}
                    className="rounded-lg border border-brand-200 px-2.5 py-1.5 text-[11px] font-bold text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isArabic ? "تحديد الجميع" : "Select all"}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setModulePermissions(module, target, false)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {isArabic ? "إلغاء الجميع" : "Clear all"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {modulePermissions.map((permission) => {
                  const checked = selected.includes(permission.id);
                  const isAvailable = availablePermissionSet.has(permission.code);
                  const permissionDisabled = !isAvailable && !checked;
                  return (
                    <button type="button" key={permission.id} disabled={disabled || permissionDisabled} onClick={() => togglePermission(permission.id, target)} title={!isAvailable ? (isArabic ? "هذه الصلاحية غير متاحة في باقتك الحالية" : "This permission is not available on the current plan") : undefined} className={`flex items-start gap-2 rounded-xl border p-3 text-start text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${checked ? "border-brand-500 bg-brand-50 text-brand-950 dark:bg-brand-950/30 dark:text-brand-100" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"} ${permissionDisabled ? "bg-slate-50 text-slate-400" : ""}`}>
                      <input type="checkbox" checked={checked} readOnly tabIndex={-1} className="mt-0.5 rounded text-brand-600" />
                      <span className="flex items-center gap-1.5 font-semibold">
                        {getPermissionLabel(permission.code, permission.name, language)}
                        {!isAvailable && <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label={isArabic ? "غير متاحة في الباقة" : "Unavailable on this plan"} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true); setMessage(null);
    const result = await updateRolePermissionsAction(selectedRole, currentPerms);
    setSaving(false);
    if (result.success) showMessage(isArabic ? "تم حفظ صلاحيات الدور بنجاح" : "Role permissions saved successfully");
    else showMessage(errorMessage(result.error, t("common.error")), true);
  };

  const handleCreateRole = async () => {
    setSaving(true);
    const result = await createRoleAction({ displayName: newRoleName, description: newRoleDescription, permissionIds: newRolePermissionIds });
    setSaving(false);
    if (!result.success) { showMessage(errorMessage(result.error, t("common.error")), true); return; }
    if (result.role?.id) {
      setSelectedRole(result.role.id);
      setRolePermissionsMap((previous) => ({ ...previous, [result.role.id]: newRolePermissionIds }));
    }
    setCreateOpen(false); setNewRoleName(""); setNewRoleDescription(""); setNewRolePermissionIds([]);
    showMessage(isArabic ? "تم إنشاء الدور بنجاح" : "Role created successfully");
    router.refresh();
  };

  const openEdit = () => {
    if (!currentRole || currentRole.isSystem) return;
    setEditName(currentRole.displayName || currentRole.name); setEditDescription(currentRole.description || ""); setEditOpen(true);
  };

  const handleEditRole = async () => {
    if (!currentRole) return;
    setSaving(true);
    const result = await updateRoleAction(currentRole.id, { displayName: editName, description: editDescription });
    setSaving(false);
    if (!result.success) { showMessage(errorMessage(result.error, t("common.error")), true); return; }
    setEditOpen(false); showMessage(isArabic ? "تم تحديث الدور بنجاح" : "Role updated successfully"); router.refresh();
  };

  const handleDeleteRole = () => {
    if (!currentRole || currentRole.isSystem || !canDelete) return;
    setDeleteOpen(true);
  };

  const handleDeleteRoleConfirm = async () => {
    if (!currentRole || currentRole.isSystem || !canDelete) return;
    setSaving(true); const result = await deleteRoleAction(currentRole.id); setSaving(false);
    if (!result.success) { setDeleteOpen(false); showMessage(errorMessage(result.error, t("common.error")), true); return; }
    setDeleteOpen(false);
    setSelectedRole(roles.find((role) => role.id !== currentRole.id)?.id || ""); showMessage(isArabic ? "تم حذف الدور بنجاح" : "Role deleted successfully"); router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t("admin.roles.title")}</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t("admin.roles.subtitle")}</p></div>
        {canCreate && <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-500/20 hover:bg-brand-700"><Plus className="h-4 w-4" />{isArabic ? "إضافة دور مخصص" : "Add custom role"}</button>}
      </div>

      {message && <div className={`rounded-xl border p-3 text-xs font-semibold ${messageIsError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{message}</div>}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 dark:border-slate-800">
        {roles.map((role) => <button type="button" key={role.id} onClick={() => { setSelectedRole(role.id); setMessage(null); }} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${selectedRole === role.id ? "bg-brand-600 text-white shadow-md shadow-brand-500/20" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}><ShieldCheck className="h-3.5 w-3.5" /><span>{role.displayName || role.name}</span>{!role.isSystem && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">{isArabic ? "مخصص" : "Custom"}</span>}</button>)}
      </div>

      {currentRole && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{currentRole.displayName || currentRole.name}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{currentRole.isSystem ? (isArabic ? "دور نظامي" : "System role") : (isArabic ? "دور مخصص للشركة" : "Company custom role")}</span></div>{currentRole.description && <p className="mt-1 text-xs text-slate-500">{currentRole.description}</p>}</div>{!currentRole.isSystem && <div className="flex flex-wrap gap-2">{canEdit && <button type="button" onClick={openEdit} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />{isArabic ? "تعديل البيانات" : "Edit details"}</button>}{canDelete && <button type="button" onClick={handleDeleteRole} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />{isArabic ? "حذف الدور" : "Delete role"}</button>}</div>}</div></div>}

      {currentRole && renderPermissionGroups("current")}
      {currentRoleIsSystem && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">{isArabic ? "هذا دور نظامي محمي. أنشئ دوراً مخصصاً للشركة لتحديد صلاحياته." : "This is a protected system role. Create a company custom role to configure its permissions."}</div>}
      {canEdit && currentRole && !currentRoleIsSystem && <div className="flex justify-end pt-1"><button type="button" onClick={handleSavePermissions} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-500/20 hover:bg-brand-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? t("common.loading") : t("admin.roles.savePermissions")}</button></div>}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={isArabic ? "إضافة دور مخصص" : "Add custom role"} description={isArabic ? "أنشئ دوراً بصلاحيات محددة لفريق شركتك." : "Create a role with the permissions your team needs."} maxWidth="4xl">
        <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>{isArabic ? "اسم الدور" : "Role name"}</span><input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} maxLength={80} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500" placeholder={isArabic ? "مثال: مدير المبيعات" : "e.g. Sales manager"} /></label><label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>{isArabic ? "الوصف (اختياري)" : "Description (optional)"}</span><input value={newRoleDescription} onChange={(event) => setNewRoleDescription(event.target.value)} maxLength={240} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500" placeholder={isArabic ? "ماذا يستطيع هذا الدور أن يفعل؟" : "What can this role do?"} /></label></div><div><h4 className="mb-2 text-sm font-bold text-slate-900">{isArabic ? "صلاحيات الدور" : "Role permissions"}</h4>{renderPermissionGroups("new")}</div><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">{isArabic ? "إلغاء" : "Cancel"}</button><button type="button" onClick={handleCreateRole} disabled={saving || newRoleName.trim().length < 2} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? t("common.loading") : isArabic ? "إنشاء الدور" : "Create role"}</button></div></div>
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={isArabic ? "تعديل الدور" : "Edit role"} maxWidth="md">
        <div className="space-y-4"><label className="block space-y-1.5 text-sm font-semibold text-slate-700"><span>{isArabic ? "اسم الدور" : "Role name"}</span><input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label><label className="block space-y-1.5 text-sm font-semibold text-slate-700"><span>{isArabic ? "الوصف" : "Description"}</span><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={240} rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setEditOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">{isArabic ? "إلغاء" : "Cancel"}</button><button type="button" onClick={handleEditRole} disabled={saving || editName.trim().length < 2} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? t("common.loading") : isArabic ? "حفظ التعديل" : "Save changes"}</button></div></div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteRoleConfirm}
        loading={saving}
        title={isArabic ? "حذف الدور المخصص" : "Delete custom role"}
        description={isArabic ? `سيتم حذف الدور «${currentRole?.displayName || ""}». لا يمكن حذف الدور إذا كان مسنداً لمستخدمين أو دعوات معلقة.` : `The role “${currentRole?.displayName || ""}” will be deleted. A role assigned to users or pending invitations cannot be deleted.`}
        confirmText={isArabic ? "حذف الدور" : "Delete role"}
        cancelText={isArabic ? "إلغاء" : "Cancel"}
        confirmVariant="danger"
      />
    </div>
  );
}
