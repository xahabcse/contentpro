import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import type { Author, FieldValue, Slide } from '@/lib/design-types';
import type { ResolvedColors } from '@/lib/palettes';

// Full-size (1080×h) slide renderer -- a faithful React port of the r_*
// template renderers in ContentPro.dc.html. The caller scales it down with a
// CSS transform for previews; for export it is rendered untransformed in an
// off-screen pool (html2canvas mis-renders nodes under a transformed
// ancestor). No CSS transform is ever applied inside this component.

interface Ctx extends ResolvedColors {
  w: number;
  h: number;
  bgImage?: string | null;
}

interface SlideCanvasProps {
  slide: Slide;
  colors: ResolvedColors;
  author: Author;
  width: number;
  height: number;
}

// ---- helpers ----

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

// The design uses color-mix(... transparent) for muted colors; html2canvas
// doesn't support color-mix, so we emit the equivalent rgba (same color at
// pct% alpha) which composites correctly on export.
function dim(color: string, pct: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${pct / 100})`;
}

function txt(fields: Record<string, FieldValue>, k: string): string {
  const v = fields[k];
  return typeof v === 'string' ? v : '';
}
function list(fields: Record<string, FieldValue>, k: string): string[] {
  const v = fields[k];
  if (Array.isArray(v)) return v;
  return typeof v === 'string' && v ? [v] : [];
}

function frame(c: Ctx, children: ReactNode, opts: { pad?: number; bgImage?: string | null } = {}): ReactNode {
  const layers: ReactNode[] = [];
  if (opts.bgImage) {
    layers.push(
      <div key="img" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${opts.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />,
    );
    layers.push(
      <div key="scrim" style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${dim(c.bg, 55)} 0%, ${dim(c.bg, 88)} 100%)` }} />,
    );
  }
  return (
    <div style={{ position: 'relative', width: c.w, height: c.h, background: c.bg, color: c.text, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: opts.pad != null ? opts.pad : 96, fontFamily: 'Archivo, sans-serif', boxSizing: 'border-box' }}>
      {layers}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

function eyebrow(c: Ctx, text: string, u: number): ReactNode {
  return <div style={{ font: `700 ${15 * u}px/1 'Space Grotesk'`, letterSpacing: '.2em', textTransform: 'uppercase', color: c.accent }}>{text}</div>;
}

function footer(c: Ctx, a: Author, u: number, compact?: boolean): ReactNode {
  const size = (compact ? 52 : 60) * u;
  const av = a.avatar
    ? <div style={{ width: size, height: size, borderRadius: '50%', flex: 'none', backgroundImage: `url(${a.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', flex: 'none', background: c.accent, color: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${24 * u}px/1 Archivo` }}>{(a.name || '?').trim().charAt(0).toUpperCase()}</div>;
  return (
    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 16 * u, paddingTop: 30 * u, borderTop: `${2 * u}px solid ${dim(c.text, 16)}` }}>
      {av}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 * u, fontFamily: "'Space Grotesk',sans-serif" }}>
        <span style={{ font: `700 ${22 * u}px/1 'Space Grotesk'`, color: c.text }}>{a.name}</span>
        <span style={{ font: `500 ${16 * u}px/1 'Space Grotesk'`, color: dim(c.text, 60) }}>{'@' + a.handle}</span>
      </div>
    </div>
  );
}

// ---- 10 templates ----

function r_quote(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  return frame(c, [
    <div key="m" style={{ font: `900 ${210 * u}px/.6 Archivo`, color: c.accent, height: 120 * u }}>{'“'}</div>,
    <div key="q" style={{ font: `500 ${62 * u}px/1.16 Newsreader`, fontStyle: 'italic', letterSpacing: '-.01em', maxWidth: '96%' }}>{txt(f, 'quote')}</div>,
    footer(c, a, u),
  ], { bgImage: c.bgImage });
}

function r_stat(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  return frame(c, [
    eyebrow(c, txt(f, 'label'), u),
    <div key="n" style={{ font: `900 ${210 * u}px/.86 Archivo`, letterSpacing: '-.04em', color: c.accent, margin: `${24 * u}px 0 ${20 * u}px` }}>{txt(f, 'number')}</div>,
    <div key="cap" style={{ font: `500 ${40 * u}px/1.24 'Space Grotesk'`, maxWidth: '88%', color: dim(c.text, 90) }}>{txt(f, 'caption')}</div>,
    footer(c, a, u),
  ], { bgImage: c.bgImage });
}

