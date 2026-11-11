import { useEffect, useRef, useState } from 'react';

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
      reset: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const SCRIPT_TIMEOUT_MS = 8_000;
type WidgetStatus = 'loading' | 'ready' | 'unavailable' | 'challenge-error' | 'expired';

function widgetSize(container: HTMLElement): 'compact' | 'flexible' {
  const width = container.getBoundingClientRect().width;
  return width > 0 && width < 300 ? 'compact' : 'flexible';
}

// Renders the real Cloudflare Turnstile widget (docs/contentpro-spec.md
// §5.5) once its script has loaded -- the script tag is async, so poll
// briefly for window.turnstile rather than assuming it's ready on mount.
// Shared by SignupPage and LoginPage.
export default function TurnstileWidget({
  token,
  onToken,
  resetSignal,
}: {
  token: string;
  onToken: (token: string) => void;
  /**
   * Bump this (e.g. a counter incremented on every failed submit) to force a
   * fresh token. Turnstile tokens are single-use -- once a submit consumes
   * one (success OR failure), the same token fails TURNSTILE_FAILED on a
   * retry unless the widget is explicitly reset.
   */
  resetSignal?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keeps the effect mount-once (matching the widget's own lifecycle) while
  // still calling the latest callback, since an inline arrow prop would
  // otherwise change identity on every parent render.
  const onTokenRef = useRef(onToken);
  const widgetIdRef = useRef<string | null>(null);
  const widgetSizeRef = useRef<'compact' | 'flexible' | null>(null);
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;

    let cancelled = false;
    let script: HTMLScriptElement | null = null;
    let createdScript = false;

    const stopWaiting = () => {
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
    };
    const failToLoad = () => {
      if (cancelled) return;
      stopWaiting();
      onTokenRef.current('');
      setStatus('unavailable');
    };
    const tryRender = () => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      stopWaiting();
      try {
        setStatus('ready');
        const size = widgetSize(containerRef.current);
        widgetSizeRef.current = size;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t) => onTokenRef.current(t),
          'expired-callback': () => {
            onTokenRef.current('');
            setStatus('expired');
          },
          'error-callback': () => {
            onTokenRef.current('');
            setStatus('challenge-error');
          },
          size,
        });
      } catch {
        onTokenRef.current('');
        setStatus('challenge-error');
      }
    };

    const pollId = window.setInterval(tryRender, 100);
    const timeoutId = window.setTimeout(failToLoad, SCRIPT_TIMEOUT_MS);

    // The HTML script may have failed before this page mounted. A bounded
    // wait gives clear feedback, and Retry injects a fresh script request.
    if (!window.turnstile) {
      script = attempt === 0
        ? document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
        : null;
      if (!script) {
        script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        createdScript = true;
        document.head.appendChild(script);
      }
      script.addEventListener('error', failToLoad);
    }
    window.setTimeout(tryRender, 0);

    return () => {
      cancelled = true;
      stopWaiting();
      script?.removeEventListener('error', failToLoad);
      if (createdScript) script?.remove();
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      widgetSizeRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;
    const container = containerRef.current;
    const checkWidth = () => {
      const next = widgetSize(container);
      if (widgetIdRef.current && widgetSizeRef.current !== next) {
        widgetSizeRef.current = next;
        onTokenRef.current('');
        setStatus('loading');
        setAttempt((old) => old + 1);
      }
    };
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(checkWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Only fires when the parent deliberately bumps resetSignal after a failed
  // submit -- the mount-time invocation (widgetIdRef still null, since
  // rendering above happens asynchronously) is a harmless no-op.
  useEffect(() => {
    if (resetSignal === undefined) return;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (TURNSTILE_SITE_KEY) {
    return (
      <div data-testid="turnstile-placeholder">
        <div ref={containerRef} />
        {status === 'loading' && <p role="status" style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0 0' }}>Loading security check…</p>}
        {status !== 'loading' && status !== 'ready' && (
          <div role="alert" style={{ marginTop: 8 }}>
            <p className="error-text" style={{ margin: '0 0 8px' }}>
              {status === 'unavailable'
                ? 'The security check could not load. Check your connection or content blocker, then retry.'
                : status === 'expired'
                  ? 'The security check expired. Please retry.'
                  : 'The security check failed. Please retry.'}
            </p>
            <button type="button" className="btn btn-outline" style={{ width: 'auto', minHeight: 36, padding: '0 14px', fontSize: 13 }} onClick={() => {
              onTokenRef.current('');
              setStatus('loading');
              setAttempt((old) => old + 1);
            }}>Retry security check</button>
          </div>
        )}
      </div>
    );
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
