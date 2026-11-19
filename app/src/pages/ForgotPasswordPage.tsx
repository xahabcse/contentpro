import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import { NETWORK_ERROR_MESSAGE } from '@/lib/errorMessages';
import { useToast } from '@/lib/toast';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Show the generic "check your email" response for ANY response status
      // -- never branch on it, that would reveal whether the account exists
      // (spec §5.4).
      setSent(true);
    } catch {
      // A request that never left the browser is not an enumeration signal,
      // and claiming "check your email" here would be a lie.
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell icon="mail" eyebrow="Reset link sent" title={<>Check your <em>email.</em></>} subtitle="If an account exists for that address, a reset link is on its way.">
        <Link to="/login" className="btn btn-outline" style={{ textDecoration: 'none' }}>Back to login</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell icon="key" eyebrow="Forgot password" title={<>It happens. <em>Let's reset it.</em></>} subtitle="Enter the email you signed up with and we'll send you a reset link.">
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
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p style={{ marginTop: 20, fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
        <Link to="/login" style={{ color: 'var(--ink)', fontWeight: 600 }}>Back to login</Link>
      </p>
    </AuthShell>
  );
}
