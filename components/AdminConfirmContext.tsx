'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import ConfirmModal, { ConfirmModalProps } from './ConfirmModal';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'default';
};

type AdminConfirmContextValue = {
  showConfirm: (options: ConfirmOptions) => void;
};

const AdminConfirmContext = createContext<AdminConfirmContextValue | null>(null);

export function AdminConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmModalProps | null>(null);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setState({
      open: true,
      onClose: () => setState((s) => (s ? { ...s, open: false } : null)),
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      onConfirm: options.onConfirm,
      variant: options.variant,
    });
  }, []);

  const handleClose = useCallback(() => setState(null), []);

  return (
    <AdminConfirmContext.Provider value={{ showConfirm }}>
      {children}
      {state && (
        <ConfirmModal
          open={state.open}
          onClose={handleClose}
          title={state.title}
          message={state.message}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          onConfirm={state.onConfirm}
          variant={state.variant}
        />
      )}
    </AdminConfirmContext.Provider>
  );
}

export function useAdminConfirm(): AdminConfirmContextValue {
  const ctx = useContext(AdminConfirmContext);
  if (!ctx) {
    throw new Error('useAdminConfirm must be used within AdminConfirmProvider');
  }
  return ctx;
}
