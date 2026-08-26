import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import TurnstileWidget from '@/components/TurnstileWidget';

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Signup failed');
      }
      navigate('/verify-email', { state: { email } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Design LinkedIn cards &amp; carousels yourself.">
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

        <div style={{ marginBottom: 16 }}>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <TurnstileWidget token={turnstileToken} onToken={setTurnstileToken} />
        </div>

        {error && <p className="error-text" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting || !turnstileToken}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
        Already have an account? <Link to="/login" style={{ color: 'var(--ink)', fontWeight: 600 }}>Log in</Link>
      </p>
    </AuthShell>
  );
}
