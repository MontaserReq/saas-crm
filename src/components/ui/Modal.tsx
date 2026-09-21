'use client';

import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  /** Ref to the element that triggered this modal; focus returns there on close. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Accessible label for the close button (localized by caller). */
  closeLabel?: string;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
  returnFocusRef,
  closeLabel = 'Close',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus trap + Escape handler + scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Snapshot the element that had focus before the modal opened
    const previouslyFocused = returnFocusRef?.current ?? (document.activeElement as HTMLElement | null);

    // Move focus into the modal after paint
    const raf = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialog.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
        ).filter((el) => el.offsetParent !== null); // exclude hidden elements

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === dialog) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;

      // Restore focus to the opener
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        // Use rAF to ensure the DOM has settled before restoring focus
        requestAnimationFrame(() => {
          previouslyFocused.focus();
        });
      }
    };
    // onClose is stable; omitting from deps is intentional to avoid re-registration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses: Record<NonNullable<ModalProps['maxWidth']>, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
    '4xl': 'sm:max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6">
      {/* Backdrop — aria-hidden so screen readers ignore it */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex flex-col w-full ${maxWidthClasses[maxWidth]} max-h-[88dvh] sm:max-h-[calc(100vh-4rem)] bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 overflow-hidden sm:my-8 focus:outline-none`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="min-w-0">
            <h3
              id={titleId}
              className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
            >
              {title}
            </h3>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="p-2.5 -me-1 shrink-0 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
