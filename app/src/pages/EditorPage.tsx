import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { CardstockMark } from '@/components/Logo';
import Icon from '@/components/ui/Icon';
import { useSky } from '@/lib/sky';
import { canvasSize, type FieldValue, type FooterData, type LocalDesign, type ResolvedSlide, type Slide, type TemplateId } from '@/lib/design-types';
import { PALETTES, resolveColors } from '@/lib/palettes';
import { CATALOG_BY_ID, TEMPLATE_ORDER, TEMPLATES, templateDefaults } from '@/lib/templates';
import { DesignConflictError, MAX_IMAGE_BYTES, designStorageKey, getDesign, saveDesign, storagePressure } from '@/lib/local-store';
import { getImageUrl, newImageId, putImage, releaseImageUrls } from '@/lib/image-store';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';

const MAX_SLIDES = 15;

// Phone editor: four steps (owner, 14 Nov 2026): pick a template, write, check, export.
type MobileStep = 'template' | 'write' | 'preview' | 'export';
const MOBILE_STEPS: { id: MobileStep; label: string }[] = [
  { id: 'template', label: 'Template' },
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
  { id: 'export', label: 'Export' },
];

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
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
  const toast = useToast();
  const { user } = useAuth();
  const ownerId = user?.id;

  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [design, setDesign] = useState<LocalDesign | null>(null);
  const [profile, setProfile] = useState<Profile>({});
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);
  // The editor's light/dark follows the app-wide sky (src/lib/sky.ts).
  const [sky, setSky] = useSky();
  const ui: 'light' | 'dark' = sky === 'night' ? 'dark' : 'light';
  const setUi = (next: 'light' | 'dark') => setSky(next === 'dark' ? 'night' : 'day');
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState<{ done: number; total: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [scale, setScale] = useState(0.35);
  const [mobileStep, setMobileStep] = useState<MobileStep>('write');
  const [tplOpen, setTplOpen] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [filmEl, setFilmEl] = useState<HTMLDivElement | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ from: number; over: number } | null>(null);
  const moveRef = useRef<(from: number, to: number) => void>(() => {});
  const isMobile = useMediaQuery('(max-width: 743px)');

  useEffect(() => {
    if (!ownerId) return;
    return () => releaseImageUrls(ownerId);
  }, [ownerId]);

  const stageAreaRef = useRef<HTMLDivElement>(null);
  const mobileStageRef = useRef<HTMLDivElement>(null);
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);
  const dirty = useRef(false);
  const pendingSave = useRef(false);
  const conflict = useRef(false);
  const savedRevision = useRef<number | null>(null);
  // latest design/active kept in refs so unmount + stable callbacks can read
  // them without re-subscribing. Written after commit (not during render):
  // every reader -- the unload/unmount flush and the memoised template picker
  // -- runs after paint, so the committed value is always the current one.
  const designRef = useRef<LocalDesign | null>(null);
  const activeRef = useRef(0);
  useEffect(() => {
    designRef.current = design;
    activeRef.current = active;
  });

  // stable so the memoised TemplatePicker doesn't re-render on every keystroke
  const onPickTemplate = useCallback((tid: TemplateId) => {
    setDesign((d) => (d ? { ...d, slides: d.slides.map((sl, i) => (i === activeRef.current ? { ...sl, template: tid, fields: templateDefaults(tid) } : sl)) } : d));
  }, []);
  const onPickTemplateAndClose = useCallback((tid: TemplateId) => {
    onPickTemplate(tid);
    setTplOpen(false);
  }, [onPickTemplate]);

  // ---- touch reorder: hold a slide ~350ms, then drag it along the strip ----
  useEffect(() => {
    if (!filmEl) return;
    let state: { from: number; over: number; x: number; y: number; active: boolean; timer: number } | null = null;
    const indexAt = (x: number, y: number): number | null => {
      const hit = document.elementFromPoint(x, y)?.closest('[data-slide-index]');
      return hit ? Number(hit.getAttribute('data-slide-index')) : null;
    };
    const onStart = (event: TouchEvent) => {
      const thumb = (event.target as Element).closest('[data-slide-index]');
      if (!thumb || event.touches.length !== 1) return;
      const from = Number(thumb.getAttribute('data-slide-index'));
      const touch = event.touches[0];
      const next = { from, over: from, x: touch.clientX, y: touch.clientY, active: false, timer: 0 };
      next.timer = window.setTimeout(() => {
        next.active = true;
        setTouchDrag({ from, over: from });
        navigator.vibrate?.(12);
      }, 350);
      state = next;
    };
    const onMove = (event: TouchEvent) => {
      if (!state) return;
      const touch = event.touches[0];
      if (!state.active) {
        // Moved before the hold finished: the user is scrolling the strip.
        if (Math.hypot(touch.clientX - state.x, touch.clientY - state.y) > 8) {
          window.clearTimeout(state.timer);
          state = null;
        }
        return;
      }
      event.preventDefault();
      const over = indexAt(touch.clientX, touch.clientY);
      if (over !== null && over !== state.over) {
        state.over = over;
        setTouchDrag({ from: state.from, over });
      }
    };
    const onEnd = (event: TouchEvent) => {
      const done = state;
      state = null;
      if (!done) return;
      window.clearTimeout(done.timer);
      if (!done.active) return;
      // A finished drag must not also count as a tap on the slide.
      event.preventDefault();
      setTouchDrag(null);
      if (done.over !== done.from) moveRef.current(done.from, done.over);
    };
    filmEl.addEventListener('touchstart', onStart, { passive: true });
    filmEl.addEventListener('touchmove', onMove, { passive: false });
    filmEl.addEventListener('touchend', onEnd, { passive: false });
    filmEl.addEventListener('touchcancel', onEnd, { passive: false });
    return () => {
      if (state) window.clearTimeout(state.timer);
      filmEl.removeEventListener('touchstart', onStart);
      filmEl.removeEventListener('touchmove', onMove);
      filmEl.removeEventListener('touchend', onEnd);
      filmEl.removeEventListener('touchcancel', onEnd);
    };
  }, [filmEl]);

  // ---- load design (localStorage) + profile (server) ----
  useEffect(() => {
    if (!id || !ownerId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      dirty.current = false;
      pendingSave.current = false;
      conflict.current = false;
      savedRevision.current = null;
      setSaveConflict(false);
      setImgUrls({});
      let d: LocalDesign | null;
      try { d = getDesign(ownerId, id); }
      catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not read this design.');
        setNotFound(true); setLoaded(true); return;
      }
      if (!d) { setNotFound(true); setLoaded(true); return; }
      savedRevision.current = d.updatedAt;
      setNotFound(false);
      setDesign(d);
      setLoaded(true);
      fetch('/api/profile', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => { if (!cancelled && p) setProfile(p); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ownerId]);

  // resolve any referenced image ids -> object URLs
  useEffect(() => {
    if (!design || !ownerId) return;
    const ids = new Set<string>();
    for (const s of design.slides) if (s.bgImageId) ids.add(s.bgImageId);
    if (design.authorOverride?.avatarImageId) ids.add(design.authorOverride.avatarImageId);
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const iid of ids) {
        if (imgUrls[iid]) { next[iid] = imgUrls[iid]; continue; }
        const url = await getImageUrl(ownerId, iid);
        if (url) next[iid] = url;
      }
      if (!cancelled) setImgUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, ownerId]);

  // ---- autosave to localStorage (debounced) ----
  useEffect(() => {
    if (!loaded || !design || !ownerId) return;
    if (!dirty.current) { dirty.current = true; return; }
    if (conflict.current) return;
    pendingSave.current = true;
    const t = setTimeout(() => {
      storagePressure().then((p) => { if (p && p.ratio > 0.85) toast.info('Your browser storage is getting full — back up and remove old designs.'); }).catch(() => {});
      try {
        const saved = saveDesign(ownerId, design, savedRevision.current ?? undefined);
        savedRevision.current = saved.updatedAt;
        if (designRef.current === design) pendingSave.current = false;
      } catch (e) {
        if (e instanceof DesignConflictError) { conflict.current = true; setSaveConflict(true); }
        toast.error(e instanceof Error ? e.message : "Couldn't save your design.");
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, ownerId]);

  // Flush the pending debounced save on unmount / tab-close so the last few
  // keystrokes before leaving the editor are never lost (there is no manual
  // Save button in this browser-only model).
  useEffect(() => {
    const flush = () => {
      if (!ownerId || !pendingSave.current || conflict.current || !designRef.current) return;
      try {
        const saved = saveDesign(ownerId, designRef.current, savedRevision.current ?? undefined);
        savedRevision.current = saved.updatedAt;
        pendingSave.current = false;
      } catch { /* The editor's debounced path reports save failures. */ }
    };
    window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('beforeunload', flush); flush(); };
  }, [ownerId]);

  // Changes from another tab arrive before the next debounced save in the
  // usual case. The expected revision check above remains the final guard.
  useEffect(() => {
    if (!ownerId || !id) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== designStorageKey(ownerId)) return;
      try {
        const latest = getDesign(ownerId, id);
        if (!latest || latest.updatedAt !== savedRevision.current) {
          conflict.current = true;
          setSaveConflict(true);
        }
      } catch {
        conflict.current = true;
        setSaveConflict(true);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [ownerId, id]);

  const cv = design ? canvasSize(design.type) : { w: 1080, h: 1080 };
  const colors = resolveColors(design?.paletteId ?? 'ink', { bg: design?.customBg, text: design?.customText, accent: design?.customAccent });

  // effective footer = per-design override, else profile, else placeholder
  const overrideAvatar = design?.authorOverride?.avatarImageId ? imgUrls[design.authorOverride.avatarImageId] : null;
  const footerData: FooterData = {
    // `||`, not `??`: an emptied override field ('') signs from the profile, as the
    // Author panel says, instead of printing the "Your name" placeholder.
    name: design?.authorOverride?.name || profile.name || '',
    handle: design?.authorOverride?.handle || profile.handle || '',
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
  }, [measure, loaded, mobileStep]);

  // ---- helpers ----
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
  useEffect(() => {
    moveRef.current = move;
  });
  function setBg(imageId: string | null, all?: boolean) {
    if (!design) return;
    if (design.type === 'card') { patchSlides((s) => s.map((sl, i) => (i === 0 ? { ...sl, bgImageId: imageId } : sl))); return; }
    if (all) patchSlides((s) => s.map((sl) => ({ ...sl, bgImageId: imageId })));
    else patchSlides((s) => s.map((sl, i) => (i === active ? { ...sl, bgImageId: imageId } : sl)));
  }

  async function storeImage(file: File): Promise<string | null> {
    if (!ownerId) return null;
    if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) {
      toast.error('Choose an image smaller than 8 MB.');
      return null;
    }
    const iid = newImageId();
    try {
      await putImage(ownerId, iid, file);
    } catch {
      toast.error("Couldn't save that image — your browser storage may be full.");
      return null;
    }
    try {
      const url = await getImageUrl(ownerId, iid);
      if (url) setImgUrls((prev) => ({ ...prev, [iid]: url }));
    } catch {
      toast.info("Saved the image, but couldn't show a preview.");
    }
    return iid;
  }

  async function exportNow(format: 'pdf' | 'png-zip' = 'pdf') {
    if (exporting || !design) return;
    setExporting(true);
    setExportStep(null);
    try {
      // Let React flush any just-applied change (e.g. a background swapped a
      // moment ago) into the offscreen export pool before we read its nodes.
      // A short timeout (not requestAnimationFrame -- browsers pause rAF in
      // hidden/background tabs, which would hang the export) is enough for the
      // pending commit + paint to land.
      await new Promise<void>((r) => setTimeout(r, 50));
      const nodes = exportRefs.current.filter((n): n is HTMLDivElement => n !== null);
      const { exportCardAsPng, exportCarouselAsPdf, exportCarouselAsPngZip, downloadBlob } = await import('@/lib/export');
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
        toast.success('PNG downloaded.');
      } else if (format === 'png-zip') {
        const blob = await exportCarouselAsPngZip(nodes, cv.w, cv.h, (done, total) => setExportStep({ done, total }));
        downloadBlob(blob, `${base}-${stamp}-slides.zip`);
        toast.success(`PNG slides downloaded — ${design.slides.length} image${design.slides.length === 1 ? '' : 's'}.`);
      } else {
        const blob = await exportCarouselAsPdf(nodes, cv.w, cv.h, (done, total) => setExportStep({ done, total }));
        downloadBlob(blob, `${base}-${stamp}.pdf`);
        toast.success(`PDF downloaded — ${design.slides.length} slide${design.slides.length === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed. If you use a profile photo or company logo, try re-uploading it, then export again.');
    }
    setExporting(false);
    setExportStep(null);
  }

  if (!loaded) {
    return <div className="cp" data-ui={ui} style={centerBox}>Loading editor…</div>;
  }
  if (notFound || !design) {
    return (
      <div className="cp" data-ui={ui} style={{ ...centerBox, flexDirection: 'column', gap: 16, textAlign: 'center', padding: 24 }}>
        <div style={{ font: '800 20px/1.3 Archivo' }}>Design not found</div>
        <div style={{ font: "500 14px/1.5 var(--font-ui)", color: 'var(--c-dim2)', maxWidth: 420 }}>Designs live in this browser. This one may have been created on another device or removed.</div>
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
      onPick={onPickTemplateAndClose}
    />
  );

  const contentPanel = (
    <Section
      title={'CONTENT · ' + tpl.name}
      action={
        <button
          onClick={clearFields}
          title="Clear the example text so you can type your own"
          style={{ border: '1px solid var(--c-line2)', background: 'var(--c-chip)', color: 'var(--c-dim2)', font: "600 10px/1 var(--font-ui)", letterSpacing: '.04em', cursor: 'pointer', padding: '6px 10px', borderRadius: 7 }}
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
          <span style={{ font: "600 10px/1 var(--font-ui)", letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--c-dim)' }}>Text size</span>
          {(headingScale !== 1 || bodyScale !== 1 || footerScale !== 1)
            ? <button onClick={() => patch({ headingScale: 1, bodyScale: 1, footerScale: 1 })} style={linkBtn} title="Reset all to 100%">Reset all ↺</button>
            : null}
        </div>
        {([['headingScale', 'Heading', headingScale], ['bodyScale', 'Body', bodyScale], ['footerScale', 'Footer', footerScale]] as [ScaleKey, string, number][]).map(([key, label, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 58, flex: 'none', font: "600 12px/1 var(--font-ui)", color: 'var(--c-dim2)' }}>{label}</span>
            <button onClick={() => bumpScale(key, -0.05)} disabled={val <= 0.7} aria-label={`Decrease ${label} size`} style={txtStepBtn(val <= 0.7)}>A−</button>
            <span style={{ flex: 1, textAlign: 'center', font: "700 12px/1 var(--font-ui)", color: 'var(--c-dim2)' }}>{Math.round(val * 100)}%</span>
            <button onClick={() => bumpScale(key, 0.05)} disabled={val >= 1.4} aria-label={`Increase ${label} size`} style={txtStepBtn(val >= 1.4)}>A+</button>
          </div>
        ))}
        <div style={{ marginTop: 6, font: "500 11px/1.4 var(--font-ui)", color: 'var(--c-dim)' }}>Heading, body and footer scale independently.</div>
      </div>
    </Section>
  );

  const themePanel = (
    <Section title="THEME">
      <button type="button" className="cp-theme-mobile-toggle" onClick={() => setUi(ui === 'light' ? 'dark' : 'light')}>
        Switch editor to {ui === 'light' ? 'dark' : 'light'} mode
      </button>
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
      <div style={{ font: "500 11px/1.5 var(--font-ui)", color: 'var(--c-dim)', marginBottom: 12 }}>
        {usingProfileAuthor ? 'Signed from your profile. Edit here to override just this design.' : 'Overridden for this design.'}
      </div>
      <Labeled label="Name">
        <input type="text" value={design.authorOverride?.name ?? profile.name ?? ''} placeholder={profile.name || 'Your name'} onChange={(e) => setAuthorOverride('name', e.target.value)} style={inputStyle} />
      </Labeled>
      <Labeled label="Handle">
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--c-input)', border: '1px solid var(--c-line2)', borderRadius: 9, padding: '0 12px' }}>
          <span style={{ color: 'var(--c-dim)', font: "500 14px/1 var(--font-ui)" }}>@</span>
          <input type="text" value={design.authorOverride?.handle ?? profile.handle ?? ''} placeholder={profile.handle || 'yourhandle'} onChange={(e) => setAuthorOverride('handle', e.target.value.replace(/^@/, ''))} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--c-text)', font: "500 14px/1 var(--font-ui)", padding: '10px 6px' }} />
        </div>
      </Labeled>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="file-trigger" style={{ flex: 1 }}>
          <span style={{ display: 'block', padding: '9px 0', textAlign: 'center', border: '1px dashed var(--c-line2)', borderRadius: 9, color: 'var(--c-dim2)', font: "600 12px/1 var(--font-ui)", cursor: 'pointer' }}>Override photo</span>
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
          <span style={{ display: 'block', padding: '9px 0', textAlign: 'center', border: '1px dashed var(--c-line2)', borderRadius: 9, color: 'var(--c-dim2)', font: "600 12px/1 var(--font-ui)", cursor: 'pointer' }}>{a.bgImageId ? 'Replace' : 'Upload image'}</span>
          <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const iid = await storeImage(f); if (iid) setBg(iid, false); } }} className="visually-hidden" />
        </label>
        {a.bgImageId ? <button onClick={() => setBg(null, false)} style={{ flex: 'none', padding: '0 14px', border: '1px solid var(--c-line2)', borderRadius: 9, background: 'none', color: 'var(--c-dim2)', cursor: 'pointer', font: "600 12px/1 var(--font-ui)" }}>Remove</button> : null}
      </div>
      {isCar && a.bgImageId ? <button onClick={() => setBg(a.bgImageId!, true)} style={{ marginTop: 8, width: '100%', padding: '8px 0', border: 'none', borderRadius: 9, background: 'var(--c-chip)', color: 'var(--c-dim2)', cursor: 'pointer', font: "600 11px/1 var(--font-ui)" }}>Apply to all slides</button> : null}
      <div style={{ marginTop: 10, font: "500 11px/1.4 var(--font-ui)", color: 'var(--c-dim)' }}>A dark scrim is added automatically so text stays readable.</div>
    </Section>
  );

  const filmstripBar = isCar ? (
    <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--c-line)', background: 'var(--c-filmstrip)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div role="group" aria-label="Reorder or delete the current slide" style={{ display: 'flex', gap: 6, flex: 'none' }}>
        <button onClick={() => move(active, active - 1)} disabled={active === 0} aria-label="Move slide earlier" title="Move slide earlier" style={filmCtrl(active === 0)}>‹</button>
        <button onClick={() => move(active, active + 1)} disabled={active >= design.slides.length - 1} aria-label="Move slide later" title="Move slide later" style={filmCtrl(active >= design.slides.length - 1)}>›</button>
        <button onClick={() => delSlide(active)} disabled={design.slides.length <= 1} aria-label="Delete current slide" title="Delete current slide" style={{ ...filmCtrl(design.slides.length <= 1), color: 'var(--c-danger)' }}>×</button>
      </div>
      <div ref={setFilmEl} className="cp-film" style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto', flex: 1, minWidth: 0 }}>
        {design.slides.map((s, i) => {
          const on = i === active;
          const dragging = touchDrag?.from === i;
          const target = touchDrag !== null && touchDrag.over === i && touchDrag.from !== i;
          return (
            <button key={i} type="button" draggable data-slide-index={i} data-dragging={dragging || undefined} data-drop={target || undefined} aria-label={`Slide ${i + 1}${on ? ' (current)' : ''}`} aria-current={on ? true : undefined} onClick={() => setActive(i)} onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => dragFrom !== null && move(dragFrom, i)} style={{ position: 'relative', flex: 'none', cursor: 'grab', borderRadius: 7, padding: 3, background: on ? 'var(--c-accent)' : 'transparent', border: on ? 'none' : '1px solid var(--c-line2)' }}>
              {scaledCanvas(s, 64)}
              <span style={{ position: 'absolute', top: 1, left: 5, font: "700 9px/1 var(--font-ui)", color: on ? 'var(--c-accent-ink)' : '#fff', textShadow: on ? 'none' : '0 1px 3px rgba(0,0,0,.8)' }}>{i + 1}</span>
            </button>
          );
        })}
        <button onClick={addSlide} disabled={design.slides.length >= MAX_SLIDES} aria-label="Add slide" title="Add slide" style={{ flex: 'none', width: 70, alignSelf: 'stretch', minHeight: 80, borderRadius: 7, border: '1.5px dashed var(--c-line2)', background: 'transparent', color: 'var(--c-dim)', cursor: design.slides.length >= MAX_SLIDES ? 'not-allowed' : 'pointer', font: '22px/1 Archivo', opacity: design.slides.length >= MAX_SLIDES ? 0.4 : 1 }}>+</button>
      </div>
    </div>
  ) : null;

  const desktopBody = (
    <div className="cp-body">
      <button type="button" className={'cp-scrim' + (tplOpen ? ' is-open' : '')} aria-label="Close templates" onClick={() => setTplOpen(false)} />
      <aside className={'cp-left' + (tplOpen ? ' is-open' : '')} style={{ background: 'var(--c-panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 14px 10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: "700 11px/1 var(--font-ui)", letterSpacing: '.16em', color: 'var(--c-dim)' }}>
          TEMPLATES
          <button type="button" className="btn btn--sm btn--glass btn--icon cp-left-close" aria-label="Close templates" onClick={() => setTplOpen(false)}><Icon name="x" /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 18px' }}>{templatePicker}</div>
      </aside>

      <main ref={stageAreaRef} className="cp-stage" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-stage)', position: 'relative' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '32px 0' }}>
          {isCar && active > 0 ? <button onClick={() => setActive(active - 1)} style={arrowStyle('left')}>‹</button> : null}
          {isCar && active < design.slides.length - 1 ? <button onClick={() => setActive(active + 1)} style={arrowStyle('right')}>›</button> : null}
          {stageCanvas}
          {isCar ? <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', font: "600 12px/1 var(--font-ui)", color: 'var(--c-dim)', letterSpacing: '.08em' }}>{active + 1 + ' / ' + design.slides.length}</div> : null}
        </div>
        {filmstripBar}
      </main>

      <aside className="cp-right" style={{ background: 'var(--c-panel)', overflowY: 'auto' }}>
        {contentPanel}
        {themePanel}
        {authorPanel}
        {backgroundPanel}
      </aside>
    </div>
  );

  const exportingLabel = exportStep ? `Exporting ${exportStep.done} / ${exportStep.total}…` : 'Exporting…';
  const stepIndex = MOBILE_STEPS.findIndex((step) => step.id === mobileStep);
  const prevStep = stepIndex > 0 ? MOBILE_STEPS[stepIndex - 1] : null;
  const nextStep = stepIndex < MOBILE_STEPS.length - 1 ? MOBILE_STEPS[stepIndex + 1] : null;
  const paletteName = design.customBg || design.customText || design.customAccent ? 'Custom' : (PALETTES.find((p) => p.id === design.paletteId)?.name ?? '');

  const mobileStage = (
    <div className="cp-mstage" ref={mobileStageRef}>
      {isCar && active > 0 ? <button onClick={() => setActive(active - 1)} aria-label="Previous slide" style={mArrow('left')}>‹</button> : null}
      {isCar && active < design.slides.length - 1 ? <button onClick={() => setActive(active + 1)} aria-label="Next slide" style={mArrow('right')}>›</button> : null}
      {stageCanvas}
      {isCar ? <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', font: '600 11px/1 var(--font-ui)', color: 'var(--c-dim)', letterSpacing: '.08em' }}>{active + 1 + ' / ' + design.slides.length}</div> : null}
    </div>
  );

  const mobileBody = (
    <div className="med">
      <div className="med__steps glass" role="tablist" aria-label="Steps">
        {MOBILE_STEPS.map((step, i) => (
          <button key={step.id} type="button" role="tab" aria-selected={mobileStep === step.id} onClick={() => setMobileStep(step.id)}>
            <b>{i + 1}</b>{step.label}
          </button>
        ))}
      </div>

      {mobileStep === 'template' && (
        <div className="med__panel" role="tabpanel">
          <div className="med__sheet glass-strong" style={{ padding: 14 }}>{templatePicker}</div>
        </div>
      )}

      {mobileStep === 'write' && (
        <div className="med__panel" role="tabpanel">
          {mobileStage}
          {filmstripBar ? <div className="med__filmstrip glass-strong">{filmstripBar}</div> : null}
          {isCar ? <p className="hint" style={{ margin: '-4px 4px 0' }}>Tip: hold a slide, then drag it to a new place.</p> : null}
          <div className="med__sheet glass-strong">
            {contentPanel}
            <details className="fold">
              <summary><Icon name="palette" /> Theme <small>{paletteName}</small><Icon name="chevron-down" /></summary>
              {themePanel}
            </details>
            <details className="fold">
              <summary><Icon name="user" /> Author <small>{usingProfileAuthor ? 'From your profile' : 'Overridden'}</small><Icon name="chevron-down" /></summary>
              {authorPanel}
            </details>
            <details className="fold">
              <summary><Icon name="image" /> Background <small>{a.bgImageId ? 'Photo' : 'None'}</small><Icon name="chevron-down" /></summary>
              {backgroundPanel}
            </details>
          </div>
        </div>
      )}

      {mobileStep === 'preview' && (
        <div className="med__panel med__panel--preview" role="tabpanel">
          {mobileStage}
          <p className="hint" style={{ textAlign: 'center', margin: 0 }}>{isCar ? 'Check every slide before you export.' : 'This is exactly what downloads.'}</p>
        </div>
      )}

      {mobileStep === 'export' && (
        <div className="med__panel" role="tabpanel">
          <div className="exp">
            {isCar ? (
              <>
                <button type="button" className="surface" disabled={exporting} onClick={() => { void exportNow('pdf'); }}>
                  <span><Icon name="file" /></span>
                  <span><b>PDF for LinkedIn</b><small>One swipeable document · {design.slides.length} pages</small></span>
                  <Icon name="download" />
                </button>
                <button type="button" className="surface" disabled={exporting} onClick={() => { void exportNow('png-zip'); }}>
                  <span><Icon name="zip" /></span>
                  <span><b>PNG slides ZIP</b><small>For Facebook · images in slide order</small></span>
                  <Icon name="download" />
                </button>
              </>
            ) : (
              <button type="button" className="surface" disabled={exporting} onClick={() => { void exportNow(); }}>
                <span><Icon name="image" /></span>
                <span><b>PNG image</b><small>1080 × 1080 · ready for any feed</small></span>
                <Icon name="download" />
              </button>
            )}
          </div>
          <p className="hint" style={{ margin: 0 }}>{exporting ? exportingLabel : 'Made on your device. Nothing is uploaded.'}</p>
        </div>
      )}

      <div className="med__act glass-strong">
        {prevStep ? (
          <button type="button" className="btn btn--glass btn--lg" onClick={() => setMobileStep(prevStep.id)}><Icon name="arrow-left" /> {prevStep.label}</button>
        ) : (
          <button type="button" className="btn btn--glass btn--lg" onClick={() => navigate('/dashboard')}><Icon name="arrow-left" /> Designs</button>
        )}
        {nextStep ? (
          <button type="button" className="btn btn--primary btn--lg" onClick={() => setMobileStep(nextStep.id)}>Next: {nextStep.label} <Icon name="arrow-right" /></button>
        ) : (
          <button type="button" className="btn btn--primary btn--lg" disabled={exporting} onClick={() => { void exportNow(isCar ? 'pdf' : undefined); }}>
            <Icon name="download" /> {exporting ? exportingLabel : isCar ? 'Download PDF' : 'Download PNG'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="cp" data-ui={ui} style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--c-app)', color: 'var(--c-text)', overflow: 'hidden' }}>
      {/* top bar */}
      <div className="cp-topbar" style={{ position: 'relative', zIndex: 50, display: 'flex', alignItems: 'center', gap: 16, height: 60, flex: '0 0 60px', padding: '0 20px', background: 'var(--c-bar)', borderBottom: '1px solid var(--c-line)' }}>
        <button onClick={() => navigate('/dashboard')} title="Back to dashboard" aria-label="Back to dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--c-text)', padding: '0 4px', minHeight: 44 }}>
          <Icon name="arrow-left" />
          <CardstockMark size={30} />
          <div className="cp-brand-name" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, textAlign: 'left' }}>
            <span style={{ font: '800 16px/1 Archivo', color: 'var(--c-text)' }}>Cardstock</span>
            <span className="cp-logosub" style={{ font: "600 9px/1.4 var(--font-ui)", letterSpacing: '.22em', color: 'var(--c-dim)' }}>CARD &amp; CAROUSEL STUDIO</span>
          </div>
        </button>
        <input
          type="text"
          value={design.title ?? ''}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Untitled design"
          aria-label="Design title"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: '1px solid var(--c-line2)', borderRadius: 8, color: 'var(--c-text)', font: "700 14px/1 var(--font-ui)", padding: '10px 12px' }}
        />
        <span className="cp-topstatus" style={{ font: "500 13px/1 var(--font-ui)", color: 'var(--c-dim)', flex: 'none', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name + (isCar ? ' · ' + design.slides.length + ' slides · 1080×1350' : ' · 1080×1080')}</span>
        <button type="button" className="btn btn--glass cp-tpl-toggle" aria-expanded={tplOpen} onClick={() => setTplOpen(true)}><Icon name="grid" /> Templates</button>
        <button className="cp-theme-toggle" onClick={() => setUi(ui === 'light' ? 'dark' : 'light')} title={ui === 'light' ? 'Switch to dark' : 'Switch to light'} aria-label={ui === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid var(--c-line2)', background: 'transparent', color: 'var(--c-dim2)', cursor: 'pointer', font: '16px/1', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{ui === 'light' ? <Icon name="moon" /> : <Icon name="sun" />}</button>
        <div className="cp-export">
        {isCar ? (
          <details ref={exportMenuRef} style={{ position: 'relative', flex: 'none', zIndex: 40 }}>
            <summary
              aria-label="Export carousel"
              onClick={(e) => { if (exporting) e.preventDefault(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, listStyle: 'none', border: 'none', cursor: exporting ? 'wait' : 'pointer', font: "700 13px/1 var(--font-ui)", padding: '14px 18px', borderRadius: 10, background: 'var(--c-accent)', color: 'var(--c-accent-ink)', opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? exportingLabel : 'Export ▾'}
            </summary>
            <div className="cp-export-menu glass-strong">
              <button type="button" className="cp-export-item" disabled={exporting} onClick={() => { if (exportMenuRef.current) exportMenuRef.current.open = false; void exportNow('pdf'); }}><span><Icon name="file" /></span><span><b>PDF for LinkedIn</b><small>One swipeable document · {design.slides.length} pages</small></span></button>
              <button type="button" className="cp-export-item" disabled={exporting} onClick={() => { if (exportMenuRef.current) exportMenuRef.current.open = false; void exportNow('png-zip'); }}><span><Icon name="zip" /></span><span><b>PNG slides ZIP for Facebook</b><small>Separate images in slide order</small></span></button>
            </div>
          </details>
        ) : (
          <button onClick={() => { void exportNow(); }} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', cursor: exporting ? 'wait' : 'pointer', font: "700 13px/1 var(--font-ui)", padding: '12px 18px', borderRadius: 10, background: 'var(--c-accent)', color: 'var(--c-accent-ink)', opacity: exporting ? 0.6 : 1, flex: 'none' }}>
            {exporting ? <span style={{ width: 13, height: 13, border: '2px solid color-mix(in srgb, var(--c-accent-ink) 35%, transparent)', borderTopColor: 'var(--c-accent-ink)', borderRadius: '50%', animation: 'cp-spin .7s linear infinite' }} /> : <span style={{ fontSize: 14 }}>↓</span>}
            {exporting ? exportingLabel : 'Export PNG'}
          </button>
        )}
        </div>
      </div>

      {saveConflict && (
        <div role="alert" style={{ padding: '10px 20px', background: 'var(--c-chip)', color: 'var(--c-text)', borderBottom: '1px solid var(--c-line)' }}>
          Another tab saved this design. Your current edits are still visible here but were not saved. Export them if needed, then reload before editing further.
        </div>
      )}

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
    </div>
  );
}

const centerBox: CSSProperties = { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-app)', color: 'var(--c-dim)', font: "600 14px/1 var(--font-ui)" };
const inputStyle: CSSProperties = { width: '100%', background: 'var(--c-input)', border: '1px solid var(--c-line2)', borderRadius: 9, color: 'var(--c-text)', font: "500 14px/1.4 var(--font-ui)", padding: '10px 12px', boxSizing: 'border-box' };
function filmCtrl(disabled: boolean): CSSProperties {
  return { width: 40, height: 40, flex: 'none', borderRadius: 9, border: '1px solid var(--c-line2)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: disabled ? 'not-allowed' : 'pointer', font: '20px/1 Archivo', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 };
}
const linkBtn: CSSProperties = { border: 'none', background: 'none', color: 'var(--c-dim)', font: "600 11px/1 var(--font-ui)", cursor: 'pointer', padding: 0, marginTop: 4 };
function txtStepBtn(disabled: boolean): CSSProperties {
  return { flex: 'none', width: 40, height: 34, borderRadius: 8, border: '1px solid var(--c-line2)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: disabled ? 'not-allowed' : 'pointer', font: "700 13px/1 var(--font-ui)", opacity: disabled ? 0.4 : 1 };
}
const accentPill: CSSProperties = { border: 'none', cursor: 'pointer', font: "700 13px/1 var(--font-ui)", padding: '12px 20px', borderRadius: 10, background: 'var(--c-accent)', color: 'var(--c-accent-ink)' };
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
        <div style={{ font: "700 11px/1 var(--font-ui)", letterSpacing: '.16em', color: 'var(--c-dim2)' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', font: "600 10px/1 var(--font-ui)", letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--c-dim)', marginBottom: 7 }}>{label}</span>
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
      <span style={{ font: "500 12px/1 var(--font-ui)", color: 'var(--c-dim2)', flex: 1 }}>{label}</span>
      <span style={{ font: "500 12px/1 var(--font-ui)", color: 'var(--c-dim)' }}>{String(value).toUpperCase()}</span>
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

// Memoised so editing a slide doesn't rebuild the template picker.
const TemplatePicker = memo(function TemplatePicker(props: TemplatePickerProps) {
  const { activeTemplate, bg, text, accent, name, handle, avatar, designation, companyName, companyLogo, cvW, cvH, onPick } = props;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = ['All', 'Originals', 'Learning & Guides', 'Data & Comparisons', 'Career & Community', 'Business & Events'];
  const visibleTemplates = TEMPLATE_ORDER.filter((id) => {
    const catalog = CATALOG_BY_ID.get(id);
    const group = catalog?.group ?? 'Originals';
    return (category === 'All' || group === category)
      && `${TEMPLATES[id].name} ${catalog?.description ?? ''} ${group}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  return (
    <div>
      <input type="search" aria-label="Search templates" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 100 templates…" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 9 }} />
      <select aria-label="Template category" value={category} onChange={(event) => setCategory(event.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 12 }}>
        {categories.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {visibleTemplates.map((tid) => {
        const on = activeTemplate === tid;
        return (
          <button key={tid} onClick={() => onPick(tid)} title={TEMPLATES[tid].name} aria-pressed={on} style={{ border: on ? '2px solid var(--c-accent)' : '1px solid var(--c-line2)', background: 'var(--c-chip)', borderRadius: 10, padding: 5, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <TemplateThumbnail tid={tid} bg={bg} text={text} accent={accent} name={name} handle={handle} avatar={avatar} designation={designation} companyName={companyName} companyLogo={companyLogo} cvW={cvW} cvH={cvH} />
            <span style={{ font: "600 10px/1.1 var(--font-ui)", color: on ? 'var(--c-accent-ink)' : 'var(--c-dim)', paddingLeft: 2 }}>{TEMPLATES[tid].name}</span>
          </button>
        );
      })}
      </div>
      {visibleTemplates.length === 0 && <p style={{ font: "500 12px/1.4 var(--font-ui)", color: 'var(--c-dim)' }}>No templates match this search.</p>}
    </div>
  );
});

const TemplateThumbnail = memo(function TemplateThumbnail(props: Omit<TemplatePickerProps, 'activeTemplate' | 'onPick'> & { tid: TemplateId }) {
  const { tid, bg, text, accent, name, handle, avatar, designation, companyName, companyLogo, cvW, cvH } = props;
  const previewRef = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = previewRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      setNearby(entries.some((entry) => entry.isIntersecting));
    }, { rootMargin: '180px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={previewRef} style={{ width: 88, aspectRatio: cvW + '/' + cvH, borderRadius: 5, overflow: 'hidden', position: 'relative', background: bg }}>
      {nearby && (
        <div style={{ width: cvW, height: cvH, transform: `scale(${88 / cvW})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <SlideCanvas
            slide={{ template: tid, fields: templateDefaults(tid), bgImage: null }}
            colors={{ bg, text, accent }}
            footer={{ name, handle, avatar, designation, companyName, companyLogo }}
            width={cvW}
            height={cvH}
          />
        </div>
      )}
    </div>
  );
});
