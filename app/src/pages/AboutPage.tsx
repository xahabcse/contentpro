import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { CardstockLogo } from '@/components/Logo';
import versionData from '@/version.json';

// Public, editorial "About" page — same visual language as the landing
// (cream/amber, Archivo display + Newsreader-italic accents, paper grain),
// built in the project's inline-style idiom. Kept to a handful of sections.

const REPO_URL = 'https://github.com/xahabcse/contentpro';

const PRINCIPLES: { n: string; title: string; body: string }[] = [
  {
    n: '01',
    title: 'Ten templates, not a blank canvas',
    body: 'Quotes, big stats, numbered tips, covers, before/after, frameworks, CTAs, bold questions and statements — each one composed by hand so a first draft already looks designed.',
  },
  {
    n: '02',
    title: 'What you see is what exports',
    body: 'The frame on screen is the exact frame you download. Cards render to a crisp 1080-square PNG; carousels stitch into a multi-page 1080×1350 PDF — all in the browser, no server render step.',
  },
  {
    n: '03',
    title: 'Your work stays on your device',
    body: 'Designs live in your own browser storage, not on our servers. Nothing to leak, nothing to mine — export a backup whenever you want to move between machines.',
  },
  {
    n: '04',
    title: 'Open source, no lock-in',
    body: 'Cardstock is MIT-licensed and public. Read the code, file an issue, or run your own copy — the whole studio is yours to inspect.',
  },
];

const STACK: { label: string; desc: string }[] = [
  { label: 'React + Vite', desc: 'A single-page studio, strictly typed, fast to build and run.' },
  { label: 'Cloudflare Workers', desc: 'A small edge API for accounts, auth and profile data.' },
  { label: 'MongoDB', desc: 'Stores account + profile info — never your design content.' },
  { label: 'Cloudflare Pages', desc: 'Hosts the app on a fast, free-tier-friendly static edge.' },
];

