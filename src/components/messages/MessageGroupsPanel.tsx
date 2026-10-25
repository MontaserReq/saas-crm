"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, UsersRound, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  createMessageGroupAction,
  getTeamMembersForMessaging,
} from "@/server/actions/messages";

type Group = {
  id: string;
  name: string;
  description?: string | null;
  canMembersSend: boolean;
  createdById: string;
  members: Array<{ user: { id: string; name: string; email: string } }>;
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  department?: { name: string } | null;
};

export function MessageGroupsPanel({
  groups,
  canCreate,
  title,
  subtitle,
}: {
  groups: Group[];
  canCreate: boolean;
  title?: string;
  subtitle?: string;
}) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [canMembersSend, setCanMembersSend] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const text = (en: string, arabic: string) => (ar ? arabic : en);

  async function openCreate() {
    setOpen(true);
    setError("");
    if (users.length > 0) return;
    setLoadingUsers(true);
    const result = await getTeamMembersForMessaging();
    if (result.success) setUsers(result.users || []);
    else setError(errorMessage(result.error));
    setLoadingUsers(false);
  }

  function toggleMember(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (saving || name.trim().length < 2 || selectedIds.length === 0) {
      setError(
        text(
          "Enter a group name and select at least one member.",
          "أدخل اسم المجموعة واختر عضوًا واحدًا على الأقل.",
        ),
      );
      return;
    }
    setSaving(true);
    setError("");
    const result = await createMessageGroupAction({
      name: name.trim(),
      description: description.trim() || undefined,
      memberIds: selectedIds,
      canMembersSend,
    });
    if (!result.success) {
      setError(errorMessage(result.error));
      setSaving(false);
      return;
    }
    setName("");
    setDescription("");
    setCanMembersSend(true);
    setSelectedIds([]);
    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" dir={ar ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              {title || text("Team groups", "مجموعات الفريق")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {subtitle ||
                text(
                  "Organize team conversations by department or project.",
                  "نظّم محادثات الفريق حسب القسم أو المشروع.",
                )}
            </p>
          </div>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => void openCreate()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Plus className="h-4 w-4" />
            {text("Create group", "إنشاء مجموعة")}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {canCreate
            ? text(
                "Create a group for a department, project, or recurring announcement.",
                "أنشئ مجموعة لقسم أو مشروع أو للإعلانات المتكررة.",
              )
            : text("No team groups are available for you yet.", "لا توجد مجموعات فريق متاحة لك حاليًا.")}
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{group.name}</h3>
                  {group.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{group.description}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                  {group.members.length} {text("members", "أعضاء")}
                </span>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {group.canMembersSend
                  ? text("All members can send", "كل الأعضاء يستطيعون الإرسال")
                  : text("Creator only can send", "المنشئ فقط يستطيع الإرسال")}
              </div>
              <div className="mt-3 flex -space-x-2 rtl:space-x-reverse">
                {group.members.slice(0, 5).map(({ user }) => (
                  <span key={user.id} title={user.name} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-50 bg-brand-100 text-[10px] font-bold text-brand-700 dark:border-slate-950 dark:bg-brand-900/70 dark:text-brand-200">
                    {user.name.charAt(0)}
                  </span>
                ))}
                {group.members.length > 5 && <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-50 bg-white text-[10px] font-bold text-slate-500 dark:border-slate-950 dark:bg-slate-800 dark:text-slate-300">+{group.members.length - 5}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-xl rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="message-group-title">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
              <div>
                <h2 id="message-group-title" className="text-lg font-extrabold text-slate-900 dark:text-white">{text("Create team group", "إنشاء مجموعة فريق")}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{text("Add the people who should join this team conversation.", "أضف الأشخاص الذين سينضمون إلى محادثة الفريق هذه.")}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label={text("Close", "إغلاق")}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={create} className="space-y-4 p-5">
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{text("Group name", "اسم المجموعة")}</span>
                <input required value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder={text("Marketing team", "فريق التسويق")} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">{text("Description (optional)", "الوصف (اختياري)")}</span>
                <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={160} placeholder={text("A short description", "وصف مختصر للمجموعة")} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{text("Members", "الأعضاء")}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{selectedIds.length} {text("selected", "محدد")}</span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  {loadingUsers ? <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{text("Loading members...", "جارٍ تحميل الأعضاء...")}</div> : users.map((user) => {
                    const selected = selectedIds.includes(user.id);
                    return <button type="button" key={user.id} onClick={() => toggleMember(user.id)} className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-start last:border-0 dark:border-slate-800 ${selected ? "bg-brand-50 dark:bg-brand-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{user.name.charAt(0)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user.name}</span><span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{user.department?.name || user.email}</span></span>{selected && <Check className="h-4 w-4 text-brand-700 dark:text-brand-300" />}</button>;
                  })}
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-3 dark:border-brand-900/60 dark:bg-brand-950/30">
                <input
                  type="checkbox"
                  checked={canMembersSend}
                  onChange={(event) => setCanMembersSend(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                />
                <span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                    {text("Allow members to send messages", "السماح لأعضاء المجموعة بإرسال الرسائل")}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {text("Turn this off for announcement or read-only groups. The creator can always reply.", "أوقفه إذا كانت المجموعة للإعلانات أو للقراءة فقط. منشئ المجموعة يستطيع الرد دائماً.")}
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">{text("Cancel", "إلغاء")}</button>
                <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" />{saving ? text("Creating...", "جارٍ الإنشاء...") : text("Create group", "إنشاء المجموعة")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
