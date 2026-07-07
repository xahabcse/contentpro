import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import { useAuth } from '@/lib/auth';

export default function VerifyEmailNoticePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  async function resend() {
    setError(null);
    setCooldown(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email }),
      });
      // Always show the same generic success message -- the API itself
      // never reveals whether the account exists (spec §5.3).
      setSent(true);
    } catch {
      setError('Something went wrong. Try again in a moment.');
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

  return (
    <AuthShell title="Check your email" subtitle="One more step before you can start designing.">
      <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
        We sent a verification link to <strong>{user?.email}</strong>. Click it, then log in again to
        continue — you'll be redirected to your dashboard once verified.
      </p>

      {sent && (
        <p className="pill pill-brand" style={{ marginBottom: 16 }}>Verification email sent.</p>
      )}
      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      <button className="btn btn-primary" onClick={resend} disabled={cooldown} style={{ marginBottom: 12 }}>
        {cooldown ? 'Sent — wait a bit before resending' : 'Resend verification email'}
      </button>
      <button className="btn btn-outline" onClick={handleLogout}>Log out</button>
    </AuthShell>
  );
}