function r_tips(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  return frame(c, [
    <div key="t" style={{ font: `800 ${58 * u}px/1.02 Archivo`, letterSpacing: '-.02em', marginBottom: 44 * u, maxWidth: '92%' }}>{txt(f, 'title')}</div>,
    <div key="l" style={{ display: 'flex', flexDirection: 'column', gap: 24 * u }}>
      {list(f, 'items').map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 22 * u, alignItems: 'baseline' }}>
          <span style={{ font: `800 ${34 * u}px/1 Archivo`, color: c.accent, flex: 'none', width: 44 * u }}>{i + 1 + '.'}</span>
          <span style={{ font: `500 ${30 * u}px/1.28 'Space Grotesk'`, color: dim(c.text, 92) }}>{it}</span>
        </div>
      ))}
    </div>,
    footer(c, a, u, true),
  ], { bgImage: c.bgImage });
}

function r_cover(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  return frame(c, [
    eyebrow(c, txt(f, 'kicker'), u),
    <div key="hl" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
      <div style={{ font: `900 ${100 * u}px/.98 Archivo`, letterSpacing: '-.025em', maxWidth: '100%' }}>{txt(f, 'headline')}</div>
    </div>,
    <div key="fr" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 * u }}>
      <div style={{ flex: 1 }}>{footer(c, a, u, true)}</div>
      <div style={{ font: `700 ${20 * u}px/1 'Space Grotesk'`, letterSpacing: '.14em', textTransform: 'uppercase', color: c.accent, paddingBottom: 6 * u }}>{'Swipe →'}</div>
    </div>,
  ], { bgImage: c.bgImage });
}

function r_announce(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  return frame(c, [
    <div key="b" style={{ alignSelf: 'flex-start', background: c.accent, color: c.bg, font: `800 ${18 * u}px/1 'Space Grotesk'`, letterSpacing: '.16em', padding: `${12 * u}px ${18 * u}px`, borderRadius: 999, marginBottom: 36 * u }}>{txt(f, 'badge')}</div>,
    <div key="t" style={{ font: `800 ${70 * u}px/1.02 Archivo`, letterSpacing: '-.02em', maxWidth: '96%' }}>{txt(f, 'title')}</div>,
    <div key="s" style={{ font: `500 ${34 * u}px/1.3 'Space Grotesk'`, color: dim(c.text, 72), marginTop: 26 * u, maxWidth: '88%' }}>{txt(f, 'subtitle')}</div>,
    <div key="d" style={{ display: 'flex', alignItems: 'center', gap: 14 * u, marginTop: 38 * u }}>
      <div style={{ width: 14 * u, height: 14 * u, borderRadius: '50%', background: c.accent }} />
      <span style={{ font: `600 ${26 * u}px/1 'Space Grotesk'`, color: c.text }}>{txt(f, 'detail')}</span>
    </div>,
    footer(c, a, u, true),
  ], { bgImage: c.bgImage });
}

function r_question(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {eyebrow(c, txt(f, 'kicker'), u)}
      <div style={{ font: `800 ${76 * u}px/1.06 Archivo`, letterSpacing: '-.02em', marginTop: 24 * u }}>
        {txt(f, 'question')}
        <span style={{ color: c.accent }}>{' ?'}</span>
      </div>
    </div>,
    footer(c, a, u, true),
  ], { bgImage: c.bgImage });
}

