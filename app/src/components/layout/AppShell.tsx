import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { listDesigns, storagePressure } from '@/lib/local-store';
import { CardstockLogo } from '@/components/Logo';
import Icon from '@/components/ui/Icon';
import SkySwitch from '@/components/ui/SkySwitch';
import versionData from '@/version.json';

interface AppShellProps {
  // Short page name for the tablet/phone app bar; the page draws its own heading.
  title: string;
  children: ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name: string | undefined, email: string | undefined): string {
  const source = (name ?? '').trim();
  if (source) {
    const parts = source.replace(/^md\.?\s+/i, '').split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  return email?.[0]?.toUpperCase() ?? '?';
}

// Signed-in chrome. Desktop: a floating glass rail. Tablet: an app bar with a
// menu drawer. Phone: an app bar plus a bottom tab bar (studio.css decides).
export default function AppShell({ title, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [usage, setUsage] = useState<{ used: number; ratio: number } | null>(null);
  const designCount = user ? safeCount(user.id) : 0;

  useEffect(() => {
    let cancelled = false;
    storagePressure()
      .then((pressure) => { if (!cancelled && pressure) setUsage({ used: pressure.usage, ratio: pressure.ratio }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen && !newOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setNewOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, newOpen]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function startNew(type: 'card' | 'carousel') {
    setNewOpen(false);
    setMenuOpen(false);
    navigate(`/dashboard?create=${type}`);
  }

  const name = user?.profile?.name;
  const mark = initials(name, user?.email);
  const current = (path: string) => (pathname === path ? 'page' as const : undefined);

  const navLinks = (onPick?: () => void) => (
    <>
      <Link className="nav-link" to="/dashboard" aria-current={current('/dashboard')} onClick={onPick}><Icon name="grid" /> Dashboard</Link>
      <button type="button" className="nav-link" onClick={() => startNew('card')}><Icon name="square" /> New card</button>
      <button type="button" className="nav-link" onClick={() => startNew('carousel')}><Icon name="layers" /> New carousel</button>
      <span className="nav-label">Account</span>
      <Link className="nav-link" to="/settings/profile" aria-current={current('/settings/profile')} onClick={onPick}><Icon name="user" /> Profile &amp; Company</Link>
      <Link className="nav-link" to="/about" onClick={onPick}><Icon name="info" /> About</Link>
      <Link className="nav-link" to="/" onClick={onPick}><Icon name="home" /> Home</Link>
    </>
  );

  const storeBox = (
    <div className="store surface">
      <div className="store__row"><b>This browser</b><span className="badge"><Icon name="drive" /> Local</span></div>
      <div className="meter" aria-hidden="true"><span style={{ width: `${Math.max(2, Math.min(100, (usage?.ratio ?? 0) * 100))}%` }} /></div>
      <span>{designCount} design{designCount === 1 ? '' : 's'}{usage ? ` · ${formatBytes(usage.used)} used` : ''}</span>
    </div>
  );

  const me = (
    <div className="me">
      <span className="avatar">{mark}</span>
      <div><b>{name || 'Your account'}</b><span>{user?.email}</span></div>
      <button type="button" className="btn btn--sm btn--quiet btn--icon" aria-label="Log out" title="Log out" onClick={handleLogout}><Icon name="logout" /></button>
    </div>
  );

  return (
    <div className="app">
      <aside className="rail glass-strong" aria-label="Cardstock dashboard">
        <Link to="/dashboard" className="logo-link" aria-label="Cardstock dashboard">
          <CardstockLogo size={32} wordSize={18} color="var(--ink)" />
        </Link>
        {navLinks()}
        {storeBox}
        <SkySwitch />
        {me}
      </aside>

      <div>
        <header className="appbar glass-strong">
          <button type="button" className="btn btn--glass btn--icon appbar__menu" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <Link to="/dashboard" className="logo-link" aria-label="Cardstock dashboard">
            <CardstockLogo size={28} wordSize={17} color="var(--ink)" />
          </Link>
          <span className="appbar__title">/ {title}</span>
          <div className="appbar__end">
            <button type="button" className="btn btn--primary appbar__new" onClick={() => setNewOpen(true)}><Icon name="plus" /> New design</button>
            <span className="avatar" title={user?.email}>{mark}</span>
          </div>
        </header>

        <main className="main">{children}</main>

        <footer className="app-foot">
          Cardstock v{versionData.version} · © 2026 <a href="https://www.xahabcse.me/" target="_blank" rel="noopener noreferrer">xahabcse.me</a>
        </footer>
      </div>

      <nav className="tabbar glass-strong" aria-label="App">
        <Link to="/dashboard" aria-current={current('/dashboard')}><Icon name="grid" />Designs</Link>
        <Link to="/#templates"><Icon name="sparkle" />Templates</Link>
        <button type="button" className="tabbar__new" aria-label="New design" onClick={() => setNewOpen(true)}><span><Icon name="plus" /></span></button>
        <Link to="/settings/profile" aria-current={current('/settings/profile')}><Icon name="user" />Profile</Link>
        <button type="button" aria-label="More" onClick={() => setMenuOpen(true)}><Icon name="menu" />More</button>
      </nav>

      {menuOpen && (
        <>
          <button type="button" className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <nav className="drawer glass-strong" aria-label="Menu">
            <div className="drawer__head">
              <CardstockLogo size={30} wordSize={17} color="var(--ink)" />
              <button type="button" className="btn btn--glass btn--icon" aria-label="Close menu" onClick={() => setMenuOpen(false)}><Icon name="x" /></button>
            </div>
            {navLinks(() => setMenuOpen(false))}
            <div className="drawer__foot">
              {storeBox}
              <SkySwitch />
              {me}
            </div>
          </nav>
        </>
      )}

      {newOpen && (
        <>
          <button type="button" className="scrim" aria-label="Close" onClick={() => setNewOpen(false)} />
          <div className="sheet glass-strong" role="dialog" aria-label="New design">
            <span className="eyebrow">Start something new</span>
            <button type="button" className="nav-link" onClick={() => startNew('card')}><Icon name="square" /> New card <span className="hint" style={{ marginLeft: 'auto' }}>1080 × 1080</span></button>
            <button type="button" className="nav-link" onClick={() => startNew('carousel')}><Icon name="layers" /> New carousel <span className="hint" style={{ marginLeft: 'auto' }}>up to 15 slides</span></button>
          </div>
        </>
      )}
    </div>
  );
}

function safeCount(ownerId: string): number {
  try {
    return listDesigns(ownerId).length;
  } catch {
    return 0;
  }
}
