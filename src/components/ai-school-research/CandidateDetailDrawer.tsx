'use client';

import { useEffect, useState } from 'react';
import { X, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { getCandidateDetailAction } from '@/server/actions/ai-school-research';
import { PhoneNumber } from '@/components/ui/PhoneNumber';
import { CandidateStatusBadge } from './StatusBadge';

interface CandidateDetailDrawerProps {
  candidateId: string;
  onClose: () => void;
}

export function CandidateDetailDrawer({ candidateId, onClose }: CandidateDetailDrawerProps) {
  const { t } = useI18n();
  const [candidate, setCandidate] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCandidateDetailAction(candidateId).then((res) => {
      if (!active) return;
      if (res.success) setCandidate(res.candidate);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [candidateId]);

  const field = (label: string, value: string | null | undefined) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800 text-sm">
      <span className="text-slate-400 font-semibold shrink-0">{label}</span>
      <span className="text-slate-800 dark:text-slate-200 text-end min-w-0 break-words">{value || t('aiResearch.notFound')}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('aiResearch.candidateDetails')}</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading || !candidate ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">{candidate.name}</h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <CandidateStatusBadge status={candidate.status} />
                  <span className="text-xs text-slate-400">{t('aiResearch.columnConfidence')}: {candidate.confidence}%</span>
                </div>
              </div>

              <div>
                {field(t('aiResearch.location'), [candidate.city, candidate.area].filter(Boolean).join(' / '))}
                {field(t('aiResearch.fieldSchoolType'), candidate.schoolType)}
                {candidate.phone ? (
                  <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800 text-sm">
                    <span className="text-slate-400 font-semibold shrink-0">{t('schools.phone')}</span>
                    <PhoneNumber value={candidate.phone} className="text-slate-800 dark:text-slate-200" />
                  </div>
                ) : (
                  field(t('schools.phone'), null)
                )}
                {field(t('schools.email'), candidate.email)}
                {field(t('aiResearch.fieldWebsite'), candidate.website)}
                {field(t('aiResearch.fieldAddress'), candidate.address)}
                {field(t('aiResearch.fieldContactPerson'), candidate.contactPerson || t('aiResearch.notFound'))}
              </div>

              {candidate.status === 'DUPLICATE' && candidate.matchedSchool && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs">
                  <p className="font-bold text-purple-700 dark:text-purple-300">{t('aiResearch.possibleDuplicate')}</p>
                  <p className="text-purple-600 dark:text-purple-400 mt-1">{t('aiResearch.existingSchoolLabel')}: {candidate.matchedSchool.name} ({candidate.matchedSchool.city})</p>
                </div>
              )}

              {candidate.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                  {candidate.rejectionReason}
                </div>
              )}

              <div>
                <h5 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{t('aiResearch.sources')}</h5>
                {candidate.sources?.length ? (
                  <ul className="space-y-2">
                    {candidate.sources.map((source: any) => (
                      <li key={source.id} className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <LinkIcon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700 dark:text-slate-300">{source.field} — {source.sourceType === 'OFFICIAL_WEBSITE' ? 'Official Website' : 'Search Grounding'}</p>
                          {source.sourceUrl && (
                            <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline break-all">
                              {source.sourceUrl}
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">{t('common.noData')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
