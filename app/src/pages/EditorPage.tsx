import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { canvasSize, type Author, type DesignType, type FieldValue, type Slide, type TemplateId } from '@/lib/design-types';
import { PALETTES, resolveColors } from '@/lib/palettes';
import { TEMPLATE_ORDER, TEMPLATES, templateDefaults } from '@/lib/templates';
import { exportCardAsPng, exportCarouselAsPdf, downloadBlob } from '@/lib/export';

const MAX_SLIDES = 15;

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState<DesignType>('card');
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [paletteId, setPaletteId] = useState('bone');
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string | null>(null);
  const [customAccent, setCustomAccent] = useState<string | null>(null);
  const [author, setAuthor] = useState<Author>({ name: '', handle: '', avatar: null });
  const [slides, setSlides] = useState<Slide[]>([]);
  const [active, setActive] = useState(0);
  const [ui, setUi] = useState<'light' | 'dark'>('light');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [scale, setScale] = useState(0.35);
  const [incompatible, setIncompatible] = useState(false);

  const stageAreaRef = useRef<HTMLDivElement>(null);
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dirty = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cv = canvasSize(type);
  const colors = resolveColors(paletteId, { bg: customBg, text: customText, accent: customAccent });

  // ---- load ----
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/designs/${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        // Designs created before the studio redesign have no slides/type and
        // can't be opened in the new template editor -- show a friendly notice
        // instead of crashing on the missing shape.
        if (!d.type || !Array.isArray(d.slides) || d.slides.length === 0) {
          setIncompatible(true);
          setLoaded(true);
          return;
        }
        setType(d.type);
        setTitle(d.title);
        setPaletteId(d.paletteId);
        setCustomBg(d.customBg ?? null);
        setCustomText(d.customText ?? null);
        setCustomAccent(d.customAccent ?? null);
        setAuthor(d.author);
        setSlides(d.slides);
        setActive(0);
        setLoaded(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  // ---- autosave (debounced) ----
  useEffect(() => {
    if (!loaded) return;
    if (!dirty.current) { dirty.current = true; return; }
    const t = setTimeout(() => {
      fetch(`/api/designs/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, paletteId, customBg, customText, customAccent, author, slides }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [loaded, id, title, paletteId, customBg, customText, customAccent, author, slides]);

  // ---- measure scale ----
  const measure = useCallback(() => {
    const a = stageAreaRef.current;
    if (!a) return;
    const reserve = type === 'carousel' ? 134 : 44;
    const w = a.clientWidth - 96;
    const h = a.clientHeight - 64 - reserve;
    const sc = Math.min(w / cv.w, h / cv.h);
    setScale(Math.max(0.12, sc));
  }, [type, cv.w, cv.h]);

  useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure, loaded]);

  // ---- helpers ----
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }
  const activeSlide = (): Slide => slides[Math.min(active, slides.length - 1)] || slides[0];

  function applyTemplate(tid: TemplateId) {
    setSlides((prev) => prev.map((s, i) => (i === active ? { ...s, template: tid, fields: templateDefaults(tid) } : s)));
  }
  function updateField(k: string, v: FieldValue) {
    setSlides((prev) => prev.map((s, i) => (i === active ? { ...s, fields: { ...s.fields, [k]: v } } : s)));
  }
  function setPalette(pid: string) {
    setPaletteId(pid);
    setCustomBg(null); setCustomText(null); setCustomAccent(null);
  }
  function setAuthorField(k: keyof Author, v: string | null) {
    setAuthor((a) => ({ ...a, [k]: v }));
  }
  function addSlide() {
    if (slides.length >= MAX_SLIDES) return;
    setSlides((prev) => {
      const cur = prev[active];
      const ns: Slide = { template: cur.template, fields: JSON.parse(JSON.stringify(cur.fields)), bgImage: cur.bgImage ?? null };
      const s = prev.slice();
      s.splice(active + 1, 0, ns);
      return s;
    });
    setActive((i) => i + 1);
  }
  function delSlide(i: number) {
    if (slides.length <= 1) return;
    setSlides((prev) => { const s = prev.slice(); s.splice(i, 1); return s; });
    setActive((a) => Math.max(0, Math.min(a, slides.length - 2)));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= slides.length || from === to) return;
    setSlides((prev) => { const s = prev.slice(); const [x] = s.splice(from, 1); s.splice(to, 0, x); return s; });
    setActive(to); setDragFrom(null);
  }
  function setBg(url: string | null, all?: boolean) {
    if (type === 'card') { setSlides((prev) => prev.map((s, i) => (i === 0 ? { ...s, bgImage: url } : s))); return; }
    if (all) { setSlides((prev) => prev.map((s) => ({ ...s, bgImage: url }))); }
    else { setSlides((prev) => prev.map((s, i) => (i === active ? { ...s, bgImage: url } : s))); }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/uploads/image', { method: 'POST', credentials: 'include', body: form });
      if (!res.ok) { showToast('Upload failed — try a smaller image'); return null; }
      const { url } = await res.json();
      return url as string;
    } catch { showToast('Upload failed'); return null; }
  }

  // ---- export ----
  async function exportNow() {
    if (exporting) return;
    setExporting(true);
    try {
      const nodes = exportRefs.current.filter((n): n is HTMLDivElement => n !== null);
      if (type === 'card') {
        const blob = await exportCardAsPng(nodes[0], cv.w, cv.h);
        const form = new FormData();
        form.append('file', blob, 'card.png');
        const res = await fetch(`/api/designs/${id}/export`, { method: 'POST', credentials: 'include', body: form });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error === 'LIMIT_REACHED' ? "You've reached 5 saved images. Delete one first." : 'Export failed'); }
        downloadBlob(blob, (title || 'contentpro-card') + '.png');
        showToast('PNG downloaded ✓');
      } else {
        const blob = await exportCarouselAsPdf(nodes, cv.w, cv.h);
        const form = new FormData();
        form.append('file', blob, 'carousel.pdf');
        form.append('pageCount', String(slides.length));
        const res = await fetch(`/api/designs/${id}/export`, { method: 'POST', credentials: 'include', body: form });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error === 'LIMIT_REACHED' ? "You've reached 5 saved PDFs. Delete one first." : 'Export failed'); }
        downloadBlob(blob, (title || 'contentpro-carousel') + '.pdf');
        showToast('PDF · ' + slides.length + ' slides downloaded ✓');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed');
    }
    setExporting(false);
  }

  if (!loaded) {
    return (
      <div className="cp" data-ui={ui} style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-app)', color: 'var(--c-dim)', font: "600 14px/1 'Space Grotesk'" }}>
        Loading editor…
      </div>
    );
  }

  if (incompatible) {
    return (
      <div className="cp" data-ui={ui} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', background: 'var(--c-app)', color: 'var(--c-text)', padding: 24, textAlign: 'center' }}>
        <div style={{ font: "800 20px/1.3 Archivo", maxWidth: 420 }}>This design is from an earlier version</div>
        <div style={{ font: "500 14px/1.5 'Space Grotesk'", color: 'var(--c-dim2)', maxWidth: 420 }}>The editor was redesigned and older designs can't be opened in the new template studio. Create a fresh card or carousel from the dashboard.</div>
        <button onClick={() => navigate('/dashboard')} style={{ border: 'none', cursor: 'pointer', font: "700 13px/1 'Space Grotesk'", padding: '12px 20px', borderRadius: 10, background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}>Back to dashboard</button>
      </div>
    );
  }

  const a = activeSlide();
  const tpl = TEMPLATES[a.template];
  const isCar = type === 'carousel';

  // ---- sub-renders ----
  const scaledCanvas = (slide: Slide, w: number, target: number) => {
    const sh = target * (w === cv.w ? cv.h / cv.w : 1);
    void sh;
    return (
      <div style={{ width: target, aspectRatio: cv.w + '/' + cv.h, borderRadius: 5, overflow: 'hidden', position: 'relative', background: '#000' }}>
        <div style={{ width: cv.w, height: cv.h, transform: `scale(${target / cv.w})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <SlideCanvas slide={slide} colors={colors} author={author} width={cv.w} height={cv.h} />
        </div>
      </div>
    );
  };

  return (
    <div className="cp" data-ui={ui} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-app)', color: 'var(--c-text)', overflow: 'hidden' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 60, flex: '0 0 60px', padding: '0 20px', background: 'var(--c-bar)', borderBottom: '1px solid var(--c-line)' }}>
        <button onClick={() => navigate('/dashboard')} title="Back to dashboard" style={{ display: 'flex', alignItems: 'center', gap: 11, border: 'none', background: 'none', cursor: 'pointer' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--c-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '900 17px/1 Archivo', color: 'var(--c-accent-ink)' }}>C</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, textAlign: 'left' }}>
            <span style={{ font: '800 16px/1 Archivo', letterSpacing: '-.01em', color: 'var(--c-text)' }}>ContentPro</span>
            <span style={{ font: "600 9px/1.4 'Space Grotesk'", letterSpacing: '.22em', color: 'var(--c-dim)' }}>CARD &amp; CAROUSEL STUDIO</span>
          </div>
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ font: "500 13px/1 'Space Grotesk'", color: 'var(--c-dim)' }}>
          {tpl.name + (isCar ? ' · ' + slides.length + ' slides · 1080×1350' : ' · 1080×1080')}
        </span>
        <button onClick={() => setUi(ui === 'light' ? 'dark' : 'light')} title={ui === 'light' ? 'Switch to dark' : 'Switch to light'} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--c-line2)', background: 'transparent', color: 'var(--c-dim2)', cursor: 'pointer', font: '16px/1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ui === 'light' ? '☽' : '☀'}</button>
        <button onClick={exportNow} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', cursor: exporting ? 'wait' : 'pointer', font: "700 13px/1 'Space Grotesk'", padding: '11px 18px', borderRadius: 10, background: 'var(--c-accent)', color: 'var(--c-accent-ink)', opacity: exporting ? 0.6 : 1 }}>
          {exporting ? <span style={{ width: 13, height: 13, border: '2px solid rgba(27,22,14,.35)', borderTopColor: '#1B160E', borderRadius: '50%', animation: 'cp-spin .7s linear infinite' }} /> : <span style={{ fontSize: 14 }}>↓</span>}
          {exporting ? 'Exporting…' : type === 'card' ? 'Export PNG' : 'Export PDF'}
        </button>
      </div>

      <div className="cp-body">
        {/* templates */}
        <aside className="cp-left" style={{ background: 'var(--c-panel)', borderRight: '1px solid var(--c-line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '16px 18px 12px', font: "700 11px/1 'Space Grotesk'", letterSpacing: '.16em', color: 'var(--c-dim)' }}>TEMPLATES</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {TEMPLATE_ORDER.map((tid) => {
                const on = a.template === tid;
                const sample: Slide = { template: tid, fields: templateDefaults(tid), bgImage: null };
                return (
                  <button key={tid} onClick={() => applyTemplate(tid)} title={TEMPLATES[tid].name} style={{ border: on ? '2px solid var(--c-accent)' : '1px solid var(--c-line2)', background: 'var(--c-chip)', borderRadius: 10, padding: 5, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                    {scaledCanvas(sample, cv.w, 88)}
                    <span style={{ font: "600 10px/1.1 'Space Grotesk'", color: on ? 'var(--c-accent-ink)' : 'var(--c-dim)', paddingLeft: 2 }}>{TEMPLATES[tid].name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* stage */}
        <main ref={stageAreaRef} className="cp-stage" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-stage)', position: 'relative' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '32px 0' }}>
            {isCar && active > 0 ? <button onClick={() => setActive(active - 1)} style={arrowStyle('left')}>‹</button> : null}
            {isCar && active < slides.length - 1 ? <button onClick={() => setActive(active + 1)} style={arrowStyle('right')}>›</button> : null}
            <div style={{ width: cv.w * scale, height: cv.h * scale, position: 'relative', animation: 'cp-fade .3s ease' }}>
              <div style={{ width: cv.w, height: cv.h, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, boxShadow: '0 30px 90px rgba(0,0,0,.35)' }}>
                <SlideCanvas slide={a} colors={colors} author={author} width={cv.w} height={cv.h} />
              </div>
            </div>
            {isCar ? <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', font: "600 12px/1 'Space Grotesk'", color: 'var(--c-dim)', letterSpacing: '.08em' }}>{active + 1 + ' / ' + slides.length}</div> : null}
          </div>

          {/* filmstrip */}
          {isCar ? (
            <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--c-line)', background: 'var(--c-filmstrip)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto' }}>
              {slides.map((s, i) => {
                const on = i === active;
                return (
                  <div key={i} draggable onClick={() => setActive(i)} onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => dragFrom !== null && move(dragFrom, i)} style={{ position: 'relative', flex: 'none', cursor: 'grab', borderRadius: 7, padding: 3, background: on ? 'var(--c-accent)' : 'transparent', border: on ? 'none' : '1px solid var(--c-line2)' }}>
                    {scaledCanvas(s, cv.w, 64)}
                    <span style={{ position: 'absolute', top: 1, left: 5, font: "700 9px/1 'Space Grotesk'", color: on ? 'var(--c-accent-ink)' : '#fff', textShadow: on ? 'none' : '0 1px 3px rgba(0,0,0,.8)' }}>{i + 1}</span>
                    {slides.length > 1 ? <button onClick={(e) => { e.stopPropagation(); delSlide(i); }} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: '#E1402B', color: '#fff', font: '11px/1 sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0 }}>×</button> : null}
                  </div>
                );
              })}
              <button onClick={addSlide} disabled={slides.length >= MAX_SLIDES} style={{ flex: 'none', width: 70, alignSelf: 'stretch', minHeight: 80, borderRadius: 7, border: '1.5px dashed var(--c-line2)', background: 'transparent', color: 'var(--c-dim)', cursor: slides.length >= MAX_SLIDES ? 'not-allowed' : 'pointer', font: '22px/1 Archivo', opacity: slides.length >= MAX_SLIDES ? 0.4 : 1 }}>+</button>
            </div>
          ) : null}
        </main>

        {/* inspector */}
        <aside className="cp-right" style={{ background: 'var(--c-panel)', borderLeft: '1px solid var(--c-line)', overflowY: 'auto' }}>
          {/* CONTENT */}
          <Section title={'CONTENT · ' + tpl.name}>
            {tpl.fields.map((fld) => (
              <Labeled key={fld.k} label={fld.l}>
                <FieldInput field={fld} value={a.fields[fld.k]} onChange={(v) => updateField(fld.k, v)} />
              </Labeled>
            ))}
          </Section>

          {/* THEME */}
          <Section title="THEME">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              {PALETTES.map((p) => {
                const on = paletteId === p.id && !customBg && !customText && !customAccent;
                return (
                  <button key={p.id} onClick={() => setPalette(p.id)} title={p.name} style={{ border: on ? '2px solid var(--c-accent)' : '1px solid var(--c-line2)', borderRadius: 9, padding: 0, cursor: 'pointer', overflow: 'hidden', height: 46, background: p.bg, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 16px/1 Archivo', color: p.text }}>Aa</div>
                    <div style={{ position: 'absolute', right: 6, bottom: 6, width: 12, height: 12, borderRadius: '50%', background: p.accent }} />
                  </button>
                );
              })}
            </div>
            <ColorRow label="Background" value={colors.bg} onChange={setCustomBg} />
            <ColorRow label="Text" value={colors.text} onChange={setCustomText} />
            <ColorRow label="Accent" value={colors.accent} onChange={setCustomAccent} />
            <button onClick={() => { setCustomBg(null); setCustomText(null); setCustomAccent(null); }} style={{ border: 'none', background: 'none', color: 'var(--c-dim)', font: "600 11px/1 'Space Grotesk'", cursor: 'pointer', padding: 0, marginTop: 4 }}>Reset ↺</button>
          </Section>

          {/* AUTHOR */}
          <Section title="AUTHOR">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              {author.avatar
                ? <div style={{ width: 46, height: 46, borderRadius: '50%', flex: 'none', backgroundImage: `url(${author.avatar})`, backgroundSize: 'cover' }} />
                : <div style={{ width: 46, height: 46, borderRadius: '50%', flex: 'none', background: 'var(--c-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-dim)', font: '700 18px/1 Archivo' }}>{(author.name || '?').charAt(0)}</div>}
              <label style={{ flex: 1 }}>
                <span style={{ display: 'block', padding: '9px 0', textAlign: 'center', border: '1px dashed var(--c-line2)', borderRadius: 9, color: 'var(--c-dim2)', font: "600 12px/1 'Space Grotesk'", cursor: 'pointer' }}>{author.avatar ? 'Change photo' : 'Upload photo'}</span>
                <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const url = await uploadImage(file); if (url) setAuthorField('avatar', url); } }} style={{ display: 'none' }} />
              </label>
              {author.avatar ? <button onClick={() => setAuthorField('avatar', null)} style={{ border: 'none', background: 'none', color: 'var(--c-dim)', cursor: 'pointer', font: '12px/1', flex: 'none' }}>×</button> : null}
            </div>
            <Labeled label="Name">
              <input type="text" value={author.name} onChange={(e) => setAuthorField('name', e.target.value)} style={inputStyle} />
            </Labeled>
            <Labeled label="Handle">
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--c-input)', border: '1px solid var(--c-line2)', borderRadius: 9, padding: '0 12px' }}>
                <span style={{ color: 'var(--c-dim)', font: "500 14px/1 'Space Grotesk'" }}>@</span>
                <input type="text" value={author.handle} onChange={(e) => setAuthorField('handle', e.target.value.replace(/^@/, ''))} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--c-text)', font: "500 14px/1 'Space Grotesk'", padding: '10px 6px', outline: 'none' }} />
              </div>
            </Labeled>
          </Section>

          {/* BACKGROUND IMAGE */}
          <Section title="BACKGROUND IMAGE">
            {a.bgImage ? <div style={{ height: 80, borderRadius: 10, backgroundImage: `url(${a.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: 10, position: 'relative' }}><div style={{ position: 'absolute', inset: 0, background: 'rgba(20,17,9,.35)', borderRadius: 10 }} /></div> : null}
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}>
                <span style={{ display: 'block', padding: '9px 0', textAlign: 'center', border: '1px dashed var(--c-line2)', borderRadius: 9, color: 'var(--c-dim2)', font: "600 12px/1 'Space Grotesk'", cursor: 'pointer' }}>{a.bgImage ? 'Replace' : 'Upload image'}</span>
                <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const url = await uploadImage(file); if (url) setBg(url, false); } }} style={{ display: 'none' }} />
              </label>
              {a.bgImage ? <button onClick={() => setBg(null, false)} style={{ flex: 'none', padding: '0 14px', border: '1px solid var(--c-line2)', borderRadius: 9, background: 'none', color: 'var(--c-dim2)', cursor: 'pointer', font: "600 12px/1 'Space Grotesk'" }}>Remove</button> : null}
            </div>
            {isCar && a.bgImage ? <button onClick={() => setBg(a.bgImage!, true)} style={{ marginTop: 8, width: '100%', padding: '8px 0', border: 'none', borderRadius: 9, background: 'var(--c-chip)', color: 'var(--c-dim2)', cursor: 'pointer', font: "600 11px/1 'Space Grotesk'" }}>Apply to all slides</button> : null}
            <div style={{ marginTop: 10, font: "500 11px/1.4 'Space Grotesk'", color: 'var(--c-dim)' }}>A dark scrim is added automatically so text stays readable.</div>
          </Section>
        </aside>
      </div>

      {/* offscreen export pool (full size, no transform ancestor) */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none', opacity: 0 }}>
        {slides.map((s, i) => (
          <div key={i} ref={(n) => { exportRefs.current[i] = n; }}>
            <SlideCanvas slide={s} colors={colors} author={author} width={cv.w} height={cv.h} />
          </div>
        ))}
      </div>

      {toast ? <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--c-text)', color: 'var(--c-app)', font: "700 13px/1 'Space Grotesk'", padding: '13px 22px', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,.35)', zIndex: 50, animation: 'cp-fade .3s ease' }}>{toast}</div> : null}
    </div>
  );
}

// ---- small UI pieces ----

const inputStyle: CSSProperties = { width: '100%', background: 'var(--c-input)', border: '1px solid var(--c-line2)', borderRadius: 9, color: 'var(--c-text)', font: "500 14px/1.4 'Space Grotesk'", padding: '10px 12px', outline: 'none', boxSizing: 'border-box' };

function arrowStyle(dir: 'left' | 'right'): CSSProperties {
  return { position: 'absolute', [dir]: 18, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--c-line2)', background: 'var(--c-panel)', color: 'var(--c-text)', cursor: 'pointer', font: '20px/1 Archivo', zIndex: 3, boxShadow: '0 6px 20px rgba(0,0,0,.12)' } as CSSProperties;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 18px', borderBottom: '1px solid var(--c-line)' }}>
      <div style={{ font: "700 11px/1 'Space Grotesk'", letterSpacing: '.16em', color: 'var(--c-dim2)', marginBottom: 14 }}>{title}</div>
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
    return <textarea value={v} rows={field.t === 'list' ? 5 : 3} onChange={(e) => onChange(field.t === 'list' ? e.target.value.split('\n') : e.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.4 }} />;
  }
  return <input type="text" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} style={{ width: 34, height: 34, borderRadius: 8, flex: 'none' }} />
      <span style={{ font: "500 12px/1 'Space Grotesk'", color: 'var(--c-dim2)', flex: 1 }}>{label}</span>
      <span style={{ font: "500 12px/1 'Space Grotesk'", color: 'var(--c-dim)' }}>{String(value).toUpperCase()}</span>
    </div>
  );
}
