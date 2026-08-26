import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastApi, type ToastItem, type ToastVariant } from '@/lib/toast';

const DURATION_MS = 4500;
// Older toasts fall off the top of the stack rather than filling the screen.
const MAX_VISIBLE = 3;

const ICONS: Record<ToastVariant, ReactNode> = {
  success: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  ),
  info: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.6v.4" />
    </svg>
  ),
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    // Returning the same array when nothing matched lets React bail out of the
    // re-render -- an auto-dismiss timer for an already-evicted toast is a
    // no-op rather than a wasted render of the whole tree.
    setToasts((list) => (list.some((t) => t.id === id) ? list.filter((t) => t.id !== id) : list));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const text = message.trim();
      if (!text) return;
      const id = nextId.current++;
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS));
      setToasts((list) => {
        // A double-submit shouldn't stack two identical cards -- drop the
        // earlier copy so the new one just restarts the timer visually.
        const kept = list.filter((t) => t.variant !== variant || t.message !== text);
        const next = [...kept, { id, variant, message: text }];
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
      dismiss,
    }),
    [push, dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region is the container, always mounted even when empty --
          a region that only appears alongside its content is unreliably
          announced. `additions` keeps auto-dismissal from being read out. */}
      <div
        className="toast-viewport"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.variant}`}>
            <span className="toast-icon" aria-hidden="true">{ICONS[t.variant]}</span>
            <span className="toast-msg">{t.message}</span>
            <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
