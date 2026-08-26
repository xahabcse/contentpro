import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import { useAuth } from '@/lib/auth';
import { NETWORK_ERROR_MESSAGE, readApiError } from '@/lib/errorMessages';
import { useToast } from '@/lib/toast';

type VerifyState = 'verifying' | 'verified' | 'failed';

// Handles the emailed verification link itself (?token=...) -- POSTs it to
// the API on mount, matching ResetPasswordPage.tsx's pattern. Without a
// token (the normal post-signup landing), falls through to the static
// "check your email" notice below.
function VerifyTokenScreen({ token }: { token: string }) {
  const [state, setState] = useState<VerifyState>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (!res.ok) {
          // Stays a full-screen state rather than a toast -- this IS the
          // screen's outcome, and it has to survive longer than 4 seconds.
          setError(await readApiError(res, 'This verification link is invalid or has expired.'));
          setState('failed');
          return;
        }
        setState('verified');
      } catch {
        if (!cancelled) {
          setError('Something went wrong. Try again in a moment.');
          setState('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'verifying') {
    return (
      <AuthShell title="Verifying…" subtitle="One moment while we confirm your email.">
        <p style={{ fontSize: 15, color: 'var(--muted)' }}>Verifying your email address…</p>
      </AuthShell>
    );
  }

  if (state === 'failed') {
    return (
      <AuthShell title="Verification failed" subtitle={error ?? 'This link is invalid or expired.'}>
        <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Back to login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Email verified" subtitle="Please log in again to continue.">
      <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
        Your email is verified. Log in again to get a fresh session and start designing.
      </p>
      <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
        Log in
      </Link>
    </AuthShell>
  );
}

export default function VerifyEmailNoticePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [cooldown, setCooldown] = useState(false);

  // After signup the user has no session yet, so useAuth().user is null --
  // fall back to the email handed over via router state from SignupPage.
  const stateEmail = (location.state as { email?: string } | null)?.email;
  const email = user?.email ?? stateEmail ?? '';

  async function resend() {
    setCooldown(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        // Only ever a throttle or a malformed address here -- the API returns
        // the same 200 whether or not the account exists (spec §5.3), so this
        // branch can't leak account existence.
        toast.error(await readApiError(res, "We couldn't resend that email. Please try again shortly."));
        return;
      }
      // Always the same generic confirmation, for the same reason.
      toast.success('Verification email sent. Check your inbox.');
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      // Server enforces the real ~60s cooldown/rate-limit; this just avoids
      // spamming the button client-side.
      setTimeout(() => setCooldown(false), 60_000);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  if (token) {
    return <VerifyTokenScreen token={token} />;
  }

  return (
    <AuthShell title="Check your email" subtitle="One more step before you can start designing.">
      <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
        We sent a verification link{email ? <> to <strong>{email}</strong></> : ''}. Click it, then log in
        again to continue — you'll be redirected to your dashboard once verified.
      </p>

      <button className="btn btn-primary" onClick={resend} disabled={cooldown} style={{ marginBottom: 12 }}>
        {cooldown ? 'Please wait before resending' : 'Resend verification email'}
      </button>
      <button className="btn btn-outline" onClick={handleLogout}>Log out</button>
    </AuthShell>
  );
}
