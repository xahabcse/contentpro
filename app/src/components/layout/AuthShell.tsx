import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CardstockLogo } from '@/components/Logo';
import SlidePreview from '@/components/editor/SlidePreview';
import Icon, { type IconName } from '@/components/ui/Icon';
import SkySwitch from '@/components/ui/SkySwitch';
import type { TemplateId } from '@/lib/design-types';

interface AuthShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  icon?: IconName;
  children: ReactNode;
}

type Fan = [TemplateId, string][];

// Each auth screen shows a different fan of real template renders.
const FANS: Record<string, Fan> = {
  '/login': [['birthday', 'paper'], ['cover', 'ink'], ['stat', 'cobalt']],
  '/signup': [['event', 'navy'], ['congrats', 'wine'], ['tips', 'plum']],
};
const DEFAULT_FAN: Fan = [['quote', 'forest'], ['framework', 'navy'], ['hiring', 'charcoal']];

// Split screen on desktop (template art left, form right); one centred glass
// card on tablet and phone (studio.css).
export default function AuthShell({ title, subtitle, eyebrow, icon, children }: AuthShellProps) {
  const { pathname } = useLocation();
  const fan = FANS[pathname] ?? DEFAULT_FAN;
  const isLogin = pathname === '/login';
  const isSignup = pathname === '/signup';

  return (
    <div className="auth">
      <aside className="auth__art glass" aria-hidden="true">
        <Link to="/" className="logo-link" tabIndex={-1}>
          <CardstockLogo size={32} wordSize={18} color="var(--ink)" />
        </Link>
        <div className="auth__fan">
          {fan.map(([template, palette]) => (
            <SlidePreview key={template} template={template} palette={palette} />
          ))}
        </div>
        <div className="auth__note surface">
          <span className="eyebrow"><Icon name="shield" /> Your account, your device</span>
          <p>Pick a template. Write the words. Export a card your feed will stop for.</p>
        </div>
      </aside>

      <section className="auth__side">
        <div className="auth__switch">
          <Link to="/" className="logo-link auth__logo" aria-label="Cardstock home">
            <CardstockLogo size={30} wordSize={17} color="var(--ink)" />
          </Link>
          <SkySwitch />
          {isLogin ? (
            <>
              <span>New here?</span>
              <Link to="/signup" className="btn btn--glass">Create an account</Link>
            </>
          ) : isSignup ? (
            <>
              <span>Have an account?</span>
              <Link to="/login" className="btn btn--glass">Log in</Link>
            </>
          ) : (
            <Link to="/login" className="btn btn--glass"><Icon name="arrow-left" /> Log in</Link>
          )}
        </div>

        <div className="auth__form rise">
          {icon && <span className="auth__badge"><Icon name={icon} /></span>}
          {eyebrow && <span className="eyebrow eyebrow--accent">{eyebrow}</span>}
          <h1 className="display auth__title">{title}</h1>
          {subtitle && <p className="lede auth__sub">{subtitle}</p>}
          {children}
        </div>

        <p className="auth__legal">
          © 2026 Cardstock · <a href="https://www.xahabcse.me/" target="_blank" rel="noopener noreferrer">xahabcse.me</a>
        </p>
      </section>
    </div>
  );
}
