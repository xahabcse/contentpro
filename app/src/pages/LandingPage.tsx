import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { CardstockLogo } from '@/components/Logo';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { resolveColors, PALETTES } from '@/lib/palettes';
import { templateDefaults, TEMPLATES } from '@/lib/templates';
import type { FooterData, ResolvedSlide, TemplateId } from '@/lib/design-types';
import versionData from '@/version.json';

// Demo author signature for live landing previews
const DEMO_FOOTER: FooterData = {
  name: 'Md Sahabuddin Hossain',
  handle: 'xahabcse',
  designation: 'Software Engineer',
  avatar: null,
};

const HERO_TEMPLATES: { id: TemplateId; label: string; quickKey: string; initialText: string }[] = [
  { id: 'cover', label: 'Cover Hook', quickKey: 'headline', initialText: 'How We Scaled Our Edge API to 50M Requests/Day' },
  { id: 'stat', label: 'Big Stat', quickKey: 'number', initialText: '99.99%' },
  { id: 'quote', label: 'Quote', quickKey: 'quote', initialText: 'The best engineering is the one that solves the problem and gets out of the way.' },
  { id: 'tips', label: 'Numbered Tips', quickKey: 'title', initialText: '4 Architecture Rules We Never Break' },
  { id: 'framework', label: 'Framework', quickKey: 'title', initialText: 'The 3-Step Edge Caching Playbook' },
  { id: 'contrast', label: 'Before / After', quickKey: 'after', initialText: 'A high-converting post published in under 3 minutes.' },
];

const CAROUSEL_DECK_SLIDES: { template: TemplateId; fields: Record<string, string | string[]>; palette: string }[] = [
  {
    template: 'cover',
    palette: 'ink',
    fields: {
      kicker: 'Engineering Leadership · Swipe →',
      headline: 'The 5 System Design Rules Every Senior Engineer Follows',
      highlight: 'Senior Engineer',
    },
  },
  {
    template: 'stat',
    palette: 'cobalt',
    fields: {
      label: 'Performance Benchmark',
      number: '4.2×',
      caption: 'Faster time-to-market when design guardrails are built directly into code.',
    },
  },
  {
    template: 'tips',
    palette: 'forest',
    fields: {
      title: '3 Principles for High-Traffic APIs',
      items: [
        'Cache aggressively at the edge before hitting databases',
        'Use atomic Durable Objects for distributed locks',
        'Keep client payloads strictly typed and validated',
      ],
    },
  },
  {
    template: 'framework',
    palette: 'grape',
    fields: {
      title: 'The Post-Mortem Framework',
      items: [
        'Tension — Identify root cause without personal blame',
        'Turn — Ship automated regression tests within 24h',
        'Take — Document lessons in public for team learning',
      ],
    },
  },
  {
    template: 'cta',
    palette: 'crimson',
    fields: {
      headline: 'Want the full architecture diagram & code examples?',
      highlight: 'architecture diagram',
      buttonText: 'Save this post & comment below →',
    },
  },
];

