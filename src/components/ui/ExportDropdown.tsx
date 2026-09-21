'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { exportToPDF, exportToPrintableTable, exportToXlsx } from '@/lib/export';
import { useI18n } from '@/lib/i18n/context';

export type ExportFormat = 'excel' | 'pdf';

// Column-based API
export interface ColumnDefinition<T = any> {
  header: string;
  accessor: (item: T, index: number) => any;
}

interface ExportDropdownProps<T = any> {
  filename: string;
  title?: string;
  data?: T[];
  columns?: ColumnDefinition<T>[];
  // Legacy row-based API
  rows?: Record<string, any>[];
  headers?: { key: string; label: string }[];
  disabled?: boolean;
  filters?: Record<string, string | number>;
  /** Formats offered inside the menu. Defaults to PDF only (legacy behaviour). */
  formats?: ExportFormat[];
  /**
   * Loads the complete result set (every filtered record, not only the visible
   * page) right before the export runs. When omitted, the rows held in memory
   * are exported.
   */
  loadAll?: () => Promise<T[]>;
  /** Excel column widths in character units, aligned with the column order. */
  columnWidths?: number[];
  /** Worksheet name used by the Excel data table. */
  sheetName?: string;
  /**
   * PDF renderer. 'print' opens the Arabic-safe printable view (recommended for
   * RTL data), 'jspdf' keeps the legacy jsPDF download.
   */
  pdfMode?: 'jspdf' | 'print';
}

export function ExportDropdown<T = any>({
  filename,
  title,
  data,
  columns,
  rows,
  headers,
  disabled = false,
  filters = {},
  formats = ['pdf'],
  loadAll,
  columnWidths,
  sheetName,
  pdfMode = 'jspdf',
}: ExportDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t, language } = useI18n();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build unified rows from either API
  const buildRowsFrom = (items: T[]): Record<string, any>[] => {
    if (!columns) return [];
    return items.map((item, index) => {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        row[col.header] = col.accessor(item, index) ?? '';
      });
      return row;
    });
  };

  const buildRows = (): Record<string, any>[] => {
    if (data && columns) return buildRowsFrom(data);
    if (rows) return rows;
    return [];
  };

  const buildHeaders = (): { key: string; label: string }[] | undefined => {
    if (columns) {
      return columns.map((col) => ({ key: col.header, label: col.header }));
    }
    return headers;
  };

  const exportRows = buildRows();
  const exportHeaders = buildHeaders();

  // Localized metadata shared by the Excel metadata sheet and the print header.
  const exportMeta = {
    sheetName: t('export.infoSheet'),
    generatedAt: t('export.generatedAt'),
    recordsCount: t('export.recordsCount'),
    filters: t('export.appliedFilters'),
    allRecords: t('export.allRecords'),
  };

  // `loadAll` lets a page export the complete filtered result set instead of the
  // rows currently rendered on screen.
  const resolveExportRows = async (): Promise<Record<string, any>[]> => {
    if (!loadAll) return exportRows;
    const loaded = await loadAll();
    const loadedRows = columns ? buildRowsFrom(loaded || []) : [];
    return loadedRows.length > 0 ? loadedRows : exportRows;
  };

  const runExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setError(null);
    try {
      const targetRows = await resolveExportRows();
      if (targetRows.length === 0) {
        setError(t('export.noData'));
        return;
      }
      const direction = language === 'ar' ? 'rtl' : 'ltr';
      const exportTitle = title || filename;
      if (format === 'excel') {
        await exportToXlsx(filename, targetRows, exportHeaders, {
          title: exportTitle,
          filters,
          widths: columnWidths,
          sheetName,
          direction,
          meta: exportMeta,
        });
      } else if (pdfMode === 'print') {
        const printed = exportToPrintableTable({
          filename,
          title: exportTitle,
          rows: targetRows,
          headers: exportHeaders,
          filters,
          direction,
          meta: exportMeta,
        });
        if (!printed) exportToPDF(filename, exportTitle, targetRows, exportHeaders, filters, direction);
      } else {
        exportToPDF(filename, exportTitle, targetRows, exportHeaders, filters, direction);
      }
      setIsOpen(false);
    } catch (err: any) {
      setError(err?.message || t('export.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const isDataAvailable = exportRows.length > 0 || !!loadAll;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || !isDataAvailable || isExporting}
        onClick={() => {
          setError(null);
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting
          ? <Loader2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 animate-spin" />
          : <Download className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
        <span>{isExporting ? t('export.exporting') : t('export.exportAs')}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && isDataAvailable && (
        <div className="absolute top-full end-0 z-50 mt-2 w-[calc(100vw-1.5rem)] sm:w-60 rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {title || filename}
            </p>
          </div>

          <div className="py-1">
            {formats.includes('excel') && (
              <button
                type="button"
                disabled={isExporting}
                onClick={() => runExport('excel')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /><span>{t('export.exportExcel')}</span>
              </button>
            )}

            {formats.includes('pdf') && (
              <button
                type="button"
                disabled={isExporting}
                onClick={() => runExport('pdf')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4 text-rose-500" /><span>{t('export.exportPDF')}</span>
              </button>
            )}
          </div>

          {isExporting && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t('export.exporting')}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
