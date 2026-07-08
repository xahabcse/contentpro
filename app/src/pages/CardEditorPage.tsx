import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import CardCanvas, { type CardContent, type CardStyle } from '@/components/editor/CardCanvas';
import { StyleControls, PalettePicker } from '@/components/editor/StyleControls';
import { DEFAULT_REGION_STYLE } from '@/lib/canvas-theme';
import { exportCardAsPng, downloadBlob } from '@/lib/export';
import type { FooterData } from '@/components/editor/SocialFooter';

const MAX_HEADLINE_WORDS = 12;
const MAX_BODY_WORDS = 50;

export default function CardEditorPage() {
  const { id } = useParams();
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [content, setContent] = useState<CardContent>({ eyebrow: 'TECH NEWS', headline: '', body: [''] });
  const [style, setStyle] = useState<CardStyle>({
    paletteId: 'brand-green',
    regions: {
      eyebrow: DEFAULT_REGION_STYLE,
      headline: DEFAULT_REGION_STYLE,
      body: DEFAULT_REGION_STYLE,
      footer: DEFAULT_REGION_STYLE,
    },
  });
  const [footerData, setFooterData] = useState<FooterData>({ photoUrl: null, companyLogoUrl: null, handle: '', designation: '' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/designs/${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setContent(d.content);
          setStyle(d.style);
        }
      })
      .catch(() => {});

    fetch('/api/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) {
          setFooterData({ photoUrl: p.photoUrl, companyLogoUrl: p.companyLogoUrl, handle: p.handle, designation: p.designation });
        }
      })
      .catch(() => {});
  }, [id]);

  const save = useCallback((nextContent: CardContent, nextStyle: CardStyle) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/designs/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: nextContent, style: nextStyle }),
      }).catch(() => {});
    }, 2000);
  }, [id]);

  function updateContent(next: CardContent) {
    setContent(next);
    save(next, style);
  }

  function updateStyle(next: CardStyle) {
    setStyle(next);
    save(content, next);
  }

  const headlineWordCount = content.headline.trim().split(/\s+/).filter(Boolean).length;
  const bodyWordCounts = content.body.map((p) => p.trim().split(/\s+/).filter(Boolean).length);

  async function handleExport() {
    if (!canvasRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportCardAsPng(canvasRef.current);

      const form = new FormData();
      form.append('file', blob, 'card.png');
      const res = await fetch(`/api/designs/${id}/export`, { method: 'POST', credentials: 'include', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "You've reached your limit of 5 saved images. Delete an existing one first.");
      }

      downloadBlob(blob, `${content.headline || 'card'}.png`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell title="Single Card editor">
      {/* Live WYSIWYG canvas -- what's shown here IS the export (decision 1/18). Scaled to fit
          the viewport via CSS transform for on-screen preview only. */}
      <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 16, marginBottom: 20, border: '1px solid var(--line)' }}>
        <div style={{ transform: 'scale(var(--canvas-scale, 0.34))', transformOrigin: 'top left', width: 1080, height: 1080 }}>
          <CardCanvas content={content} style={style} footerData={footerData} />
        </div>
      </div>

      {/* Off-screen, untransformed copy used only for export capture -- html2canvas
          renders incorrectly (duplicated/overlapping content) when the target node
          sits under an ancestor with a CSS transform, so the exported ref must never
          be the scaled preview node above. */}
      <div style={{ position: 'absolute', top: 0, left: -99999, pointerEvents: 'none' }}>
        <CardCanvas ref={canvasRef} content={content} style={style} footerData={footerData} />
      </div>

      <div className="card-surface" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <label className="label" htmlFor="eyebrow">Eyebrow tag (optional)</label>
          <input
            id="eyebrow"
            className="input"
            placeholder="e.g. CAREER TIP"
            value={content.eyebrow ?? ''}
            onChange={(e) => updateContent({ ...content, eyebrow: e.target.value })}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="label" htmlFor="headline">Headline ({headlineWordCount} words)</label>
          <input
            id="headline"
            className="input"
            value={content.headline}
            onChange={(e) => updateContent({ ...content, headline: e.target.value })}
          />
          {headlineWordCount > MAX_HEADLINE_WORDS && (
            <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
              This headline may be a bit long — brand guidance suggests up to {MAX_HEADLINE_WORDS} words for the best mobile-thumbnail read.
            </p>
          )}
        </div>

        {content.body.map((para, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <label className="label" htmlFor={`body-${i}`}>Paragraph {i + 1} ({bodyWordCounts[i]} words)</label>
            <textarea
              id={`body-${i}`}
              className="input"
              style={{ height: 90, paddingTop: 10, resize: 'vertical' }}
              value={para}
              onChange={(e) => {
                const nextBody = [...content.body];
                nextBody[i] = e.target.value;
                updateContent({ ...content, body: nextBody });
              }}
            />
            {bodyWordCounts[i] > MAX_BODY_WORDS && (
              <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>This may look crowded — brand guidance suggests up to {MAX_BODY_WORDS} words per paragraph.</p>
            )}
          </div>
        ))}
        {content.body.length < 2 && (
          <button type="button" className="btn btn-outline" onClick={() => updateContent({ ...content, body: [...content.body, ''] })}>
            + Add paragraph
          </button>
        )}
      </div>

      <div className="card-surface" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Color palette</h2>
        <PalettePicker value={style.paletteId} onChange={(paletteId) => updateStyle({ ...style, paletteId })} />

        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Text style</h2>
        <StyleControls label="Eyebrow" value={style.regions.eyebrow} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, eyebrow: v } })} showSize={false} />
        <StyleControls label="Headline" value={style.regions.headline} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, headline: v } })} />
        <StyleControls label="Body" value={style.regions.body} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, body: v } })} />
        <StyleControls label="Footer" value={style.regions.footer} onChange={(v) => updateStyle({ ...style, regions: { ...style.regions, footer: v } })} showSize={false} />
      </div>

      {exportError && <p className="error-text" style={{ marginBottom: 12 }}>{exportError}</p>}

      <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
        {exporting ? 'Exporting…' : 'Download PNG'}
      </button>
    </AppShell>
  );
}
