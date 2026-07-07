import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Invalid email or password');
      }
      const me = await res.json();
      await refresh();
      // Server-side middleware is the real gate (spec §5.3) -- this is just
      // a UX convenience so an unverified user lands on the right screen.
      navigate(me.emailVerified ? '/dashboard' : '/verify-email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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

        {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
        Don't have an account? <Link to="/signup" style={{ color: 'var(--brand-strong)', fontWeight: 600 }}>Sign up</Link>
      </p>
    </AuthShell>
  );
}
