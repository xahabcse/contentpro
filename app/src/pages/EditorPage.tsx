import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { CardstockMark } from '@/components/Logo';
import { canvasSize, type FieldValue, type FooterData, type LocalDesign, type ResolvedSlide, type Slide, type TemplateId } from '@/lib/design-types';
import { PALETTES, resolveColors } from '@/lib/palettes';
import { TEMPLATE_ORDER, TEMPLATES, templateDefaults } from '@/lib/templates';
import { exportCardAsPng, exportCarouselAsPdf, downloadBlob } from '@/lib/export';
import { getDesign, saveDesign, storagePressure } from '@/lib/local-store';
import { getImageUrl, newImageId, putImage } from '@/lib/image-store';

const MAX_SLIDES = 15;

type MobileTab = 'templates' | 'content' | 'theme' | 'author' | 'background';
const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: 'templates', label: 'Templates' },
  { id: 'content', label: 'Content' },
  { id: 'theme', label: 'Theme' },
  { id: 'author', label: 'Author' },
  { id: 'background', label: 'Image' },
];

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    setMatches(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}

interface Profile {
  name?: string;
  handle?: string;
  photoUrl?: string | null;
  designation?: string;
  companyName?: string;
  companyLogoUrl?: string | null;
}

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [design, setDesign] = useState<LocalDesign | null>(null);
  const [profile, setProfile] = useState<Profile>({});
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);
  const [ui, setUi] = useState<'light' | 'dark'>('light');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [scale, setScale] = useState(0.35);
  const [mobileTab, setMobileTab] = useState<MobileTab>('content');
  const isMobile = useMediaQuery('(max-width: 900px)');

  const stageAreaRef = useRef<HTMLDivElement>(null);
  const mobileStageRef = useRef<HTMLDivElement>(null);
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dirty = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // latest design/active kept in refs so unmount + stable callbacks can read
  // them without re-subscribing.
  const designRef = useRef<LocalDesign | null>(null);
  const activeRef = useRef(0);
  designRef.current = design;
  activeRef.current = active;

  // stable so the memoised TemplatePicker doesn't re-render on every keystroke
  const onPickTemplate = useCallback((tid: TemplateId) => {
    setDesign((d) => (d ? { ...d, slides: d.slides.map((sl, i) => (i === activeRef.current ? { ...sl, template: tid, fields: templateDefaults(tid) } : sl)) } : d));
  }, []);

  // ---- load design (localStorage) + profile (server) ----
  useEffect(() => {
    if (!id) return;
    const d = getDesign(id);
    if (!d) { setNotFound(true); setLoaded(true); return; }
    setDesign(d);
    setLoaded(true);
    fetch('/api/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (p) setProfile(p); })
      .catch(() => {});
  }, [id]);

  // resolve any referenced image ids -> object URLs
  useEffect(() => {
    if (!design) return;
    const ids = new Set<string>();
    for (const s of design.slides) if (s.bgImageId) ids.add(s.bgImageId);
    if (design.authorOverride?.avatarImageId) ids.add(design.authorOverride.avatarImageId);
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const iid of ids) {
        if (imgUrls[iid]) { next[iid] = imgUrls[iid]; continue; }
        const url = await getImageUrl(iid);
        if (url) next[iid] = url;
      }
      if (!cancelled) setImgUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design]);

  // ---- autosave to localStorage (debounced) ----
  useEffect(() => {
    if (!loaded || !design) return;
    if (!dirty.current) { dirty.current = true; return; }
    const t = setTimeout(() => {
      storagePressure().then((p) => { if (p && p.ratio > 0.85) showToast('Your browser storage is getting full — back up and remove old designs.'); });
      try {
        saveDesign(design);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Couldn't save your design.");
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design]);

  // Flush the pending debounced save on unmount / tab-close so the last few
  // keystrokes before leaving the editor are never lost (there is no manual
  // Save button in this browser-only model).
  useEffect(() => {
    const flush = () => {
      if (!dirty.current || !designRef.current) return;
      try { saveDesign(designRef.current); } catch { /* quota surfaced on the debounced path */ }
    };
    window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('beforeunload', flush); flush(); };
  }, []);

  const cv = design ? canvasSize(design.type) : { w: 1080, h: 1080 };
  const colors = resolveColors(design?.paletteId ?? 'ink', { bg: design?.customBg, text: design?.customText, accent: design?.customAccent });

  // effective footer = per-design override, else profile, else placeholder
  const overrideAvatar = design?.authorOverride?.avatarImageId ? imgUrls[design.authorOverride.avatarImageId] : null;
  const footerData: FooterData = {
    name: design?.authorOverride?.name ?? profile.name ?? '',
    handle: design?.authorOverride?.handle ?? profile.handle ?? '',
    avatar: overrideAvatar ?? profile.photoUrl ?? null,
    designation: profile.designation ?? null,
    companyName: profile.companyName ?? null,
    companyLogo: profile.companyLogoUrl ?? null,
  };

  const resolveSlide = (s: Slide): ResolvedSlide => ({ template: s.template, fields: s.fields, bgImage: s.bgImageId ? imgUrls[s.bgImageId] ?? null : null });

  // ---- measure scale ----
  const measure = useCallback(() => {
    if (!design) return;
    if (isMobile) {
      const el = mobileStageRef.current;
      if (!el) return;
      // arrows overlay the edges on carousels -> reserve a little more width
      const reserve = design.type === 'carousel' ? 76 : 28;
      const w = el.clientWidth - reserve;
      const h = el.clientHeight - 28;
      setScale(Math.max(0.05, Math.min(w / cv.w, h / cv.h)));
      return;
    }
    const a = stageAreaRef.current;
    if (!a) return;
    const reserve = design.type === 'carousel' ? 134 : 44;
    const w = a.clientWidth - 96;
    const h = a.clientHeight - 64 - reserve;
    setScale(Math.max(0.12, Math.min(w / cv.w, h / cv.h)));
  }, [design, cv.w, cv.h, isMobile]);
  useEffect(() => {
    measure();
    const on = () => measure();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [measure, loaded]);

  // ---- helpers ----
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }
  function patch(p: Partial<LocalDesign>) { setDesign((d) => (d ? { ...d, ...p } : d)); }
  function patchSlides(fn: (slides: Slide[]) => Slide[]) { setDesign((d) => (d ? { ...d, slides: fn(d.slides) } : d)); }

  const activeSlide = (): Slide | null => (design ? design.slides[Math.min(active, design.slides.length - 1)] || design.slides[0] : null);

  function updateField(k: string, v: FieldValue) { patchSlides((s) => s.map((sl, i) => (i === active ? { ...sl, fields: { ...sl.fields, [k]: v } } : sl))); }
  // Empty the example/placeholder text for the current slide so the user can
  // start from a clean card in one tap (list fields -> [], text/area -> '').
  function clearFields() {
    patchSlides((s) => s.map((sl, i) => {
      if (i !== active) return sl;
      const cleared: Record<string, FieldValue> = {};
      for (const fld of TEMPLATES[sl.template].fields) cleared[fld.k] = fld.t === 'list' ? [] : '';
      return { ...sl, fields: cleared };
    }));
  }
  function setPalette(pid: string) { patch({ paletteId: pid, customBg: null, customText: null, customAccent: null }); }
  // Clamp a text-size multiplier to a safe range so it can never blow the
  // layout apart or shrink copy into illegibility.
  const clampScale = (v: number) => Math.max(0.7, Math.min(1.4, Math.round(v * 100) / 100));
  type ScaleKey = 'headingScale' | 'bodyScale' | 'footerScale';
  // Functional delta so rapid successive taps compound correctly (each reads the
  // live value, not a stale render-time closure).
  function bumpScale(key: ScaleKey, delta: number) { setDesign((d) => (d ? { ...d, [key]: clampScale((d[key] ?? 1) + delta) } : d)); }
  function setAuthorOverride(k: 'name' | 'handle', v: string) { setDesign((d) => (d ? { ...d, authorOverride: { ...d.authorOverride, [k]: v } } : d)); }
  function resetAuthor() { setDesign((d) => (d ? { ...d, authorOverride: undefined } : d)); }
  function addSlide() {
    if (!design || design.slides.length >= MAX_SLIDES) return;
    const cur = design.slides[active];
    const ns: Slide = { template: cur.template, fields: JSON.parse(JSON.stringify(cur.fields)), bgImageId: cur.bgImageId ?? null };
    patchSlides((s) => { const c = s.slice(); c.splice(active + 1, 0, ns); return c; });
    setActive((i) => i + 1);
  }
  function delSlide(i: number) {
    if (!design || design.slides.length <= 1) return;
    patchSlides((s) => { const c = s.slice(); c.splice(i, 1); return c; });
    setActive((a) => Math.max(0, Math.min(a, design.slides.length - 2)));
  }
  function move(from: number, to: number) {
    if (!design || to < 0 || to >= design.slides.length || from === to) return;
    patchSlides((s) => { const c = s.slice(); const [x] = c.splice(from, 1); c.splice(to, 0, x); return c; });
    setActive(to); setDragFrom(null);
  }
  function setBg(imageId: string | null, all?: boolean) {
    if (!design) return;
    if (design.type === 'card') { patchSlides((s) => s.map((sl, i) => (i === 0 ? { ...sl, bgImageId: imageId } : sl))); return; }
    if (all) patchSlides((s) => s.map((sl) => ({ ...sl, bgImageId: imageId })));
    else patchSlides((s) => s.map((sl, i) => (i === active ? { ...sl, bgImageId: imageId } : sl)));
  }

  async function storeImage(file: File): Promise<string | null> {
    const iid = newImageId();
    try {
      await putImage(iid, file);
    } catch {
      showToast("Couldn't save that image — your browser storage may be full.");
      return null;
    }
    try {
      const url = await getImageUrl(iid);
      if (url) setImgUrls((prev) => ({ ...prev, [iid]: url }));
    } catch {
      showToast("Saved the image, but couldn't show a preview.");
    }
    return iid;
  }

  async function exportNow() {
    if (exporting || !design) return;
    setExporting(true);
    try {
      // Let React flush any just-applied change (e.g. a background swapped a
      // moment ago) into the offscreen export pool before we read its nodes.
      // A short timeout (not requestAnimationFrame -- browsers pause rAF in
      // hidden/background tabs, which would hang the export) is enough for the
      // pending commit + paint to land.
      await new Promise<void>((r) => setTimeout(r, 50));
      const nodes = exportRefs.current.filter((n): n is HTMLDivElement => n !== null);
      // Timestamp suffix so re-exports never collide on the same filename --
      // otherwise the browser writes "name (1).png" while the user re-opens the
      // stale "name.png" and thinks the new background didn't apply.
      const base = (design.title || (design.type === 'card' ? 'contentpro-card' : 'contentpro-carousel')).replace(/[\\/:*?"<>|]+/g, '-');
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
      if (design.type === 'card') {
        const blob = await exportCardAsPng(nodes[0], cv.w, cv.h);
        downloadBlob(blob, `${base}-${stamp}.png`);
        showToast('PNG downloaded ✓');
      } else {
        const blob = await exportCarouselAsPdf(nodes, cv.w, cv.h);
        downloadBlob(blob, `${base}-${stamp}.pdf`);
        showToast('PDF · ' + design.slides.length + ' slides downloaded ✓');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed. If you use a profile photo or company logo, try re-uploading it, then export again.');
    }
    setExporting(false);
  }

  if (!loaded) {
    return <div className="cp" data-ui={ui} style={centerBox}>Loading editor…</div>;
  }
  if (notFound || !design) {
    return (
      <div className="cp" data-ui={ui} style={{ ...centerBox, flexDirection: 'column', gap: 16, textAlign: 'center', padding: 24 }}>
        <div style={{ font: '800 20px/1.3 Archivo' }}>Design not found</div>
        <div style={{ font: "500 14px/1.5 'Space Grotesk'", color: 'var(--c-dim2)', maxWidth: 420 }}>Designs live in this browser. This one may have been created on another device or removed.</div>
        <button onClick={() => navigate('/dashboard')} style={accentPill}>Back to dashboard</button>
      </div>
    );
  }

  const a = activeSlide()!;
  const tpl = TEMPLATES[a.template];
  const isCar = design.type === 'carousel';
  const usingProfileAuthor = !design.authorOverride?.name && !design.authorOverride?.handle && !design.authorOverride?.avatarImageId;

  const headingScale = design.headingScale ?? 1;
  const bodyScale = design.bodyScale ?? 1;
  const footerScale = design.footerScale ?? 1;
  const scaledCanvas = (slide: Slide, target: number) => (
    <div style={{ width: target, aspectRatio: cv.w + '/' + cv.h, borderRadius: 5, overflow: 'hidden', position: 'relative', background: '#000' }}>
      <div style={{ width: cv.w, height: cv.h, transform: `scale(${target / cv.w})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <SlideCanvas slide={resolveSlide(slide)} colors={colors} footer={footerData} width={cv.w} height={cv.h} headingScale={headingScale} bodyScale={bodyScale} footerScale={footerScale} />
      </div>
    </div>
  );

  // ---- shared editor pieces (composed differently for desktop vs mobile) ----
  const stageCanvas = (
    <div style={{ width: cv.w * scale, height: cv.h * scale, position: 'relative', animation: 'cp-fade .3s ease' }}>
      <div style={{ width: cv.w, height: cv.h, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, boxShadow: '0 30px 90px rgba(0,0,0,.35)' }}>
        <SlideCanvas slide={resolveSlide(a)} colors={colors} footer={footerData} width={cv.w} height={cv.h} headingScale={headingScale} bodyScale={bodyScale} footerScale={footerScale} />
      </div>
    </div>
  );

  const templatePicker = (
    <TemplatePicker
      activeTemplate={a.template}
      bg={colors.bg}
      text={colors.text}
      accent={colors.accent}
      name={footerData.name}
      handle={footerData.handle}
      avatar={footerData.avatar ?? null}
      designation={footerData.designation ?? null}
      companyName={footerData.companyName ?? null}
      companyLogo={footerData.companyLogo ?? null}
      cvW={cv.w}
      cvH={cv.h}
      onPick={onPickTemplate}
    />
  );

  const contentPanel = (
    <Section
      title={'CONTENT · ' + tpl.name}
      action={
        <button
          onClick={clearFields}
          title="Clear the example text so you can type your own"
          style={{ border: '1px solid var(--c-line2)', background: 'var(--c-chip)', color: 'var(--c-dim2)', font: "600 10px/1 'Space Grotesk'", letterSpacing: '.04em', cursor: 'pointer', padding: '6px 10px', borderRadius: 7 }}
        >
          Clear ✕
        </button>
      }
    >
      {tpl.fields.map((fld) => (
        <Labeled key={fld.k} label={fld.l}>
          <FieldInput field={fld} value={a.fields[fld.k]} onChange={(v) => updateField(fld.k, v)} />
        </Labeled>
      ))}
      <div style={{ marginTop: 4, paddingTop: 14, borderTop: '1px dashed var(--c-line2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ font: "600 10px/1 'Space Grotesk'", letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--c-dim)' }}>Text size</span>
          {(headingScale !== 1 || bodyScale !== 1 || footerScale !== 1)
            ? <button onClick={() => patch({ headingScale: 1, bodyScale: 1, footerScale: 1 })} style={linkBtn} title="Reset all to 100%">Reset all ↺</button>
            : null}
        </div>
        {([['headingScale', 'Heading', headingScale], ['bodyScale', 'Body', bodyScale], ['footerScale', 'Footer', footerScale]] as [ScaleKey, string, number][]).map(([key, label, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 58, flex: 'none', font: "600 12px/1 'Space Grotesk'", color: 'var(--c-dim2)' }}>{label}</span>
            <button onClick={() => bumpScale(key, -0.05)} disabled={val <= 0.7} aria-label={`Decrease ${label} size`} style={txtStepBtn(val <= 0.7)}>A−</button>
            <span style={{ flex: 1, textAlign: 'center', font: "700 12px/1 'Space Grotesk'", color: 'var(--c-dim2)' }}>{Math.round(val * 100)}%</span>
            <button onClick={() => bumpScale(key, 0.05)} disabled={val >= 1.4} aria-label={`Increase ${label} size`} style={txtStepBtn(val >= 1.4)}>A+</button>
          </div>
        ))}
        <div style={{ marginTop: 6, font: "500 11px/1.4 'Space Grotesk'", color: 'var(--c-dim)' }}>Heading, body and footer scale independently.</div>
      </div>
    </Section>
  );

  const themePanel = (
    <Section title="THEME">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        {PALETTES.map((p) => {
          const on = design.paletteId === p.id && !design.customBg && !design.customText && !design.customAccent;
          return (
            <button key={p.id} onClick={() => setPalette(p.id)} title={p.name} style={{ border: on ? '2px solid var(--c-accent)' : '1px solid var(--c-line2)', borderRadius: 9, padding: 0, cursor: 'pointer', overflow: 'hidden', height: 46, background: p.bg, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 16px/1 Archivo', color: p.text }}>Aa</div>
              <div style={{ position: 'absolute', right: 6, bottom: 6, width: 12, height: 12, borderRadius: '50%', background: p.accent }} />
            </button>
          );
        })}
      </div>
      <ColorRow label="Background" value={colors.bg} onChange={(v) => patch({ customBg: v })} />
      <ColorRow label="Text" value={colors.text} onChange={(v) => patch({ customText: v })} />
      <ColorRow label="Accent" value={colors.accent} onChange={(v) => patch({ customAccent: v })} />
      <button onClick={() => patch({ customBg: null, customText: null, customAccent: null })} style={linkBtn}>Reset ↺</button>
    </Section>
  );

  const authorPanel = (
    <Section title="AUTHOR">
      <div style={{ font: "500 11px/1.5 'Space Grotesk'", color: 'var(--c-dim)', marginBottom: 12 }}>
        {usingProfileAuthor ? 'Signed from your profile. Edit here to override just this design.' : 'Overridden for this design.'}
      </div>
      <Labeled label="Name">
        <input type="text" value={footerData.name} placeholder="Your name" onChange={(e) => setAuthorOverride('name', e.target.value)} style={inputStyle} />
      </Labeled>
      <Labeled label="Handle">
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--c-input)', border: '1px solid var(--c-line2)', borderRadius: 9, padding: '0 12px' }}>
          <span style={{ color: 'var(--c-dim)', font: "500 14px/1 'Space Grotesk'" }}>@</span>
          <input type="text" value={footerData.handle} placeholder="yourhandle" onChange={(e) => setAuthorOverride('handle', e.target.value.replace(/^@/, ''))} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--c-text)', font: "500 14px/1 'Space Grotesk'", padding: '10px 6px' }} />
        </div>
      </Labeled>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="file-trigger" style={{ flex: 1 }}>
          <span style={{ display: 'block', padding: '9px 0', textAlign: 'center', border: '1px dashed var(--c-line2)', borderRadius: 9, color: 'var(--c-dim2)', font: "600 12px/1 'Space Grotesk'", cursor: 'pointer' }}>Override photo</span>
          <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const iid = await storeImage(f); if (iid) setDesign((d) => (d ? { ...d, authorOverride: { ...d.authorOverride, avatarImageId: iid } } : d)); } }} className="visually-hidden" />
        </label>
        {!usingProfileAuthor ? <button onClick={resetAuthor} style={{ ...linkBtn, flex: 'none' }}>Use profile</button> : null}
      </div>
    </Section>
  );

  const backgroundPanel = (
    <Section title="BACKGROUND IMAGE">
      {a.bgImageId && imgUrls[a.bgImageId] ? <div style={{ height: 80, borderRadius: 10, backgroundImage: `url(${imgUrls[a.bgImageId]})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: 10, position: 'relative' }}><div style={{ position: 'absolute', inset: 0, background: 'var(--c-scrim)', borderRadius: 10 }} /></div> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <label className="file-trigger" style={{ flex: 1 }}>
          <span style={{ display: 'block', padding: '9px 0', textAlign: 'center', border: '1px dashed var(--c-line2)', borderRadius: 9, color: 'var(--c-dim2)', font: "600 12px/1 'Space Grotesk'", cursor: 'pointer' }}>{a.bgImageId ? 'Replace' : 'Upload image'}</span>
          <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const iid = await storeImage(f); if (iid) setBg(iid, false); } }} className="visually-hidden" />
        </label>
        {a.bgImageId ? <button onClick={() => setBg(null, false)} style={{ flex: 'none', padding: '0 14px', border: '1px solid var(--c-line2)', borderRadius: 9, background: 'none', color: 'var(--c-dim2)', cursor: 'pointer', font: "600 12px/1 'Space Grotesk'" }}>Remove</button> : null}
      </div>
      {isCar && a.bgImageId ? <button onClick={() => setBg(a.bgImageId!, true)} style={{ marginTop: 8, width: '100%', padding: '8px 0', border: 'none', borderRadius: 9, background: 'var(--c-chip)', color: 'var(--c-dim2)', cursor: 'pointer', font: "600 11px/1 'Space Grotesk'" }}>Apply to all slides</button> : null}
      <div style={{ marginTop: 10, font: "500 11px/1.4 'Space Grotesk'", color: 'var(--c-dim)' }}>A dark scrim is added automatically so text stays readable.</div>
    </Section>
  );

  const filmstripBar = isCar ? (
    <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--c-line)', background: 'var(--c-filmstrip)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div role="group" aria-label="Reorder or delete the current slide" style={{ display: 'flex', gap: 6, flex: 'none' }}>
        <button onClick={() => move(active, active - 1)} disabled={active === 0} aria-label="Move slide earlier" title="Move slide earlier" style={filmCtrl(active === 0)}>‹</button>
        <button onClick={() => move(active, active + 1)} disabled={active >= design.slides.length - 1} aria-label="Move slide later" title="Move slide later" style={filmCtrl(active >= design.slides.length - 1)}>›</button>
        <button onClick={() => delSlide(active)} disabled={design.slides.length <= 1} aria-label="Delete current slide" title="Delete current slide" style={{ ...filmCtrl(design.slides.length <= 1), color: 'var(--c-danger)' }}>×</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto', flex: 1, minWidth: 0 }}>
        {design.slides.map((s, i) => {
          const on = i === active;
          return (
            <button key={i} type="button" draggable aria-label={`Slide ${i + 1}${on ? ' (current)' : ''}`} aria-current={on ? true : undefined} onClick={() => setActive(i)} onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => dragFrom !== null && move(dragFrom, i)} style={{ position: 'relative', flex: 'none', cursor: 'grab', borderRadius: 7, padding: 3, background: on ? 'var(--c-accent)' : 'transparent', border: on ? 'none' : '1px solid var(--c-line2)' }}>
              {scaledCanvas(s, 64)}
              <span style={{ position: 'absolute', top: 1, left: 5, font: "700 9px/1 'Space Grotesk'", color: on ? 'var(--c-accent-ink)' : '#fff', textShadow: on ? 'none' : '0 1px 3px rgba(0,0,0,.8)' }}>{i + 1}</span>
            </button>
          );
        })}
        <button onClick={addSlide} disabled={design.slides.length >= MAX_SLIDES} aria-label="Add slide" title="Add slide" style={{ flex: 'none', width: 70, alignSelf: 'stretch', minHeight: 80, borderRadius: 7, border: '1.5px dashed var(--c-line2)', background: 'transparent', color: 'var(--c-dim)', cursor: design.slides.length >= MAX_SLIDES ? 'not-allowed' : 'pointer', font: '22px/1 Archivo', opacity: design.slides.length >= MAX_SLIDES ? 0.4 : 1 }}>+</button>
      </div>
    </div>
  ) : null;

  const desktopBody = (
    <div className="cp-body">
      <aside className="cp-left" style={{ background: 'var(--c-panel)', borderRight: '1px solid var(--c-line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '16px 18px 12px', font: "700 11px/1 'Space Grotesk'", letterSpacing: '.16em', color: 'var(--c-dim)' }}>TEMPLATES</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 18px' }}>{templatePicker}</div>
      </aside>

      <main ref={stageAreaRef} className="cp-stage" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-stage)', position: 'relative' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '32px 0' }}>
          {isCar && active > 0 ? <button onClick={() => setActive(active - 1)} style={arrowStyle('left')}>‹</button> : null}
          {isCar && active < design.slides.length - 1 ? <button onClick={() => setActive(active + 1)} style={arrowStyle('right')}>›</button> : null}
          {stageCanvas}
          {isCar ? <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', font: "600 12px/1 'Space Grotesk'", color: 'var(--c-dim)', letterSpacing: '.08em' }}>{active + 1 + ' / ' + design.slides.length}</div> : null}
        </div>
        {filmstripBar}
      </main>

      <aside className="cp-right" style={{ background: 'var(--c-panel)', borderLeft: '1px solid var(--c-line)', overflowY: 'auto' }}>
        {contentPanel}
        {themePanel}
        {authorPanel}
        {backgroundPanel}
      </aside>
    </div>
  );

  const mobilePanel =
    mobileTab === 'templates' ? <div style={{ padding: '16px 14px 40px' }}>{templatePicker}</div>
    : mobileTab === 'content' ? contentPanel
    : mobileTab === 'theme' ? themePanel
    : mobileTab === 'author' ? authorPanel
    : backgroundPanel;

  const mobileBody = (
    <div className="cp-mbody">
      <div className="cp-mstage" ref={mobileStageRef}>
        {isCar && active > 0 ? <button onClick={() => setActive(active - 1)} aria-label="Previous slide" style={mArrow('left')}>‹</button> : null}
        {isCar && active < design.slides.length - 1 ? <button onClick={() => setActive(active + 1)} aria-label="Next slide" style={mArrow('right')}>›</button> : null}
        {stageCanvas}
        {isCar ? <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', font: "600 11px/1 'Space Grotesk'", color: 'var(--c-dim)', letterSpacing: '.08em' }}>{active + 1 + ' / ' + design.slides.length}</div> : null}
      </div>
      {filmstripBar}
      <div className="cp-mtabs" role="tablist" aria-label="Editor panels">
        {MOBILE_TABS.map((t) => {
          const on = mobileTab === t.id;
          return (
            <button key={t.id} className="cp-mtab" data-on={on} role="tab" aria-selected={on} onClick={() => setMobileTab(t.id)}>{t.label}</button>
          );
        })}
      </div>
      <div className="cp-mpanel" role="tabpanel">{mobilePanel}</div>
    </div>
  );

  return (
    <div className="cp" data-ui={ui} style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--c-app)', color: 'var(--c-text)', overflow: 'hidden' }}>
      {/* top bar */}
      <div className="cp-topbar" style={{ display: 'flex', alignItems: 'center', gap: 16, height: 60, flex: '0 0 60px', padding: '0 20px', background: 'var(--c-bar)', borderBottom: '1px solid var(--c-line)' }}>
        <button onClick={() => navigate('/dashboard')} title="Back to dashboard" style={{ display: 'flex', alignItems: 'center', gap: 11, border: 'none', background: 'none', cursor: 'pointer' }}>
          <CardstockMark size={30} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, textAlign: 'left' }}>
            <span style={{ font: '800 16px/1 Archivo', color: 'var(--c-text)' }}>Cardstock</span>
            <span className="cp-logosub" style={{ font: "600 9px/1.4 'Space Grotesk'", letterSpacing: '.22em', color: 'var(--c-dim)' }}>CARD &amp; CAROUSEL STUDIO</span>
          </div>
        </button>
        <input
          type="text"
          value={design.title ?? ''}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Untitled design"
          aria-label="Design title"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: '1px solid var(--c-line2)', borderRadius: 8, color: 'var(--c-text)', font: "700 14px/1 'Space Grotesk'", padding: '10px 12px' }}
        />
        <span className="cp-topstatus" style={{ font: "500 13px/1 'Space Grotesk'", color: 'var(--c-dim)', flex: 'none', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name + (isCar ? ' · ' + design.slides.length + ' slides · 1080×1350' : ' · 1080×1080')}</span>
        <button onClick={() => setUi(ui === 'light' ? 'dark' : 'light')} title={ui === 'light' ? 'Switch to dark' : 'Switch to light'} aria-label={ui === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid var(--c-line2)', background: 'transparent', color: 'var(--c-dim2)', cursor: 'pointer', font: '16px/1', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{ui === 'light' ? '☽' : '☀'}</button>
        <button onClick={exportNow} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', cursor: exporting ? 'wait' : 'pointer', font: "700 13px/1 'Space Grotesk'", padding: '12px 18px', borderRadius: 10, background: 'var(--c-accent)', color: 'var(--c-accent-ink)', opacity: exporting ? 0.6 : 1, flex: 'none' }}>
          {exporting ? <span style={{ width: 13, height: 13, border: '2px solid color-mix(in srgb, var(--c-accent-ink) 35%, transparent)', borderTopColor: 'var(--c-accent-ink)', borderRadius: '50%', animation: 'cp-spin .7s linear infinite' }} /> : <span style={{ fontSize: 14 }}>↓</span>}
          {exporting ? 'Exporting…' : design.type === 'card' ? 'Export PNG' : 'Export PDF'}
        </button>
      </div>

      {isMobile ? mobileBody : desktopBody}

      {/* offscreen export pool (full size, untransformed). Zero-sized +
          overflow:hidden so the full-size slide nodes it holds never add to the
          document's scrollable height (html2canvas renders each node directly,
          so the clipping here doesn't affect the export). */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -99999, top: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0 }}>
        {design.slides.map((s, i) => (
          <div key={i} ref={(n) => { exportRefs.current[i] = n; }}>
            <SlideCanvas slide={resolveSlide(s)} colors={colors} footer={footerData} width={cv.w} height={cv.h} headingScale={headingScale} bodyScale={bodyScale} footerScale={footerScale} />
          </div>
        ))}
      </div>

      {toast ? <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--c-text)', color: 'var(--c-app)', font: "700 13px/1 'Space Grotesk'", padding: '13px 22px', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,.35)', zIndex: 50, animation: 'cp-fade .3s ease', maxWidth: 360, textAlign: 'center', lineHeight: 1.4 }}>{toast}</div> : null}
    </div>
  );
}

