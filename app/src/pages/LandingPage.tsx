import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { resolveColors } from '@/lib/palettes';
import { templateDefaults } from '@/lib/templates';
import type { Author, Slide, TemplateId } from '@/lib/design-types';

const DEMO_AUTHOR: Author = { name: 'Ayesha Rahman', handle: 'ayesharahman', avatar: null };

const sliderArrow: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: '50%',
  border: '1px solid var(--line-2)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  cursor: 'pointer',
  font: '22px/1 Archivo',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// A scaled, non-interactive 1080-square card preview built from a real
// template + palette -- the same renderer the editor and export use, so the
// landing page shows genuine output, not a mockup.
function CardPreview({ template, paletteId, target, style }: { template: TemplateId; paletteId: string; target: number; style?: React.CSSProperties }) {
  const slide: Slide = { template, fields: templateDefaults(template), bgImage: null };
  const colors = resolveColors(paletteId, {});
  return (
    <div style={{ width: target, height: target, borderRadius: 14, overflow: 'hidden', position: 'relative', boxShadow: '0 24px 60px rgba(27,22,14,0.22)', ...style }}>
      <div style={{ width: 1080, height: 1080, transform: `scale(${target / 1080})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <SlideCanvas slide={slide} colors={colors} author={DEMO_AUTHOR} width={1080} height={1080} />
      </div>
    </div>
  );
}

const FEATURES: { title: string; body: string }[] = [
  { title: '10 curated templates', body: 'Quotes, big stats, numbered tips, covers, before/after, frameworks, CTAs and more — each one already looks designed.' },
  { title: 'Live WYSIWYG editor', body: 'Type your words and watch the card update instantly. What you see is exactly what exports — no surprises.' },
  { title: '6 palettes + custom colors', body: 'Swap the whole look in one click, fine-tune background/text/accent, or flip the editor into dark mode.' },
  { title: 'Export PNG & PDF', body: 'Single cards download as crisp 1080×1080 PNGs; carousels assemble into a multi-page 1080×1350 PDF — all in your browser.' },
  { title: 'Your profile is the footer', body: 'Set your name, handle and photo once. Every design signs itself off automatically, on-brand.' },
  { title: 'Background images', body: 'Drop a photo behind any slide and a readable dark scrim is added for you — no fiddling.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const sliderRef = useRef<HTMLDivElement>(null);

  function scrollSlider(dir: 1 | -1) {
    const el = sliderRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  const primaryCta = user
    ? { to: '/dashboard', label: 'Go to your dashboard' }
    : { to: '/signup', label: "Start designing — it's free" };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bar)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '900 17px/1 Archivo', color: 'var(--brand-ink)' }}>C</div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span style={{ font: '800 16px/1 Archivo', color: 'var(--ink)' }}>ContentPro</span>
              <span style={{ font: "600 9px/1.4 'Space Grotesk'", letterSpacing: '.22em', color: 'var(--muted)' }}>CARD &amp; CAROUSEL STUDIO</span>
            </div>
          </Link>
          <div style={{ flex: 1 }} />
          {user ? (
            <Link to="/dashboard" className="btn btn-primary" style={{ width: 'auto', height: 40, padding: '0 18px', fontSize: 14, textDecoration: 'none' }}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" style={{ font: "700 14px/1 'Space Grotesk'", color: 'var(--ink)', textDecoration: 'none' }}>Log in</Link>
              <Link to="/signup" className="btn btn-primary" style={{ width: 'auto', height: 40, padding: '0 18px', fontSize: 14, textDecoration: 'none' }}>Get started</Link>
            </>
          )}
        </div>
      </header>

      {/* hero */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '64px 20px 40px', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center' }}>
        <div style={{ flex: '1 1 420px', minWidth: 300 }}>
          <span className="pill pill-brand" style={{ marginBottom: 20 }}>Design LinkedIn posts in minutes</span>
          <h1 style={{ font: '900 clamp(38px, 6vw, 64px)/1.02 Archivo', letterSpacing: '-0.03em', margin: '0 0 20px' }}>
            Make LinkedIn cards &amp; carousels that stop the scroll.
          </h1>
          <p style={{ font: "400 clamp(16px,2.2vw,20px)/1.55 'Space Grotesk'", color: 'var(--muted-2)', maxWidth: 520, margin: '0 0 32px' }}>
            Pick a template, drop in your words, tweak the palette, and export a crisp PNG or PDF — right in your browser. No design tools, no watermarks.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link to={primaryCta.to} className="btn btn-primary" style={{ width: 'auto', padding: '0 26px', fontSize: 16, textDecoration: 'none' }}>{primaryCta.label}</Link>
            {!user && <Link to="/login" className="btn btn-outline" style={{ width: 'auto', padding: '0 26px', fontSize: 16, textDecoration: 'none' }}>Log in</Link>}
          </div>
        </div>

        <div style={{ flex: '1 1 380px', minWidth: 300, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', minHeight: 360 }}>
          <CardPreview template="stat" paletteId="cobalt" target={230} style={{ transform: 'rotate(-6deg) translateX(-40px)' }} />
          <CardPreview template="quote" paletteId="ink" target={270} style={{ position: 'relative', zIndex: 2 }} />
          <CardPreview template="cta" paletteId="forest" target={230} style={{ transform: 'rotate(6deg) translateX(40px)' }} />
        </div>
      </section>

      {/* features */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '48px 20px' }}>
        <h2 style={{ font: '800 clamp(26px,4vw,38px)/1.1 Archivo', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Everything you need to look polished</h2>
        <p style={{ font: "400 16px/1.5 'Space Grotesk'", color: 'var(--muted-2)', margin: '0 0 32px', maxWidth: 560 }}>Built for founders, job-seekers and creators who want on-brand posts without opening a design app.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="card-surface" style={{ padding: 22 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '900 18px/1 Archivo', color: 'var(--brand-ink)', marginBottom: 14 }}>✦</div>
              <h3 style={{ font: '700 18px/1.25 Archivo', margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ font: "400 14px/1.55 'Space Grotesk'", color: 'var(--muted-2)', margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* template showcase slider */}
      <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '48px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
            <h2 style={{ font: '800 clamp(24px,4vw,34px)/1.1 Archivo', letterSpacing: '-0.02em', margin: 0 }}>Start from a template, make it yours</h2>
            <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
              <button aria-label="Previous" onClick={() => scrollSlider(-1)} style={sliderArrow}>‹</button>
              <button aria-label="Next" onClick={() => scrollSlider(1)} style={sliderArrow}>›</button>
            </div>
          </div>
          <div ref={sliderRef} className="slider-track">
            {([['cover', 'ink'], ['tips', 'crimson'], ['framework', 'grape'], ['question', 'bone'], ['statement', 'forest'], ['announce', 'cobalt'], ['quote', 'ink'], ['stat', 'cobalt'], ['contrast', 'crimson'], ['cta', 'forest']] as [TemplateId, string][]).map(([t, p], i) => (
              <div key={t + i} style={{ flex: 'none' }}>
                <CardPreview template={t} paletteId={p} target={220} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
        <h2 style={{ font: '900 clamp(30px,5vw,48px)/1.05 Archivo', letterSpacing: '-0.02em', margin: '0 0 16px' }}>Your next post is 5 minutes away.</h2>
        <p style={{ font: "400 18px/1.5 'Space Grotesk'", color: 'var(--muted-2)', margin: '0 0 28px' }}>Create an account and design your first card free.</p>
        <Link to={primaryCta.to} className="btn btn-primary" style={{ width: 'auto', padding: '0 30px', fontSize: 17, textDecoration: 'none', display: 'inline-flex' }}>{primaryCta.label}</Link>
      </section>

      {/* footer */}
      <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--bar)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '24px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ font: "600 13px/1 'Space Grotesk'", color: 'var(--muted)' }}>© 2026 ContentPro · Card &amp; Carousel Studio</span>
          <div style={{ display: 'flex', gap: 18 }}>
            <Link to="/login" style={{ font: "600 13px/1 'Space Grotesk'", color: 'var(--muted-2)', textDecoration: 'none' }}>Log in</Link>
            <Link to="/signup" style={{ font: "600 13px/1 'Space Grotesk'", color: 'var(--muted-2)', textDecoration: 'none' }}>Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
