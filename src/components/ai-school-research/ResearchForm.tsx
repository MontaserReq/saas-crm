'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n/context';
import { createResearchJobAction } from '@/server/actions/ai-school-research';
import { SCHOOL_TYPES } from '@/lib/schools/schoolTypes';
import { AlertCircle } from 'lucide-react';

const FIELD_OPTIONS = [
  { value: 'phone', labelKey: 'aiResearch.fieldPhone' },
  { value: 'email', labelKey: 'aiResearch.fieldEmail' },
  { value: 'website', labelKey: 'aiResearch.fieldWebsite' },
  { value: 'address', labelKey: 'aiResearch.fieldAddress' },
  { value: 'contactPerson', labelKey: 'aiResearch.fieldContactPerson' },
  { value: 'schoolType', labelKey: 'aiResearch.fieldSchoolType' },
] as const;

interface ResearchFormProps {
  isOpen: boolean;
  onClose: () => void;
  maxSchoolsPerJob: number;
}

export function ResearchForm({ isOpen, onClose, maxSchoolsPerJob }: ResearchFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [location, setLocation] = useState('Amman');
  const [area, setArea] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [requestedCount, setRequestedCount] = useState(25);
  const [requiredFields, setRequiredFields] = useState<string[]>(['phone', 'email', 'website']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleField = (value: string) => {
    setRequiredFields((prev) => (prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createResearchJobAction({
      location: location.trim(),
      area: area.trim() || null,
      schoolType: schoolType || null,
      requestedCount,
      requiredFields,
    });

    setLoading(false);
    if (res.success && res.job) {
      onClose();
      router.push(`/ai-school-research/${res.job.id}`);
    } else {
      setError(res.error || t('aiResearch.errorStart'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('aiResearch.title')} description={t('aiResearch.subtitle')} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('aiResearch.location')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={location}
              placeholder={t('aiResearch.locationPlaceholder')}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('aiResearch.area')}</label>
            <input
              type="text"
              value={area}
              placeholder={t('aiResearch.areaPlaceholder')}
              onChange={(e) => setArea(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('aiResearch.schoolType')}</label>
            <select
              value={schoolType}
              onChange={(e) => setSchoolType(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">{t('aiResearch.anySchoolType')}</option>
              {SCHOOL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('aiResearch.numberOfSchools')}</label>
            <input
              type="number"
              min={1}
              max={maxSchoolsPerJob}
              required
              value={requestedCount}
              onChange={(e) => setRequestedCount(Math.max(1, Math.min(maxSchoolsPerJob, Number(e.target.value) || 1)))}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">{t('aiResearch.requestedCountHint').replace('{max}', String(maxSchoolsPerJob))}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">{t('aiResearch.requiredData')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FIELD_OPTIONS.map((field) => (
              <label
                key={field.value}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <input
                  type="checkbox"
                  checked={requiredFields.includes(field.value)}
                  onChange={() => toggleField(field.value)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>{t(field.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading || requiredFields.length === 0}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('aiResearch.startResearch')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
