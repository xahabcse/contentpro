import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { CardstockLogo } from '@/components/Logo';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { resolveColors } from '@/lib/palettes';
import { templateDefaults } from '@/lib/templates';
import type { FooterData, ResolvedSlide, TemplateId } from '@/lib/design-types';

// No account context on the landing page -> the demo cards show the same
// placeholder author a signed-out / empty-profile user would see.
const PLACEHOLDER_FOOTER: FooterData = { name: '', handle: '', avatar: null };

// A scaled, non-interactive card built from a real template + palette -- the
// same renderer the editor and export use, so the page shows genuine output.
function CardPreview({ template, paletteId, target, radius = 16 }: { template: TemplateId; paletteId: string; target: number; radius?: number }) {
  const slide: ResolvedSlide = { template, fields: templateDefaults(template), bgImage: null };
  const colors = resolveColors(paletteId, {});
  return (
    <div style={{ width: target, height: target, borderRadius: radius, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width: 1080, height: 1080, transform: `scale(${target / 1080})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <SlideCanvas slide={slide} colors={colors} footer={PLACEHOLDER_FOOTER} width={1080} height={1080} />
      </div>
    </div>
  );
}

const FEATURES: { n: string; title: string; body: string }[] = [
  { n: '01', title: 'Ten templates that already look designed', body: 'Quotes, big stats, numbered tips, covers, before/after, frameworks, CTAs, bold questions and statements — each one composed by hand, not a blank box.' },
  { n: '02', title: 'A true what-you-see editor', body: 'Type a word, watch the card change. The frame on screen is the exact frame that exports — no preview lies, no re-rendering surprises.' },
  { n: '03', title: 'Palettes, custom colours & dark mode', body: 'Six ready palettes, or dial in your own background, text and accent. Flip the whole studio to dark when the light one gets loud.' },
  { n: '04', title: 'PNG for cards, PDF for carousels', body: 'Single cards come out as crisp 1080-square PNGs. Carousels assemble into a multi-page 1080×1350 PDF — all stitched together in your browser.' },
  { n: '05', title: 'Your profile signs every post', body: 'Set your name, handle and photo once. Every design signs itself off in the footer, consistently, so you never retype it.' },
  { n: '06', title: 'Background photos, handled', body: 'Drop an image behind any slide and a readable dark scrim is layered in automatically — legible text, zero fiddling.' },
];

const TEMPLATE_TICKER = ['Quote', 'Big Stat', 'Numbered Tips', 'Cover', 'Announcement', 'Bold Question', 'Before / After', 'Framework', 'Call to Action', 'Statement'];

export default function LandingPage() {
  const { user } = useAuth();
  const sliderRef = useRef<HTMLDivElement>(null);

  // Anthropic-style navbar: the wordmark collapses to just the mark once the
  // page is scrolled past the hero's top edge.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollSlider(dir: 1 | -1) {
    const el = sliderRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  const cta = user ? { to: '/dashboard', label: 'Open your dashboard' } : { to: '/signup', label: 'Start for free' };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', overflowX: 'clip' }}>
      <div className="lp-grain" />

      {/* ---- nav ---- */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'color-mix(in srgb, var(--bar) 88%, transparent)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--ink)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" aria-label="Cardstock home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <CardstockLogo size={32} wordSize={19} color="var(--ink)" collapsed={scrolled} />
          </Link>
          <div style={{ flex: 1 }} />
          {user ? (
            <Link to="/dashboard" style={ctaBtn}>Dashboard →</Link>
          ) : (
            <>
              <Link to="/login" className="lp-underline" style={{ font: "700 14px/1 'Space Grotesk'", color: 'var(--ink)', textDecoration: 'none', paddingBottom: 2 }}>Log in</Link>
              <Link to="/signup" style={ctaBtn}>Sign up</Link>
            </>
          )}
        </div>
      </header>

      {/* ---- hero ---- */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '72px 22px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', gap: 40, alignItems: 'center' }} className="lp-hero-grid">
          <div>
            <div className="lp-reveal" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26, animationDelay: '0.05s' }}>
              <span style={{ height: 1, width: 46, background: 'var(--ink)' }} />
              <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--muted-2)' }}>IN-BROWSER STUDIO · EST. 2026</span>
            </div>

            <h1 className="lp-reveal" style={{ margin: '0 0 24px', animationDelay: '0.12s' }}>
              <span style={{ display: 'block', font: '900 clamp(42px, 7vw, 82px)/0.98 Archivo', letterSpacing: '-0.035em' }}>Cards &amp; carousels</span>
              <span style={{ display: 'block', font: '900 clamp(42px, 7vw, 82px)/0.98 Archivo', letterSpacing: '-0.035em' }}>
                worth the{' '}
                <em style={{ fontFamily: 'Newsreader, serif', fontWeight: 500, fontStyle: 'italic', color: 'var(--brand-strong, #7a5a00)', position: 'relative', whiteSpace: 'nowrap' }}>
                  <span style={{ position: 'relative', zIndex: 1, color: 'var(--ink)' }}>double&#8209;take</span>
                  <span style={{ position: 'absolute', left: '-2%', right: '-2%', bottom: '0.08em', height: '0.34em', background: 'var(--brand)', zIndex: 0, borderRadius: 2 }} />
                </em>
                .
              </span>
            </h1>

            <p className="lp-reveal" style={{ font: "400 clamp(16px, 2.1vw, 20px)/1.6 'Space Grotesk'", color: 'var(--muted-2)', maxWidth: 500, margin: '0 0 30px', animationDelay: '0.2s' }}>
              Pick a template, type your words, nudge the palette — then export a razor-sharp PNG or PDF. All in the browser. No design app, no watermark, no learning curve.
            </p>

            <div className="lp-reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 26, animationDelay: '0.28s' }}>
              <Link to={cta.to} style={{ ...ctaBtn, height: 52, padding: '0 30px', fontSize: 16 }}>{cta.label}</Link>
              {!user && <Link to="/login" style={{ ...ghostBtn, height: 52, padding: '0 26px', fontSize: 16 }}>I have an account</Link>}
            </div>

            <div className="lp-reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', animationDelay: '0.34s' }}>
              {['10 templates', 'Light & dark', 'PNG + PDF', 'Free to start'].map((m) => (
                <span key={m} style={{ font: "600 11px/1 'Space Grotesk'", letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>◦ {m}</span>
              ))}
            </div>
          </div>

          {/* collage */}
          <div className="lp-hero-art" style={{ position: 'relative', height: 420 }}>
            <FigCard template="stat" palette="cobalt" size={196} rot={-7} x={-132} y={-18} delay="0.5s" caption="Fig.1 — Big Stat" z={1} />
            <FigCard template="quote" palette="ink" size={244} rot={2} x={8} y={24} delay="0.3s" caption="Fig.2 — Quote" z={3} />
            <FigCard template="cta" palette="forest" size={196} rot={8} x={150} y={-8} delay="0.65s" caption="Fig.3 — Call to Action" z={2} />
          </div>
        </div>
      </section>

      {/* ---- marquee ---- */}
      <div className="lp-marquee" style={{ position: 'relative', zIndex: 1, margin: '20px 0 8px' }}>
        <div className="lp-marquee__track">
          {[0, 1].map((dup) => (
            <div key={dup} style={{ display: 'inline-flex' }} aria-hidden={dup === 1}>
              {TEMPLATE_TICKER.map((t, i) => (
                <span key={t + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 22, padding: '13px 22px', font: '800 15px/1 Archivo', letterSpacing: '-0.01em', color: i % 2 ? 'var(--brand)' : 'var(--bar)' }}>
                  {t}<span style={{ color: 'var(--brand)', fontSize: 12 }}>✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---- features (editorial index) ---- */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '56px 22px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 8, borderBottom: '2px solid var(--ink)', paddingBottom: 18 }}>
          <h2 style={{ font: '900 clamp(28px, 4.5vw, 44px)/1 Archivo', letterSpacing: '-0.03em', margin: 0, maxWidth: 640 }}>
            Built to make you look like you hired a designer.
          </h2>
          <span style={{ font: "italic 500 20px/1 Newsreader", color: 'var(--muted-2)' }}>Six reasons</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 0 }}>
          {FEATURES.map((f, i) => (
            <div key={f.n} style={{ display: 'flex', gap: 18, padding: '26px 22px 26px 0', borderBottom: '1px solid var(--line-2)', ...(i % 2 === 0 ? { borderRight: '1px solid var(--line-2)', paddingRight: 30 } : { paddingLeft: 30 }) }}>
              <div style={{ font: 'italic 500 34px/1 Newsreader', color: 'var(--brand)', flex: 'none', width: 52 }}>{f.n}</div>
              <div>
                <h3 style={{ font: '800 19px/1.25 Archivo', letterSpacing: '-0.01em', margin: '2px 0 8px' }}>{f.title}</h3>
                <p style={{ font: "400 14px/1.6 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- template slider ---- */}
      <section style={{ position: 'relative', zIndex: 1, background: 'var(--ink)', color: 'var(--bar)', borderTop: '2px solid var(--ink)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 26 }}>
            <div>
              <span style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.28em', color: 'var(--brand)' }}>THE TEMPLATE RACK</span>
              <h2 style={{ font: '900 clamp(26px, 4vw, 40px)/1.02 Archivo', letterSpacing: '-0.03em', margin: '12px 0 0', color: 'var(--bar)' }}>Start from one. Make it unmistakably yours.</h2>
            </div>
            <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
              <button aria-label="Previous" onClick={() => scrollSlider(-1)} style={darkArrow}>‹</button>
              <button aria-label="Next" onClick={() => scrollSlider(1)} style={darkArrow}>›</button>
            </div>
          </div>
          <div ref={sliderRef} className="slider-track">
            {([['cover', 'ink'], ['tips', 'crimson'], ['framework', 'grape'], ['question', 'bone'], ['statement', 'forest'], ['announce', 'cobalt'], ['quote', 'ink'], ['stat', 'cobalt'], ['contrast', 'crimson'], ['cta', 'forest']] as [TemplateId, string][]).map(([t, p], i) => (
              <div key={t + i} style={{ flex: 'none' }} className="lp-lift">
                <CardPreview template={t} paletteId={p} target={224} radius={12} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- closing ---- */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '0 auto', padding: '84px 22px', textAlign: 'center' }}>
        <p style={{ font: "italic 500 clamp(18px,3vw,24px)/1.4 Newsreader", color: 'var(--muted-2)', margin: '0 0 14px' }}>Stop screenshotting Notes. Stop wrestling Canva.</p>
        <h2 style={{ font: '900 clamp(34px, 6vw, 62px)/1 Archivo', letterSpacing: '-0.035em', margin: '0 0 28px' }}>
          Your next post is <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>five minutes<span style={{ position: 'absolute', left: 0, right: 0, bottom: '0.06em', height: '0.28em', background: 'var(--brand)', zIndex: -1 }} /></span> away.
        </h2>
        <Link to={cta.to} style={{ ...ctaBtn, height: 56, padding: '0 34px', fontSize: 17, display: 'inline-flex' }}>{cta.label}</Link>
      </section>

      {/* ---- footer ---- */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--ink)', background: 'var(--bar)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 22px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ font: "600 12px/1 'Space Grotesk'", color: 'var(--muted)', letterSpacing: '.04em' }}>© 2026 Cardstock — Card &amp; Carousel Studio</span>
          <div style={{ display: 'flex', gap: 20 }}>
            <Link to="/login" className="lp-underline" style={{ font: "600 12px/1 'Space Grotesk'", color: 'var(--muted-2)', textDecoration: 'none', paddingBottom: 2 }}>Log in</Link>
            <Link to="/signup" className="lp-underline" style={{ font: "600 12px/1 'Space Grotesk'", color: 'var(--muted-2)', textDecoration: 'none', paddingBottom: 2 }}>Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Floating figure card with caption for the hero collage.
function FigCard({ template, palette, size, rot, x, y, delay, caption, z }: { template: TemplateId; palette: string; size: number; rot: number; x: number; y: number; delay: string; caption: string; z: number }) {
  return (
    <div className="lp-reveal" style={{ position: 'absolute', left: '50%', top: '50%', zIndex: z, animationDelay: delay, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}>
      <div style={{ ['--lp-rot' as string]: `rotate(${rot}deg)`, animation: 'lp-float 7s ease-in-out infinite', animationDelay: delay, transform: `rotate(${rot}deg)`, boxShadow: '0 26px 60px rgba(27,22,14,0.28)', border: '4px solid var(--bar)', borderRadius: 18 }}>
        <CardPreview template={template} paletteId={palette} target={size} radius={14} />
      </div>
      <div style={{ marginTop: 8, textAlign: 'center', font: "600 9px/1 'Space Grotesk'", letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)', transform: `rotate(${rot}deg)` }}>{caption}</div>
    </div>
  );
}

// ---- shared button styles ----
const ctaBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 42,
  padding: '0 20px',
  borderRadius: 999,
  background: 'var(--ink)',
  color: 'var(--brand)',
  font: "800 14px/1 'Space Grotesk'",
  letterSpacing: '0.01em',
  textDecoration: 'none',
  border: '1px solid var(--ink)',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 42,
  padding: '0 20px',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--ink)',
  font: "800 14px/1 'Space Grotesk'",
  textDecoration: 'none',
  border: '1px solid var(--ink)',
};
const darkArrow: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: '50%',
  border: '1px solid rgba(243,238,225,0.28)',
  background: 'transparent',
  color: 'var(--bar)',
  cursor: 'pointer',
  font: '22px/1 Archivo',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
