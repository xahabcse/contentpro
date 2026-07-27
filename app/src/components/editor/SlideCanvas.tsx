import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import type { FieldValue, FooterData, ResolvedSlide } from '@/lib/design-types';
import type { ResolvedColors } from '@/lib/palettes';

// Full-size (1080×h) slide renderer -- faithful port of the r_* templates in
// ContentPro.dc.html, upgraded with iconography, data-viz and auto-fit. Images
// (background + avatar/logo) arrive already resolved to URLs. No CSS transform
// is applied inside this component so html2canvas can capture it under an
// untransformed export pool. Everything here is deterministic on text/props so
// the live canvas, thumbnails and export render identically.

interface Ctx extends ResolvedColors {
  w: number;
  h: number;
  bgImage?: string | null;
  // Independent text-size units. Structural sizing (padding/gap/icons) keeps
  // using the base `u`; FONT sizes use uH (headings), uB (body/secondary) or
  // uF (footer/author) so each group can be scaled separately by the user.
  uH: number;
  uB: number;
  uF: number;
}

interface SlideCanvasProps {
  slide: ResolvedSlide;
  colors: ResolvedColors;
  footer: FooterData;
  width: number;
  height: number;
  /** Independent text-size multipliers (1 = default). Heading, body and footer
   *  text scale separately; structural spacing stays fixed so the layout holds. */
  headingScale?: number;
  bodyScale?: number;
  footerScale?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
// color-mix(... transparent) equivalent as rgba (html2canvas-safe).
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

// Deterministic shrink-to-fit: pick a font size (pre-u px) purely from the
// character count so long input can never break the layout or push the footer
// off-canvas. Buckets are [maxChars, sizePx]; last entry is the floor.
function autofit(text: string, buckets: Array<[number, number]>): number {
  const len = (text || '').replace(/\s+/g, ' ').trim().length;
  for (const [max, size] of buckets) if (len <= max) return size;
  return buckets[buckets.length - 1][1];
}

// Parse a leading percentage from a stat string ("68%", "up 68% YoY") for the
// bar/ring fill. Returns null when there's no percent to derive a fill from.
function parsePct(s: string): number | null {
  const m = (s || '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Math.max(0, Math.min(100, parseFloat(m[1]))) : null;
}

type IconName = 'check' | 'arrow' | 'bolt' | 'star' | 'dot' | 'x' | 'plus';
function Icon({ name, size, color }: { name: IconName; size: number; color: string }) {
  const paths: Record<IconName, ReactNode> = {
    check: <path d="M4 12.5l5 5L20 6" />,
    arrow: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
    bolt: <path d="M13 2L5 13.5h6l-1 8.5L19 10.5h-6l0-8.5z" />,
    star: <path d="M12 3l2.6 5.6L20.5 9.4l-4.3 4 1 5.9L12 16.5 6.8 19.3l1-5.9-4.3-4 5.9-.8L12 3z" />,
    dot: <circle cx="12" cy="12" r="3.4" fill={color} stroke="none" />,
    x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      {paths[name]}
    </svg>
  );
}

// Horizontal progress bar; a null pct renders a full accent underline (emphasis,
// not a fabricated value).
function Bar({ pct, c, u }: { pct: number | null; c: Ctx; u: number }) {
  const w = pct == null ? '100%' : `${Math.max(4, Math.min(100, pct))}%`;
  return (
    <div style={{ width: '100%', height: 18 * u, borderRadius: 999, background: dim(c.text, 12), overflow: 'hidden' }}>
      <div style={{ width: w, height: '100%', background: c.accent, borderRadius: 999 }} />
    </div>
  );
}

// Circular progress ring; null pct falls back to a decorative 3/4 sweep.
function Ring({ pct, c, u, size }: { pct: number | null; c: Ctx; u: number; size: number }) {
  const stroke = 18 * u;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const frac = pct == null ? 0.75 : Math.max(0, Math.min(100, pct)) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={dim(c.text, 12)} strokeWidth={stroke} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={c.accent} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} transform={`rotate(-90 ${cx} ${cx})`} />
    </svg>
  );
}

function PersonIcon({ size, c }: { size: number; c: Ctx }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flex: 'none', background: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill={c.bg}>
        <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.6 0-8 1.8-8 4.2V20h16v-1.8C20 15.8 15.6 14 12 14z" />
      </svg>
    </div>
  );
}

