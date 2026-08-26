import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import TurnstileWidget from '@/components/TurnstileWidget';
import { useAuth } from '@/lib/auth';
import { NETWORK_ERROR_MESSAGE, readApiError } from '@/lib/errorMessages';
import { useToast } from '@/lib/toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Invalid email or password.'));
        return;
      }
      const me = (await res.json()) as { emailVerified?: boolean };
      await refresh();
      // Server-side middleware is the real gate (spec §5.3) -- this is just
      // a UX convenience so an unverified user lands on the right screen.
      if (me.emailVerified) {
        navigate('/dashboard');
      } else {
        toast.info('Verify your email address to finish setting up your account.');
        navigate('/verify-email');
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Log in" subtitle="Welcome back.">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <p style={{ textAlign: 'right', marginBottom: 16 }}>
          <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--muted)' }}>Forgot password?</Link>
        </p>

        <div style={{ marginBottom: 16 }}>
          <TurnstileWidget token={turnstileToken} onToken={setTurnstileToken} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting || !turnstileToken}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
        Don't have an account? <Link to="/signup" style={{ color: 'var(--ink)', fontWeight: 600 }}>Sign up</Link>
      </p>
    </AuthShell>
  );
}
