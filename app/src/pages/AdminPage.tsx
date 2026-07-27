import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';

interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  handle?: string | null;
  emailVerified?: boolean;
  designation?: string | null;
  companyName?: string | null;
  createdAt?: number | string | null;
}

interface AuthEvent {
  ts: number;
  type: string;
  email?: string | null;
  ip?: string | null;
  detail?: string | null;
}

type Gate = 'checking' | 'ok';

function formatDate(value?: number | string | null): string {
  if (value === null || value === undefined) return '—';
  const d = new Date(typeof value === 'number' ? value : value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [gate, setGate] = useState<Gate>('checking');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const r = await fetch('/api/admin/users', { credentials: 'include' });
      if (!r.ok) throw new Error('load');
      const data = (await r.json()) as { users: AdminUser[] };
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError('Could not load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const r = await fetch('/api/admin/logs?limit=100', { credentials: 'include' });
      if (!r.ok) throw new Error('load');
      const data = (await r.json()) as { events: AuthEvent[] };
      const list = Array.isArray(data.events) ? data.events : [];
      setEvents([...list].sort((a, b) => b.ts - a.ts));
    } catch {
      setError('Could not load logs.');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/admin/me', { credentials: 'include' });
        if (!r.ok) throw new Error('denied');
        const data = (await r.json()) as { isAdmin?: boolean };
        if (cancelled) return;
        if (!data.isAdmin) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setGate('ok');
      } catch {
        if (!cancelled) navigate('/dashboard', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (gate !== 'ok') return;
    void loadUsers();
    void loadLogs();
  }, [gate, loadUsers, loadLogs]);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingDelete(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingDelete]);

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setDeleting(true);
    setRowError(null);
    try {
      const r = await fetch('/api/admin/users/' + encodeURIComponent(target.id), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) {
        let code = '';
        try {
          const body = (await r.json()) as { error?: string };
          code = body.error ?? '';
        } catch {
          /* ignore */
        }
        if (code === 'CANNOT_DELETE_ADMIN') {
          setRowError('That account is an admin and cannot be deleted.');
        } else {
          setRowError('Could not delete that user.');
        }
        setPendingDelete(null);
        return;
      }
      setPendingDelete(null);
      await loadUsers();
    } catch {
      setRowError('Could not delete that user.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  if (gate === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'var(--font-ui)', fontSize: 15 }}>
        Checking access…
      </div>
    );
  }

  return (
    <AppShell title="Admin">
      {error && (
        <p className="error-text" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      {/* Users */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)' }}>Users</h2>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{usersLoading ? 'loading…' : `${users.length} total`}</span>
        </div>

        {rowError && (
          <p className="error-text" role="alert" style={{ marginBottom: 12 }}>
            {rowError}
          </p>
        )}

        <div className="card-surface" style={{ borderRadius: 16, overflowX: 'auto' }}>
          {usersLoading ? (
            <div style={cellMuted}>Loading users…</div>
          ) : !users.length ? (
            <div style={cellMuted}>No users found.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Handle</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Joined</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{u.email}</span>
                    </td>
                    <td style={tdStyle}>{u.name || '—'}</td>
                    <td style={tdStyle}>{u.handle ? '@' + String(u.handle).replace(/^@/, '') : '—'}</td>
                    <td style={tdStyle}>
                      {u.emailVerified ? (
                        <span style={{ ...pillStyle, background: 'rgba(18,161,92,0.14)', color: '#0a703f' }}>Verified</span>
                      ) : (
                        <span style={{ ...pillStyle, background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--line)' }}>Unverified</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--muted)' }}>{formatDate(u.createdAt)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button className="dash-act dash-act-danger" style={{ flex: 'none', width: 'auto', padding: '0 12px', height: 32 }} onClick={() => setPendingDelete(u)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7h16" />
                          <path d="M9 7V4h6v3" />
                          <path d="M6 7l1 13h10l1-13" />
                        </svg>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Auth & security logs */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)' }}>Auth &amp; security logs</h2>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{logsLoading ? 'loading…' : `${events.length} recent`}</span>
          </div>
          <button className="dash-ghost" onClick={() => void loadLogs()} disabled={logsLoading}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11a8 8 0 1 0-2.3 5.6" />
              <path d="M20 4v6h-6" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="card-surface" style={{ borderRadius: 16, overflowX: 'auto' }}>
          {logsLoading ? (
            <div style={cellMuted}>Loading events…</div>
          ) : !events.length ? (
            <div style={cellMuted}>No events yet.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>IP</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => {
                  const danger = ev.type === 'login_failed';
                  return (
                    <tr key={`${ev.ts}-${i}`}>
                      <td style={{ ...tdStyle, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatTime(ev.ts)}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            ...pillStyle,
                            ...(danger
                              ? { background: 'rgba(225,64,43,0.14)', color: 'var(--danger)' }
                              : { background: 'var(--surface)', color: 'var(--muted-2)', border: '1px solid var(--line)' }),
                          }}
                        >
                          {ev.type}
                        </span>
                      </td>
                      <td style={tdStyle}>{ev.email || '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--muted)', fontFamily: 'var(--font-ui)' }}>{ev.ip || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-del-title"
          onClick={() => setPendingDelete(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(27,22,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: 24, boxShadow: '0 30px 80px rgba(27,22,14,0.3)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, flex: 'none', background: 'rgba(225,64,43,0.12)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16" />
                  <path d="M9 7V4h6v3" />
                  <path d="M6 7l1 13h10l1-13" />
                </svg>
              </span>
              <h3 id="admin-del-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)' }}>Delete this user?</h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--ink)' }}>{pendingDelete.email}</strong> and their account data will be permanently removed. This can't be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" style={{ width: 'auto', height: 42, padding: '0 18px', fontSize: 14 }} onClick={() => setPendingDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn" style={{ width: 'auto', height: 42, padding: '0 20px', fontSize: 14, background: 'var(--danger)', color: '#fff' }} onClick={() => void confirmDelete()} disabled={deleting} autoFocus>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

const tableStyle = {
  width: '100%',
  minWidth: 640,
  borderCollapse: 'collapse' as const,
  fontFamily: 'var(--font-ui)',
  fontSize: 13.5,
};

const thStyle = {
  textAlign: 'left' as const,
  padding: '12px 16px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--muted)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
};

const tdStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--line)',
  color: 'var(--ink)',
  verticalAlign: 'middle' as const,
};

const cellMuted = {
  padding: '28px 16px',
  textAlign: 'center' as const,
  color: 'var(--muted)',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
};

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 999,
  font: '700 11px/1 var(--font-ui)',
  whiteSpace: 'nowrap' as const,
};
