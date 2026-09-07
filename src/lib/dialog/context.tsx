'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Dialog, DialogVariant } from '@/components/ui/Dialog';
import { useI18n } from '@/lib/i18n/context';

export interface ConfirmOptions {
  title: string;
  message: string | React.ReactNode;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export interface AlertOptions {
  title: string;
  message: string | React.ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { direction } = useI18n();
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    variant: DialogVariant;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setDialogState({
          isOpen: true,
          title: options.title,
          message: options.message,
          variant: options.variant || 'confirmation',
          confirmText: options.confirmText,
          cancelText: options.cancelText,
          isDestructive: options.isDestructive ?? true,
          resolve,
        });
      });
    },
    []
  );

  const alert = useCallback(
    (options: AlertOptions): Promise<void> => {
      return new Promise<void>((resolve) => {
        setDialogState({
          isOpen: true,
          title: options.title,
          message: options.message,
          variant: options.variant || 'info',
          confirmText: options.confirmText,
          cancelText: undefined,
          isDestructive: false,
          resolve: () => resolve(),
        });
      });
    },
    []
  );

  const handleClose = () => {
    if (dialogState) {
      dialogState.resolve(false);
      setDialogState(null);
    }
  };

  const handleConfirm = () => {
    if (dialogState) {
      dialogState.resolve(true);
      setDialogState(null);
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialogState && (
        <Dialog
          isOpen={dialogState.isOpen}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title={dialogState.title}
          message={dialogState.message}
          variant={dialogState.variant}
          confirmText={dialogState.confirmText}
          cancelText={dialogState.cancelText}
          isDestructive={dialogState.isDestructive}
          direction={direction}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextType {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
