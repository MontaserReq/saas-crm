'use client';

import { useEffect, useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { formatNumber } from '@/lib/formatters';
import { Badge } from '@/components/ui/Badge';
import {
  Activity,
  Zap,
  Globe,
  Coins,
  Clock,
  ShieldAlert,
  Cpu,
  RotateCcw,
  GitFork,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { getJobUsageAction, getJobAttemptsAction } from '@/server/actions/ai-school-research';
import type { JobUsageSummary } from '@/lib/ai/usage';

interface AttemptRecord {
  id: string;
  provider: string;
  model: string;
  attemptNumber: number;
  status: string;
  httpStatus: number | null;
  durationMs: number;
  startedAt: Date | string;
  completedAt: Date | string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  webSearches: number;
  executedTools: string | null;
  isRetry: boolean;
  isFallback: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
}

interface JobUsagePanelProps {
  jobId: string;
  requestedCount: number;
  successfulCount?: number;
}

export function JobUsagePanel({ jobId, requestedCount, successfulCount = 0 }: JobUsagePanelProps) {
  const { language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<JobUsageSummary | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  // Filters
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fallbackFilter, setFallbackFilter] = useState<string>('ALL');
  const [retryFilter, setRetryFilter] = useState<string>('ALL');

  useEffect(() => {
    let mounted = true;
    async function loadUsage() {
      setLoading(true);
      try {
        const [usageRes, attemptsRes] = await Promise.all([
          getJobUsageAction(jobId),
          getJobAttemptsAction(jobId),
        ]);

        if (mounted) {
          if (usageRes.success && usageRes.summary) {
            setSummary(usageRes.summary);
          }
          if (attemptsRes.success && attemptsRes.attempts) {
            setAttempts(attemptsRes.attempts as AttemptRecord[]);
          }
        }
      } catch (err) {
        console.error('Failed to load usage data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadUsage();
    return () => {
      mounted = false;
    };
  }, [jobId]);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      if (providerFilter !== 'ALL' && a.provider !== providerFilter) return false;
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (fallbackFilter === 'FALLBACK_ONLY' && !a.isFallback) return false;
      if (fallbackFilter === 'NO_FALLBACK' && a.isFallback) return false;
      if (retryFilter === 'RETRY_ONLY' && !a.isRetry) return false;
      if (retryFilter === 'NO_RETRY' && a.isRetry) return false;
      return true;
    });
  }, [attempts, providerFilter, statusFilter, fallbackFilter, retryFilter]);

  if (loading) {
    return (
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-400">
        <Activity className="w-5 h-5 animate-pulse mx-auto mb-2 text-brand-500" />
        {language === 'ar' ? 'جاري تحميل مقاييس الاستخدام والتكلفة...' : 'Loading usage and telemetry metrics...'}
      </div>
    );
  }

  if (!summary && attempts.length === 0) {
    return null;
  }

  const denominatorSchools = successfulCount > 0 ? successfulCount : (requestedCount > 0 ? requestedCount : 1);
  const avgTokensPerSchool = summary?.totalTokens ? Math.round(summary.totalTokens / denominatorSchools) : null;
  const avgRequestsPerSchool = summary?.totalApiRequests ? (summary.totalApiRequests / denominatorSchools).toFixed(1) : '0';
  const avgSearchesPerSchool = summary?.totalWebSearches ? (summary.totalWebSearches / denominatorSchools).toFixed(1) : '0';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {language === 'ar' ? 'مقاييس استهلاك الـ AI والبحث' : 'AI & Telemetry Usage Metrics'}
              <Badge variant="blue" className="text-[10px] font-mono">
                {attempts.length} {language === 'ar' ? 'طلب API' : 'API Calls'}
              </Badge>
            </h2>
            <p className="text-xs text-slate-400">
              {language === 'ar'
                ? 'تتبع حقيقي ودقيق لاستهلاك التوكنز وعمليات البحث ومعدل الأخطاء'
                : 'Exact measured token consumption, web searches, retries, and fallback telemetry'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle usage panel"
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Section 1: Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Cpu className="w-3.5 h-3.5 text-brand-500" />
                <span>{language === 'ar' ? 'طلبات الـ API' : 'API Requests'}</span>
              </div>
              <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                {formatNumber(summary?.totalApiRequests || 0, language)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {avgRequestsPerSchool} {language === 'ar' ? '/ مدرسة' : '/ school'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>{language === 'ar' ? 'عمليات البحث' : 'Web Searches'}</span>
              </div>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatNumber(summary?.totalWebSearches || 0, language)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {avgSearchesPerSchool} {language === 'ar' ? '/ مدرسة' : '/ school'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span>{language === 'ar' ? 'إجمالي التوكنز' : 'Total Tokens'}</span>
              </div>
              <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {summary?.totalTokens !== null ? formatNumber(summary?.totalTokens || 0, language) : '—'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {avgTokensPerSchool ? `~${formatNumber(avgTokensPerSchool, language)} / مدرسة` : (language === 'ar' ? 'غير متوفر' : 'N/A')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>{language === 'ar' ? 'متوسط الوقت' : 'Avg Duration'}</span>
              </div>
              <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                {summary?.avgDurationMs ? `${(summary.avgDurationMs / 1000).toFixed(1)}s` : '—'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {summary?.minDurationMs && summary?.maxDurationMs
                  ? `${(summary.minDurationMs / 1000).toFixed(1)}s - ${(summary.maxDurationMs / 1000).toFixed(1)}s`
                  : '—'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <RotateCcw className="w-3.5 h-3.5 text-purple-500" />
                <span>{language === 'ar' ? 'إعادة المحاولة' : 'Retries'}</span>
              </div>
              <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                {formatNumber(summary?.retryCount || 0, language)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {summary?.rateLimitErrors || 0} {language === 'ar' ? 'أخطاء 429' : '429 errors'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <GitFork className="w-3.5 h-3.5 text-rose-500" />
                <span>{language === 'ar' ? 'تحويل للبديل' : 'Fallbacks'}</span>
              </div>
              <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                {formatNumber(summary?.fallbackCount || 0, language)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {summary?.fallbackCount ? (language === 'ar' ? 'تم استخدام Gemini' : 'Gemini used') : (language === 'ar' ? 'لم يحدث' : 'None')}
              </p>
            </div>
          </div>

          {/* Section 2: Detailed Breakdown Grids (Providers & Tokens) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider Breakdown */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-400" />
                {language === 'ar' ? 'تفاصيل المزودات' : 'Provider Telemetry'}
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Groq (Compound Mini)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{summary?.groqRequests || 0} requests</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Google Gemini (Fallback)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{summary?.geminiRequests || 0} requests</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Breakdown */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4 text-slate-400" />
                {language === 'ar' ? 'تفاصيل استهلاك التوكنز (Tokens)' : 'Token Consumption Breakdown'}
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[11px] text-slate-400">{language === 'ar' ? 'الإدخال (Input)' : 'Input Tokens'}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                    {summary?.inputTokens !== null ? formatNumber(summary?.inputTokens || 0, language) : '—'}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[11px] text-slate-400">{language === 'ar' ? 'الإخراج (Output)' : 'Output Tokens'}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                    {summary?.outputTokens !== null ? formatNumber(summary?.outputTokens || 0, language) : '—'}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[11px] text-slate-400">{language === 'ar' ? 'المجموع (Total)' : 'Total Tokens'}</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {summary?.totalTokens !== null ? formatNumber(summary?.totalTokens || 0, language) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Attempt History Table & Filters */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                {language === 'ar' ? 'سجل محاولات الـ API الفردية' : 'Individual API Attempt Log'}
                <span className="text-slate-400 font-normal">({filteredAttempts.length}/{attempts.length})</span>
              </h3>

              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">{language === 'ar' ? 'جميع المزودات' : 'All Providers'}</option>
                  <option value="groq">Groq</option>
                  <option value="gemini">Gemini</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
                  <option value="SUCCESS">{language === 'ar' ? 'ناجح' : 'SUCCESS'}</option>
                  <option value="RATE_LIMITED">{language === 'ar' ? 'معدل الطلب (429)' : 'RATE LIMITED (429)'}</option>
                  <option value="FAILED">{language === 'ar' ? 'فاشل' : 'FAILED'}</option>
                </select>

                <select
                  value={fallbackFilter}
                  onChange={(e) => setFallbackFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">{language === 'ar' ? 'التحويل: الكل' : 'Fallback: All'}</option>
                  <option value="FALLBACK_ONLY">{language === 'ar' ? 'تحويل فقط' : 'Fallback Only'}</option>
                  <option value="NO_FALLBACK">{language === 'ar' ? 'بدون تحويل' : 'No Fallback'}</option>
                </select>

                <select
                  value={retryFilter}
                  onChange={(e) => setRetryFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">{language === 'ar' ? 'الإعادة: الكل' : 'Retry: All'}</option>
                  <option value="RETRY_ONLY">{language === 'ar' ? 'إعادة فقط' : 'Retry Only'}</option>
                  <option value="NO_RETRY">{language === 'ar' ? 'بدون إعادة' : 'No Retry'}</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                    <th className="p-2.5 text-start">#</th>
                    <th className="p-2.5 text-start">{language === 'ar' ? 'المزود' : 'Provider'}</th>
                    <th className="p-2.5 text-start">{language === 'ar' ? 'النموذج' : 'Model'}</th>
                    <th className="p-2.5 text-start">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="p-2.5 text-start">HTTP</th>
                    <th className="p-2.5 text-end">{language === 'ar' ? 'البحث' : 'Searches'}</th>
                    <th className="p-2.5 text-end">{language === 'ar' ? 'التوكنز' : 'Tokens'}</th>
                    <th className="p-2.5 text-end">{language === 'ar' ? 'المدة' : 'Duration'}</th>
                    <th className="p-2.5 text-center">{language === 'ar' ? 'إعادة' : 'Retry'}</th>
                    <th className="p-2.5 text-center">{language === 'ar' ? 'بديل' : 'Fallback'}</th>
                    <th className="p-2.5 text-start">{language === 'ar' ? 'تفاصيل / خطأ' : 'Notes / Error'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAttempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono text-slate-400">{att.attemptNumber}</td>
                      <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-200 uppercase">{att.provider}</td>
                      <td className="p-2.5 font-mono text-slate-500 truncate max-w-[140px]">{att.model}</td>
                      <td className="p-2.5">
                        {att.status === 'SUCCESS' ? (
                          <Badge variant="success" className="text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" /> SUCCESS
                          </Badge>
                        ) : att.status === 'RATE_LIMITED' ? (
                          <Badge variant="warning" className="text-[10px] gap-1">
                            <RotateCcw className="w-3 h-3" /> RATE LIMIT
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <XCircle className="w-3 h-3" /> FAILED
                          </Badge>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600 dark:text-slate-300">
                        {att.httpStatus ? (
                          <span className={att.httpStatus === 429 ? 'text-amber-600 font-bold' : att.httpStatus >= 400 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                            {att.httpStatus}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-2.5 text-end font-semibold text-emerald-600 dark:text-emerald-400">
                        {att.webSearches > 0 ? att.webSearches : '0'}
                      </td>
                      <td className="p-2.5 text-end font-mono">
                        {att.totalTokens !== null ? (
                          <span title={`In: ${att.inputTokens || 0} | Out: ${att.outputTokens || 0}`}>
                            {formatNumber(att.totalTokens, language)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-2.5 text-end font-mono text-slate-500">
                        {(att.durationMs / 1000).toFixed(2)}s
                      </td>
                      <td className="p-2.5 text-center">
                        {att.isRetry ? <Badge variant="purple" className="text-[10px]">Yes</Badge> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="p-2.5 text-center">
                        {att.isFallback ? <Badge variant="blue" className="text-[10px]">Yes</Badge> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="p-2.5 text-slate-500 max-w-[200px] truncate text-[11px]">
                        {att.errorMessage || att.errorCode || (att.webSearches > 0 ? `${att.webSearches} searches executed` : '—')}
                      </td>
                    </tr>
                  ))}
                  {filteredAttempts.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-slate-400 text-xs">
                        {language === 'ar' ? 'لا توجد محاولات مطابقة للتصفية' : 'No attempt records match the selected filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
