'use client';

import React, { useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  X,
} from 'lucide-react';

export type DialogVariant = 'confirmation' | 'success' | 'error' | 'warning' | 'info';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string | React.ReactNode;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  isLoading?: boolean;
  isDestructive?: boolean;
  direction?: 'rtl' | 'ltr';
}

export function Dialog({
  isOpen,
  onClose,
  title,
  message,
  variant = 'confirmation',
  confirmText,
  cancelText,
  onConfirm,
  isLoading = false,
  isDestructive = false,
  direction = 'rtl',
}: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const isRTL = direction === 'rtl';

  const variantConfig = {
    confirmation: {
      icon: isDestructive ? (
        <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
      ) : (
        <HelpCircle className="w-6 h-6 text-brand-600 dark:text-brand-400" />
      ),
      iconBg: isDestructive
        ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60'
        : 'bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/60',
      confirmButtonClass: isDestructive
        ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus:ring-rose-500/30'
        : 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-xs focus:ring-brand-500/30',
      defaultConfirmText: isRTL ? 'تأكيد' : 'Confirm',
      defaultCancelText: isRTL ? 'إلغاء' : 'Cancel',
      showCancel: true,
    },
    success: {
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60',
      confirmButtonClass:
        'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs focus:ring-emerald-500/30',
      defaultConfirmText: isRTL ? 'حسناً' : 'OK',
      defaultCancelText: '',
      showCancel: false,
    },
    error: {
      icon: <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />,
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60',
      confirmButtonClass:
        'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus:ring-rose-500/30',
      defaultConfirmText: isRTL ? 'إغلاق' : 'Close',
      defaultCancelText: '',
      showCancel: false,
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60',
      confirmButtonClass:
        'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs focus:ring-amber-500/30',
      defaultConfirmText: isRTL ? 'متابعة' : 'Proceed',
      defaultCancelText: isRTL ? 'إلغاء' : 'Cancel',
      showCancel: true,
    },
    info: {
      icon: <Info className="w-6 h-6 text-brand-600 dark:text-brand-400" />,
      iconBg: 'bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/60',
      confirmButtonClass:
        'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-xs focus:ring-brand-500/30',
      defaultConfirmText: isRTL ? 'حسناً' : 'OK',
      defaultCancelText: '',
      showCancel: false,
    },
  }[variant];

  const resolvedConfirmText = confirmText || variantConfig.defaultConfirmText;
  const resolvedCancelText = cancelText || variantConfig.defaultCancelText;

  const handleConfirmClick = async () => {
    if (onConfirm) {
      await onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto" dir={direction}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-charcoal-950/60 backdrop-blur-xs transition-opacity"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Dialog Box */}
      <div className="relative w-full max-w-md bg-white dark:bg-charcoal-900 rounded-2xl shadow-2xl border border-charcoal-200 dark:border-charcoal-800 z-10 overflow-hidden my-8 animate-fade-in font-sans">
        {/* Top bar with close button */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${variantConfig.iconBg}`}
            >
              {variantConfig.icon}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-charcoal-950 dark:text-charcoal-50 leading-snug">
                {title}
              </h3>
              <div className="text-xs sm:text-sm text-charcoal-600 dark:text-charcoal-300 mt-1 leading-relaxed">
                {typeof message === 'string' ? <p>{message}</p> : message}
              </div>
            </div>
          </div>

          {!isLoading && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200 hover:bg-charcoal-100 dark:hover:bg-charcoal-800 transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="px-6 py-4 bg-charcoal-50/80 dark:bg-charcoal-800/60 border-t border-charcoal-200/80 dark:border-charcoal-800 flex items-center justify-end gap-2.5">
          {variantConfig.showCancel && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-charcoal-700 dark:text-charcoal-300 bg-white dark:bg-charcoal-800 border border-charcoal-300 dark:border-charcoal-700 hover:bg-charcoal-100/80 dark:hover:bg-charcoal-700 rounded-xl transition-colors focus:outline-none disabled:opacity-50"
            >
              {resolvedCancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isLoading}
            className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all focus:outline-none focus:ring-2 disabled:opacity-50 flex items-center gap-2 ${variantConfig.confirmButtonClass}`}
          >
            {isLoading && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{resolvedConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
