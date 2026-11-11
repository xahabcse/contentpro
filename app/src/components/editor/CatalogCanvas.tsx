import type { CSSProperties, ReactNode } from 'react';
import type { FieldValue, FooterData, ResolvedSlide } from '@/lib/design-types';
import type { ResolvedColors } from '@/lib/palettes';

interface CatalogCanvasProps {
  slide: ResolvedSlide;
  colors: ResolvedColors;
  footer: FooterData;
  width: number;
  height: number;
  layout: string;
  name: string;
  headingScale?: number;
  bodyScale?: number;
  footerScale?: number;
}

const text = (fields: Record<string, FieldValue>, key: string): string =>
  typeof fields[key] === 'string' ? fields[key] as string : '';
const list = (fields: Record<string, FieldValue>, key: string): string[] =>
  Array.isArray(fields[key]) ? (fields[key] as string[]).filter(Boolean) : [];
const first = (fields: Record<string, FieldValue>, ...keys: string[]): string =>
  keys.map((key) => text(fields, key)).find(Boolean) ?? '';

function alpha(hex: string, opacity: number): string {
  const raw = hex.replace('#', '');
  const value = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[a-f\d]{6}$/i.test(value)) return hex;
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${opacity})`;
}

interface Datum { label: string; value: number; suffix: string }
function parseData(rows: string[]): Datum[] {
  return rows.map((row) => {
    const parts = row.split(/\s+[—–]\s+/);
    const raw = parts.length > 1 ? parts.pop()!.trim() : row.trim();
    const match = raw.match(/(-?\d+(?:\.\d+)?)\s*(%?)/);
    return { label: parts.length ? parts.join(' — ') : row, value: match ? Number(match[1]) : NaN, suffix: match?.[2] ?? '' };
  }).filter((row) => Number.isFinite(row.value) && row.value >= 0);
}

function piePath(start: number, end: number): string {
  const point = (a: number) => [100 + 86 * Math.cos(a), 100 + 86 * Math.sin(a)];
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  return `M 100 100 L ${x1} ${y1} A 86 86 0 ${end - start > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
}

