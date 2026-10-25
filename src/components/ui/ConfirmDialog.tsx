'use client';

import { useI18n } from '@/lib/i18n/context';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { ReactNode, useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  confirmVariant = 'danger',
  loading = false,
  children,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', keydown);
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus());
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', keydown);
      previouslyFocused?.focus();
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const confirmBtnClass =
    confirmVariant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20'
      : confirmVariant === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20'
      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/20';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-3xl shadow-2xl max-h-[88dvh] sm:max-h-[calc(100vh-4rem)] max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute top-4 end-4 p-2.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmVariant === 'danger'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600'
                  : confirmVariant === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600'
                  : 'bg-brand-50 dark:bg-brand-950/60 text-brand-600'
              }`}
            >
              {confirmVariant === 'danger' ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
              <p id={descriptionId} className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{description}</p>
            </div>
          </div>

          {children}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {cancelText || t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all ${confirmBtnClass}`}
          >
            {loading ? t('common.loading') : confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
