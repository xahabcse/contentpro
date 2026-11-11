import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { CardstockLogo } from '@/components/Logo';
import versionData from '@/version.json';

const REPO_URL = 'https://github.com/xahabcse/contentpro';

const PILLARS: { icon: string; title: string; subtitle: string; body: string }[] = [
  {
    icon: '📐',
    title: 'Constraint Over Chaos',
    subtitle: 'Structured layouts that keep the focus on your message',
    body: 'When design tools give you an infinite blank canvas, you spend time aligning boxes and fixing line wraps. Cardstock replaces free-form dragging with curated templates and automatic font sizing. Preview longer copy before exporting to make sure every line fits.',
  },
  {
    icon: '⚡',
    title: 'Pixel-for-Pixel WYSIWYG',
    subtitle: 'What you see in the studio is what downloads',
    body: 'Cardstock compiles PNG cards (1080×1080), multi-page PDF carousels, and ordered PNG slide ZIPs (1080×1350 per slide) in your browser. Preview the design before exporting it for LinkedIn, Facebook, or another platform.',
  },
  {
    icon: '🔒',
    title: 'Radical Local-First Privacy',
    subtitle: 'Zero designs or drafts sent to our servers',
    body: 'Your draft thoughts, client case studies, and unpublished ideas belong to you. Cardstock keeps design JSON in account-scoped localStorage and design images in IndexedDB on your device. The edge server stores account data and profile details, including any profile images you upload.',
  },
  {
    icon: '🌐',
    title: 'Open Source & Freedom',
    subtitle: 'MIT Licensed · Fully inspectable and self-hostable',
    body: 'No hidden paywalls for basic features or watermarks. The entire codebase is open source. You can run the stack locally with Docker or deploy your own instance to Cloudflare. Login and signup require internet access for Cloudflare Turnstile verification.',
  },
];

const TECH_STACK: { name: string; role: string; desc: string; badge: string }[] = [
  {
    name: 'React 19 + TypeScript',
    role: 'Frontend UI & Studio Engine',
    desc: 'Typed editor with live previews across 100 templates for cards and carousels.',
    badge: 'Frontend',
  },
  {
    name: 'html2canvas, jsPDF & JSZip',
    role: 'Client-Side Export Pipeline',
    desc: 'Creates PNG cards, LinkedIn document PDFs, and ordered PNG slide ZIPs in the browser.',
    badge: 'Engine',
  },
  {
    name: 'Cloudflare Workers & Hono 4',
    role: 'Edge API Layer',
    desc: 'Edge runtime for accounts, profiles, and authentication.',
    badge: 'Backend',
  },
  {
    name: 'D1, R2 & Durable Objects',
    role: 'Data, Images & Rate Limiting',
    desc: 'D1 stores accounts, R2 stores profile images, and Durable Objects enforce atomic login limits.',
    badge: 'Database',
  },
  {
    name: 'Web Crypto (PBKDF2)',
    role: 'Stateless Auth & Security',
    desc: '100,000 PBKDF2-HMAC-SHA256 iterations, httpOnly Strict JWT cookies, and sessionVersion revocation.',
    badge: 'Security',
  },
  {
    name: 'Cloudflare Pages',
    role: 'Static Global Edge CDN',
    desc: 'Fast, secure static asset distribution with hardened CSP and HSTS security headers.',
    badge: 'Infra',
  },
];