export default function CatalogCanvas({ slide, colors, footer, width, height, layout, name, headingScale = 1, bodyScale = 1, footerScale = 1 }: CatalogCanvasProps) {
  const f = slide.fields;
  const u = height / 1080;
  const ink = slide.bgImage ? '#FFFFFF' : colors.text;
  const accent = colors.accent;
  const muted = alpha(ink, 0.72);
  const wash = alpha(ink, 0.075);
  const edge = alpha(ink, 0.18);
  const h = (v: number) => v * u * headingScale;
  const b = (v: number) => v * u * bodyScale;
  const tag = first(f, 'label') || name;
  const title = first(f, 'title', 'question', 'challenge', 'term', 'formula', 'symptom', 'person');
  const subtitle = first(f, 'subtitle', 'note', 'result', 'insight', 'takeaway', 'next', 'outcome', 'closing', 'context', 'resolution');
  const rows = list(f, 'items');
  const value = first(f, 'value', 'role', 'date');
  const panel: CSSProperties = { border: `${1.5 * u}px solid ${edge}`, background: wash, borderRadius: 24 * u, padding: 26 * u, minWidth: 0, boxSizing: 'border-box' };
  const heading: CSSProperties = { font: `800 ${h(title.length > 85 ? 42 : title.length > 55 ? 52 : 64)}px/1.07 Archivo`, letterSpacing: '-.025em', margin: 0, maxWidth: '98%', overflowWrap: 'anywhere' };
  const body: CSSProperties = { font: `500 ${b(27)}px/1.32 'Space Grotesk'`, color: muted, overflowWrap: 'anywhere' };
  const small: CSSProperties = { font: `700 ${b(21)}px/1.2 'Space Grotesk'`, letterSpacing: '.025em' };
  const lead = (copy = title) => copy && <div style={{ ...heading }}>{copy}</div>;
  const note = (copy = subtitle) => copy && <div style={{ ...body, marginTop: 18 * u }}>{copy}</div>;
  const rowCards = (values = rows, numbered = false) => <div style={{ display: 'grid', gap: 12 * u, marginTop: 28 * u }}>
    {values.slice(0, 5).map((item, index) => <div key={index} style={{ ...panel, display: 'flex', alignItems: 'flex-start', gap: 18 * u, padding: `${18 * u}px ${24 * u}px` }}><span style={{ color: accent, font: `800 ${b(26)}px/1 Archivo`, minWidth: 42 * u }}>{numbered ? String(index + 1).padStart(2, '0') : '•'}</span><span style={{ font: `600 ${b(item.length > 80 ? 22 : 27)}px/1.23 'Space Grotesk'` }}>{item}</span></div>)}
  </div>;
  const gridCards = (values = rows, columns = 2) => <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 14 * u, marginTop: 28 * u }}>
    {values.slice(0, columns === 3 ? 6 : 4).map((item, index) => {
      const parts = item.split(/\s+[—–]\s+/);
      return <div key={index} style={{ ...panel, minHeight: 135 * u }}><span style={{ ...small, color: accent }}>{String(index + 1).padStart(2, '0')}</span><div style={{ font: `700 ${b(26)}px/1.18 'Space Grotesk'`, marginTop: 17 * u }}>{parts[0]}</div>{parts.length > 1 && <div style={{ ...body, fontSize: b(21), marginTop: 9 * u }}>{parts.slice(1).join(' — ')}</div>}</div>;
    })}
  </div>;
  const feature = (key: string, label: string) => {
    const v = f[key];
    if (!v || (Array.isArray(v) && v.length === 0)) return null;
    return <div style={{ ...panel, flex: 1 }}><div style={{ ...small, color: accent, textTransform: 'uppercase', marginBottom: 17 * u }}>{label}</div>{Array.isArray(v) ? <div style={{ display: 'grid', gap: 12 * u }}>{v.slice(0, 4).map((item, i) => <div key={i} style={{ font: `600 ${b(23)}px/1.25 'Space Grotesk'` }}>• {item}</div>)}</div> : <div style={{ font: `600 ${b(v.length > 110 ? 22 : 29)}px/1.27 'Space Grotesk'` }}>{v}</div>}</div>;
  };
  const featureRow = (entries: [string, string][]) => <div style={{ display: 'flex', gap: 16 * u, marginTop: 30 * u, alignItems: 'stretch' }}>{entries.map(([key, label]) => <div key={key} style={{ flex: 1, minWidth: 0 }}>{feature(key, label)}</div>)}</div>;
  const cta = text(f, 'cta') && <div style={{ ...small, display: 'inline-flex', alignSelf: 'flex-start', color: accent, borderBottom: `${2 * u}px solid ${accent}`, paddingBottom: 6 * u, marginTop: 26 * u }}>{text(f, 'cta')}</div>;

  let content: ReactNode;
  switch (layout) {
    case 'progress-bars': {
      const data = parseData(list(f, 'values'));
      content = <>{lead()}<div style={{ display: 'grid', gap: 29 * u, marginTop: 55 * u }}>{data.slice(0, 5).map((d, i) => <div key={i}><div style={{ display: 'flex', justifyContent: 'space-between', ...small, fontSize: b(26), marginBottom: 13 * u }}><span>{d.label}</span><span style={{ color: accent }}>{d.value}{d.suffix || '%'}</span></div><div style={{ height: 24 * u, background: edge, borderRadius: 99 * u, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, d.value)}%`, height: '100%', background: accent, borderRadius: 99 * u }} /></div></div>)}</div>{note(first(f, 'next'))}</>;
      break;
    }
    case 'progress-meter':
    case 'fundraiser-thermometer': {
      const raw = text(f, 'value');
      const numbers = [...raw.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
      const pct = raw.includes('%') ? numbers[0] ?? 0 : numbers.length > 1 && numbers[1] > 0 ? numbers[0] / numbers[1] * 100 : 0;
      content = <>{lead()}<div style={{ display: 'flex', alignItems: 'baseline', gap: 18 * u, margin: `${54 * u}px 0 ${20 * u}px` }}><span style={{ font: `900 ${h(115)}px/1 Archivo`, color: accent }}>{raw || '0%'}</span></div><div style={{ height: 36 * u, borderRadius: 100 * u, background: edge, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: accent, borderRadius: 100 * u }} /></div>{note()}{cta}</>;
      break;
    }
    case 'line-chart':
    case 'bar-chart':
    case 'vertical-bars': {
      const data = parseData(list(f, 'values').length ? list(f, 'values') : list(f, 'segments')).slice(0, 6);
      const max = Math.max(1, ...data.map((d) => d.value));
      const chartH = 360;
      const chartW = 760;
      const x = (i: number) => 60 + i * (700 / Math.max(1, data.length - 1));
      const y = (v: number) => 320 - v / max * 270;
      content = <>{lead()}<div style={{ ...panel, marginTop: 35 * u, padding: 28 * u }}><svg role="img" aria-label={`${name}: ${data.map((d) => `${d.label} ${d.value}${d.suffix}`).join(', ')}`} viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={390 * u} style={{ overflow: 'visible' }}><line x1="40" y1="320" x2="750" y2="320" stroke={edge} strokeWidth="3" />{[0, 1, 2, 3].map((i) => <line key={i} x1="40" y1={50 + i * 90} x2="750" y2={50 + i * 90} stroke={edge} strokeWidth="1" />)}{layout === 'line-chart' ? <><polyline points={data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')} fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />{data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="10" fill={accent} stroke={colors.bg} strokeWidth="4" />)}</> : data.map((d, i) => <rect key={i} x={40 + i * (700 / Math.max(1, data.length)) + 12} y={y(d.value)} width={Math.max(32, 700 / Math.max(1, data.length) - 28)} height={320 - y(d.value)} rx="10" fill={accent} opacity={0.65 + i / Math.max(1, data.length) * 0.35} />)}{data.map((d, i) => <g key={i}><text x={layout === 'line-chart' ? x(i) : 40 + i * (700 / Math.max(1, data.length)) + 700 / Math.max(1, data.length) / 2} y="350" textAnchor="middle" fill={ink} fontSize="19" fontFamily="Space Grotesk">{d.label.slice(0, 12)}</text><text x={layout === 'line-chart' ? x(i) : 40 + i * (700 / Math.max(1, data.length)) + 700 / Math.max(1, data.length) / 2} y={Math.max(35, y(d.value) - 17)} textAnchor="middle" fill={ink} fontSize="22" fontWeight="700" fontFamily="Space Grotesk">{d.value}{d.suffix}</text></g>)}</svg></div>{note(first(f, 'insight', 'subtitle'))}</>;
      break;
    }
    case 'pie-chart':
    case 'pie-segments':
    case 'donut-segments': {
      const data = parseData(list(f, 'values').length ? list(f, 'values') : list(f, 'segments')).slice(0, 6);
      const total = data.reduce((sum, d) => sum + d.value, 0);
      const colorsForSlice = [accent, alpha(accent, .76), alpha(accent, .53), alpha(ink, .57), alpha(ink, .35), alpha(ink, .21)];
      const sectors = data.map((d, i) => {
        const start = -Math.PI / 2 + (total ? data.slice(0, i).reduce((sum, item) => sum + item.value, 0) / total * Math.PI * 2 : 0);
        const end = start + (total ? d.value / total * Math.PI * 2 : 0);
        return <path key={i} d={piePath(start, Math.min(end, start + Math.PI * 2 - .0001))} fill={colorsForSlice[i]} stroke={colors.bg} strokeWidth="2" />;
      });
      content = <>{lead()}<div style={{ display: 'flex', gap: 42 * u, alignItems: 'center', marginTop: 42 * u }}><svg role="img" aria-label={`${name}: ${data.map((d) => `${d.label} ${d.value}${d.suffix}`).join(', ')}`} viewBox="0 0 200 200" width={380 * u} height={380 * u} style={{ flex: 'none' }}>{sectors}{layout === 'donut-segments' && <circle cx="100" cy="100" r="45" fill={colors.bg} />}</svg><div style={{ display: 'grid', gap: 17 * u, flex: 1, minWidth: 0 }}>{data.map((d, i) => <div key={i} style={{ borderBottom: `${1 * u}px solid ${edge}`, paddingBottom: 11 * u, display: 'flex', gap: 12 * u, alignItems: 'center' }}><span style={{ width: 16 * u, height: 16 * u, borderRadius: 5 * u, background: colorsForSlice[i], flex: 'none' }} /><span style={{ ...small, flex: 1, fontSize: b(23) }}>{d.label}</span><strong style={{ font: `800 ${b(28)}px/1 Archivo` }}>{d.value}{d.suffix}</strong></div>)}</div></div>{note(first(f, 'insight', 'subtitle'))}</>;
      break;
    }
    case 'metric-grid': content = <>{lead()}{gridCards(rows, 2)}{note()}</>; break;
    case 'code-window': content = <>{lead()}<div style={{ ...panel, marginTop: 34 * u, padding: 0, overflow: 'hidden' }}><div style={{ borderBottom: `${1.5 * u}px solid ${edge}`, padding: `${16 * u}px ${25 * u}px`, ...small, color: accent }}>● &nbsp; ● &nbsp; ● &nbsp; {tag}</div><pre style={{ font: `600 ${b(25)}px/1.48 Consolas, monospace`, padding: 30 * u, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>{text(f, 'code')}</pre></div>{rowCards(rows)}</>; break;
    case 'flow':
    case 'system-map':
    case 'ordered-steps':
    case 'day-one-plan':
    case 'milestone-timeline':
    case 'process-glimpses':
    {
      const flowRows = rows.length ? rows : [first(f, 'before', 'symptom'), first(f, 'after', 'resolution')].filter(Boolean);
      content = <>{lead()}<div style={{ display: 'flex', gap: 13 * u, alignItems: 'stretch', marginTop: 42 * u }}>{flowRows.slice(0, 4).map((item, i) => <div key={i} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', gap: 10 * u }}><div style={{ ...panel, flex: 1, padding: 23 * u }}><div style={{ font: `900 ${h(43)}px/1 Archivo`, color: accent, marginBottom: 30 * u }}>{String(i + 1).padStart(2, '0')}</div><div style={{ font: `650 ${b(item.length > 65 ? 21 : 25)}px/1.28 'Space Grotesk'` }}>{item}</div></div>{i < flowRows.length - 1 && <span style={{ alignSelf: 'center', font: `800 ${b(27)}px/1 Archivo`, color: accent }}>→</span>}</div>)}</div>{note(first(f, 'resolution', 'outcome', 'result', 'note', 'subtitle'))}</>;
      break;
    }
    case 'branch': content = <>{lead()}<div style={{ textAlign: 'center', color: accent, font: `700 ${b(48)}px/1 Archivo`, margin: `${25 * u}px 0` }}>↙ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ↘</div>{featureRow([['left', 'YES'], ['right', 'NO']])}{note()}</>; break;
    case 'concept-map': content = <>{lead()}<div style={{ ...panel, textAlign: 'center', margin: `${35 * u}px auto`, width: '70%', font: `800 ${h(42)}px/1.14 Archivo`, color: accent }}>{text(f, 'center')}</div>{gridCards(rows, 3)}</>; break;
    case 'layer-stack': content = <><div style={{ color: accent, font: `800 ${h(66)}px/1.05 Archivo` }}>{text(f, 'term')}</div>{rows.slice(0, 5).map((item, i) => <div key={i} style={{ ...panel, marginTop: 14 * u, marginLeft: i * 30 * u, marginRight: i * 30 * u, font: `650 ${b(28)}px/1.24 'Space Grotesk'` }}>{item}</div>)}{note(first(f, 'takeaway'))}</>; break;
    case 'split':
    case 'career-split':
    case 'two-partners':
    case 'customer-journey': content = <>{lead()}{featureRow(text(f, 'familiar') ? [['familiar', 'FAMILIAR'], ['technical', 'THE IDEA']] : text(f, 'mistake') ? [['mistake', 'THE MISTAKE'], ['fix', 'THE FIX']] : f.do ? [['do', 'DO'], ['dont', 'AVOID']] : f.gains ? [['gains', 'GAINS'], ['costs', 'COSTS']] : f.before ? [['before', 'BEFORE'], ['after', 'AFTER']] : [['role', 'NEW ROLE'], ['items', 'WHY IT FITS']])}{note(first(f, 'limit', 'why', 'decision', 'subtitle', 'quote'))}</>; break;
    case 'equation': content = <><div style={{ ...small, color: accent, marginBottom: 24 * u }}>{tag}</div><div style={{ ...panel, font: `800 ${h(56)}px/1.16 Archivo`, color: accent, padding: 40 * u }}>{text(f, 'formula')}</div>{rowCards(rows)}{note(first(f, 'example'))}</>; break;
    case 'reference-grid':
    case 'term-cards':
    case 'project-grid':
    case 'people-grid':
    case 'pricing-columns':
    case 'volunteer-cards': content = <>{lead()}{gridCards(rows, layout === 'pricing-columns' || layout === 'people-grid' ? 3 : 2)}{note()}{cta}</>; break;
    case 'pillars': content = <>{lead()}{gridCards(rows, 3)}{note(first(f, 'closing'))}</>; break;
    case 'quiz': content = <>{lead(first(f, 'question'))}{list(f, 'options').length ? rowCards(list(f, 'options')) : null}<div style={{ ...panel, marginTop: 30 * u, borderColor: alpha(accent, .55) }}><div style={{ ...small, color: accent, marginBottom: 13 * u }}>ANSWER</div><div style={{ font: `750 ${b(29)}px/1.25 'Space Grotesk'` }}>{text(f, 'answer')}</div></div>{note(first(f, 'reason', 'example'))}{text(f, 'tip') && note(text(f, 'tip'))}</>; break;
    case 'story': {
      const keys = ['context', 'action', 'result', 'hypothesis', 'test', 'observation', 'next', 'trigger', 'response', 'learning'];
      content = <>{lead()}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 * u, marginTop: 35 * u }}>{keys.filter((key) => !!f[key]).slice(0, 4).map((key) => <div key={key}>{feature(key, key.replace(/_/g, ' '))}</div>)}</div></>;
      break;
    }
    case 'challenge': content = <>{lead(first(f, 'challenge'))}{rowCards(list(f, 'constraints'), true)}{featureRow([['success', 'SUCCESS LOOKS LIKE']])}</>; break;
    case 'career-hero':
    case 'ceremony-badge':
    case 'credential-stamp':
    case 'launch-feature':
    case 'review-callout':
    case 'availability-counter':
    case 'speaker-poster':
    case 'community-portrait':
    case 'profile-availability':
    case 'tribute-quote': {
      content = <>{value && <div style={{ color: accent, font: `800 ${h(value.length > 26 ? 43 : 68)}px/1.08 Archivo`, marginBottom: 24 * u }}>{value}</div>}{lead()}{text(f, 'person') && title !== text(f, 'person') && <div style={{ font: `700 ${b(35)}px/1.2 'Space Grotesk'`, color: accent, marginTop: 30 * u }}>{text(f, 'person')}</div>}{text(f, 'quote') && <div style={{ ...panel, font: `500 ${b(34)}px/1.28 Newsreader`, marginTop: 34 * u }}>“{text(f, 'quote')}”</div>}{rows.length ? gridCards(rows, 3) : null}{note()}{cta}</>;
      break;
    }
    case 'menu-board':
    case 'service-list':
    case 'release-bullets':
    case 'outcome-bullets':
    case 'bullet-roundup':
    case 'bullet-list':
    case 'checklist':
    case 'error-stack': content = <>{lead()}{rowCards(rows, layout === 'error-stack')}{note()}{cta}</>; break;
    default: content = <>{lead()}{rows.length ? rowCards(rows) : null}{note()}{cta}</>;
  }

  const initials = footer.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return <div data-template-id={slide.template} style={{ width, height, boxSizing: 'border-box', overflow: 'hidden', position: 'relative', background: colors.bg, color: ink, padding: `${64 * u}px ${68 * u}px ${48 * u}px`, display: 'flex', flexDirection: 'column', fontFamily: 'Space Grotesk' }}>
    {slide.bgImage && <><div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${slide.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /><div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.64)' }} /></>}
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 16 * u, marginBottom: 55 * u }}><span style={{ display: 'inline-block', width: 25 * u, height: 25 * u, borderRadius: 7 * u, background: accent }} /><span style={{ font: `800 ${b(20)}px/1.2 'Space Grotesk'`, letterSpacing: '.15em', textTransform: 'uppercase', color: accent }}>{tag}</span><span style={{ flex: 1, borderTop: `${1 * u}px solid ${edge}` }} /></div>
    <div data-catalog-content style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{content}</div>
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 15 * u, paddingTop: 28 * u, marginTop: 35 * u, borderTop: `${1.5 * u}px solid ${edge}`, minHeight: 58 * u }}><div style={{ width: 48 * u, height: 48 * u, borderRadius: '50%', flex: 'none', border: `${1 * u}px solid ${edge}`, background: wash, display: 'grid', placeItems: 'center', overflow: 'hidden', font: `800 ${20 * u * footerScale}px/1 Archivo` }}>{footer.avatar ? <img src={footer.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}</div><div style={{ minWidth: 0, flex: 1 }}><div style={{ font: `700 ${20 * u * footerScale}px/1.1 'Space Grotesk'` }}>{footer.name}</div><div style={{ font: `500 ${16 * u * footerScale}px/1.2 'Space Grotesk'`, color: muted, marginTop: 4 * u }}>{footer.designation || (footer.handle ? `@${footer.handle}` : '')}</div></div><span style={{ color: accent, font: `800 ${20 * u}px/1 Archivo` }}>↗</span></div>
  </div>;
}