export default function AboutPage() {
  const { user } = useAuth();
  const cta = user ? { to: '/dashboard', label: 'Open your dashboard' } : { to: '/signup', label: 'Start for free' };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', overflowX: 'clip' }}>
      <div className="lp-grain" />

      {/* ---- nav ---- */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'color-mix(in srgb, var(--bar) 88%, transparent)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--ink)' }}>
        <div className="lp-nav-inner" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <Link to="/" aria-label="Cardstock home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <CardstockLogo size={32} wordSize={19} color="var(--ink)" />
          </Link>
          <div style={{ flex: 1 }} />
          <nav style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/" className="lp-underline lp-nav-login" style={textLink}>Home</Link>
            <Link to={cta.to} style={pill}>{cta.label}</Link>
          </nav>
        </div>
      </header>

      {/* ---- hero ---- */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '72px 22px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ height: 1, width: 46, background: 'var(--ink)' }} />
          <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--muted-2)' }}>ABOUT CARDSTOCK</span>
        </div>
        <h1 style={{ margin: '0 0 22px', maxWidth: 900 }}>
          <span style={{ display: 'block', font: '900 clamp(38px, 6.4vw, 74px)/1 Archivo', letterSpacing: '-0.035em' }}>
            A calmer way to make LinkedIn posts that look{' '}
            <em style={{ fontFamily: 'Newsreader, serif', fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.01em' }}>designed</em>.
          </span>
        </h1>
        <p style={{ font: "400 clamp(16px, 2.1vw, 20px)/1.6 'Space Grotesk'", color: 'var(--muted-2)', maxWidth: 620, margin: '0 0 30px' }}>
          Cardstock is a browser-based studio for designing LinkedIn cards and carousels. Pick a template, type your
          words, nudge the palette, and export a razor-sharp PNG or PDF — no design app, no watermark, no learning curve.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link to={cta.to} style={{ ...pill, height: 52, padding: '0 28px', fontSize: 16 }}>{cta.label}</Link>
          <Link to="/" style={{ ...ghost, height: 52, padding: '0 24px', fontSize: 16 }}>Back to home</Link>
        </div>
      </section>

      {/* ---- what it is ---- */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '20px 22px 56px' }}>
        <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 26 }}>
          <span style={{ font: "italic 500 20px/1 Newsreader", color: 'var(--muted-2)' }}>What it is</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '26px 40px', marginTop: 18, maxWidth: 900 }}>
            <p style={{ font: "400 15.5px/1.7 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>
              Most people reach for a heavy design tool or screenshot an app's notes to post on LinkedIn. Cardstock
              trims that to the essentials: a fixed set of hand-composed templates, a live editor where the frame on
              screen is exactly what you download, and a one-click export. That's the whole product.
            </p>
            <p style={{ font: "400 15.5px/1.7 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>
              Because rendering and export happen entirely in your browser, your designs never touch a server — they
              live in local browser storage, and you own the backup. It stays fast, private, and free to start.
            </p>
          </div>
        </div>
      </section>

      {/* ---- principles ---- */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '0 22px 56px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 8, borderBottom: '2px solid var(--ink)', paddingBottom: 18 }}>
          <h2 style={{ font: '900 clamp(26px, 4vw, 40px)/1 Archivo', letterSpacing: '-0.03em', margin: 0, maxWidth: 560 }}>
            Built on a few stubborn ideas.
          </h2>
          <span style={{ font: "italic 500 20px/1 Newsreader", color: 'var(--muted-2)' }}>Four of them</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 0 }}>
          {PRINCIPLES.map((p, i) => (
            <div key={p.n} style={{ display: 'flex', gap: 18, padding: '26px 22px 26px 0', borderBottom: '1px solid var(--line-2)', ...(i % 2 === 0 ? { borderRight: '1px solid var(--line-2)', paddingRight: 30 } : { paddingLeft: 30 }) }}>
              <div style={{ font: 'italic 500 34px/1 Newsreader', color: 'var(--brand)', flex: 'none', width: 52 }}>{p.n}</div>
              <div>
                <h3 style={{ font: '800 19px/1.25 Archivo', letterSpacing: '-0.01em', margin: '2px 0 8px' }}>{p.title}</h3>
                <p style={{ font: "400 14px/1.6 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- built with / open source (dark band) ---- */}
      <section style={{ position: 'relative', zIndex: 1, background: 'var(--ink)', color: 'var(--bar)', borderTop: '2px solid var(--ink)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 22px' }}>
          <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--brand)' }}>BUILT WITH</span>
          <h2 style={{ font: '900 clamp(24px, 3.6vw, 38px)/1.04 Archivo', letterSpacing: '-0.03em', margin: '12px 0 8px', color: 'var(--bar)', maxWidth: 640 }}>
            Open source, and honest about the stack.
          </h2>
          <p style={{ font: "400 15px/1.65 'Space Grotesk'", color: 'color-mix(in srgb, var(--bar) 72%, transparent)', margin: '0 0 32px', maxWidth: 600 }}>
            Cardstock is MIT-licensed — the code is public, and you're welcome to read it, file an issue, or run your own copy.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
            {STACK.map((s) => (
              <div key={s.label} style={{ border: '1px solid rgba(243,238,225,0.18)', borderRadius: 14, padding: '18px 18px 20px' }}>
                <div style={{ font: '800 16px/1.2 Archivo', letterSpacing: '-0.01em', color: 'var(--bar)', marginBottom: 6 }}>{s.label}</div>
                <p style={{ font: "400 13px/1.55 'Space Grotesk'", color: 'color-mix(in srgb, var(--bar) 64%, transparent)', margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 30 }}>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" style={{ ...pill, background: 'var(--brand)', color: 'var(--ink)', border: '1px solid var(--brand)', height: 48, padding: '0 22px' }}>
              View source on GitHub →
            </a>
          </div>
        </div>
      </section>

      {/* ---- closing CTA ---- */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '80px 22px', textAlign: 'center' }}>
        <p style={{ font: "italic 500 clamp(17px,3vw,23px)/1.4 Newsreader", color: 'var(--muted-2)', margin: '0 0 14px' }}>No app to install. No watermark. No catch.</p>
        <h2 style={{ font: '900 clamp(30px, 5.5vw, 56px)/1 Archivo', letterSpacing: '-0.035em', margin: '0 0 28px' }}>
          Make your first card in{' '}
          <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>five minutes<span style={{ position: 'absolute', left: 0, right: 0, bottom: '0.06em', height: '0.28em', background: 'var(--brand)', zIndex: -1 }} /></span>.
        </h2>
        <Link to={cta.to} style={{ ...pill, height: 56, padding: '0 34px', fontSize: 17 }}>{cta.label}</Link>
      </section>

      {/* ---- footer ---- */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--ink)', background: 'var(--bar)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 22px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ font: "600 12px/1 'Space Grotesk'", color: 'var(--muted)', letterSpacing: '.04em' }}>
            © 2026 Cardstock — Card &amp; Carousel Studio
            <span style={{ marginLeft: 10, opacity: 0.75 }}>v{versionData.version}</span>
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            <Link to="/" className="lp-underline" style={footLink}>Home</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="lp-underline" style={footLink}>GitHub</a>
            <Link to="/signup" className="lp-underline" style={footLink}>Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const pill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 44,
  padding: '0 20px',
  borderRadius: 999,
  background: 'var(--ink)',
  color: 'var(--brand)',
  font: "800 14px/1 'Space Grotesk'",
  letterSpacing: '0.01em',
  textDecoration: 'none',
  border: '1px solid var(--ink)',
};
const ghost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 44,
  padding: '0 20px',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--ink)',
  font: "800 14px/1 'Space Grotesk'",
  textDecoration: 'none',
  border: '1px solid var(--ink)',
};
const textLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 44,
  padding: '0 6px',
  font: "700 14px/1 'Space Grotesk'",
  color: 'var(--ink)',
  textDecoration: 'none',
};
const footLink: CSSProperties = {
  font: "600 12px/1 'Space Grotesk'",
  color: 'var(--muted-2)',
  textDecoration: 'none',
  paddingBottom: 2,
};
