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
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, color: 'var(--ink)' }}
            >
              ☰
            </button>
            <Link to="/dashboard" aria-label="Cardstock dashboard" style={{ textDecoration: 'none', display: 'flex' }}>
              <CardstockLogo size={28} wordSize={18} color="var(--ink)" />
            </Link>
          </div>

          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9999,
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              display: 'flex',
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
            style={{
              maxWidth: 960,
              margin: '0 auto',
              padding: '0 16px 12px 16px',
              display: 'flex',
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
