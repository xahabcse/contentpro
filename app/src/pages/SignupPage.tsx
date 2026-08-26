import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import TurnstileWidget from '@/components/TurnstileWidget';
import { NETWORK_ERROR_MESSAGE, readApiError } from '@/lib/errorMessages';
import { useToast } from '@/lib/toast';

export default function SignupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, "We couldn't create your account. Please try again."));
        // Turnstile tokens are single-use -- the one just submitted is now
        // dead regardless of why signup failed, so a retry with it would
        // fail closed on TURNSTILE_FAILED even with correct credentials.
        setTurnstileToken('');
        setTurnstileResetKey((k) => k + 1);
        return;
      }
      // The toast survives the route change -- it confirms the account landed
      // before the verify-email screen explains the next step.
      toast.success('Account created. Check your email for the verification link.');
      navigate('/verify-email', { state: { email } });
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
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
          <TurnstileWidget token={turnstileToken} onToken={setTurnstileToken} resetSignal={turnstileResetKey} />
        </div>

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