function r_contrast(c: Ctx, f: Record<string, FieldValue>, _a: Author, u: number) {
  const panel = (label: string, text: string, accentBg: boolean): ReactNode => (
    <div style={{ flex: 1, borderRadius: 20 * u, padding: `${44 * u}px ${46 * u}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: accentBg ? c.accent : dim(c.text, 7), color: accentBg ? c.bg : c.text }}>
      <div style={{ font: `700 ${17 * u}px/1 'Space Grotesk'`, letterSpacing: '.18em', textTransform: 'uppercase', color: accentBg ? c.bg : c.accent, marginBottom: 18 * u }}>{label}</div>
      <div style={{ font: `700 ${40 * u}px/1.14 Archivo`, letterSpacing: '-.01em' }}>{text}</div>
    </div>
  );
  return frame(c, [
    <div key="g" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22 * u }}>
      {panel(txt(f, 'beforeLabel'), txt(f, 'before'), false)}
      {panel(txt(f, 'afterLabel'), txt(f, 'after'), true)}
    </div>,
  ], { pad: 80, bgImage: c.bgImage });
}

function r_framework(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  return frame(c, [
    <div key="t" style={{ font: `800 ${58 * u}px/1.02 Archivo`, letterSpacing: '-.02em', marginBottom: 44 * u }}>{txt(f, 'title')}</div>,
    <div key="l" style={{ display: 'flex', flexDirection: 'column', gap: 26 * u, flex: 1 }}>
      {list(f, 'items').map((it, i) => {
        const parts = String(it).split(' — ');
        const name = parts[0];
        const desc = parts.slice(1).join(' — ');
        return (
          <div key={i} style={{ display: 'flex', gap: 24 * u, alignItems: 'flex-start' }}>
            <div style={{ flex: 'none', width: 60 * u, height: 60 * u, borderRadius: 14 * u, background: dim(c.accent, 18), color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${28 * u}px/1 Archivo` }}>{i + 1}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 * u, paddingTop: 4 * u }}>
              <span style={{ font: `800 ${34 * u}px/1.05 Archivo`, color: c.text }}>{name}</span>
              {desc ? <span style={{ font: `500 ${24 * u}px/1.3 'Space Grotesk'`, color: dim(c.text, 66) }}>{desc}</span> : null}
            </div>
          </div>
        );
      })}
    </div>,
    footer(c, a, u, true),
  ], { bgImage: c.bgImage });
}

function r_cta(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
      <div style={{ font: `900 ${84 * u}px/1.02 Archivo`, letterSpacing: '-.025em' }}>{txt(f, 'headline')}</div>
    </div>,
    <div key="btn" style={{ alignSelf: 'flex-start', background: c.accent, color: c.bg, font: `800 ${32 * u}px/1 Archivo`, padding: `${26 * u}px ${40 * u}px`, borderRadius: 999, marginBottom: 12 * u }}>{txt(f, 'buttonText')}</div>,
    footer(c, a, u, true),
  ], { bgImage: c.bgImage });
}

function r_statement(c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) {
  const hw = (txt(f, 'highlight') || '').trim();
  const statement = txt(f, 'statement');
  let parts: string[] = [statement];
  if (hw) {
    const re = new RegExp('(' + hw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i');
    parts = String(statement).split(re);
  }
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ font: `800 ${82 * u}px/1.08 Archivo`, letterSpacing: '-.02em', textAlign: 'center' }}>
        {parts.map((p, i) =>
          hw && p.toLowerCase() === hw.toLowerCase()
            ? <span key={i} style={{ background: c.accent, color: c.bg, padding: `0 ${12 * u}px`, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } as CSSProperties}>{p}</span>
            : <span key={i}>{p}</span>,
        )}
      </div>
    </div>,
    <div key="f" style={{ alignSelf: 'center' }}>{footer(c, a, u, true)}</div>,
  ], { bgImage: c.bgImage });
}

const RENDERERS: Record<string, (c: Ctx, f: Record<string, FieldValue>, a: Author, u: number) => ReactNode> = {
  quote: r_quote,
  stat: r_stat,
  tips: r_tips,
  cover: r_cover,
  announce: r_announce,
  question: r_question,
  contrast: r_contrast,
  framework: r_framework,
  cta: r_cta,
  statement: r_statement,
};

const SlideCanvas = forwardRef<HTMLDivElement, SlideCanvasProps>(({ slide, colors, author, width, height }, ref) => {
  const useImg = !!slide.bgImage;
  const c: Ctx = {
    w: width,
    h: height,
    bg: colors.bg,
    text: useImg ? '#FFFFFF' : colors.text,
    accent: colors.accent,
    bgImage: slide.bgImage,
  };
  const u = height / 1080;
  const render = RENDERERS[slide.template] ?? r_quote;
  return <div ref={ref}>{render(c, slide.fields, author, u)}</div>;
});

SlideCanvas.displayName = 'SlideCanvas';
export default SlideCanvas;