export default function AboutPage() {
  const { user } = useAuth();
  const cta = user ? { to: '/dashboard', label: 'Open Studio Dashboard →' } : { to: '/signup', label: 'Start Designing Free →' };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'transparent', color: 'var(--ink)', overflowX: 'clip' }}>
      <div className="lp-grain" />

      {/* ==================== 1. NAVIGATION ==================== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'rgba(250, 252, 249, 0.76)',
          backdropFilter: 'blur(18px) saturate(1.2)',
          borderBottom: '1px solid var(--glass-line)',
          boxShadow: '0 8px 24px rgba(30, 48, 44, 0.06)',
        }}
      >
        <div className="lp-nav-inner" style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <Link to="/" aria-label="Cardstock home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <CardstockLogo size={32} wordSize={19} color="var(--ink)" />
          </Link>
          <div style={{ flex: 1 }} />
          <nav style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" className="lp-underline lp-about-aux" style={navTextLink}>Home</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="lp-underline lp-about-aux" style={navTextLink}>GitHub</a>
            <Link to={cta.to} style={navPill}>
              <span className="lp-about-cta-long">{cta.label}</span>
              <span className="lp-about-cta-short">{user ? 'Dashboard →' : 'Start Free →'}</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ==================== 2. HERO SECTION ==================== */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '72px 22px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span className="lp-glow-tag">✦ THE CARDSTOCK MANIFESTO</span>
          <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.18em', color: 'var(--muted)' }}>EST. 2026</span>
        </div>

        <h1 style={{ margin: '0 0 24px', maxWidth: 960 }}>
          <span style={{ display: 'block', font: '900 clamp(38px, 6.2vw, 72px)/1.02 Archivo', letterSpacing: '-0.035em' }}>
            The antidote to 45-minute Canva wrestling sessions.
          </span>
        </h1>

        <p style={{ font: "400 clamp(16.5px, 2.1vw, 21px)/1.6 'Space Grotesk'", color: 'var(--muted-2)', maxWidth: 740, margin: '0 0 36px' }}>
          Cardstock was born from a simple realization: high-signal LinkedIn creators don&apos;t need another complex graphic design tool. They need strict typographic guardrails that make good ideas look publication-ready in under 3 minutes.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <Link to={cta.to} style={{ ...ctaBtn, height: 52, padding: '0 32px', fontSize: 16 }}>{cta.label}</Link>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, height: 52, padding: '0 24px', fontSize: 15 }}>
            View GitHub Repository ↗
          </a>
        </div>
      </section>

      {/* ==================== 3. THE CREATOR DILEMMA & STORY ==================== */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '36px 22px 64px' }}>
        <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 36 }}>
          <span style={{ font: "italic 500 22px/1 Newsreader", color: 'var(--muted-2)' }}>The Core Problem</span>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px 48px', marginTop: 20 }}>
            <div>
              <h3 style={{ font: '800 20px/1.3 Archivo', margin: '0 0 10px' }}>The Tyranny of the Blank Canvas</h3>
              <p style={{ font: "400 15.5px/1.7 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>
                Writing technical or career insights on LinkedIn is already mentally demanding. But turning that insight into a visual card or carousel often means opening bloated tools, manually aligning text boxes, guessing line-heights, and fixing broken fonts on mobile. Most creators give up or post unformatted text that gets ignored.
              </p>
            </div>
            <div>
              <h3 style={{ font: '800 20px/1.3 Archivo', margin: '0 0 10px' }}>Design Built into Code</h3>
              <p style={{ font: "400 15.5px/1.7 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>
                Cardstock solves this by replacing manual graphic placement with deterministic code. Our templates automatically calculate typography scaling based on your character count, layer contrast scrims behind background photos, and sign off with your profile signature without you ever moving a single pixel by hand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 4. CORE DESIGN PILLARS ==================== */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '0 22px 72px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28, borderBottom: '2px solid var(--ink)', paddingBottom: 18 }}>
          <div>
            <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--muted)' }}>OUR PHILOSOPHY</span>
            <h2 style={{ font: '900 clamp(26px, 4vw, 42px)/1.04 Archivo', letterSpacing: '-0.03em', margin: '8px 0 0' }}>
              Four principles behind every line of code.
            </h2>
          </div>
          <span style={{ font: "italic 500 20px/1 Newsreader", color: 'var(--muted-2)' }}>The Cardstock Standard</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {PILLARS.map((p) => (
            <div key={p.title} className="lp-feature-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{p.icon}</div>
              <h3 style={{ font: '800 19px/1.2 Archivo', margin: '0 0 4px' }}>{p.title}</h3>
              <div style={{ font: "600 12px/1.4 'Space Grotesk'", color: 'var(--brand-strong, #9b6c00)', marginBottom: 12 }}>
                {p.subtitle}
              </div>
              <p style={{ font: "400 14px/1.65 'Space Grotesk'", color: 'var(--muted-2)', margin: 0, flex: 1 }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== 5. OPEN SOURCE & TECH ARCHITECTURE ==================== */}
      <section style={{ position: 'relative', zIndex: 1, background: 'var(--ink)', color: 'var(--bar)', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)', padding: '72px 22px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>
            <div>
              <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--brand)' }}>HONEST ABOUT THE STACK</span>
              <h2 style={{ font: '900 clamp(26px, 4vw, 42px)/1.04 Archivo', letterSpacing: '-0.03em', margin: '10px 0 0', color: 'var(--bar)' }}>
                Built with modern edge infrastructure.
              </h2>
            </div>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...ctaBtn,
                background: 'var(--brand)',
                color: 'var(--ink)',
                border: '1px solid var(--brand)',
                height: 44,
                padding: '0 20px',
                fontSize: 14,
              }}
            >
              Star on GitHub ⭐️
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 20 }}>
            {TECH_STACK.map((item) => (
              <div
                key={item.name}
                style={{
                  border: '1px solid rgba(243,238,225,0.16)',
                  borderRadius: 16,
                  padding: '22px 20px',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ font: '800 17px/1.2 Archivo', color: 'var(--bar)' }}>{item.name}</div>
                  <span style={{ font: "700 10px/1 'Space Grotesk'", letterSpacing: '.08em', padding: '3px 8px', borderRadius: 999, background: 'rgba(242,183,5,0.18)', color: 'var(--brand)', textTransform: 'uppercase' }}>
                    {item.badge}
                  </span>
                </div>
                <div style={{ font: "600 12.5px/1 'Space Grotesk'", color: 'var(--brand)', marginBottom: 8 }}>{item.role}</div>
                <p style={{ font: "400 13.5px/1.6 'Space Grotesk'", color: 'color-mix(in srgb, var(--bar) 70%, transparent)', margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 6. CREATOR / COMMUNITY CARD ==================== */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '72px 22px' }}>
        <div className="lp-feature-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.4fr) minmax(0, 0.6fr)', gap: 32, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', borderRight: '1px solid var(--line-2)', paddingRight: 20 }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--ink)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, fontFamily: 'Archivo', marginBottom: 14 }}>
              SH
            </div>
            <h3 style={{ font: '800 20px/1.2 Archivo', margin: '0 0 4px' }}>Md Sahabuddin Hossain</h3>
            <div style={{ font: "600 13px/1 'Space Grotesk'", color: 'var(--muted)', marginBottom: 8 }}>Creator &amp; Software Engineer</div>
            <div style={{ font: "700 12px/1 'Space Grotesk'", color: 'var(--brand-strong, #9b6c00)' }}>@xahabcse</div>
          </div>

          <div>
            <h3 style={{ font: '800 22px/1.2 Archivo', margin: '0 0 12px' }}>Contributions &amp; Local Setup</h3>
            <p style={{ font: "400 14.5px/1.65 'Space Grotesk'", color: 'var(--muted-2)', margin: '0 0 18px' }}>
              Cardstock is built for the global developer and creator community. If you want to contribute new template layouts, report issues, or run a local instance with Docker, explore the open source repository:
            </p>
            <div style={{ background: 'var(--surface)', padding: '10px 14px', borderRadius: 10, font: '13px monospace', color: 'var(--ink)', marginBottom: 18, border: '1px solid var(--line-2)' }}>
              git clone https://github.com/xahabcse/contentpro.git &amp;&amp; docker compose up
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, height: 42, padding: '0 18px', fontSize: 13.5 }}>
                GitHub Repository ↗
              </a>
              <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, height: 42, padding: '0 18px', fontSize: 13.5 }}>
                Contributing Guide ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 7. CLOSING CTA ==================== */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto 60px', padding: '0 22px', textAlign: 'center' }}>
        <p style={{ font: "italic 500 clamp(18px,2.8vw,24px)/1.4 Newsreader", color: 'var(--muted-2)', margin: '0 0 14px' }}>
          No design skills required. No watermark. No learning curve.
        </p>
        <h2 style={{ font: '900 clamp(30px, 5.2vw, 56px)/1 Archivo', letterSpacing: '-0.035em', margin: '0 0 28px' }}>
          Design your first LinkedIn post in{' '}
          <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>
            three minutes
            <span style={{ position: 'absolute', left: 0, right: 0, bottom: '0.06em', height: '0.28em', background: 'var(--brand)', zIndex: -1 }} />
          </span>
          .
        </h2>
        <Link to={cta.to} style={{ ...ctaBtn, height: 56, padding: '0 36px', fontSize: 17 }}>{cta.label}</Link>
      </section>

      {/* ==================== 8. SITE FOOTER ==================== */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--ink)', background: 'var(--bar)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 22px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CardstockLogo size={24} wordSize={16} color="var(--ink)" />
            <span style={{ font: "600 12px/1 'Space Grotesk'", color: 'var(--muted)', letterSpacing: '.04em' }}>
              © 2026 Cardstock — Open Source In-Browser Studio
              <span style={{ marginLeft: 8, opacity: 0.75 }}>v{versionData.version}</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 22 }}>
            <Link to="/" className="lp-underline" style={footLink}>Home</Link>
            <Link to="/about" className="lp-underline" style={footLink}>About</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="lp-underline" style={footLink}>GitHub</a>
            <Link to="/signup" className="lp-underline" style={footLink}>Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Shared button & link styles
const ctaBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  background: 'var(--ink)',
  color: 'var(--brand)',
  font: "800 14px/1 'Space Grotesk'",
  letterSpacing: '0.01em',
  textDecoration: 'none',
  border: '1px solid var(--ink)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--ink)',
  font: "800 14px/1 'Space Grotesk'",
  textDecoration: 'none',
  border: '1px solid var(--line-2)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const navPill: CSSProperties = {
  ...ctaBtn,
  height: 40,
  padding: '0 18px',
};

const navTextLink: CSSProperties = {
  alignItems: 'center',
  height: 40,
  padding: '0 6px',
  font: "700 13.5px/1 'Space Grotesk'",
  color: 'var(--ink)',
  textDecoration: 'none',
};

const footLink: CSSProperties = {
  font: "600 12px/1 'Space Grotesk'",
  color: 'var(--muted-2)',
  textDecoration: 'none',
  paddingBottom: 2,
};
