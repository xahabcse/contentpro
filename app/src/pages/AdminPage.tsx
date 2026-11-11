import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NETWORK_ERROR_MESSAGE, readApiError } from '@/lib/errorMessages';
import { useToast } from '@/lib/toast';

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

interface AdminOverview {
  totalUsers: number;
  verifiedUsers: number;
  newUsers24h: number;
  newUsers7d: number;
  successfulLogins7d: number;
  failedLogins7d: number;
  failedLoginIps7d: number;
}

type Tab = 'overview' | 'users' | 'logs';
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

function eventBadgeClass(type: string): string {
  if (type === 'login_failed') return 'admin-badge danger';
  if (type === 'login') return 'admin-badge success';
  if (type === 'signup') return 'admin-badge info';
  if (type === 'email_verified') return 'admin-badge accent';
  if (type === 'reset_request' || type === 'reset_complete') return 'admin-badge warning';
  return 'admin-badge muted';
}

export default function AdminPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [gate, setGate] = useState<Gate>('checking');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [rowError, setRowError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState<string>('all');
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const r = await fetch('/api/admin/overview', { credentials: 'include' });
      if (!r.ok) throw new Error('load');
      const data = (await r.json()) as { overview: AdminOverview };
      setOverview(data.overview);
    } catch {
      setRowError('Could not load overview statistics.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const r = await fetch('/api/admin/users', { credentials: 'include' });
      if (!r.ok) throw new Error('load');
      const data = (await r.json()) as { users: AdminUser[] };
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setRowError('Could not load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const r = await fetch('/api/admin/logs?limit=200', { credentials: 'include' });
      if (!r.ok) throw new Error('load');
      const data = (await r.json()) as { events: AuthEvent[] };
      const list = Array.isArray(data.events) ? data.events : [];
      setEvents([...list].sort((a, b) => b.ts - a.ts));
    } catch {
      setRowError('Could not load logs.');
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
        if (!data.isAdmin) { navigate('/dashboard', { replace: true }); return; }
        setGate('ok');
        void loadOverview();
        void loadUsers();
        void loadLogs();
      } catch {
        if (!cancelled) navigate('/dashboard', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, loadOverview, loadUsers, loadLogs]);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPendingDelete(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingDelete]);

  // The outcome of this action is a toast, not the row banner -- the modal
  // closes on its way out, so banner text would appear detached from the thing
  // that caused it. The banner stays for load failures only.
  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setDeleting(true);
    setRowError(null);
    try {
      const r = await fetch('/api/admin/users/' + encodeURIComponent(target.id), { method: 'DELETE', credentials: 'include' });
      if (!r.ok) {
        toast.error(await readApiError(r, 'Could not delete that user.'));
        setPendingDelete(null);
        return;
      }
      setPendingDelete(null);
      await loadUsers();
      await loadOverview();
      toast.success(`Deleted ${target.email}.`);
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const filteredUsers = useMemo(() => {
    let list = users;
    if (userFilter === 'verified') list = list.filter(u => u.emailVerified);
    if (userFilter === 'unverified') list = list.filter(u => !u.emailVerified);
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      list = list.filter(u => u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q) || (u.handle ?? '').toLowerCase().includes(q) || (u.companyName ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [users, userSearch, userFilter]);

  const filteredLogs = useMemo(() => {
    let list = events;
    if (logFilter !== 'all') list = list.filter(e => e.type === logFilter);
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      list = list.filter(e => (e.email ?? '').toLowerCase().includes(q) || (e.ip ?? '').includes(q));
    }
    return list;
  }, [events, logSearch, logFilter]);

  const logEventTypes = useMemo(() => Array.from(new Set(events.map(e => e.type))).sort(), [events]);

  if (gate === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', flexDirection: 'column', gap: 16, color: '#8b8fa8', fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(242,183,5,0.15)', borderTopColor: '#f2b705', borderRadius: '50%', animation: 'cp-spin 0.7s linear infinite' }} />
        Verifying access…
      </div>
    );
  }

  const topbarMeta: Record<Tab, { title: string; sub: string }> = {
    overview: { title: 'Overview', sub: 'Platform health at a glance' },
    users: { title: 'User Management', sub: `${users.length} registered accounts` },
    logs: { title: 'Security Logs', sub: `${events.length} recent auth events loaded` },
  };

  return (
    <div className="admin-root">
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 9h10M7 12h6M7 15h8" />
              </svg>
            </div>
            <div className="admin-sidebar-brand-text">
              <span className="admin-sidebar-brand-name">Cardstock</span>
              <span className="admin-sidebar-brand-sub">Admin</span>
            </div>
          </div>

          <div className="admin-sidebar-section-label">Navigation</div>

          <button id="admin-nav-overview" className={`admin-nav-item${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
            Overview
          </button>

          <button id="admin-nav-users" className={`admin-nav-item${activeTab === 'users' ? ' active' : ''}`} onClick={() => setActiveTab('users')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            Users
            {!usersLoading && users.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--adm-muted)', fontWeight: 600 }}>{users.length}</span>}
          </button>

          <button id="admin-nav-logs" className={`admin-nav-item${activeTab === 'logs' ? ' active' : ''}`} onClick={() => setActiveTab('logs')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Security Logs
            {!!overview?.failedLogins7d && <span className="admin-nav-badge">{overview.failedLogins7d}</span>}
          </button>

          <div className="admin-sidebar-footer">
            <button className="admin-back-btn" onClick={() => navigate('/dashboard')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              Back to Dashboard
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="admin-main">
          {/* Topbar */}
          <div className="admin-topbar">
            <div className="admin-topbar-left">
              <h1 className="admin-topbar-title">{topbarMeta[activeTab].title}</h1>
              <span className="admin-topbar-sub">{topbarMeta[activeTab].sub}</span>
            </div>
            <div className="admin-topbar-actions">
              <button id="admin-refresh-btn" className="admin-icon-btn" title="Refresh data" onClick={() => { setRowError(null); void loadOverview(); void loadUsers(); void loadLogs(); }} disabled={overviewLoading || usersLoading || logsLoading}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.6" /><path d="M20 4v6h-6" /></svg>
              </button>
            </div>
          </div>

          <nav className="admin-mobile-nav" aria-label="Admin sections">
            {(['overview', 'users', 'logs'] as const).map(tab => (
              <button key={tab} className={`admin-mobile-tab${activeTab === tab ? ' active' : ''}`} aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>
                {tab === 'logs' ? 'Security Logs' : tab === 'users' ? 'Users' : 'Overview'}
              </button>
            ))}
            <button className="admin-mobile-tab admin-mobile-back" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </nav>

          {/* Error banner */}
          {rowError && (
            <div style={{ margin: '16px 32px 0', padding: '12px 16px', background: 'rgba(255,92,92,0.12)', border: '1px solid rgba(255,92,92,0.25)', borderRadius: 10, color: '#ff5c5c', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {rowError}
              <button onClick={() => setRowError(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 12 }}>Dismiss ×</button>
            </div>
          )}

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="admin-content" key="overview">
              <div className="admin-stats-grid">
                <StatCard icon="users" variant="accent" value={overviewLoading || !overview ? '—' : String(overview.totalUsers)} label="Registered Users" trend="Total" trendClass="neutral" />
                <StatCard icon="check" variant="success" value={overviewLoading || !overview ? '—' : String(overview.verifiedUsers)} label="Email Verified" trend={!overview || overviewLoading ? '—' : `${overview.totalUsers > 0 ? Math.round((overview.verifiedUsers / overview.totalUsers) * 100) : 0}%`} trendClass="up" />
                <StatCard icon="clock" variant="info" value={overviewLoading || !overview ? '—' : String(overview.newUsers24h)} label="New Signups (24h)" trend="24h" trendClass="up" />
                <StatCard icon="shield" variant="danger" value={overviewLoading || !overview ? '—' : String(overview.failedLogins7d)} label="Failed Logins (7 days)" trend={!overview || overviewLoading ? '—' : `${overview.failedLoginIps7d} IP${overview.failedLoginIps7d !== 1 ? 's' : ''}`} trendClass={overview && overview.failedLogins7d > 5 ? 'warn' : 'neutral'} />
              </div>

              <div className="admin-overview-panels">
                {/* Auth events breakdown */}
                <div className="admin-table-wrap" style={{ padding: 20 }}>
                  <div style={{ fontSize: 10, color: '#6b6f88', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Latest 200 Auth Events</div>
                  {logsLoading ? <div style={{ color: '#8b8fa8', fontSize: 13 }}>Loading…</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {logEventTypes.length === 0 ? <div style={{ color: '#8b8fa8', fontSize: 13 }}>No events yet.</div> : logEventTypes.map(type => {
                        const count = events.filter(e => e.type === type).length;
                        const pct = events.length > 0 ? (count / events.length) * 100 : 0;
                        return (
                          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className={eventBadgeClass(type)} style={{ minWidth: 120 }}>{type}</span>
                            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: '#f2b705', borderRadius: 4, width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: 12, color: '#8b8fa8', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="admin-table-wrap" style={{ padding: 20 }}>
                  <div style={{ fontSize: 10, color: '#6b6f88', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Platform Stats</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { label: 'Successful Logins (7 days)', value: overviewLoading || !overview ? '…' : overview.successfulLogins7d, color: '#4ade80' },
                      { label: 'New Users (7 days)', value: overviewLoading || !overview ? '…' : overview.newUsers7d, color: '#60a5fa' },
                      { label: 'Unverified Accounts', value: overviewLoading || !overview ? '…' : overview.totalUsers - overview.verifiedUsers, color: '#fb923c' },
                      { label: 'IPs with Failed Logins (7 days)', value: overviewLoading || !overview ? '…' : overview.failedLoginIps7d, color: overview && overview.failedLoginIps7d > 0 ? '#ff5c5c' : '#8b8fa8' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#8b8fa8' }}>{item.label}</span>
                        <span style={{ fontSize: 20, fontFamily: 'Archivo, sans-serif', fontWeight: 800, color: item.color, letterSpacing: '-0.03em' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent users */}
              <div>
                <div className="admin-section-header" style={{ marginBottom: 14 }}>
                  <h2 className="admin-section-title">Recent Signups</h2>
                  <button className="admin-filter-chip" onClick={() => setActiveTab('users')}>View all →</button>
                </div>
                <UsersTable users={usersLoading ? [] : users.slice(0, 5)} loading={usersLoading} onDelete={u => setPendingDelete(u)} compact />
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <div className="admin-content" key="users">
              <div>
                <div className="admin-section-header" style={{ marginBottom: 14 }}>
                  <h2 className="admin-section-title">All Users <span className="admin-section-count" style={{ marginLeft: 10 }}>{usersLoading ? '…' : filteredUsers.length}</span></h2>
                </div>
                <div className="admin-toolbar" style={{ marginBottom: 14 }}>
                  <div className="admin-search-wrap">
                    <span className="admin-search-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    </span>
                    <input id="admin-user-search" className="admin-search" placeholder="Search by email, name, handle…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                  </div>
                  <div className="admin-filter-chips">
                    {(['all', 'verified', 'unverified'] as const).map(f => (
                      <button key={f} className={`admin-filter-chip${userFilter === f ? ' active' : ''}`} onClick={() => setUserFilter(f)}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button className="admin-icon-btn" title="Refresh" onClick={() => void loadUsers()} disabled={usersLoading}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.6" /><path d="M20 4v6h-6" /></svg>
                  </button>
                </div>
                <UsersTable users={filteredUsers} loading={usersLoading} onDelete={u => setPendingDelete(u)} />
              </div>
            </div>
          )}

          {/* LOGS */}
          {activeTab === 'logs' && (
            <div className="admin-content" key="logs">
              <div>
                <div className="admin-section-header" style={{ marginBottom: 14 }}>
                  <h2 className="admin-section-title">Security Logs <span className="admin-section-count" style={{ marginLeft: 10 }}>{logsLoading ? '…' : filteredLogs.length}</span></h2>
                </div>
                <div className="admin-toolbar" style={{ marginBottom: 14 }}>
                  <div className="admin-search-wrap">
                    <span className="admin-search-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    </span>
                    <input id="admin-log-search" className="admin-search" placeholder="Search by email or IP…" value={logSearch} onChange={e => setLogSearch(e.target.value)} />
                  </div>
                  <button className="admin-icon-btn" title="Refresh logs" onClick={() => void loadLogs()} disabled={logsLoading}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.6" /><path d="M20 4v6h-6" /></svg>
                  </button>
                </div>
                <div className="admin-filter-chips" style={{ marginBottom: 16 }}>
                  <button className={`admin-filter-chip${logFilter === 'all' ? ' active' : ''}`} onClick={() => setLogFilter('all')}>All ({events.length})</button>
                  {logEventTypes.map(type => (
                    <button key={type} className={`admin-filter-chip${logFilter === type ? ' active' : ''}${type === 'login_failed' ? ' danger-chip' : ''}`} onClick={() => setLogFilter(logFilter === type ? 'all' : type)}>
                      {type} ({events.filter(e => e.type === type).length})
                    </button>
                  ))}
                </div>
                <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
                  {logsLoading ? (
                    <div className="admin-table-empty">Loading events…</div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="admin-table-empty">No events match your filters.</div>
                  ) : (
                    <table className="admin-table" style={{ minWidth: 680 }}>
                      <thead><tr><th>Time</th><th>Event</th><th>Email</th><th>IP Address</th><th>Detail</th></tr></thead>
                      <tbody>
                        {filteredLogs.map((ev, i) => (
                          <tr key={`${ev.ts}-${i}`} className={ev.type === 'login_failed' ? 'row-danger' : ''}>
                            <td style={{ color: '#8b8fa8', whiteSpace: 'nowrap', fontSize: 12.5 }}>{formatTime(ev.ts)}</td>
                            <td><span className={eventBadgeClass(ev.type)}>{ev.type}</span></td>
                            <td style={{ fontWeight: ev.email ? 500 : 400, color: ev.email ? '#f0f0f0' : '#6b6f88' }}>{ev.email || '—'}</td>
                            <td style={{ color: '#8b8fa8', fontFamily: 'monospace', fontSize: 12.5 }}>{ev.ip || '—'}</td>
                            <td style={{ color: '#8b8fa8', fontSize: 12.5 }}>{ev.detail || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Delete Modal */}
      {pendingDelete && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-del-title" onClick={() => setPendingDelete(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>
            </div>
            <h3 id="admin-del-title" className="admin-modal-title">Delete this user?</h3>
            <p className="admin-modal-body"><strong>{pendingDelete.email}</strong> and their account data will be permanently removed. This action cannot be undone.</p>
            <div className="admin-modal-actions">
              <button id="admin-del-cancel" className="admin-btn-cancel" onClick={() => setPendingDelete(null)} disabled={deleting}>Cancel</button>
              <button id="admin-del-confirm" className="admin-btn-danger" onClick={() => void confirmDelete()} disabled={deleting} autoFocus>{deleting ? 'Deleting…' : 'Delete User'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, variant, value, label, trend, trendClass }: {
  icon: 'users' | 'check' | 'clock' | 'shield';
  variant: 'accent' | 'success' | 'info' | 'danger';
  value: string;
  label: string;
  trend: string;
  trendClass: 'up' | 'warn' | 'neutral';
}) {
  const icons: Record<string, ReactNode> = {
    users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
    clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  };
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-card-header">
        <div className={`admin-stat-card-icon ${variant}`}>{icons[icon]}</div>
        <span className={`admin-stat-trend ${trendClass}`}>{trend}</span>
      </div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

function UsersTable({ users, loading, onDelete, compact = false }: {
  users: AdminUser[];
  loading: boolean;
  onDelete: (u: AdminUser) => void;
  compact?: boolean;
}) {
  if (loading) return <div className="admin-table-empty">Loading users…</div>;
  if (!users.length) return <div className="admin-table-empty">No users found.</div>;
  return (
    <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
      <table className="admin-table" style={{ minWidth: compact ? 500 : 720 }}>
        <thead>
          <tr>
            <th>Email</th><th>Name</th>
            {!compact && <th>Handle</th>}
            {!compact && <th>Company</th>}
            <th>Status</th><th>Joined</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td><span style={{ fontWeight: 600, color: '#f0f0f0' }}>{u.email}</span></td>
              <td style={{ color: u.name ? '#f0f0f0' : '#6b6f88' }}>{u.name || '—'}</td>
              {!compact && <td style={{ color: '#8b8fa8', fontSize: 12.5 }}>{u.handle ? '@' + String(u.handle).replace(/^@/, '') : '—'}</td>}
              {!compact && <td style={{ color: '#8b8fa8', fontSize: 12.5 }}>{u.companyName || '—'}</td>}
              <td>{u.emailVerified ? <span className="admin-badge success">✓ Verified</span> : <span className="admin-badge muted">Unverified</span>}</td>
              <td style={{ color: '#8b8fa8', fontSize: 12.5, whiteSpace: 'nowrap' }}>{formatDate(u.createdAt)}</td>
              <td style={{ textAlign: 'right' }}>
                <button id={`admin-delete-user-${u.id}`} className="admin-delete-btn" onClick={() => onDelete(u)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