const centerBox: CSSProperties = { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-app)', color: 'var(--c-dim)', font: "600 14px/1 'Space Grotesk'" };
const inputStyle: CSSProperties = { width: '100%', background: 'var(--c-input)', border: '1px solid var(--c-line2)', borderRadius: 9, color: 'var(--c-text)', font: "500 14px/1.4 'Space Grotesk'", padding: '10px 12px', boxSizing: 'border-box' };
function filmCtrl(disabled: boolean): CSSProperties {
  return { width: 40, height: 40, flex: 'none', borderRadius: 9, border: '1px solid var(--c-line2)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: disabled ? 'not-allowed' : 'pointer', font: '20px/1 Archivo', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 };
}
const linkBtn: CSSProperties = { border: 'none', background: 'none', color: 'var(--c-dim)', font: "600 11px/1 'Space Grotesk'", cursor: 'pointer', padding: 0, marginTop: 4 };
function txtStepBtn(disabled: boolean): CSSProperties {
  return { flex: 'none', width: 40, height: 34, borderRadius: 8, border: '1px solid var(--c-line2)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: disabled ? 'not-allowed' : 'pointer', font: "700 13px/1 'Space Grotesk'", opacity: disabled ? 0.4 : 1 };
}
const accentPill: CSSProperties = { border: 'none', cursor: 'pointer', font: "700 13px/1 'Space Grotesk'", padding: '12px 20px', borderRadius: 10, background: 'var(--c-accent)', color: 'var(--c-accent-ink)' };
function arrowStyle(dir: 'left' | 'right'): CSSProperties {
  return { position: 'absolute', [dir]: 18, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--c-line2)', background: 'var(--c-panel)', color: 'var(--c-text)', cursor: 'pointer', font: '20px/1 Archivo', zIndex: 3, boxShadow: '0 6px 20px rgba(0,0,0,.12)' } as CSSProperties;
}
function mArrow(dir: 'left' | 'right'): CSSProperties {
  return { position: 'absolute', [dir]: 4, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--c-line2)', background: 'color-mix(in srgb, var(--c-panel) 82%, transparent)', color: 'var(--c-text)', cursor: 'pointer', font: '20px/1 Archivo', zIndex: 3, boxShadow: '0 4px 14px rgba(0,0,0,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' } as CSSProperties;
}
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 18px', borderBottom: '1px solid var(--c-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <div style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.16em', color: 'var(--c-dim2)' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', font: "600 10px/1 'Space Grotesk'", letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--c-dim)', marginBottom: 7 }}>{label}</span>
      {children}
    </label>
  );
}
function FieldInput({ field, value, onChange }: { field: { k: string; l: string; t: 'text' | 'area' | 'list' }; value: FieldValue | undefined; onChange: (v: FieldValue) => void }) {
  if (field.t === 'area' || field.t === 'list') {
    const v = field.t === 'list' ? (Array.isArray(value) ? value : []).join('\n') : (typeof value === 'string' ? value : '');
    return <textarea value={v} rows={field.t === 'list' ? 5 : 3} placeholder={field.t === 'list' ? 'One item per line…' : field.l} onChange={(e) => onChange(field.t === 'list' ? e.target.value.split('\n') : e.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.4 }} />;
  }
  return <input type="text" value={typeof value === 'string' ? value : ''} placeholder={field.l} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
}
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={label + ' colour'} style={{ width: 34, height: 34, borderRadius: 8, flex: 'none' }} />
      <span style={{ font: "500 12px/1 'Space Grotesk'", color: 'var(--c-dim2)', flex: 1 }}>{label}</span>
      <span style={{ font: "500 12px/1 'Space Grotesk'", color: 'var(--c-dim)' }}>{String(value).toUpperCase()}</span>
    </div>
  );
}