function frame(c: Ctx, children: ReactNode, opts: { pad?: number; bgImage?: string | null } = {}): ReactNode {
  const layers: ReactNode[] = [];
  if (opts.bgImage) {
    layers.push(<img key="img" src={opts.bgImage} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />);
    layers.push(<div key="scrim" style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${dim(c.bg, 55)} 0%, ${dim(c.bg, 88)} 100%)` }} />);
  }
  return (
    <div style={{ position: 'relative', width: c.w, height: c.h, background: c.bg, color: c.text, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: opts.pad != null ? opts.pad : 96, fontFamily: 'Archivo, sans-serif', boxSizing: 'border-box' }}>
      {layers}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

function eyebrow(c: Ctx, text: string, u: number): ReactNode {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 * u }}>
      <div style={{ width: 26 * u, height: 3 * u, background: c.accent, borderRadius: 999, flex: 'none' }} />
      <div style={{ font: `700 ${15 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.2em', textTransform: 'uppercase', color: c.accent }}>{text}</div>
    </div>
  );
}

// Two-part footer: author lockup (left) + company lockup (right).
function footer(c: Ctx, fd: FooterData, u: number, compact?: boolean): ReactNode {
  const size = (compact ? 52 : 60) * u;
  const avatar = fd.avatar
    ? <img src={fd.avatar} alt="" crossOrigin="anonymous" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
    : <PersonIcon size={size} c={c} />;
  const name = fd.name || 'Your name';
  const hasCompany = !!(fd.companyName || fd.companyLogo);
  return (
    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 * u, paddingTop: 30 * u, borderTop: `${2 * u}px solid ${dim(c.text, 16)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 * u, minWidth: 0 }}>
        {avatar}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 * u, minWidth: 0, fontFamily: "'Space Grotesk',sans-serif" }}>
          <span style={{ font: `700 ${22 * c.uF}px/1.15 'Space Grotesk'`, color: c.text }}>{name}</span>
          <span style={{ font: `500 ${15 * c.uF}px/1.2 'Space Grotesk'`, color: dim(c.text, 60) }}>@{fd.handle || 'yourhandle'}</span>
          {fd.designation ? <span style={{ font: `500 ${14 * c.uF}px/1.2 'Space Grotesk'`, color: dim(c.text, 52) }}>{fd.designation}</span> : null}
        </div>
      </div>
      {hasCompany ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 * u, flex: 'none' }}>
          {fd.companyLogo ? <img src={fd.companyLogo} alt="" crossOrigin="anonymous" style={{ width: (compact ? 40 : 46) * u, height: (compact ? 40 : 46) * u, borderRadius: 10 * u, objectFit: 'contain', background: '#FFFFFF', padding: 5 * u }} /> : null}
          {fd.companyName ? <span style={{ font: `600 ${16 * c.uF}px/1.2 'Space Grotesk'`, color: dim(c.text, 82), maxWidth: 260 * u }}>{fd.companyName}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// Section-heading lockup shared by the list-style templates.
function listHeading(c: Ctx, title: string, u: number, eyebrowText?: string): ReactNode {
  return (
    <div key="h" style={{ marginBottom: 40 * u }}>
      {eyebrowText ? <div style={{ marginBottom: 18 * u }}>{eyebrow(c, eyebrowText, u)}</div> : null}
      <div style={{ font: `800 ${autofit(title, [[34, 58], [64, 48], [Infinity, 40]]) * c.uH}px/1.04 Archivo`, letterSpacing: '-.02em', maxWidth: '94%' }}>{title}</div>
    </div>
  );
}

// Wrap any occurrence of the comma-separated `terms` in an accent highlight.
// Case-insensitive; supports MULTIPLE words/phrases (e.g. "growth, focus").
// Returns the plain string when there's nothing to highlight.
function highlightNodes(text: string, rawTerms: string, c: Ctx, u: number): ReactNode {
  const terms = (rawTerms || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!terms.length || !text) return text;
  const re = new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  const lc = new Set(terms.map((t) => t.toLowerCase()));
  return String(text)
    .split(re)
    .map((p, i) =>
      p && lc.has(p.toLowerCase())
        ? (
          <span key={i} style={{ background: c.accent, color: c.bg, padding: `0 ${10 * u}px`, borderRadius: `${5 * u}px`, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } as CSSProperties}>{p}</span>
        )
        : <span key={i}>{p}</span>,
    );
}

function r_quote(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const q = txt(f, 'quote');
  return frame(c, [
    <div key="m" style={{ font: `900 ${210 * c.uH}px/.6 Archivo`, color: c.accent, height: 120 * u }}>{'“'}</div>,
    <div key="q" style={{ font: `500 ${autofit(q, [[80, 62], [150, 54], [240, 45], [Infinity, 37]]) * c.uH}px/1.16 Newsreader`, fontStyle: 'italic', letterSpacing: '-.01em', maxWidth: '96%', minHeight: 0, overflow: 'hidden' }}>{highlightNodes(q, txt(f, 'highlight'), c, u)}</div>,
    footer(c, fd, u),
  ], { bgImage: c.bgImage });
}
function r_stat(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const num = txt(f, 'number');
  const pct = parsePct(num);
  return frame(c, [
    eyebrow(c, txt(f, 'label'), u),
    <div key="n" style={{ font: `900 ${autofit(num, [[4, 210], [6, 168], [Infinity, 120]]) * c.uH}px/.86 Archivo`, letterSpacing: '-.04em', color: c.accent, margin: `${20 * u}px 0 ${28 * u}px` }}>{num}</div>,
    <div key="bar" style={{ width: '74%', marginBottom: 30 * u }}><Bar pct={pct} c={c} u={u} /></div>,
    <div key="cap" style={{ font: `500 ${autofit(txt(f, 'caption'), [[70, 40], [130, 34], [Infinity, 28]]) * c.uB}px/1.24 'Space Grotesk'`, maxWidth: '88%', color: dim(c.text, 90) }}>{txt(f, 'caption')}</div>,
    footer(c, fd, u),
  ], { bgImage: c.bgImage });
}
function r_tips(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  return frame(c, [
    listHeading(c, txt(f, 'title'), u),
    <div key="l" style={{ display: 'flex', flexDirection: 'column', gap: 22 * u, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {list(f, 'items').map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 22 * u, alignItems: 'baseline' }}>
          <span style={{ font: `800 ${34 * c.uB}px/1 Archivo`, color: c.accent, flex: 'none', width: 44 * u }}>{i + 1 + '.'}</span>
          <span style={{ font: `500 ${30 * c.uB}px/1.28 'Space Grotesk'`, color: dim(c.text, 92) }}>{it}</span>
        </div>
      ))}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_cover(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const hl = txt(f, 'headline');
  return frame(c, [
    eyebrow(c, txt(f, 'kicker'), u),
    <div key="hl" style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ font: `900 ${autofit(hl, [[36, 100], [70, 84], [110, 68], [Infinity, 54]]) * c.uH}px/.98 Archivo`, letterSpacing: '-.025em', maxWidth: '100%' }}>{highlightNodes(hl, txt(f, 'highlight'), c, u)}</div>
    </div>,
    <div key="fr" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 * u }}>
      <div style={{ flex: 1, minWidth: 0 }}>{footer(c, fd, u, true)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 * u, font: `700 ${20 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.14em', textTransform: 'uppercase', color: c.accent, paddingBottom: 6 * u, flex: 'none' }}>Swipe<Icon name="arrow" size={22 * u} color={c.accent} /></div>
    </div>,
  ], { bgImage: c.bgImage });
}
function r_announce(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const title = txt(f, 'title');
  return frame(c, [
    <div key="b" style={{ alignSelf: 'flex-start', background: c.accent, color: c.bg, font: `800 ${18 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.16em', padding: `${12 * u}px ${18 * u}px`, borderRadius: 999, marginBottom: 36 * u }}>{txt(f, 'badge')}</div>,
    <div key="t" style={{ font: `800 ${autofit(title, [[40, 70], [80, 58], [Infinity, 48]]) * c.uH}px/1.02 Archivo`, letterSpacing: '-.02em', maxWidth: '96%' }}>{title}</div>,
    <div key="s" style={{ font: `500 ${34 * c.uB}px/1.3 'Space Grotesk'`, color: dim(c.text, 72), marginTop: 26 * u, maxWidth: '88%' }}>{txt(f, 'subtitle')}</div>,
    <div key="d" style={{ display: 'flex', alignItems: 'center', gap: 14 * u, marginTop: 38 * u }}>
      <div style={{ width: 14 * u, height: 14 * u, borderRadius: '50%', background: c.accent }} />
      <span style={{ font: `600 ${26 * c.uB}px/1 'Space Grotesk'`, color: c.text }}>{txt(f, 'detail')}</span>
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_question(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const q = txt(f, 'question');
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      {eyebrow(c, txt(f, 'kicker'), u)}
      <div style={{ font: `800 ${autofit(q, [[45, 76], [85, 64], [140, 52], [Infinity, 44]]) * c.uH}px/1.06 Archivo`, letterSpacing: '-.02em', marginTop: 24 * u }}>
        {highlightNodes(q, txt(f, 'highlight'), c, u)}<span style={{ color: c.accent }}>{' ?'}</span>
      </div>
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_contrast(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const panel = (label: string, text: string, accentBg: boolean): ReactNode => (
    <div style={{ flex: 1, borderRadius: 20 * u, padding: `${40 * u}px ${44 * u}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden', background: accentBg ? c.accent : dim(c.text, 9), color: accentBg ? c.bg : c.text, border: accentBg ? 'none' : `${2 * u}px solid ${dim(c.text, 26)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * u, marginBottom: 18 * u }}>
        <Icon name={accentBg ? 'check' : 'x'} size={26 * u} color={accentBg ? c.bg : c.accent} />
        <div style={{ font: `700 ${17 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.18em', textTransform: 'uppercase', color: accentBg ? c.bg : c.accent }}>{label}</div>
      </div>
      <div style={{ font: `700 ${autofit(text, [[60, 40], [110, 33], [Infinity, 28]]) * c.uH}px/1.14 Archivo`, letterSpacing: '-.01em' }}>{text}</div>
    </div>
  );
  return frame(c, [
    <div key="g" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 * u, minHeight: 0 }}>
      {panel(txt(f, 'beforeLabel'), txt(f, 'before'), false)}
      {panel(txt(f, 'afterLabel'), txt(f, 'after'), true)}
    </div>,
    footer(c, fd, u, true),
  ], { pad: 80, bgImage: c.bgImage });
}
function r_framework(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  return frame(c, [
    listHeading(c, txt(f, 'title'), u),
    <div key="l" style={{ display: 'flex', flexDirection: 'column', gap: 26 * u, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {list(f, 'items').map((it, i) => {
        const parts = String(it).split(' — ');
        const nm = parts[0];
        const desc = parts.slice(1).join(' — ');
        return (
          <div key={i} style={{ display: 'flex', gap: 24 * u, alignItems: 'flex-start' }}>
            <div style={{ flex: 'none', width: 60 * u, height: 60 * u, borderRadius: 14 * u, background: dim(c.accent, 18), color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${28 * c.uB}px/1 Archivo` }}>{i + 1}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 * u, paddingTop: 4 * u }}>
              <span style={{ font: `800 ${34 * c.uH}px/1.05 Archivo`, color: c.text }}>{nm}</span>
              {desc ? <span style={{ font: `500 ${24 * c.uB}px/1.3 'Space Grotesk'`, color: dim(c.text, 66) }}>{desc}</span> : null}
            </div>
          </div>
        );
      })}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_cta(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const hl = txt(f, 'headline');
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ font: `900 ${autofit(hl, [[40, 84], [80, 70], [Infinity, 56]]) * c.uH}px/1.02 Archivo`, letterSpacing: '-.025em' }}>{highlightNodes(hl, txt(f, 'highlight'), c, u)}</div>
    </div>,
    <div key="btn" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 14 * u, background: c.accent, color: c.bg, font: `800 ${32 * c.uB}px/1 Archivo`, padding: `${26 * u}px ${40 * u}px`, borderRadius: 999, marginBottom: 12 * u }}>{txt(f, 'buttonText')}<Icon name="arrow" size={30 * u} color={c.bg} /></div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_statement(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const statement = txt(f, 'statement');
  const size = autofit(statement, [[45, 82], [90, 68], [150, 54], [Infinity, 44]]);
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ font: `800 ${size * c.uH}px/1.08 Archivo`, letterSpacing: '-.02em', textAlign: 'center' }}>
        {highlightNodes(statement, txt(f, 'highlight'), c, u)}
      </div>
    </div>,
    <div key="f" style={{ alignSelf: 'center' }}>{footer(c, fd, u, true)}</div>,
  ], { bgImage: c.bgImage });
}
function r_checklist(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  return frame(c, [
    listHeading(c, txt(f, 'title'), u, 'Checklist'),
    <div key="l" style={{ display: 'flex', flexDirection: 'column', gap: 22 * u, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {list(f, 'items').map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 20 * u, alignItems: 'center' }}>
          <div style={{ flex: 'none', width: 48 * u, height: 48 * u, borderRadius: '50%', background: dim(c.accent, 16), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={28 * u} color={c.accent} />
          </div>
          <span style={{ font: `500 ${30 * c.uB}px/1.24 'Space Grotesk'`, color: dim(c.text, 92) }}>{it}</span>
        </div>
      ))}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_timeline(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const items = list(f, 'items');
  return frame(c, [
    listHeading(c, txt(f, 'title'), u, 'Timeline'),
    <div key="l" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 30 * u, flex: 1, minHeight: 0, overflow: 'hidden', paddingLeft: 6 * u }}>
      {items.map((it, i) => {
        const parts = String(it).split(' — ');
        const nm = parts[0];
        const desc = parts.slice(1).join(' — ');
        const last = i === items.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 26 * u, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 24 * u }}>
              <div style={{ width: 24 * u, height: 24 * u, borderRadius: '50%', background: c.accent, flex: 'none' }} />
              {!last ? <div style={{ width: 3 * u, flex: 1, background: dim(c.text, 20), marginTop: 4 * u }} /> : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 * u, paddingBottom: last ? 0 : 8 * u }}>
              <span style={{ font: `800 ${32 * c.uH}px/1.08 Archivo`, color: c.text }}>{nm}</span>
              {desc ? <span style={{ font: `500 ${24 * c.uB}px/1.3 'Space Grotesk'`, color: dim(c.text, 66) }}>{desc}</span> : null}
            </div>
          </div>
        );
      })}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_testimonial(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const name = txt(f, 'name') || 'Anonymous';
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const q = txt(f, 'quote');
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ font: `900 ${150 * c.uH}px/.7 Archivo`, color: c.accent, height: 76 * u }}>{'“'}</div>
      <div style={{ font: `500 ${autofit(q, [[90, 52], [170, 44], [260, 37], [Infinity, 31]]) * c.uH}px/1.26 Newsreader`, fontStyle: 'italic', letterSpacing: '-.01em', maxWidth: '96%' }}>{q}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 * u, marginTop: 44 * u }}>
        <div style={{ width: 68 * u, height: 68 * u, borderRadius: '50%', background: c.accent, color: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${26 * c.uB}px/1 Archivo`, flex: 'none' }}>{initials || '—'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 * u, fontFamily: "'Space Grotesk',sans-serif" }}>
          <span style={{ font: `700 ${27 * c.uB}px/1.1 'Space Grotesk'`, color: c.text }}>{name}</span>
          <span style={{ font: `500 ${20 * c.uB}px/1.2 'Space Grotesk'`, color: dim(c.text, 60) }}>{txt(f, 'role')}</span>
        </div>
      </div>
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_agenda(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const items = list(f, 'items');
  return frame(c, [
    listHeading(c, txt(f, 'title'), u, 'Agenda'),
    <div key="l" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 26 * u, alignItems: 'center', padding: `${18 * u}px 0`, borderTop: i === 0 ? 'none' : `${2 * u}px solid ${dim(c.text, 14)}` }}>
          <span style={{ font: `800 ${40 * c.uB}px/1 Archivo`, color: c.accent, flex: 'none', width: 74 * u, letterSpacing: '-.02em' }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ font: `600 ${30 * c.uB}px/1.2 'Space Grotesk'`, color: dim(c.text, 92) }}>{it}</span>
        </div>
      ))}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_comparison(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const col = (label: string, items: string[], accent: boolean): ReactNode => (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 * u }}>
      <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 10 * u, background: accent ? c.accent : dim(c.text, 10), color: accent ? c.bg : c.text, border: accent ? 'none' : `${2 * u}px solid ${dim(c.text, 22)}`, borderRadius: 999, padding: `${10 * u}px ${20 * u}px`, font: `700 ${17 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.1em', textTransform: 'uppercase' }}>
        <Icon name={accent ? 'check' : 'x'} size={22 * u} color={accent ? c.bg : c.accent} />{label}
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 14 * u, alignItems: 'flex-start' }}>
          <div style={{ paddingTop: 8 * u }}><Icon name="dot" size={16 * u} color={accent ? c.accent : dim(c.text, 40)} /></div>
          <span style={{ font: `500 ${26 * c.uB}px/1.26 'Space Grotesk'`, color: dim(c.text, accent ? 92 : 70) }}>{it}</span>
        </div>
      ))}
    </div>
  );
  return frame(c, [
    listHeading(c, txt(f, 'title'), u, 'Comparison'),
    <div key="cols" style={{ display: 'flex', gap: 40 * u, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {col(txt(f, 'leftLabel'), list(f, 'left'), false)}
      <div style={{ width: 2 * u, background: dim(c.text, 14), flex: 'none', alignSelf: 'stretch' }} />
      {col(txt(f, 'rightLabel'), list(f, 'right'), true)}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_myth(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const panel = (label: string, text: string, accent: boolean): ReactNode => (
    <div style={{ flex: 1, borderRadius: 20 * u, padding: `${38 * u}px ${42 * u}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden', background: accent ? dim(c.accent, 14) : dim(c.text, 8), border: `${2 * u}px solid ${accent ? c.accent : dim(c.text, 22)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * u, marginBottom: 18 * u }}>
        <div style={{ width: 44 * u, height: 44 * u, borderRadius: '50%', background: accent ? c.accent : dim(c.text, 14), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon name={accent ? 'check' : 'x'} size={26 * u} color={accent ? c.bg : dim(c.text, 70)} />
        </div>
        <div style={{ font: `700 ${18 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.18em', textTransform: 'uppercase', color: accent ? c.accent : dim(c.text, 60) }}>{label}</div>
      </div>
      <div style={{ font: `700 ${autofit(text, [[70, 38], [130, 32], [Infinity, 27]]) * c.uH}px/1.18 Archivo`, letterSpacing: '-.01em', color: c.text }}>{text}</div>
    </div>
  );
  return frame(c, [
    <div key="g" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22 * u, minHeight: 0 }}>
      {panel('Myth', txt(f, 'myth'), false)}
      {panel('Fact', txt(f, 'fact'), true)}
    </div>,
    footer(c, fd, u, true),
  ], { pad: 80, bgImage: c.bgImage });
}
function r_divider(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const title = txt(f, 'title');
  const idx = txt(f, 'index');
  return frame(c, [
    <div key="mk" style={{ position: 'absolute', top: 0, right: 0 }}><Icon name="plus" size={40 * u} color={dim(c.accent, 70)} /></div>,
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      {idx ? <div style={{ font: `900 ${120 * c.uH}px/.9 Archivo`, color: dim(c.accent, 90), letterSpacing: '-.04em' }}>{idx}</div> : null}
      <div style={{ width: 90 * u, height: 5 * u, background: c.accent, borderRadius: 999, margin: `${28 * u}px 0` }} />
      <div style={{ font: `900 ${autofit(title, [[30, 96], [60, 78], [Infinity, 62]]) * c.uH}px/1 Archivo`, letterSpacing: '-.03em' }}>{title}</div>
      {txt(f, 'subtitle') ? <div style={{ font: `500 ${30 * c.uB}px/1.3 'Space Grotesk'`, color: dim(c.text, 66), marginTop: 24 * u, maxWidth: '80%' }}>{txt(f, 'subtitle')}</div> : null}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_bio(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const name = txt(f, 'name') || fd.name || 'Your name';
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatar = fd.avatar
    ? <img src={fd.avatar} alt="" crossOrigin="anonymous" style={{ width: 150 * u, height: 150 * u, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
    : <div style={{ width: 150 * u, height: 150 * u, borderRadius: '50%', background: c.accent, color: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${54 * c.uB}px/1 Archivo`, flex: 'none' }}>{initials || '—'}</div>;
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      {eyebrow(c, 'Introduction', u)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 * u, margin: `${32 * u}px 0` }}>
        {avatar}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * u, minWidth: 0 }}>
          <span style={{ font: `900 ${autofit(name, [[16, 68], [Infinity, 52]]) * c.uH}px/1 Archivo`, letterSpacing: '-.02em' }}>{name}</span>
          <span style={{ font: `600 ${26 * c.uB}px/1.2 'Space Grotesk'`, color: c.accent }}>{txt(f, 'role')}</span>
        </div>
      </div>
      <div style={{ font: `500 ${autofit(txt(f, 'bio'), [[90, 38], [Infinity, 32]]) * c.uB}px/1.34 'Space Grotesk'`, color: dim(c.text, 84), maxWidth: '92%' }}>{txt(f, 'bio')}</div>
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_bignum(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const value = txt(f, 'value');
  const pct = parsePct(value);
  const ring = 300 * u;
  return frame(c, [
    eyebrow(c, txt(f, 'label'), u),
    <div key="w" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 56 * u, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: ring, height: ring, flex: 'none' }}>
        <Ring pct={pct} c={c} u={u} size={ring} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 ${autofit(value, [[3, 82], [5, 62], [Infinity, 46]]) * c.uH}px/1 Archivo`, letterSpacing: '-.03em', color: c.text }}>{value}</div>
      </div>
      <div style={{ font: `500 ${autofit(txt(f, 'caption'), [[70, 40], [Infinity, 32]]) * c.uB}px/1.26 'Space Grotesk'`, color: dim(c.text, 88), minWidth: 0 }}>{txt(f, 'caption')}</div>
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_closing(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const title = txt(f, 'title');
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 0, overflow: 'hidden' }}>
      <Icon name="star" size={56 * u} color={c.accent} />
      <div style={{ font: `900 ${autofit(title, [[30, 90], [60, 74], [Infinity, 58]]) * c.uH}px/1.02 Archivo`, letterSpacing: '-.02em', marginTop: 28 * u }}>{title}</div>
      {txt(f, 'subtitle') ? <div style={{ font: `500 ${32 * c.uB}px/1.3 'Space Grotesk'`, color: dim(c.text, 72), marginTop: 24 * u, maxWidth: '78%' }}>{txt(f, 'subtitle')}</div> : null}
      {txt(f, 'cta') ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 * u, background: c.accent, color: c.bg, font: `800 ${28 * c.uB}px/1 'Space Grotesk'`, padding: `${22 * u}px ${36 * u}px`, borderRadius: 999, marginTop: 40 * u }}>{txt(f, 'cta')}</div> : null}
    </div>,
    <div key="f" style={{ alignSelf: 'stretch' }}>{footer(c, fd, u, true)}</div>,
  ], { bgImage: c.bgImage });
}

function r_poll(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const q = txt(f, 'question');
  const row = (letter: string, text: string, accent: boolean): ReactNode => (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 28 * u, borderRadius: 20 * u, padding: `${30 * u}px ${38 * u}px`, background: accent ? c.accent : dim(c.text, 9), color: accent ? c.bg : c.text, border: accent ? 'none' : `${2 * u}px solid ${dim(c.text, 24)}` }}>
      <div style={{ flex: 'none', width: 78 * u, height: 78 * u, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${38 * c.uB}px/1 Archivo`, background: accent ? c.bg : c.accent, color: accent ? c.accent : c.bg }}>{letter}</div>
      <div style={{ font: `700 ${autofit(text, [[40, 42], [80, 34], [Infinity, 28]]) * c.uB}px/1.14 Archivo`, letterSpacing: '-.01em', minWidth: 0 }}>{text}</div>
    </div>
  );
  return frame(c, [
    eyebrow(c, txt(f, 'kicker'), u),
    <div key="q" style={{ font: `800 ${autofit(q, [[40, 64], [80, 52], [Infinity, 42]]) * c.uH}px/1.08 Archivo`, letterSpacing: '-.02em', margin: `${24 * u}px 0 ${36 * u}px`, maxWidth: '96%' }}>{q}</div>,
    <div key="g" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 * u, minHeight: 0 }}>
      {row('A', txt(f, 'optionA'), false)}
      <div style={{ alignSelf: 'center', font: `800 ${20 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.24em', color: dim(c.text, 46) }}>OR</div>
      {row('B', txt(f, 'optionB'), true)}
    </div>,
    footer(c, fd, u, true),
  ], { pad: 80, bgImage: c.bgImage });
}
function r_takeaway(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const t = txt(f, 'takeaway');
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      {eyebrow(c, txt(f, 'label'), u)}
      <div style={{ display: 'flex', gap: 34 * u, marginTop: 38 * u, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: 'none', width: 8 * u, borderRadius: 999, background: c.accent, alignSelf: 'stretch' }} />
        <div style={{ font: `800 ${autofit(t, [[45, 78], [90, 64], [150, 52], [Infinity, 42]]) * c.uH}px/1.12 Archivo`, letterSpacing: '-.02em' }}>{highlightNodes(t, txt(f, 'highlight'), c, u)}</div>
      </div>
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_stattrio(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const items = list(f, 'items');
  return frame(c, [
    eyebrow(c, txt(f, 'label'), u),
    <div key="g" style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 26 * u, marginTop: 40 * u, minHeight: 0, overflow: 'hidden' }}>
      {items.map((it, i) => {
        const parts = String(it).split(' — ');
        const value = parts[0];
        const lbl = parts.slice(1).join(' — ');
        return (
          <div key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 * u, borderRadius: 20 * u, padding: `${30 * u}px ${26 * u}px`, background: dim(c.text, 6), border: `${2 * u}px solid ${dim(c.text, 14)}` }}>
            <div style={{ font: `900 ${autofit(value, [[3, 88], [5, 64], [Infinity, 48]]) * c.uH}px/.9 Archivo`, letterSpacing: '-.03em', color: c.accent }}>{value}</div>
            <div style={{ width: 42 * u, height: 4 * u, background: dim(c.accent, 55), borderRadius: 999 }} />
            <div style={{ font: `600 ${autofit(lbl, [[30, 25], [Infinity, 20]]) * c.uB}px/1.24 'Space Grotesk'`, color: dim(c.text, 80) }}>{lbl}</div>
          </div>
        );
      })}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_definition(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const term = txt(f, 'term');
  const meaning = txt(f, 'meaning');
  const pron = txt(f, 'pronunciation');
  return frame(c, [
    eyebrow(c, txt(f, 'label'), u),
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 * u, flexWrap: 'wrap' }}>
        <div style={{ font: `900 ${autofit(term, [[12, 108], [20, 82], [Infinity, 62]]) * c.uH}px/1 Archivo`, letterSpacing: '-.03em' }}>{term}</div>
        {pron ? <div style={{ font: `400 ${34 * c.uB}px/1 Newsreader`, fontStyle: 'italic', color: dim(c.text, 55) }}>{pron}</div> : null}
      </div>
      <div style={{ width: 90 * u, height: 5 * u, background: c.accent, borderRadius: 999, margin: `${30 * u}px 0` }} />
      <div style={{ font: `500 ${autofit(meaning, [[90, 42], [170, 36], [Infinity, 30]]) * c.uB}px/1.36 Newsreader`, color: dim(c.text, 88), maxWidth: '94%' }}>{meaning}</div>
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_protip(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const tip = txt(f, 'tip');
  return frame(c, [
    <div key="w" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 * u, marginBottom: 34 * u }}>
        <div style={{ width: 72 * u, height: 72 * u, borderRadius: 18 * u, background: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon name="bolt" size={40 * u} color={c.bg} />
        </div>
        <div style={{ font: `800 ${22 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.2em', textTransform: 'uppercase', color: c.accent }}>{txt(f, 'label') || 'Pro tip'}</div>
      </div>
      <div style={{ borderRadius: 24 * u, padding: `${44 * u}px ${48 * u}px`, background: dim(c.accent, 12), borderLeft: `${8 * u}px solid ${c.accent}`, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ font: `700 ${autofit(tip, [[70, 48], [140, 40], [220, 34], [Infinity, 28]]) * c.uH}px/1.26 Archivo`, letterSpacing: '-.01em', color: c.text }}>{highlightNodes(tip, txt(f, 'highlight'), c, u)}</div>
      </div>
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}
function r_roadmap(c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) {
  const items = list(f, 'items');
  return frame(c, [
    listHeading(c, txt(f, 'title'), u, 'Roadmap'),
    <div key="l" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {items.map((it, i) => {
        const parts = String(it).split(' — ');
        const nm = parts[0];
        const desc = parts.slice(1).join(' — ');
        const last = i === items.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 28 * u, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 96 * u }}>
              <div style={{ width: 96 * u, height: 96 * u, borderRadius: 22 * u, background: c.accent, color: c.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ font: `600 ${13 * c.uB}px/1 'Space Grotesk'`, letterSpacing: '.14em', textTransform: 'uppercase', opacity: 0.85 }}>Phase</span>
                <span style={{ font: `900 ${40 * c.uB}px/1 Archivo`, marginTop: 4 * u }}>{i + 1}</span>
              </div>
              {!last ? <div style={{ width: 4 * u, flex: 1, background: dim(c.accent, 40), minHeight: 18 * u }} /> : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * u, paddingTop: 12 * u, paddingBottom: last ? 0 : 30 * u, minWidth: 0 }}>
              <span style={{ font: `800 ${autofit(nm, [[24, 38], [Infinity, 30]]) * c.uH}px/1.08 Archivo`, color: c.text }}>{nm}</span>
              {desc ? <span style={{ font: `500 ${autofit(desc, [[60, 25], [Infinity, 21]]) * c.uB}px/1.3 'Space Grotesk'`, color: dim(c.text, 66) }}>{desc}</span> : null}
            </div>
          </div>
        );
      })}
    </div>,
    footer(c, fd, u, true),
  ], { bgImage: c.bgImage });
}

const RENDERERS: Record<string, (c: Ctx, f: Record<string, FieldValue>, fd: FooterData, u: number) => ReactNode> = {
  quote: r_quote, stat: r_stat, tips: r_tips, cover: r_cover, announce: r_announce,
  question: r_question, contrast: r_contrast, framework: r_framework, cta: r_cta, statement: r_statement,
  checklist: r_checklist, timeline: r_timeline, testimonial: r_testimonial, agenda: r_agenda,
  comparison: r_comparison, myth: r_myth, divider: r_divider, bio: r_bio, bignum: r_bignum, closing: r_closing,
  poll: r_poll, takeaway: r_takeaway, stattrio: r_stattrio, definition: r_definition, protip: r_protip, roadmap: r_roadmap,
};

const SlideCanvas = forwardRef<HTMLDivElement, SlideCanvasProps>(({ slide, colors, footer: fd, width, height, headingScale, bodyScale, footerScale }, ref) => {
  const useImg = !!slide.bgImage;
  const u = height / 1080;
  const s = (v: number | undefined) => (v && v > 0 ? v : 1);
  const c: Ctx = {
    w: width, h: height, bg: colors.bg, text: useImg ? '#FFFFFF' : colors.text, accent: colors.accent, bgImage: slide.bgImage,
    uH: u * s(headingScale), uB: u * s(bodyScale), uF: u * s(footerScale),
  };
  const render = RENDERERS[slide.template] ?? r_quote;
  return <div ref={ref}>{render(c, slide.fields, fd, u)}</div>;
});

SlideCanvas.displayName = 'SlideCanvas';
export default SlideCanvas;
