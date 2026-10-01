'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  ExternalLink,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe2,
} from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import { PhoneNumber } from '@/components/ui/PhoneNumber';
import { MobileCardField } from '@/components/ui/MobileCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { JobStatusBadge, CandidateStatusBadge } from './StatusBadge';
import { RejectDialog } from './RejectDialog';
import { CandidateDetailDrawer } from './CandidateDetailDrawer';
import { safeExternalUrl } from '@/lib/security/url';
import { JobUsagePanel } from './JobUsagePanel';
import {
  getResearchJobAction,
  approveCandidateAction,
  bulkApproveCandidatesAction,
  rejectCandidateAction,
  keepCandidateSeparateAction,
} from '@/server/actions/ai-school-research';

const FILTER_TABS = [
  { value: 'ALL', labelKey: 'aiResearch.filterAll' },
  { value: 'NEW', labelKey: 'aiResearch.filterReady' },
  { value: 'NEEDS_REVIEW', labelKey: 'aiResearch.filterNeedsReview' },
  { value: 'DUPLICATE', labelKey: 'aiResearch.filterDuplicates' },
  { value: 'REJECTED', labelKey: 'aiResearch.filterRejected' },
] as const;

const APPROVABLE_STATUSES = new Set(['NEW', 'NEEDS_REVIEW']);
const ACTIVE_JOB_STATUSES = new Set(['PENDING', 'RUNNING']);

interface JobDetailViewProps {
  job: any;
  candidates: any[];
  total: number;
  page: number;
  totalPages: number;
  summary: Record<string, number>;
  activeStatus: string;
  canApprove: boolean;
  canReject: boolean;
}