interface TemplatePickerProps {
  activeTemplate: TemplateId;
  bg: string;
  text: string;
  accent: string;
  name: string;
  handle: string;
  avatar: string | null;
  designation: string | null;
  companyName: string | null;
  companyLogo: string | null;
  cvW: number;
  cvH: number;
  onPick: (t: TemplateId) => void;
}

// Memoised so typing content (which changes the active slide, not these
// primitive props) doesn't re-render all 10 scaled SlideCanvas previews.
const TemplatePicker = memo(function TemplatePicker(props: TemplatePickerProps) {
  const { activeTemplate, bg, text, accent, name, handle, avatar, designation, companyName, companyLogo, cvW, cvH, onPick } = props;
  const colors = { bg, text, accent };
  const footer: FooterData = { name, handle, avatar, designation, companyName, companyLogo };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {TEMPLATE_ORDER.map((tid) => {
        const on = activeTemplate === tid;
        const slide: ResolvedSlide = { template: tid, fields: templateDefaults(tid), bgImage: null };
        return (
          <button key={tid} onClick={() => onPick(tid)} title={TEMPLATES[tid].name} aria-pressed={on} style={{ border: on ? '2px solid var(--c-accent)' : '1px solid var(--c-line2)', background: 'var(--c-chip)', borderRadius: 10, padding: 5, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <div style={{ width: 88, aspectRatio: cvW + '/' + cvH, borderRadius: 5, overflow: 'hidden', position: 'relative', background: '#000' }}>
              <div style={{ width: cvW, height: cvH, transform: `scale(${88 / cvW})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                <SlideCanvas slide={slide} colors={colors} footer={footer} width={cvW} height={cvH} />
              </div>
            </div>
            <span style={{ font: "600 10px/1.1 'Space Grotesk'", color: on ? 'var(--c-accent-ink)' : 'var(--c-dim)', paddingLeft: 2 }}>{TEMPLATES[tid].name}</span>
          </button>
        );
      })}
    </div>
  );
});
