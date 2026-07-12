import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { resolveColors } from '@/lib/palettes';
import { canvasSize, type FooterData, type LocalDesign, type ResolvedSlide } from '@/lib/design-types';
import { buildBackup, createDesign, deleteDesign, ensureSeeded, listDesigns, restoreBackup } from '@/lib/local-store';
import { getImageUrl } from '@/lib/image-store';

interface Profile { name?: string; handle?: string; photoUrl?: string | null; designation?: string; companyName?: string; companyLogoUrl?: string | null }

export default function DashboardPage() {
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<LocalDesign[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [bgUrls, setBgUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  function reload() { setDesigns(listDesigns()); }

  useEffect(() => {
    ensureSeeded();
    reload();
    fetch('/api/profile', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((p) => { if (p) setProfile(p); }).catch(() => {});
  }, []);

  // resolve first-slide background images for thumbnails
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const d of designs) {
        const id = d.slides[0]?.bgImageId;
        if (id && !bgUrls[id]) { const u = await getImageUrl(id); if (u) next[id] = u; }
      }
      if (!cancelled && Object.keys(next).length) setBgUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designs]);

  const footerData: FooterData = {
    name: profile.name ?? '',
    handle: profile.handle ?? '',
    avatar: profile.photoUrl ?? null,
    designation: profile.designation ?? null,
    companyName: profile.companyName ?? null,
    companyLogo: profile.companyLogoUrl ?? null,
  };

  function handleCreate(type: 'card' | 'carousel') {
    // A design signs itself from the profile footer -- send users with an
    // incomplete profile to fill it in first (spec §6).
    if (!profile.name || !profile.handle) {
      setError('Add your name and handle in Profile settings before creating your first design.');
      navigate('/settings/profile');
      return;
    }
    try {
      const d = createDesign(type);
      navigate('/designs/' + d.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the design.');
    }
  }
  async function handleDelete(id: string) {
    if (!confirm('Delete this design? It is removed from this browser only.')) return;
    await deleteDesign(id);
    reload();
  }
  async function handleBackup() {
    try {
      const blob = await buildBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'contentpro-designs-backup.json'; a.click();
      URL.revokeObjectURL(url);
      setNote('Backup downloaded.');
    } catch { setError('Could not build a backup.'); }
  }
  async function handleRestore(file: File) {
    try {
      const n = await restoreBackup(file);
      reload();
      setNote(`Restored ${n} design${n === 1 ? '' : 's'}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not restore that file.'); }
  }

  const imageCount = designs.filter((d) => d.type === 'card').length;
  const pdfCount = designs.filter((d) => d.type === 'carousel').length;

  return (
    <AppShell title="Your designs">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div className="card-surface" style={{ padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{imageCount}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Cards</div>
        </div>
        <div className="card-surface" style={{ padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{pdfCount}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Carousels</div>
        </div>
      </div>

      {error && <p className="error-text" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
      {note && <p className="pill pill-brand" role="status" style={{ marginBottom: 12 }}>{note}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => handleCreate('card')}>+ New Single Card</button>
        <button className="btn btn-outline" onClick={() => handleCreate('carousel')}>+ New Carousel</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-outline" style={{ width: 'auto', height: 40, padding: '0 16px', fontSize: 13 }} onClick={handleBackup}>⭳ Back up designs</button>
        <button className="btn btn-outline" style={{ width: 'auto', height: 40, padding: '0 16px', fontSize: 13 }} onClick={() => restoreInput.current?.click()}>⭱ Restore</button>
        <input ref={restoreInput} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRestore(f); e.currentTarget.value = ''; }} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 24 }}>
        Designs are saved <strong>in this browser only</strong> — they don't sync across devices. Back up to keep or move them.
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Saved designs</h2>
      {!designs.length && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No designs yet — create your first one above.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 172px)', gap: 14, justifyContent: 'flex-start' }}>
        {designs.map((d) => {
          const cv = canvasSize(d.type);
          const colors = resolveColors(d.paletteId, { bg: d.customBg, text: d.customText, accent: d.customAccent });
          const first = d.slides[0];
          const slide: ResolvedSlide = { template: first.template, fields: first.fields, bgImage: first.bgImageId ? bgUrls[first.bgImageId] ?? null : null };
          const THUMB_W = 172;
          return (
            <div key={d.id} className="card-surface" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', width: THUMB_W }}>
              <button onClick={() => navigate('/designs/' + d.id)} style={{ border: 'none', padding: 0, cursor: 'pointer', background: '#000', display: 'block' }}>
                <div style={{ width: THUMB_W, height: THUMB_W * (cv.h / cv.w), position: 'relative', overflow: 'hidden' }}>
                  <div style={{ width: cv.w, height: cv.h, transform: `scale(${THUMB_W / cv.w})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                    <SlideCanvas slide={slide} colors={colors} footer={footerData} width={cv.w} height={cv.h} />
                  </div>
                </div>
              </button>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title || 'Untitled'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.type === 'card' ? 'Card' : `Carousel · ${d.slides.length}`} · {new Date(d.updatedAt).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline" style={{ width: 'auto', height: 32, padding: '0 10px', fontSize: 12, flex: 1 }} onClick={() => navigate('/designs/' + d.id)}>Open</button>
                  <button className="btn btn-outline" style={{ width: 'auto', height: 32, padding: '0 10px', fontSize: 12, color: 'var(--danger)' }} onClick={() => handleDelete(d.id)}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
