"use client";

import { useState } from "react";
import { updateRolePermissionsAction } from "@/server/actions/admin";
import { ShieldCheck, Save } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  getPermissionLabel,
  getPermissionModuleLabel,
} from "@/lib/i18n/permissionLabels";

interface RolesClientViewProps {
  roles: any[];
  permissions: any[];
  canEdit?: boolean;
}

export function RolesClientView({
  roles,
  permissions,
  canEdit = true,
}: RolesClientViewProps) {
  const { t, language, errorMessage } = useI18n();
  const [selectedRole, setSelectedRole] = useState(roles[0]?.id || "");
  const [rolePermissionsMap, setRolePermissionsMap] = useState<
    Record<string, string[]>
  >(() => {
    const map: Record<string, string[]> = {};
    for (const r of roles) {
      map[r.id] = r.rolePermissions.map((rp: any) => rp.permissionId);
    }
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentRole = roles.find((r) => r.id === selectedRole);
  const currentPerms = rolePermissionsMap[selectedRole] || [];

  const handleTogglePerm = (permId: string) => {
    if (
      !canEdit ||
      ["PLATFORM_ADMIN", "SUPER_ADMIN"].includes(currentRole?.name || "")
    )
      return;
    setRolePermissionsMap((prev) => {
      const current = prev[selectedRole] || [];
      const updated = current.includes(permId)
        ? current.filter((id) => id !== permId)
        : [...current, permId];
      return { ...prev, [selectedRole]: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const res = await updateRolePermissionsAction(selectedRole, currentPerms);
    setSaving(false);
    if (res.success) {
      setMessage(t("common.success"));
    } else {
      setMessage(errorMessage(res.error, t("common.error")));
    }
  };

  // Keep legacy school permissions available to the backend for compatibility,
  // but do not expose that old product area in the current CRM interface.
  const visiblePermissions = permissions.filter(
    (permission) =>
      permission.module !== "schools" &&
      permission.code !== "activity.view_school" &&
      permission.code !== "analytics.view_schools",
  );

  // Group visible permissions by module.
  const modules = Array.from(new Set(visiblePermissions.map((p) => p.module)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("admin.roles.title")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t("admin.roles.subtitle")}
        </p>
      </div>

      {/* Role Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => {
              setSelectedRole(role.id);
              setMessage(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedRole === role.id
                ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{role.displayName || role.name}</span>
          </button>
        ))}
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
          {message}
        </div>
      )}

      {/* Permission Modules Matrix */}
      <div className="space-y-6">
        {modules.map((mod) => {
          const modPerms = visiblePermissions.filter(
            (p) => (p.module as string) === mod,
          );
          return (
            <div
              key={mod as string}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                {t("admin.roles.moduleLabel")}:{" "}
                {getPermissionModuleLabel(mod as string, language)}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {modPerms.map((p) => {
                  const isProtectedRole = [
                    "PLATFORM_ADMIN",
                    "SUPER_ADMIN",
                  ].includes(currentRole?.name || "");
                  const isChecked =
                    currentPerms.includes(p.id) || isProtectedRole;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleTogglePerm(p.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                        isChecked
                          ? "border-brand-600 bg-purple-50/50 dark:bg-purple-950/20 text-brand-950 dark:text-purple-200"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isProtectedRole || !canEdit}
                        onChange={() => {}}
                        className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="font-bold block">
                          {getPermissionLabel(p.code, p.name, language)}
                        </span>
                        {language !== "ar" && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {p.code}
                          </span>
                        )}
                        {language !== "ar" && p.description && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            {p.description}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit &&
        !["PLATFORM_ADMIN", "SUPER_ADMIN"].includes(
          currentRole?.name || "",
        ) && (
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {saving
                  ? t("common.loading")
                  : t("admin.roles.savePermissions")}
              </span>
            </button>
          </div>
        )}
    </div>
  );
}