const TEMPLATE_CATEGORIES: {
  category: string;
  items: { id: TemplateId; name: string; palette: string; desc: string }[];
}[] = [
  {
    category: 'Hooks & Covers',
    items: [
      { id: 'cover', name: 'Cover / Hook', palette: 'ink', desc: 'Punchy headline with high-contrast highlight badge' },
      { id: 'question', name: 'Bold Question', palette: 'bone', desc: 'Provocative question hook that stops the scroll' },
      { id: 'announce', name: 'Announcement', palette: 'cobalt', desc: 'Product release, workshop, or milestone notice' },
      { id: 'statement', name: 'Statement', palette: 'forest', desc: 'Bold contrarian viewpoint with inline marker accent' },
    ],
  },
  {
    category: 'Data & Benchmarks',
    items: [
      { id: 'stat', name: 'Big Stat', palette: 'cobalt', desc: 'Massive metric callout with context caption' },
      { id: 'bignum', name: 'Big Number + Ring', palette: 'ink', desc: 'Circular visual graphic with percentage callout' },
      { id: 'stattrio', name: 'Stat Trio', palette: 'bone', desc: 'Three stacked growth numbers in a structured row' },
      { id: 'comparison', name: 'Comparison Matrix', palette: 'forest', desc: 'Side-by-side columns comparing two approaches' },
    ],
  },
  {
    category: 'Frameworks & Educational',
    items: [
      { id: 'tips', name: 'Numbered Tips', palette: 'grape', desc: 'High-retention listicle with clear step numbering' },
      { id: 'framework', name: 'Framework', palette: 'crimson', desc: 'Multi-part method with bold step lead-ins' },
      { id: 'contrast', name: 'Before / After', palette: 'bone', desc: 'Direct split comparison highlighting transformations' },
      { id: 'checklist', name: 'Checklist', palette: 'forest', desc: 'Actionable tick-box items for saveable cheat sheets' },
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How does exporting to LinkedIn work?',
    a: 'Single cards export as crisp 1080×1080 PNG images. Carousels export as multi-page 1080×1350 portrait PDFs. When you create a post on LinkedIn, simply click the "Add a document" icon and select your exported PDF — LinkedIn automatically turns it into an interactive swipeable carousel!',
  },
  {
    q: 'Why fixed templates instead of a free-form canvas like Canva?',
    a: 'Free-form canvases let you nudge text boxes forever, resulting in inconsistent alignment, unreadable mobile fonts, and 45 minutes wasted per post. Cardstock enforces mathematically locked typographic hierarchies and auto-contrast scrims so your post looks professionally typeset in under 3 minutes.',
  },
  {
    q: 'Are my designs saved on your server?',
    a: 'No. Designs live 100% on your device inside your browser (localStorage for structure and IndexedDB for uploaded photos). Your content never touches our servers. You can export a full JSON backup at any time to move your designs between computers.',
  },
  {
    q: 'Can I add my own profile picture, logo, and brand colors?',
    a: 'Yes! Set your name, handle, designation, avatar, and company logo once in your profile. Every template automatically signs your post in the footer. You can also pick from 6 curated palettes or enter custom hex colors for any design.',
  },
  {
    q: 'Is there any watermark on exported designs?',
    a: 'None. Exported PNGs and PDFs are completely unbranded and 100% yours to publish.',
  },
  {
    q: 'Can I test it without creating an account?',
    a: 'You can test the live interactive sandbox right here on this page, or log in with the instant demo account (demo@contentpro.local / demo1234) if running locally.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Scroll collapse for logo
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sandbox State
  const [sandboxTemplate, setSandboxTemplate] = useState<TemplateId>('cover');
  const [sandboxPalette, setSandboxPalette] = useState<string>('ink');
  const [sandboxFormat, setSandboxFormat] = useState<'card' | 'carousel'>('card');
  const [customText, setCustomText] = useState('How We Scaled Our Edge API to 50M Requests/Day');

  // Carousel Deck State
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [feedSimulation, setFeedSimulation] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Template Showcase Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // When changing sandbox template, set appropriate default editable text
  function handleSelectSandboxTemplate(t: typeof HERO_TEMPLATES[0]) {
    setSandboxTemplate(t.id);
    setCustomText(t.initialText);
  }

  // Construct live resolved slide for sandbox
  const currentHeroConfig = HERO_TEMPLATES.find((t) => t.id === sandboxTemplate) || HERO_TEMPLATES[0];
  const baseFields = templateDefaults(sandboxTemplate);
  const liveFields = {
    ...baseFields,
    [currentHeroConfig.quickKey]: customText || baseFields[currentHeroConfig.quickKey],
  };
  const sandboxSlide: ResolvedSlide = {
    template: sandboxTemplate,
    fields: liveFields,
    bgImage: null,
  };
  const sandboxColors = resolveColors(sandboxPalette, {});

  const currentDeckItem = CAROUSEL_DECK_SLIDES[activeSlideIndex];
  const currentDeckSlide: ResolvedSlide = {
    template: currentDeckItem.template,
    fields: currentDeckItem.fields,
    bgImage: null,
  };
  const currentDeckColors = resolveColors(currentDeckItem.palette, {});

  const cta = user ? { to: '/dashboard', label: 'Go to Studio Dashboard →' } : { to: '/signup', label: 'Start Designing Free →' };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', overflowX: 'clip' }}>
      <div className="lp-grain" />

      {/* ==================== 1. TOP NAVIGATION ==================== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'color-mix(in srgb, var(--bar) 90%, transparent)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--line-2)',
        }}
      >
        <div className="lp-nav-inner" style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <Link to="/" aria-label="Cardstock home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <CardstockLogo size={32} wordSize={19} color="var(--ink)" collapsed={scrolled} />
          </Link>

          <div style={{ flex: 1 }} />

          <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="#playground" className="lp-underline lp-nav-about" style={navTextLink}>Playground</a>
            <a href="#carousel-deck" className="lp-underline lp-nav-about" style={navTextLink}>Carousels</a>
            <a href="#templates" className="lp-underline lp-nav-about" style={navTextLink}>Templates</a>
            <Link to="/about" className="lp-underline lp-nav-about" style={navTextLink}>About</Link>
            {user ? (
              <Link to="/dashboard" style={navPill}>Dashboard →</Link>
            ) : (
              <>
                <Link to="/login" className="lp-underline lp-nav-login" style={navTextLink}>Log in</Link>
                <Link to="/signup" style={navPill}>Start Free</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ==================== 2. HERO & LIVE PLAYGROUND ==================== */}
      <section id="playground" style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '64px 22px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)', gap: 48, alignItems: 'center' }} className="lp-hero-grid">
          {/* Left Hero Copy */}
          <div>
            <div className="lp-reveal" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span className="lp-glow-tag">✦ ZERO DESIGN TOOLS REQUIRED</span>
              <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.18em', color: 'var(--muted)' }}>100% IN-BROWSER</span>
            </div>

            <h1 className="lp-reveal" style={{ margin: '0 0 22px', animationDelay: '0.08s' }}>
              <span style={{ display: 'block', font: '900 clamp(38px, 5.8vw, 72px)/0.98 Archivo', letterSpacing: '-0.035em' }}>
                LinkedIn cards &amp; carousels that look
              </span>
              <span style={{ display: 'block', font: '900 clamp(38px, 5.8vw, 72px)/0.98 Archivo', letterSpacing: '-0.035em' }}>
                hand-typeset by an{' '}
                <em style={{ fontFamily: 'Newsreader, serif', fontWeight: 500, fontStyle: 'italic', color: 'var(--ink)', position: 'relative', whiteSpace: 'nowrap' }}>
                  <span style={{ position: 'relative', zIndex: 1 }}>editorial designer</span>
                  <span style={{ position: 'absolute', left: '-2%', right: '-2%', bottom: '0.08em', height: '0.32em', background: 'var(--brand)', zIndex: 0, borderRadius: 2 }} />
                </em>
                .
              </span>
            </h1>

            <p className="lp-reveal" style={{ font: "400 clamp(16px, 1.8vw, 19px)/1.6 'Space Grotesk'", color: 'var(--muted-2)', maxWidth: 540, margin: '0 0 32px', animationDelay: '0.16s' }}>
              No wrestling Canva text boxes. No fuzzy screenshots of phone notes. Pick a structured template, dial your message, and export vector-crisp 1080p PNGs or multi-page PDFs in under 3 minutes.
            </p>

            <div className="lp-reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 30, animationDelay: '0.24s' }}>
              <Link to={cta.to} style={{ ...ctaBtn, height: 52, padding: '0 32px', fontSize: 16 }}>{cta.label}</Link>
              {!user && (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{ ...ghostBtn, height: 52, padding: '0 24px', fontSize: 15 }}
                >
                  Demo Account →
                </button>
              )}
            </div>

            <div className="lp-reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', animationDelay: '0.32s' }}>
              {[
                '✓ 100% Client-Side Privacy',
                '✓ Vector 1080p Export',
                '✓ No Watermarks Ever',
                '✓ Auto Profile Footers',
              ].map((item) => (
                <span key={item} style={{ font: "600 12.5px/1 'Space Grotesk'", color: 'var(--muted-2)', display: 'inline-flex', alignItems: 'center' }}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Live Interactive Sandbox */}
          <div className="lp-reveal lp-sandbox" style={{ animationDelay: '0.2s', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line-2)', paddingBottom: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
                <span style={{ font: "700 12px/1 'Space Grotesk'", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink)' }}>Live Studio Sandbox</span>
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', padding: 3, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setSandboxFormat('card')}
                  style={{
                    border: 'none',
                    background: sandboxFormat === 'card' ? 'var(--ink)' : 'transparent',
                    color: sandboxFormat === 'card' ? 'var(--brand)' : 'var(--muted)',
                    font: "700 11px/1 'Space Grotesk'",
                    padding: '5px 9px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  1:1 Card
                </button>
                <button
                  type="button"
                  onClick={() => setSandboxFormat('carousel')}
                  style={{
                    border: 'none',
                    background: sandboxFormat === 'carousel' ? 'var(--ink)' : 'transparent',
                    color: sandboxFormat === 'carousel' ? 'var(--brand)' : 'var(--muted)',
                    font: "700 11px/1 'Space Grotesk'",
                    padding: '5px 9px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  4:5 Slide
                </button>
              </div>
            </div>

            {/* Template Selector Pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 12, scrollbarWidth: 'none' }}>
              {HERO_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="lp-tab-btn"
                  data-active={sandboxTemplate === t.id}
                  onClick={() => handleSelectSandboxTemplate(t)}
                  style={{ fontSize: 12, padding: '6px 11px', whiteSpace: 'nowrap' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Live Interactive Canvas Screen */}
            <div
              style={{
                width: '100%',
                aspectRatio: sandboxFormat === 'card' ? '1 / 1' : '1080 / 1350',
                maxHeight: 380,
                borderRadius: 14,
                overflow: 'hidden',
                position: 'relative',
                background: '#0e0e0e',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <div
                style={{
                  width: 1080,
                  height: sandboxFormat === 'card' ? 1080 : 1350,
                  transform: `scale(${sandboxFormat === 'card' ? 380 / 1080 : 380 / 1350})`,
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                  flex: 'none',
                }}
              >
                <SlideCanvas
                  slide={sandboxSlide}
                  colors={sandboxColors}
                  footer={DEMO_FOOTER}
                  width={1080}
                  height={sandboxFormat === 'card' ? 1080 : 1350}
                />
              </div>
            </div>

            {/* Quick Live Text Edit + Palette Bar */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type your words live…"
                className="input"
                style={{ height: 38, fontSize: 13, flex: 1 }}
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none' }}>
                {PALETTES.slice(0, 6).map((p) => {
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-label={`Palette ${p.name}`}
                      className="lp-palette-chip"
                      data-active={sandboxPalette === p.id}
                      onClick={() => setSandboxPalette(p.id)}
                      style={{ background: p.bg, border: `1px solid ${p.accent}` }}
                    />
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: "500 12px/1 'Space Grotesk'", color: 'var(--muted)' }}>
                ⚡ Real-time browser rendering via HTML/CSS
              </span>
              <Link to={cta.to} style={{ font: "700 12px/1 'Space Grotesk'", color: 'var(--ink)', textDecoration: 'none' }} className="lp-underline">
                Open in Full Studio →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 3. MULTI-SLIDE CAROUSEL DECK SIMULATOR ==================== */}
      <section id="carousel-deck" style={{ position: 'relative', zIndex: 1, background: 'var(--ink)', color: 'var(--bar)', padding: '72px 22px', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 36 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--brand)' }}>INTERACTIVE DECK SIMULATOR</span>
                <span style={{ color: 'var(--brand)', fontSize: 14 }}>✦</span>
              </div>
              <h2 style={{ font: '900 clamp(28px, 4.4vw, 48px)/1.05 Archivo', letterSpacing: '-0.03em', margin: 0, color: 'var(--bar)', maxWidth: 680 }}>
                Build high-retention multi-slide decks that readers actually swipe through.
              </h2>
            </div>

            {/* Stepper + Feed Simulation Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setFeedSimulation(!feedSimulation)}
                style={{
                  height: 42,
                  padding: '0 16px',
                  borderRadius: 999,
                  background: feedSimulation ? 'var(--brand)' : 'rgba(255,255,255,0.1)',
                  color: feedSimulation ? 'var(--ink)' : 'var(--bar)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  font: "700 13px/1 'Space Grotesk'",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{feedSimulation ? '✓ LinkedIn Feed View' : '👁️ Preview LinkedIn Feed'}</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  aria-label="Previous Slide"
                  onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeSlideIndex === 0}
                  style={{ ...darkArrow, opacity: activeSlideIndex === 0 ? 0.3 : 1 }}
                >
                  ‹
                </button>
                <span style={{ font: "800 14px/1 'Space Grotesk'", color: 'var(--brand)', minWidth: 54, textAlign: 'center' }}>
                  {`0${activeSlideIndex + 1} / 0${CAROUSEL_DECK_SLIDES.length}`}
                </span>
                <button
                  type="button"
                  aria-label="Next Slide"
                  onClick={() => setActiveSlideIndex((prev) => Math.min(CAROUSEL_DECK_SLIDES.length - 1, prev + 1))}
                  disabled={activeSlideIndex === CAROUSEL_DECK_SLIDES.length - 1}
                  style={{ ...darkArrow, opacity: activeSlideIndex === CAROUSEL_DECK_SLIDES.length - 1 ? 0.3 : 1 }}
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Carousel Stage Container */}
          <div style={{ display: 'grid', gridTemplateColumns: feedSimulation ? '1fr' : 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 36, alignItems: 'center' }}>
            {/* Slide Stage / LinkedIn Mockup */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {feedSimulation ? (
                /* Simulated LinkedIn Feed Post Container */
                <div style={{ width: '100%', maxWidth: 580, background: '#ffffff', color: '#191919', borderRadius: 16, padding: '16px 20px 20px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                  {/* LinkedIn Post Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0a66c2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16 }}>
                      SH
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#191919' }}>Md Sahabuddin Hossain</span>
                        <span style={{ color: '#666', fontSize: 12 }}>• 1st</span>
                      </div>
                      <div style={{ color: '#666', fontSize: 12, lineHeight: 1.2 }}>Software Engineer · In-Browser Tools Creator</div>
                      <div style={{ color: '#888', fontSize: 11 }}>1h • 🌐</div>
                    </div>
                    <button type="button" style={{ border: 'none', background: 'transparent', color: '#0a66c2', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      + Follow
                    </button>
                  </div>

                  <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 12px', color: '#191919' }}>
                    Most engineering posts fail to gain traction not because the insight is weak, but because it&apos;s trapped in a block of unformatted text. Here is our 5-step framework to document complex architecture in clean swipeable carousels:
                  </p>

                  {/* Document Carousel Container */}
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '1080 / 1350', maxHeight: 440, background: '#000', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 1080, height: 1350, transform: 'scale(0.325)', transformOrigin: 'center center', pointerEvents: 'none', flex: 'none' }}>
                      <SlideCanvas slide={currentDeckSlide} colors={currentDeckColors} footer={DEMO_FOOTER} width={1080} height={1350} />
                    </div>
                    {/* LinkedIn document page pill */}
                    <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                      {activeSlideIndex + 1} / {CAROUSEL_DECK_SLIDES.length}
                    </div>
                  </div>

                  {/* LinkedIn Reaction Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e0e0e0', marginTop: 14, paddingTop: 10, color: '#666', fontSize: 13, fontWeight: 600 }}>
                    <span>👍 428 Likes</span>
                    <span>💬 64 Comments · 18 Reposts</span>
                  </div>
                </div>
              ) : (
                /* Raw Slide Stage View */
                <div style={{ width: '100%', maxWidth: 440, aspectRatio: '1080 / 1350', background: '#0e0e0e', borderRadius: 18, overflow: 'hidden', position: 'relative', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 1080, height: 1350, transform: 'scale(0.325)', transformOrigin: 'center center', pointerEvents: 'none', flex: 'none' }}>
                    <SlideCanvas slide={currentDeckSlide} colors={currentDeckColors} footer={DEMO_FOOTER} width={1080} height={1350} />
                  </div>
                </div>
              )}
            </div>

            {/* Slide Navigation Filmstrip & Breakdown */}
            {!feedSimulation && (
              <div>
                <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.2em', color: 'var(--brand)', textTransform: 'uppercase' }}>
                  SLIDE {activeSlideIndex + 1} OF {CAROUSEL_DECK_SLIDES.length} — {TEMPLATES[currentDeckItem.template]?.name}
                </span>

                <h3 style={{ font: '800 24px/1.2 Archivo', color: 'var(--bar)', margin: '10px 0 14px' }}>
                  {activeSlideIndex === 0 && '1. The Hook Cover (Slide 1)'}
                  {activeSlideIndex === 1 && '2. The Data Anchor (Slide 2)'}
                  {activeSlideIndex === 2 && '3. The Step-by-Step Breakdown (Slide 3)'}
                  {activeSlideIndex === 3 && '4. The Actionable Framework (Slide 4)'}
                  {activeSlideIndex === 4 && '5. The Engagement Call-to-Action (Slide 5)'}
                </h3>

                <p style={{ font: "400 15px/1.65 'Space Grotesk'", color: 'color-mix(in srgb, var(--bar) 75%, transparent)', margin: '0 0 24px' }}>
                  {activeSlideIndex === 0 && 'A clear, high-contrast title with a highlighted hook. Mobile readers immediately understand the value proposition within 0.8 seconds.'}
                  {activeSlideIndex === 1 && 'Follow up the hook with an indisputable metric or percentage that builds instant credibility and curiosity.'}
                  {activeSlideIndex === 2 && 'Give three concise, high-signal rules with zero filler words so readers begin bookmarking the post.'}
                  {activeSlideIndex === 3 && 'Provide a concrete named model (Tension → Turn → Take) that makes the advice easy to remember and apply.'}
                  {activeSlideIndex === 4 && 'Direct readers to save the post or comment below, maximizing LinkedIn algorithm distribution.'}
                </p>

                {/* Filmstrip Selector */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 26 }}>
                  {CAROUSEL_DECK_SLIDES.map((slide, idx) => (
                    <button
                      key={slide.template + idx}
                      type="button"
                      onClick={() => setActiveSlideIndex(idx)}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 10,
                        border: activeSlideIndex === idx ? '2px solid var(--brand)' : '1px solid rgba(255,255,255,0.15)',
                        background: activeSlideIndex === idx ? 'rgba(242,183,5,0.15)' : 'rgba(255,255,255,0.04)',
                        color: activeSlideIndex === idx ? 'var(--brand)' : 'var(--bar)',
                        font: "700 12px/1 'Space Grotesk'",
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>Slide {idx + 1}</div>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{TEMPLATES[slide.template]?.name.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>

                <Link
                  to={cta.to}
                  style={{
                    ...ctaBtn,
                    background: 'var(--brand)',
                    color: 'var(--ink)',
                    border: '1px solid var(--brand)',
                    height: 48,
                    padding: '0 24px',
                    fontSize: 15,
                  }}
                >
                  Create Your Own Carousel Deck →
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ==================== 4. CANVA / NOTES VS. CARDSTOCK COMPARISON ==================== */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '80px 22px 56px' }}>
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 48px' }}>
          <span className="lp-glow-tag" style={{ marginBottom: 12 }}>THE CONTENT CREATION MATRIX</span>
          <h2 style={{ font: '900 clamp(28px, 4.2vw, 46px)/1.08 Archivo', letterSpacing: '-0.03em', margin: '10px 0 16px' }}>
            Why typical LinkedIn graphics take 45 minutes and still look sloppy.
          </h2>
          <p style={{ font: "400 16px/1.6 'Space Grotesk'", color: 'var(--muted-2)' }}>
            Free-form canvas tools offer infinite choices that slow you down. Cardstock provides fixed typographical guardrails designed specifically for technical and professional LinkedIn content.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {/* Card 1: Phone Notes Screenshot */}
          <div className="lp-feature-card" style={{ background: '#fbf9f4', border: '1px solid var(--line-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>📱</span>
              <div>
                <h3 style={{ font: '800 18px/1.2 Archivo', margin: 0, color: 'var(--ink)' }}>Phone Notes Screenshots</h3>
                <span style={{ font: "600 11px/1 'Space Grotesk'", color: 'var(--danger)', textTransform: 'uppercase' }}>Amateur &amp; Low Reach</span>
              </div>
            </div>
            <ul style={{ paddingLeft: 18, margin: 0, font: "400 14px/1.7 'Space Grotesk'", color: 'var(--muted-2)' }}>
              <li>JPEG compression creates fuzzy, unreadable text on retina screens</li>
              <li>No author or company footer signature</li>
              <li>Cannot export as a multi-page interactive PDF document</li>
              <li>Inconsistent line spacing that reads like an informal scratchpad</li>
            </ul>
          </div>

          {/* Card 2: Canva / Freeform Canvas */}
          <div className="lp-feature-card" style={{ background: '#fbf9f4', border: '1px solid var(--line-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>🎨</span>
              <div>
                <h3 style={{ font: '800 18px/1.2 Archivo', margin: 0, color: 'var(--ink)' }}>Canva / Free-form Tools</h3>
                <span style={{ font: "600 11px/1 'Space Grotesk'", color: '#b58000', textTransform: 'uppercase' }}>High Friction &amp; Time Sink</span>
              </div>
            </div>
            <ul style={{ paddingLeft: 18, margin: 0, font: "400 14px/1.7 'Space Grotesk'", color: 'var(--muted-2)' }}>
              <li>30–45 minutes of manual dragging, aligning text boxes, and layer tweaking</li>
              <li>Templates are designed for Instagram and look mismatched on LinkedIn</li>
              <li>Font sizes easily break when switching between mobile and desktop feeds</li>
              <li>Exporting crisp vector PDF carousels requires tedious multi-step setups</li>
            </ul>
          </div>

          {/* Card 3: Cardstock (Winner) */}
          <div className="lp-feature-card" style={{ background: 'var(--surface-2)', border: '2px solid var(--brand)', boxShadow: '0 20px 48px -12px rgba(242,183,5,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--brand)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✓</span>
              <div>
                <h3 style={{ font: '800 18px/1.2 Archivo', margin: 0, color: 'var(--ink)' }}>The Cardstock Standard</h3>
                <span style={{ font: "700 11px/1 'Space Grotesk'", color: '#0a703f', textTransform: 'uppercase' }}>3 Minutes · Publication Ready</span>
              </div>
            </div>
            <ul style={{ paddingLeft: 18, margin: 0, font: "500 14px/1.7 'Space Grotesk'", color: 'var(--ink)' }}>
              <li><strong>Mathematical Type Lock:</strong> Headlines, bodies, and stats never overlap or clip</li>
              <li><strong>Instant Multi-page PDF:</strong> Stitched entirely in-browser ready for LinkedIn</li>
              <li><strong>Auto Profile Signature:</strong> Avatar, name, handle, and company logo sign every slide</li>
              <li><strong>100% Client-Side Privacy:</strong> Zero designs or sensitive copy uploaded to any server</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ==================== 5. CATEGORIZED TEMPLATE CATALOG ==================== */}
      <section id="templates" style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '40px 22px 72px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 32, borderBottom: '2px solid var(--ink)', paddingBottom: 20 }}>
          <div>
            <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--muted)' }}>CURATED TEMPLATE ENGINE</span>
            <h2 style={{ font: '900 clamp(26px, 4vw, 42px)/1.04 Archivo', letterSpacing: '-0.03em', margin: '8px 0 0' }}>
              Every template crafted for specific communication goals.
            </h2>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['All', 'Hooks & Covers', 'Data & Benchmarks', 'Frameworks & Educational'].map((cat) => (
              <button
                key={cat}
                type="button"
                className="lp-tab-btn"
                data-active={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                style={{ fontSize: 13 }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Template Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
          {TEMPLATE_CATEGORIES.filter((grp) => selectedCategory === 'All' || grp.category === selectedCategory)
            .flatMap((grp) => grp.items)
            .map((item) => {
              const previewSlide: ResolvedSlide = {
                template: item.id,
                fields: templateDefaults(item.id),
                bgImage: null,
              };
              const previewColors = resolveColors(item.palette, {});

              return (
                <div
                  key={item.id}
                  className="lp-feature-card lp-lift"
                  style={{ padding: 18, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                  onClick={() => navigate(cta.to)}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: 12,
                      overflow: 'hidden',
                      position: 'relative',
                      background: '#111',
                      marginBottom: 16,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    }}
                  >
                    <div style={{ width: 1080, height: 1080, transform: 'scale(0.24)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                      <SlideCanvas slide={previewSlide} colors={previewColors} footer={DEMO_FOOTER} width={1080} height={1080} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h3 style={{ font: '800 17px/1.2 Archivo', margin: 0 }}>{item.name}</h3>
                    <span style={{ font: "700 11px/1 'Space Grotesk'", color: 'var(--muted)', textTransform: 'uppercase' }}>
                      {item.palette}
                    </span>
                  </div>

                  <p style={{ font: "400 13px/1.5 'Space Grotesk'", color: 'var(--muted-2)', margin: '0 0 14px', flex: 1 }}>
                    {item.desc}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: "700 12px/1 'Space Grotesk'", color: 'var(--ink)' }}>
                    <span>Use template</span>
                    <span style={{ color: 'var(--brand)' }}>→</span>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* ==================== 6. ARCHITECTURE & ZERO-SERVER RETENTION ==================== */}
      <section style={{ position: 'relative', zIndex: 1, background: 'var(--surface-2)', borderTop: '1px solid var(--line-2)', borderBottom: '1px solid var(--line-2)', padding: '64px 22px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 40, alignItems: 'center' }} className="lp-hero-grid">
          <div>
            <span className="lp-glow-tag" style={{ marginBottom: 12 }}>ARCHITECTURAL PRIVACY</span>
            <h2 style={{ font: '900 clamp(26px, 3.8vw, 42px)/1.08 Archivo', letterSpacing: '-0.03em', margin: '10px 0 16px' }}>
              Your unpublished thoughts &amp; client designs never touch our server.
            </h2>
            <p style={{ font: "400 15.5px/1.65 'Space Grotesk'", color: 'var(--muted-2)', margin: '0 0 24px' }}>
              Unlike generic cloud apps that index and store every graphic draft, Cardstock runs completely client-side. The server only handles authentication and your public profile handle.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'var(--surface)', padding: '16px 18px', borderRadius: 14, border: '1px solid var(--line)' }}>
                <div style={{ font: '800 15px/1.2 Archivo', marginBottom: 4 }}>LocalStorage + IndexedDB</div>
                <p style={{ font: "400 12.5px/1.5 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>Design states and background images stay strictly in your local browser sandbox.</p>
              </div>
              <div style={{ background: 'var(--surface)', padding: '16px 18px', borderRadius: 14, border: '1px solid var(--line)' }}>
                <div style={{ font: '800 15px/1.2 Archivo', marginBottom: 4 }}>1-Click JSON Backup</div>
                <p style={{ font: "400 12.5px/1.5 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>Export all your cards and carousel decks as a single JSON file and re-import anywhere.</p>
              </div>
            </div>
          </div>

          {/* Architecture Visual Box */}
          <div style={{ background: 'var(--ink)', color: 'var(--bar)', borderRadius: 20, padding: '28px 24px', border: '1px solid var(--ink)', boxShadow: '0 20px 50px rgba(27,22,14,0.18)' }}>
            <div style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.2em', color: 'var(--brand)', marginBottom: 16, textTransform: 'uppercase' }}>
              CLIENT-SIDE RENDERING PIPELINE
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, font: "600 13px/1.4 'Space Grotesk'" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 10 }}>
                <span style={{ color: 'var(--brand)', fontSize: 16 }}>1.</span>
                <span>User edits template text in React Live Studio</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 10 }}>
                <span style={{ color: 'var(--brand)', fontSize: 16 }}>2.</span>
                <span>SlideCanvas computes typography &amp; auto-scrims locally</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 10 }}>
                <span style={{ color: 'var(--brand)', fontSize: 16 }}>3.</span>
                <span>html2canvas + jsPDF compile PNG/PDF on device</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(242,183,5,0.18)', border: '1px solid var(--brand)', padding: '12px 16px', borderRadius: 10, color: 'var(--brand)' }}>
                <span>✓ Direct browser download — Zero server hops</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 7. INTERACTIVE FAQ ACCORDION ==================== */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '80px 22px 64px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--muted)' }}>FREQUENTLY ASKED QUESTIONS</span>
          <h2 style={{ font: '900 clamp(28px, 4.2vw, 44px)/1.08 Archivo', letterSpacing: '-0.03em', margin: '8px 0 0' }}>
            Everything you need to know about Cardstock.
          </h2>
        </div>

        <div style={{ borderTop: '2px solid var(--ink)' }}>
          {FAQS.map((faq, idx) => (
            <div key={faq.q} style={{ borderBottom: '1px solid var(--line-2)' }}>
              <button
                type="button"
                className="lp-accordion-btn"
                aria-expanded={openFaq === idx}
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span>{faq.q}</span>
                <span className="lp-accordion-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>

              {openFaq === idx && (
                <div style={{ paddingBottom: 22, font: "400 15px/1.7 'Space Grotesk'", color: 'var(--muted-2)' }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ==================== 8. CLOSING EDITORIAL CTA ==================== */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto 60px', padding: '0 22px' }}>
        <div
          style={{
            background: 'var(--ink)',
            color: 'var(--bar)',
            borderRadius: 28,
            padding: '72px 24px',
            textAlign: 'center',
            boxShadow: '0 30px 80px rgba(27,22,14,0.22)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <p style={{ font: "italic 500 clamp(18px,2.5vw,23px)/1.4 Newsreader", color: 'var(--brand)', margin: '0 0 12px' }}>
            Stop fighting complex design tools.
          </p>
          <h2 style={{ font: '900 clamp(32px, 5.5vw, 58px)/1.02 Archivo', letterSpacing: '-0.035em', margin: '0 0 26px', color: 'var(--bar)' }}>
            Publish your next LinkedIn post in{' '}
            <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: '0.06em', height: '0.28em', background: 'var(--brand)', zIndex: 0 }} />
              <span style={{ position: 'relative', zIndex: 1, color: 'var(--ink)' }}>three minutes</span>
            </span>
            .
          </h2>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
            <Link
              to={cta.to}
              style={{
                ...ctaBtn,
                background: 'var(--brand)',
                color: 'var(--ink)',
                border: '1px solid var(--brand)',
                height: 56,
                padding: '0 36px',
                fontSize: 16,
              }}
            >
              {cta.label}
            </Link>
          </div>

          <span style={{ font: "500 12px/1 'Space Grotesk'", color: 'color-mix(in srgb, var(--bar) 65%, transparent)' }}>
            Free to start · Instant export · No credit card required
          </span>
        </div>
      </section>

      {/* ==================== 9. SITE FOOTER ==================== */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--ink)', background: 'var(--bar)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 22px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CardstockLogo size={24} wordSize={16} color="var(--ink)" />
            <span style={{ font: "600 12px/1 'Space Grotesk'", color: 'var(--muted)', letterSpacing: '.04em' }}>
              © 2026 Cardstock — In-Browser Card &amp; Carousel Studio · A product of{' '}
              <a href="https://www.xahabcse.me/" target="_blank" rel="noopener noreferrer" className="lp-underline" style={{ color: 'var(--muted)' }}>xahabcse.me</a>
              <span style={{ marginLeft: 8, opacity: 0.75 }}>v{versionData.version}</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 22 }}>
            <a href="#playground" className="lp-underline" style={footLink}>Playground</a>
            <a href="#carousel-deck" className="lp-underline" style={footLink}>Carousels</a>
            <a href="#templates" className="lp-underline" style={footLink}>Templates</a>
            <Link to="/about" className="lp-underline" style={footLink}>About</Link>
            <a href="https://github.com/xahabcse/contentpro" target="_blank" rel="noopener noreferrer" className="lp-underline" style={footLink}>GitHub</a>
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
  transition: 'transform 0.15s ease, filter 0.15s ease',
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

const darkArrow: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: '1px solid rgba(243,238,225,0.28)',
  background: 'transparent',
  color: 'var(--bar)',
  cursor: 'pointer',
  font: '20px/1 Archivo',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s ease, border-color 0.15s ease',
};

const navPill: CSSProperties = {
  ...ctaBtn,
  height: 40,
  padding: '0 18px',
};

const navTextLink: CSSProperties = {
  display: 'inline-flex',
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
