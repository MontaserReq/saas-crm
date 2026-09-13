'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { Sparkles, Plus, MapPin, ChevronRight, AlertTriangle, ChevronLeft } from 'lucide-react';
import { ResearchForm } from './ResearchForm';
import { JobStatusBadge } from './StatusBadge';
import { formatNumber } from '@/lib/formatters';

interface JobRow {
  id: string;
  location: string;
  area: string | null;
  status: string;
  requestedCount: number;
  createdAt: string | Date;
  createdBy: { id: string; name: string };
  _count?: { candidates: number };
}

interface AiResearchHomeViewProps {
  jobs: JobRow[];
  total: number;
  page: number;
  totalPages: number;
  canCreate: boolean;
  isConfigured: boolean;
  maxSchoolsPerJob: number;
}

export function AiResearchHomeView({ jobs, total, page, totalPages, canCreate, isConfigured, maxSchoolsPerJob }: AiResearchHomeViewProps) {
  const { t, language } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`/ai-school-research?${params.toString()}`);
  };

  const formatDate = (value: string | Date) =>
    new Date(value).toLocaleDateString(language === 'ar' ? 'ar-JO' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('aiResearch.title')}</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t('aiResearch.subtitle')}</p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t('aiResearch.startResearch')}
          </button>
        )}
      </div>

      {!isConfigured && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t('aiResearch.notConfigured')}</span>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/40">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center text-brand-600 mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{t('aiResearch.emptyStateTitle')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md">{t('aiResearch.emptyStateDesc')}</p>
          {canCreate && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('aiResearch.startResearch')}
            </button>
          )}
        </div>
      ) : (
        <>
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('aiResearch.researchHistory')}</h2>
          <div className="space-y-2.5">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/ai-school-research/${job.id}`}
                className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {job.location}
                      {job.area ? ` / ${job.area}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {formatDate(job.createdAt)} · {formatNumber(job.requestedCount, language)} {t('schools.schoolsCount')} · {formatNumber(job._count?.candidates || 0, language)} {t('aiResearch.summaryFound').toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <JobStatusBadge status={job.status} />
                  {language === 'ar' ? <ChevronLeft className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
              >
                {t('common.previous')}
              </button>
              <span className="text-xs text-slate-500">
                {t('common.page')} {formatNumber(page, language)} {t('common.of')} {formatNumber(totalPages, language)}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}

      {isFormOpen && <ResearchForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} maxSchoolsPerJob={maxSchoolsPerJob} />}
    </div>
  );
}
