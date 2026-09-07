'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileText, ChevronDown } from 'lucide-react';
import { exportToPDF } from '@/lib/export';
import { useI18n } from '@/lib/i18n/context';

// Column-based API
interface ColumnDefinition<T = any> {
  header: string;
  accessor: (item: T) => any;
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
}: ExportDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
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
  const buildRows = (): Record<string, any>[] => {
    if (data && columns) {
      return data.map((item) => {
        const row: Record<string, any> = {};
        columns.forEach((col) => {
          row[col.header] = col.accessor(item) ?? '';
        });
        return row;
      });
    }
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

  const handleExportPDF = () => {
    exportToPDF(filename, title || filename, exportRows, exportHeaders, filters, language === 'ar' ? 'rtl' : 'ltr');
    setIsOpen(false);
  };

  const isDataAvailable = exportRows.length > 0;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || !isDataAvailable}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
        <span>{t('export.exportAs')}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && isDataAvailable && (
        <div className="absolute z-50 mt-2 w-52 rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {title || filename}
            </p>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={handleExportPDF}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
            >
              <FileText className="w-4 h-4 text-rose-500" /><span>{t('export.exportPDF')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
