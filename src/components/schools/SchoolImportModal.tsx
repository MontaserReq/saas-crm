'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n/context';
import { FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface SchoolImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SchoolImportModal({ isOpen, onClose, onSuccess }: SchoolImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const { t, language } = useI18n();

  const analyzeFile = async (uploadedFile: File) => {
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setOperationId(crypto.randomUUID());
    setError(null);
    setPreviewData(null);
    setSummary(null);
    setParsing(true);

    try {
      setParsing(false);
      setValidating(true);

      const formData = new FormData();
      formData.append('file', uploadedFile);
      const response = await fetch('/api/schools/import', { method: 'POST', body: formData });
      const validationRes = await response.json();
      setValidating(false);

      if (response.ok && validationRes.success) {
        setPreviewData(validationRes);
      } else {
        setError(validationRes.error?.message || validationRes.error || t('common.error'));
      }
    } catch (err: any) {
      setParsing(false);
      setValidating(false);
      setError(err.message || t('common.error'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) void analyzeFile(uploadedFile);
  };

  const handleExecuteImport = async () => {
    if (!previewData || previewData.validCount === 0) return;

    const validRowsToImport = previewData.preview
      .filter((r: any) => r.status === 'valid')
      .map((r: any) => r.data);

    setImporting(true);
    setError(null);

    const response = await fetch('/api/schools/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        rows: validRowsToImport,
        metadata: {
          fileName: file?.name,
          skippedCount: previewData.duplicateCount + previewData.invalidCount,
          failedCount: previewData.invalidCount,
          duplicateCount: previewData.duplicateCount,
        },
      }),
    });
    const res = await response.json();
    setImporting(false);

    if (res.success) {
      setSummary({ count: res.importedCount, skipped: previewData.duplicateCount + previewData.invalidCount, invalid: previewData.invalidCount, duplicates: previewData.duplicateCount });
      if (onSuccess) onSuccess();
    } else {
      setError(res.error?.message || res.error || t('common.error'));
    }
  };

  const handleReset = () => {
    setFile(null);
    setOperationId(null);
    setPreviewData(null);
    setSummary(null);
    setError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('schools.importTitle')}
      description={t('schools.importDesc')}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Success summary */}
        {summary ? (
          <div className="p-6 text-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
              {t('schools.importCompletedTitle')}
            </h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {t('schools.importCompletedDesc', { count: summary.count })}
            </p>
            <div className="pt-2">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                {t('schools.doneBtn')}
              </button>
            </div>
          </div>
        ) : !previewData ? (
          /* File Upload Zone */
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dropped = event.dataTransfer.files?.[0]; if (dropped) void analyzeFile(dropped); }} className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center hover:border-brand-500 transition-colors">
            <input
              type="file"
              id="school-import-input"
              className="hidden"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="school-import-input"
              className="cursor-pointer flex flex-col items-center justify-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div>
                <span className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:underline">
                  {t('schools.selectFile')}
                </span>
                <p className="text-xs text-slate-400 mt-1">{t('schools.fileTypesHint')}</p>
              </div>
            </label>
            {(parsing || validating) && (
              <p className="text-xs font-semibold text-brand-600 animate-pulse mt-4">
                {t('common.loading')}
              </p>
            )}
            {file && !parsing && !validating && <p className="text-xs text-slate-500 mt-3">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
          </div>
        ) : (
          /* Validation Preview Table */
          <div className="space-y-4">
            {/* Metric counters */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block">
                  {t('schools.validRows')}
                </span>
                <span className="text-xl font-extrabold text-emerald-600">{previewData.validCount}</span>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 block">
                  {t('schools.duplicateRows')}
                </span>
                <span className="text-xl font-extrabold text-amber-600">{previewData.duplicateCount}</span>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-center">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300 block">
                  {t('schools.invalidRows')}
                </span>
                <span className="text-xl font-extrabold text-rose-600">{previewData.invalidCount}</span>
              </div>
            </div>

            <div className="grid gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div><span className="font-bold">{t('schools.detectedColumns')}:</span> {previewData.detectedColumns?.length || 0}</div>
              <div><span className="font-bold">{t('schools.mappedColumns')}:</span> {Object.keys(previewData.mappedColumns || {}).length}</div>
              <div><span className="font-bold">{t('schools.ignoredColumns')}:</span> {previewData.ignoredColumns?.length || 0}</div>
              {previewData.ignoredColumns?.length > 0 && (
                <div><span className="font-bold">{t('schools.ignoredColumns')}:</span> {previewData.ignoredColumns.map((column: any) => column.header).join(', ')}</div>
              )}
              {previewData.missingOptionalColumns?.length > 0 && (
                <div><span className="font-bold">{t('schools.missingOptionalColumns')}:</span> {previewData.missingOptionalColumns.join(', ')}</div>
              )}
            </div>

            {/* Preview items list */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {previewData.preview.map((row: any) => (
                <div key={row.index} className="p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {row.status === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {row.status === 'duplicate' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                    {row.status === 'invalid' && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 break-words">
                        #{row.index} {row.data.name || t('schools.unnamedSchool')}
                      </span>
                      <span className="hidden">
                        {row.data.responsibleEmployee ? `${language === 'ar' ? 'المسؤول: ' : 'Responsible: '}${row.data.responsibleEmployee} · ` : ''}{row.data.city} {row.data.phone ? `• ${row.data.phone}` : ''}
                      </span>
                      <div className="text-[11px] text-slate-400 mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                        <span>Responsible: {row.data.responsibleEmployee || '—'}</span>
                        <span>City: {row.data.city || '—'}</span>
                        <span>Class: {row.data.classification || '—'}</span>
                        <span>Phone: {row.data.phone || '—'}</span>
                        <span className="col-span-2 truncate">Email: {row.data.email || '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-end max-w-full sm:max-w-[40%]">
                    {row.status === 'valid' && (
                      <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        {t('schools.readyStatus')}
                      </span>
                    )}
                    {row.status === 'duplicate' && (
                      <span className="inline-block text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded break-words">
                        {row.duplicateReason || t('schools.duplicateStatus')}
                      </span>
                    )}
                    {row.status === 'invalid' && (
                      <span className="inline-block text-[10px] text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded break-words">
                        {row.errors?.join(', ') || t('schools.invalidStatus')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                {t('schools.uploadDifferentFile')}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importing || previewData.validCount === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md shadow-brand-500/10"
                >
                  <span>{importing ? t('common.loading') : `${t('schools.confirmImport')} (${previewData.validCount})`}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
