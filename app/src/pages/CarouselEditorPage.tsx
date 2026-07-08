import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import SlideCanvas, { DEFAULT_CAROUSEL_STYLE, newContentSlide, defaultSlides, type Slide, type CarouselStyle } from '@/components/editor/CarouselSlides';
import { StyleControls, PalettePicker } from '@/components/editor/StyleControls';
import { exportCarouselAsPdf, downloadBlob } from '@/lib/export';
import type { FooterData } from '@/components/editor/SocialFooter';

const MIN_SLIDES_WARNING = 5;
const MAX_SLIDES = 15;

export default function CarouselEditorPage() {
  const { id } = useParams();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [slides, setSlides] = useState<Slide[]>(defaultSlides());
  const [style, setStyle] = useState<CarouselStyle>(DEFAULT_CAROUSEL_STYLE);
  const [footerData, setFooterData] = useState<FooterData>({ photoUrl: null, companyLogoUrl: null, handle: '', designation: '' });
  const [activeIndex, setActiveIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/designs/${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSlides(d.content.slides);
          setStyle(d.style);
        }
      })
      .catch(() => {});

    fetch('/api/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) setFooterData({ photoUrl: p.photoUrl, companyLogoUrl: p.companyLogoUrl, handle: p.handle, designation: p.designation });
      })
      .catch(() => {});
  }, [id]);

  const save = useCallback((nextSlides: Slide[], nextStyle: CarouselStyle) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/designs/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { slides: nextSlides }, style: nextStyle }),
      }).catch(() => {});
    }, 2000);
  }, [id]);

  function updateSlide(index: number, patch: Partial<Slide>) {
    const next = slides.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setSlides(next);
    save(next, style);
  }

  function updateStyle(next: CarouselStyle) {
    setStyle(next);
    save(slides, next);
  }

  function addSlide() {
    if (slides.length >= MAX_SLIDES) return;
    // Always insert a new content-type slide immediately before the CTA
    // slide (spec §3.2) -- cover stays at 0, CTA stays last.
    const next = [...slides.slice(0, -1), newContentSlide(), slides[slides.length - 1]];
    setSlides(next);
    setActiveIndex(next.length - 2);
    save(next, style);
  }

  const active = slides[activeIndex];

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const nodes = slideRefs.current.filter((n): n is HTMLDivElement => n !== null);
      const blob = await exportCarouselAsPdf(nodes);

      const form = new FormData();
      form.append('file', blob, 'carousel.pdf');
      const res = await fetch(`/api/designs/${id}/export`, { method: 'POST', credentials: 'include', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "You've reached your limit of 5 saved PDFs. Delete an existing one first.");
      }

      downloadBlob(blob, 'carousel.pdf');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell title="Carousel editor">
      {/* Scaled on-screen preview of the active slide only -- decision 1/18. This node is
          never used for export capture (see below): html2canvas renders incorrectly
          (duplicated/overlapping content) when the captured node sits under an
          ancestor with a CSS transform, which this scaled wrapper always has. */}
      <div style={{ position: 'relative' }}>
        <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 16, marginBottom: 12, border: '1px solid var(--line)' }}>
          <div style={{ transform: 'scale(var(--canvas-scale, 0.34))', transformOrigin: 'top left', width: 1080, height: 1080 }}>
            <SlideCanvas
              slide={active}
              index={activeIndex}
              total={slides.length}
              style={style}
              footerData={footerData}
            />
          </div>
        </div>

        {/* Off-screen, untransformed renders of every slide (including the active one),
            kept mounted (not display:none, so html2canvas can still rasterize them) but
            visually hidden -- the only nodes ever used for export capture. */}
        <div style={{ position: 'absolute', top: 0, left: -99999, pointerEvents: 'none' }}>
          {slides.map((s, i) => (
            <div key={i} style={{ width: 1080, height: 1080 }}>
              <SlideCanvas
                ref={(el) => { slideRefs.current[i] = el; }}
                slide={s}
                index={i}
                total={slides.length}
                style={style}
                footerData={footerData}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Slide navigator */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: i === activeIndex ? '2px solid var(--brand)' : '1px solid var(--line)',
              background: 'var(--surface)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title={s.type}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={addSlide}
          disabled={slides.length >= MAX_SLIDES}
          style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, border: '1px dashed var(--line)', background: 'var(--surface)', cursor: 'pointer', fontSize: 18 }}
        >
          +
        </button>
      </div>

      {slides.length < MIN_SLIDES_WARNING && (
        <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>
          This carousel has fewer than {MIN_SLIDES_WARNING} slides — brand guidance suggests 7–10 for the best engagement. You can still export as-is.
        </p>
      )}
      {slides.length >= MAX_SLIDES && (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Maximum of {MAX_SLIDES} slides reached.</p>
      )}

      {/* Per-slide-type content editing */}
      <div className="card-surface" style={{ padding: 16, marginBottom: 16 }}>
        {active.type === 'cover' && (
          <div>
            <label className="label" htmlFor="cover-headline">Cover headline</label>
            <input id="cover-headline" className="input" value={active.headline ?? ''} onChange={(e) => updateSlide(activeIndex, { headline: e.target.value })} />
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Footer (photo, handle, designation) comes from your profile — edit it in Settings.</p>
          </div>
        )}

        {active.type === 'content' && (
          <div>
            <label className="label" htmlFor="content-heading">Heading</label>
            <input id="content-heading" className="input" style={{ marginBottom: 14 }} value={active.heading ?? ''} onChange={(e) => updateSlide(activeIndex, { heading: e.target.value })} />

            <label className="label" htmlFor="content-body">Body (bullets, one per line — or write one paragraph)</label>
            <textarea
              id="content-body"
              className="input"
              style={{ height: 120, paddingTop: 10, resize: 'vertical' }}
              value={(active.bullets ?? [active.body ?? '']).join('\n')}
              onChange={(e) => {
                const lines = e.target.value.split('\n');
                if (lines.length > 1) updateSlide(activeIndex, { bullets: lines, body: undefined });
                else updateSlide(activeIndex, { body: lines[0], bullets: undefined });
              }}
            />
          </div>
        )}

        {active.type === 'cta' && (
          <div>
            <label className="label" htmlFor="cta-heading">Heading</label>
            <input id="cta-heading" className="input" style={{ marginBottom: 14 }} value={active.heading ?? ''} onChange={(e) => updateSlide(activeIndex, { heading: e.target.value })} />
            <label className="label" htmlFor="cta-body">Body</label>
            <textarea id="cta-body" className="input" style={{ height: 80, paddingTop: 10, resize: 'vertical', marginBottom: 14 }} value={active.body ?? ''} onChange={(e) => updateSlide(activeIndex, { body: e.target.value })} />
            <label className="label" htmlFor="cta-line">Call to action</label>
            <input id="cta-line" className="input" value={active.cta ?? ''} onChange={(e) => updateSlide(activeIndex, { cta: e.target.value })} />
          </div>
        )}
      </div>

      <div className="card-surface" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Color palette</h2>
        <PalettePicker value={style.paletteId} onChange={(paletteId) => updateStyle({ ...style, paletteId })} />

        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Text style ({active.type} slide)</h2>
        {active.type === 'cover' && (
          <StyleControls label="Headline" value={style.regions.coverHeadline} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, coverHeadline: v } })} />
        )}
        {active.type === 'content' && (
          <>
            <StyleControls label="Heading" value={style.regions.contentHeading} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, contentHeading: v } })} />
            <StyleControls label="Body" value={style.regions.contentBody} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, contentBody: v } })} />
          </>
        )}
        {active.type === 'cta' && (
          <>
            <StyleControls label="Heading" value={style.regions.ctaHeading} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, ctaHeading: v } })} />
            <StyleControls label="Body" value={style.regions.ctaBody} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, ctaBody: v } })} />
            <StyleControls label="CTA line" value={style.regions.ctaLine} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, ctaLine: v } })} showSize={false} />
          </>
        )}
      </div>

      {exportError && <p className="error-text" style={{ marginBottom: 12 }}>{exportError}</p>}

      <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
        {exporting ? 'Exporting…' : 'Download PDF'}
      </button>
    </AppShell>
  );
}