export function JobDetailView({ job, candidates, total, page, totalPages, summary, activeStatus, canApprove, canReject }: JobDetailViewProps) {
  const { t, language } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobState, setJobState] = useState(job);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerCandidateId, setDrawerCandidateId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => setJobState(job), [job]);

  useEffect(() => {
    if (!ACTIVE_JOB_STATUSES.has(jobState.status)) return;
    const interval = setInterval(async () => {
      const res = await getResearchJobAction(job.id);
      if (res.success && res.job) {
        setJobState(res.job);
        if (!ACTIVE_JOB_STATUSES.has(res.job.status)) {
          router.refresh();
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobState.status, job.id, router]);

  const goToFilter = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', status);
    params.set('page', '1');
    router.push(`/ai-school-research/${job.id}?${params.toString()}`);
  };

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`/ai-school-research/${job.id}?${params.toString()}`);
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async (candidateId: string) => {
    setPendingId(candidateId);
    setNotice(null);
    const res = await approveCandidateAction(candidateId);
    setPendingId(null);
    if (res.success) {
      setNotice({ type: 'success', text: t('aiResearch.candidateImported') });
      router.refresh();
    } else {
      setNotice({ type: 'error', text: res.error || t('common.error') });
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    setPendingId(rejectTarget.id);
    const res = await rejectCandidateAction(rejectTarget.id, reason);
    setPendingId(null);
    setRejectTarget(null);
    if (res.success) {
      setNotice({ type: 'success', text: t('aiResearch.candidateRejected') });
      router.refresh();
    } else {
      setNotice({ type: 'error', text: res.error || t('common.error') });
    }
  };

  const handleKeepSeparate = async (candidateId: string) => {
    setPendingId(candidateId);
    const res = await keepCandidateSeparateAction(candidateId);
    setPendingId(null);
    if (res.success) router.refresh();
    else setNotice({ type: 'error', text: res.error || t('common.error') });
  };

  const handleBulkApprove = async () => {
    setBulkLoading(true);
    const res = await bulkApproveCandidatesAction(Array.from(selected));
    setBulkLoading(false);
    setBulkConfirmOpen(false);
    if (res.success && res.results) {
      const succeeded = res.results.filter((r: any) => r.success).length;
      const failed = res.results.length - succeeded;
      setNotice({
        type: failed === 0 ? 'success' : 'error',
        text: failed === 0 ? t('aiResearch.candidateImported') : `${succeeded} ${t('aiResearch.approve')}, ${failed} ${t('common.error')}`,
      });
      setSelected(new Set());
      router.refresh();
    } else {
      setNotice({ type: 'error', text: res.error || t('common.error') });
    }
  };

  const found = Object.values(summary).reduce((sum, n) => sum + n, 0);
  const ready = summary.NEW || 0;
  const needsReview = summary.NEEDS_REVIEW || 0;
  const duplicates = summary.DUPLICATE || 0;

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ai-school-research" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 mb-3">
          <BackIcon className="w-3.5 h-3.5" />
          {t('common.back')}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                {job.location}
                {job.area ? ` / ${job.area}` : ''}
              </h1>
              <p className="text-xs text-slate-400">{formatNumber(job.requestedCount, language)} {t('schools.schoolsCount')}</p>
            </div>
          </div>
          <JobStatusBadge status={jobState.status} />
        </div>
      </div>

      {ACTIVE_JOB_STATUSES.has(jobState.status) && (
        <div className="p-4 rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-brand-600 animate-spin shrink-0" />
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {jobState.status === 'PENDING' ? t('aiResearch.progressFinding') : t('aiResearch.statusRunning')}
          </p>
        </div>
      )}

      {jobState.status === 'FAILED' && jobState.error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700 dark:text-rose-300">{jobState.error}</p>
        </div>
      )}

      {notice && (
        <div className={`p-3 rounded-xl text-xs font-semibold border ${notice.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'}`}>
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('aiResearch.summaryFound'), value: found },
          { label: t('aiResearch.summaryReady'), value: ready },
          { label: t('aiResearch.summaryNeedsReview'), value: needsReview },
          { label: t('aiResearch.summaryDuplicates'), value: duplicates },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl font-black text-slate-900 dark:text-white">{formatNumber(card.value, language)}</p>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      <JobUsagePanel jobId={job.id} requestedCount={job.requestedCount} successfulCount={found} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => goToFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                activeStatus === tab.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        {canApprove && selected.size > 0 && (
          <button
            onClick={() => setBulkConfirmOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('aiResearch.approveSelected')} ({formatNumber(selected.size, language)})
          </button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-bold uppercase tracking-wide">
              {canApprove && <th className="p-3 w-8"></th>}
              <th className="p-3 text-start">{t('aiResearch.columnSchool')}</th>
              <th className="p-3 text-start">{t('aiResearch.columnArea')}</th>
              <th className="p-3 text-start">{t('aiResearch.columnPhone')}</th>
              <th className="p-3 text-start">{t('aiResearch.columnEmail')}</th>
              <th className="p-3 text-start">{t('aiResearch.columnWebsite')}</th>
              <th className="p-3 text-start">{t('aiResearch.columnSource')}</th>
              <th className="p-3 text-start">{t('aiResearch.columnConfidence')}</th>
              <th className="p-3 text-start">{t('aiResearch.columnStatus')}</th>
              <th className="p-3 text-end">{t('aiResearch.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                {canApprove && (
                  <td className="p-3">
                    {APPROVABLE_STATUSES.has(candidate.status) && (
                      <input type="checkbox" checked={selected.has(candidate.id)} onChange={() => toggleSelected(candidate.id)} className="rounded border-slate-300 text-brand-600" />
                    )}
                  </td>
                )}
                <td className="p-3 font-semibold text-slate-800 dark:text-slate-100 max-w-[220px] truncate">{candidate.name}</td>
                <td className="p-3 text-slate-500 dark:text-slate-400">{candidate.area || '—'}</td>
                <td className="p-3"><PhoneNumber value={candidate.phone} className="text-slate-600 dark:text-slate-300" /></td>
                <td className="p-3 text-slate-500 dark:text-slate-400 max-w-[160px] truncate">{candidate.email || '—'}</td>
                <td className="p-3 max-w-[140px] truncate">
                  {safeExternalUrl(candidate.website) ? (
                    <a href={safeExternalUrl(candidate.website)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
                      <Globe2 className="w-3 h-3 shrink-0" /> <span className="truncate">{candidate.website}</span>
                    </a>
                  ) : '—'}
                </td>
                <td className="p-3 text-xs text-slate-500 dark:text-slate-400">
                  {candidate.sources?.[0] ? (candidate.sources[0].sourceType === 'OFFICIAL_WEBSITE' ? 'Official Website' : 'Search Grounding') : '—'}
                </td>
                <td className="p-3 font-bold text-slate-700 dark:text-slate-200">{candidate.confidence}%</td>
                <td className="p-3"><CandidateStatusBadge status={candidate.status} /></td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setDrawerCandidateId(candidate.id)} title={t('common.view')} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40">
                      <Eye className="w-4 h-4" />
                    </button>
                    {candidate.status === 'DUPLICATE' ? (
                      <>
                        {candidate.matchedSchool && (
                          <Link href={`/schools?search=${encodeURIComponent(candidate.matchedSchool.name)}`} title={t('aiResearch.viewExisting')} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}
                        {canReject && (
                          <button disabled={pendingId === candidate.id} onClick={() => handleKeepSeparate(candidate.id)} title={t('aiResearch.keepAsSeparate')} className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40">
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                        {canReject && (
                          <button disabled={pendingId === candidate.id} onClick={() => setRejectTarget({ id: candidate.id, name: candidate.name })} title={t('aiResearch.reject')} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    ) : APPROVABLE_STATUSES.has(candidate.status) ? (
                      <>
                        {canApprove && (
                          <button disabled={pendingId === candidate.id} onClick={() => handleApprove(candidate.id)} title={t('aiResearch.approve')} className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                            {pendingId === candidate.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                        )}
                        {canReject && (
                          <button disabled={pendingId === candidate.id} onClick={() => setRejectTarget({ id: candidate.id, name: candidate.name })} title={t('aiResearch.reject')} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={10} className="p-10 text-center text-sm text-slate-400">{t('common.noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{candidate.name}</p>
                <p className="text-xs text-slate-400">{candidate.area || '—'}</p>
              </div>
              <CandidateStatusBadge status={candidate.status} />
            </div>
            {candidate.status === 'DUPLICATE' && candidate.matchedSchool && (
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-[11px] text-purple-700 dark:text-purple-300">
                {t('aiResearch.existingSchoolLabel')}: {candidate.matchedSchool.name}
              </div>
            )}
            <MobileCardField label={t('aiResearch.columnPhone')}><PhoneNumber value={candidate.phone} /> {!candidate.phone && '—'}</MobileCardField>
            <MobileCardField label={t('aiResearch.columnEmail')}>{candidate.email || '—'}</MobileCardField>
            <MobileCardField label={t('aiResearch.columnConfidence')}>{candidate.confidence}%</MobileCardField>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setDrawerCandidateId(candidate.id)} className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">
                {t('aiResearch.review')}
              </button>
              {candidate.status === 'DUPLICATE' ? (
                <>
                  {canReject && <button onClick={() => handleKeepSeparate(candidate.id)} className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40">{t('aiResearch.keepAsSeparate')}</button>}
                  {canReject && <button onClick={() => setRejectTarget({ id: candidate.id, name: candidate.name })} className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/40">{t('aiResearch.reject')}</button>}
                </>
              ) : APPROVABLE_STATUSES.has(candidate.status) ? (
                <>
                  {canApprove && <button onClick={() => handleApprove(candidate.id)} className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600">{t('aiResearch.approve')}</button>}
                  {canReject && <button onClick={() => setRejectTarget({ id: candidate.id, name: candidate.name })} className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/40">{t('aiResearch.reject')}</button>}
                </>
              ) : null}
            </div>
          </div>
        ))}
        {candidates.length === 0 && <p className="text-center text-sm text-slate-400 py-10">{t('common.noData')}</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => goToPage(page - 1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40">
            {t('common.previous')}
          </button>
          <span className="text-xs text-slate-500">
            {t('common.page')} {formatNumber(page, language)} {t('common.of')} {formatNumber(totalPages, language)}
          </span>
          <button disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40">
            {t('common.next')}
          </button>
        </div>
      )}

      {drawerCandidateId && <CandidateDetailDrawer candidateId={drawerCandidateId} onClose={() => setDrawerCandidateId(null)} />}

      <RejectDialog
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        loading={pendingId === rejectTarget?.id}
        candidateName={rejectTarget?.name}
      />

      <ConfirmDialog
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkApprove}
        title={t('aiResearch.approveSelected')}
        description={t('aiResearch.confirmBulkApprove')}
        confirmText={t('aiResearch.approve')}
        confirmVariant="primary"
        loading={bulkLoading}
      />
    </div>
  );
}
