import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { CardstockLogo } from '@/components/Logo';
import versionData from '@/version.json';

interface AppShellProps {
  title: string;
  children: ReactNode;
}

// Mobile-first top bar: hamburger (left) + wordmark, condensed avatar action
// (right); the nav links collapse into the hamburger menu on all viewports.
export default function AppShell({ title, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header
        className="card-surface"
        style={{
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="app-burger"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, color: 'var(--ink)' }}
            >
              ☰
            </button>
            <Link to="/dashboard" aria-label="Cardstock dashboard" style={{ textDecoration: 'none', display: 'flex' }}>
              <CardstockLogo size={28} wordSize={18} color="var(--ink)" />
            </Link>
          </div>

          {/* desktop inline nav */}
          <nav className="app-nav-inline">
            <Link to="/dashboard" style={inlineLinkStyle}>Dashboard</Link>
            <Link to="/settings/profile" style={inlineLinkStyle}>Profile &amp; Company</Link>
            <Link to="/about" style={inlineLinkStyle}>About</Link>
            <button onClick={handleLogout} style={{ ...inlineLinkStyle, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>Log out</button>
            <div
              style={{ width: 34, height: 34, borderRadius: 9999, background: 'var(--brand)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flex: 'none' }}
              title={user?.email}
            >
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
          </nav>

          {/* mobile avatar (inline nav is hidden here) */}
          <div
            className="app-avatar-mobile"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9999,
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
            }}
            title={user?.email}
          >
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
        </div>

        {menuOpen && (
          <nav
            className="app-nav-drop"
            style={{
              maxWidth: 960,
              margin: '0 auto',
              padding: '0 16px 12px 16px',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <Link to="/dashboard" onClick={() => setMenuOpen(false)} style={navLinkStyle}>Dashboard</Link>
            <Link to="/settings/profile" onClick={() => setMenuOpen(false)} style={navLinkStyle}>Profile &amp; Company Settings</Link>
            <Link to="/about" onClick={() => setMenuOpen(false)} style={navLinkStyle}>About</Link>
            <button onClick={handleLogout} style={{ ...navLinkStyle, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
              Log out
            </button>
          </nav>
        )}
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 40px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 16px 0' }}>{title}</h1>
        {children}
      </main>

      <footer style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 40px 16px' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', opacity: 0.8 }}>Cardstock v{versionData.version}</span>
      </footer>
    </div>
  );
}

const navLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--ink)',
  textDecoration: 'none',
};

const inlineLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  height: 38,
  padding: '0 10px',
  borderRadius: 9,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--ink)',
  textDecoration: 'none',
  whiteSpace: 'nowrap' as const,
};
