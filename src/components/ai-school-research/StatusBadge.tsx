'use client';

import { Badge } from '@/components/ui/Badge';
import { useI18n } from '@/lib/i18n/context';

export function JobStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, { variant: any; key: string }> = {
    PENDING: { variant: 'secondary', key: 'aiResearch.statusPending' },
    RUNNING: { variant: 'blue', key: 'aiResearch.statusRunning' },
    COMPLETED: { variant: 'success', key: 'aiResearch.statusCompleted' },
    FAILED: { variant: 'destructive', key: 'aiResearch.statusFailed' },
    CANCELLED: { variant: 'outline', key: 'aiResearch.statusCancelled' },
  };
  const entry = map[status] || map.PENDING;
  return <Badge variant={entry.variant}>{t(entry.key)}</Badge>;
}

export function CandidateStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, { variant: any; key: string }> = {
    NEW: { variant: 'success', key: 'aiResearch.filterReady' },
    NEEDS_REVIEW: { variant: 'warning', key: 'aiResearch.filterNeedsReview' },
    DUPLICATE: { variant: 'purple', key: 'aiResearch.filterDuplicates' },
    APPROVED: { variant: 'blue', key: 'aiResearch.approve' },
    REJECTED: { variant: 'destructive', key: 'aiResearch.filterRejected' },
    IMPORTED: { variant: 'success', key: 'aiResearch.candidateImported' },
  };
  const entry = map[status] || map.NEW;
  return <Badge variant={entry.variant}>{t(entry.key)}</Badge>;
}
