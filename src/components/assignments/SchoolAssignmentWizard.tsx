'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { executeBulkAssignmentAction } from '@/server/actions/assignments';
import { CheckCircle2, Share2, Users, Building, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TaskTypeItem {
  id: string;
  name: string;
}

interface DepartmentItem {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  name: string;
  departmentId: string;
  department?: { name: string };
}

interface SchoolItem {
  id: string;
  name: string;
  city: string;
  schoolType: string;
  status: string;
}

interface SchoolAssignmentWizardProps {
  taskTypes: TaskTypeItem[];
  departments: DepartmentItem[];
  teamMembers: UserItem[];
  availableSchools: SchoolItem[];
}

export function SchoolAssignmentWizard({
  taskTypes,
  departments,
  teamMembers,
  availableSchools,
}: SchoolAssignmentWizardProps) {
  const { t, getStatusLabel, language } = useI18n();
  const router = useRouter();

  const [taskTypeId, setTaskTypeId] = useState(taskTypes[0]?.id || '');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [, setRandomCount] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Toggle user selection
  const handleToggleUser = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Toggle school selection
  const handleToggleSchool = (schoolId: string) => {
    setSelectedSchoolIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId]
    );
  };

  const handleSelectAllSchools = () => {
    if (selectedSchoolIds.length === availableSchools.length) {
      setSelectedSchoolIds([]);
    } else {
      setSelectedSchoolIds(availableSchools.map((s) => s.id));
    }
  };

  const handlePickRandomSchools = (count: number) => {
    setRandomCount(count);
    if (count <= 0) return;
    const shuffled = [...availableSchools].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, count).map((s) => s.id);
    setSelectedSchoolIds(picked);
  };

  // Calculate live distribution preview
  const distributionPreview: Array<{ user: UserItem; count: number }> = selectedAssigneeIds.map((userId, idx) => {
    const user = teamMembers.find((m) => m.id === userId)!;
    const total = selectedSchoolIds.length;
    const numAssignees = selectedAssigneeIds.length;
    const base = Math.floor(total / numAssignees);
    const remainder = total % numAssignees;
    const count = idx < remainder ? base + 1 : base;
    return { user, count };
  });

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAssigneeIds.length === 0) {
      setError(t('assignment.selectAssigneeError'));
      return;
    }
    if (selectedSchoolIds.length === 0) {
      setError(t('assignment.selectSchoolError'));
      return;
    }

    setLoading(true);
    setError(null);

    const res = await executeBulkAssignmentAction({
      taskTypeId,
      departmentId,
      priority,
      dueDate: dueDate || null,
      notes: notes.trim() || null,
      assigneeIds: selectedAssigneeIds,
      schoolIds: selectedSchoolIds,
    });

    setLoading(false);

    if (res.success) {
      setResult(res);
    } else {
      setError(res.error || t('common.error'));
    }
  };

  if (result) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('assignment.assignmentSuccessful')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {result.batchNumber} • {result.ticketsCount} {t('tickets.title')}
        </p>

        <div className="pt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              setResult(null);
              setSelectedSchoolIds([]);
              setSelectedAssigneeIds([]);
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
          >
            {t('assignment.createAnother')}
          </button>
          <button
            onClick={() => router.push('/tickets')}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20"
          >
            {t('assignment.viewGeneratedTickets')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleExecute} className="space-y-8">
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Campaign & Task Info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Share2 className="w-5 h-5 text-brand-600" />
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{t('assignment.step1')}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('assignment.taskType')} <span className="text-rose-500">*</span>
            </label>
            <select
              value={taskTypeId}
              onChange={(e) => setTaskTypeId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              {taskTypes.map((taskT) => (
                <option key={taskT.id} value={taskT.id}>
                  {taskT.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('assignment.targetDepartment')}
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('assignment.priority')}
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="LOW">{getStatusLabel('LOW')}</option>
              <option value="MEDIUM">{getStatusLabel('MEDIUM')}</option>
              <option value="HIGH">{getStatusLabel('HIGH')}</option>
              <option value="URGENT">{getStatusLabel('URGENT')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('assignment.dueDate')}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('schools.notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('assignment.notesPlaceholder')}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Step 2: Select Assignees */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{t('assignment.step2')}</h3>
          </div>
          <span className="text-xs font-semibold text-brand-600">
            {selectedAssigneeIds.length} {t('assignment.assigneesSelected')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {teamMembers.map((member) => {
            const isSelected = selectedAssigneeIds.includes(member.id);
            return (
              <div
                key={member.id}
                onClick={() => handleToggleUser(member.id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-brand-600 bg-purple-50/60 dark:bg-purple-950/30 text-brand-900 dark:text-purple-200 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">{member.name}</span>
                    <span className="text-[10px] text-slate-400">{member.department?.name || t('assignment.prOfficer')}</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 3: Select Schools & Distribution */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{t('assignment.step3')}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick count buttons */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">{t('assignment.quickPick')}:</span>
              {[5, 10, 20, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePickRandomSchools(num)}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-medium"
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSelectAllSchools}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {selectedSchoolIds.length === availableSchools.length ? t('assignment.deselectAll') : t('assignment.selectAll')}
            </button>
          </div>
        </div>

        {/* Selected counter banner */}
        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/40 rounded-xl flex items-center justify-between">
          <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
            {t('assignment.selectedSchoolsCount')}: <strong>{selectedSchoolIds.length}</strong> / {availableSchools.length}
          </span>
          <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
            {t('assignment.strategyEqual')}
          </span>
        </div>

        {/* Schools Table Grid */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {availableSchools.map((school) => {
            const isSelected = selectedSchoolIds.includes(school.id);
            return (
              <div
                key={school.id}
                onClick={() => handleToggleSchool(school.id)}
                className={`p-3 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                  isSelected ? 'bg-purple-50/40 dark:bg-purple-950/20' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{school.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {school.city} • {getStatusLabel(school.schoolType)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {getStatusLabel(school.status)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Distribution Summary & Execution */}
      {selectedAssigneeIds.length > 0 && selectedSchoolIds.length > 0 && (
        <div className="bg-gradient-to-br from-purple-900 to-brand-900 text-white rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-purple-800">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-base text-white">{t('assignment.summary')}</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {distributionPreview.map(({ user, count }) => (
              <div key={user.id} className="p-3 bg-purple-800/50 rounded-xl border border-purple-700/60">
                <span className="font-bold text-xs text-purple-200 block">{user.name}</span>
                <span className="text-xl font-extrabold text-white mt-1 block">{count} {t('schools.schoolsCount')}</span>
                <span className="text-[10px] text-purple-300">({count} {t('tickets.title')})</span>
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-purple-800/80">
            <div>
              <span className="text-xs text-purple-300 block">{t('assignment.totalTicketsToGenerate')}</span>
              <span className="text-2xl font-black text-white">{selectedSchoolIds.length} {t('tickets.title')}</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-brand-900 bg-white hover:bg-purple-50 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              <span>{loading ? t('common.loading') : t('assignment.executeAssignment')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
