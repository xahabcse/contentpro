import { createContext, useContext } from 'react';

// Context + hook only. The provider/UI lives in
// components/ui/ToastProvider.tsx so neither file mixes component and
// non-component exports (keeps Fast Refresh working for both).

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

export interface ToastApi {
  /** Confirms a completed action: "Profile saved." */
  success: (message: string) => void;
  /** A failed action. Pass a humanized message (see lib/errorMessages.ts). */
  error: (message: string) => void;
  /** Neutral heads-up that isn't a failure: "Add your handle first." */
  info: (message: string) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
