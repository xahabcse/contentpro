import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CardstockLogo } from '@/components/Logo';
import Icon from '@/components/ui/Icon';
import SkySwitch from '@/components/ui/SkySwitch';
import { useAuth } from '@/lib/auth-context';
import versionData from '@/version.json';

const REPO_URL = 'https://github.com/xahabcse/contentpro';

// Section links point at the landing page; on the landing page itself they stay
// plain hash links so the browser scrolls without a route change.
function useSectionHref() {
  const { pathname } = useLocation();

  return (hash: string) => (pathname === '/' ? hash : '/' + hash);
}

// Floating glass top bar for the public pages (landing, about, 404). Below
// 1024px the section links move into a drawer; on phones the sky switch and the
// sign-up button move there too (the page shows a sticky call to action).
export function PublicHeader({ current }: { current?: 'about' }) {
  const { user } = useAuth();
  const sectionHref = useSectionHref();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const links = [
    { href: sectionHref('#templates'), label: 'Templates', icon: 'grid' as const },
    { href: sectionHref('#carousels'), label: 'Carousels', icon: 'layers' as const },
    { href: sectionHref('#privacy'), label: 'Privacy', icon: 'shield' as const },
  ];

  return (
    <>
      <header className="top glass">
        <Link to="/" className="logo-link" aria-label="Cardstock home">
          <CardstockLogo size={32} wordSize={18} color="var(--ink)" />
        </Link>
        <nav className="top__nav" aria-label="Main">
          {links.map((link) => <a key={link.label} href={link.href}>{link.label}</a>)}
          <Link to="/about" aria-current={current === 'about' ? 'page' : undefined}>About</Link>
        </nav>
        <div className="top__end">
          <button type="button" className="btn btn--glass btn--icon top__menu" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <SkySwitch className="top__sky" />
          {user ? (
            <Link to="/dashboard" className="btn btn--primary">Dashboard <Icon name="arrow-right" /></Link>
          ) : (
            <>
              <Link to="/login" className="btn btn--quiet">Log in</Link>
              <Link to="/signup" className="btn btn--primary top__cta">Start free <Icon name="arrow-right" /></Link>
            </>
          )}
        </div>
      </header>

      {open && (
        <>
          <button type="button" className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
          <nav className="drawer glass-strong" aria-label="Menu">
            <div className="drawer__head">
              <CardstockLogo size={30} wordSize={17} color="var(--ink)" />
              <button type="button" className="btn btn--glass btn--icon" aria-label="Close menu" onClick={() => setOpen(false)}>
                <Icon name="x" />
              </button>
            </div>
            {links.map((link) => (
              <a key={link.label} className="nav-link" href={link.href} onClick={() => setOpen(false)}>
                <Icon name={link.icon} /> {link.label}
              </a>
            ))}
            <Link className="nav-link" to="/about" onClick={() => setOpen(false)} aria-current={current === 'about' ? 'page' : undefined}><Icon name="info" /> About</Link>
            <a className="nav-link" href={REPO_URL} target="_blank" rel="noopener noreferrer"><Icon name="github" /> GitHub</a>
            <div className="drawer__foot">
              <SkySwitch />
              {user ? (
                <Link to="/dashboard" className="btn btn--primary btn--lg btn--block">Open dashboard <Icon name="arrow-right" /></Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn--glass btn--lg btn--block">Log in</Link>
                  <Link to="/signup" className="btn btn--primary btn--lg btn--block">Start designing free <Icon name="arrow-right" /></Link>
                </>
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
}

export function PublicFooter() {
  const sectionHref = useSectionHref();

  return (
    <footer className="foot">
      <CardstockLogo size={26} wordSize={16} color="var(--ink)" />
      <span>
        © 2026 · A product of <a className="link" href="https://www.xahabcse.me/" target="_blank" rel="noopener noreferrer">xahabcse.me</a> · <span className="mono">v{versionData.version}</span>
      </span>
      <nav aria-label="Footer">
        <a href={sectionHref('#templates')}>Templates</a>
        <a href={sectionHref('#carousels')}>Carousels</a>
        <Link to="/about">About</Link>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
        <Link to="/signup">Sign up</Link>
      </nav>
    </footer>
  );
}

// Phone-only sticky call to action at the bottom of public pages.
export function PhoneCta() {
  const { user } = useAuth();

  return (
    <div className="mcta glass-strong">
      {user ? (
        <Link to="/dashboard" className="btn btn--primary btn--lg">Open dashboard <Icon name="arrow-right" /></Link>
      ) : (
        <>
          <Link to="/login" className="btn btn--glass btn--lg">Log in</Link>
          <Link to="/signup" className="btn btn--primary btn--lg">Start designing free <Icon name="arrow-right" /></Link>
        </>
      )}
    </div>
  );
}
