import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          size?: 'normal' | 'flexible' | 'compact';
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

// Renders the real Cloudflare Turnstile widget (docs/contentpro-spec.md
// §5.5) once its script has loaded -- the script tag is async, so poll
// briefly for window.turnstile rather than assuming it's ready on mount.
// Shared by SignupPage and LoginPage.
export default function TurnstileWidget({ token, onToken }: { token: string; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keeps the effect mount-once (matching the widget's own lifecycle) while
  // still calling the latest callback, since an inline arrow prop would
  // otherwise change identity on every parent render.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;

    let widgetId: string | null = null;
    let cancelled = false;

    const tryRender = () => {
      if (cancelled) return;
      if (window.turnstile && containerRef.current) {
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t) => onTokenRef.current(t),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
          size: 'flexible',
        });
      } else {
        setTimeout(tryRender, 100);
      }
    };
    tryRender();

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  if (TURNSTILE_SITE_KEY) {
    return <div ref={containerRef} data-testid="turnstile-placeholder" />;
  }

  if (import.meta.env.DEV) {
    // Dev-only bypass -- import.meta.env.DEV is statically false in a
    // production build, so this branch is dead-code-eliminated and can
    // never render for real users.
    return (
      <div data-testid="turnstile-placeholder">
        <p className="error-text" style={{ marginBottom: 6 }}>Turnstile site key not configured (dev).</p>
        <button
          type="button"
          className="btn btn-outline"
          style={{ height: 36, fontSize: 13 }}
          onClick={() => onTokenRef.current('dev-bypass-token')}
        >
          {token ? 'Dev bypass active ✓' : 'Simulate Turnstile success (dev only)'}
        </button>
      </div>
    );
  }

  return (
    <p className="error-text" role="alert" data-testid="turnstile-placeholder">
      This action is temporarily unavailable. Please try again later.
    </p>
  );
}
