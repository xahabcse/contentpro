import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { resolveColors } from '@/lib/palettes';
import { canvasSize, type FooterData, type LocalDesign, type ResolvedSlide } from '@/lib/design-types';
import { buildBackup, createDesign, deleteDesign, duplicateDesign, ensureSeeded, listDesigns, restoreBackup } from '@/lib/local-store';
import { getImageUrl } from '@/lib/image-store';
import { useToast } from '@/lib/toast';

interface Profile { name?: string; handle?: string; photoUrl?: string | null; designation?: string; companyName?: string; companyLogoUrl?: string | null }

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [designs, setDesigns] = useState<LocalDesign[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [bgUrls, setBgUrls] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<LocalDesign | null>(null);
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

  // Esc closes the delete confirmation modal.
  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPendingDelete(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingDelete]);

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
    // incomplete profile to fill it in first (spec §6). A toast, not inline
    // text: this component unmounts on the very next line, so page-local
    // feedback would never be seen.
    if (!profile.name || !profile.handle) {
      toast.info('Add your name and handle here first — your designs are signed with them.');
      navigate('/settings/profile');
      return;
    }
    try {
      const d = createDesign(type);
      navigate('/designs/' + d.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the design.');
    }
  }
  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    try {
      await deleteDesign(target.id);
      reload();
      toast.success(`Deleted “${target.title || 'Untitled'}”.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete that design.');
    }
  }
  async function handleDuplicate(id: string) {
    try {
      const copy = await duplicateDesign(id);
      reload();
      if (copy) {
        toast.success('Copy created — opening it now.');
        navigate('/designs/' + copy.id);
      } else {
        toast.error("That design is no longer in this browser, so it couldn't be copied.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not duplicate the design.');
    }
  }
  async function handleBackup() {
    try {
      const blob = await buildBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'contentpro-designs-backup.json'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded.');
    } catch { toast.error('Could not build a backup.'); }
  }
  async function handleRestore(file: File) {
    try {
      const n = await restoreBackup(file);
      reload();
      toast.success(`Restored ${n} design${n === 1 ? '' : 's'}.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not restore that file.'); }
  }

  const cardCount = designs.filter((d) => d.type === 'card').length;
  const carouselCount = designs.filter((d) => d.type === 'carousel').length;
  const countLine = designs.length
    ? [cardCount ? `${cardCount} card${cardCount === 1 ? '' : 's'}` : '', carouselCount ? `${carouselCount} carousel${carouselCount === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')
    : '';

  return (
    <AppShell title="Your designs">
      {/* create actions */}
      <div className="dash-create">
        <button className="dash-tile dash-tile-primary" onClick={() => handleCreate('card')}>
          <span className="dash-tile-ic" style={{ background: 'rgba(27,22,14,0.12)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><path d="M7.5 15.5l3-3.5 2.3 2.5L16 11" /></svg>
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', font: '800 17px/1.1 var(--font-display)', color: 'var(--ink)' }}>New card</span>
            <span style={{ display: 'block', marginTop: 3, font: '500 12px/1.3 var(--font-ui)', color: 'rgba(27,22,14,0.62)' }}>Single square post · 1080×1080</span>
          </span>
        </button>
        <button className="dash-tile" onClick={() => handleCreate('carousel')}>
          <span className="dash-tile-ic" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7.5" y="4.5" width="13" height="15" rx="2.5" /><path d="M4.5 7v10" opacity="0.5" /><path d="M2 9v6" opacity="0.28" /></svg>
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', font: '800 17px/1.1 var(--font-display)', color: 'var(--ink)' }}>New carousel</span>
            <span style={{ display: 'block', marginTop: 3, font: '500 12px/1.3 var(--font-ui)', color: 'var(--muted)' }}>Multi-slide swipe deck · up to 15</span>
          </span>
        </button>
      </div>

      {/* saved-designs header + toolbar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)' }}>Saved designs</h2>
          {countLine ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{countLine}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dash-ghost" onClick={handleBackup} title="Download a JSON backup of all designs">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></svg>
            Back up
          </button>
          <button className="dash-ghost" onClick={() => restoreInput.current?.click()} title="Restore designs from a backup file">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V9" /><path d="M7 13l5-5 5 5" /><path d="M4 4h16" /></svg>
            Restore
          </button>
          <input ref={restoreInput} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRestore(f); e.currentTarget.value = ''; }} />
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 20px' }}>
        Saved <strong>in this browser only</strong> — they don't sync across devices. Back up to keep or move them.
      </p>

      {!designs.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '52px 24px', border: '1.5px dashed var(--line-2)', borderRadius: 18, color: 'var(--muted)' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><path d="M8 14l2.5-3 2 2.2L15 10l1.5 1.8" /></svg>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>No designs yet</div>
          <div style={{ fontSize: 13.5, maxWidth: 320 }}>Create your first card or carousel above — it takes about a minute.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 208px)', gap: 16, justifyContent: 'flex-start' }}>
          {designs.map((d) => {
            const cv = canvasSize(d.type);
            const colors = resolveColors(d.paletteId, { bg: d.customBg, text: d.customText, accent: d.customAccent });
            const first = d.slides[0];
            const slide: ResolvedSlide = { template: first.template, fields: first.fields, bgImage: first.bgImageId ? bgUrls[first.bgImageId] ?? null : null };
            const THUMB_W = 208;
            return (
              <div key={d.id} className="dash-card">
                <button className="dash-thumb" onClick={() => navigate('/designs/' + d.id)} aria-label={`Open ${d.title || 'Untitled'}`}>
                  <span className="dash-badge">{d.type === 'card' ? 'Card' : `Deck · ${d.slides.length}`}</span>
                  <div style={{ width: THUMB_W, height: THUMB_W * (cv.h / cv.w), position: 'relative', overflow: 'hidden' }}>
                    <div style={{ width: cv.w, height: cv.h, transform: `scale(${THUMB_W / cv.w})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                      <SlideCanvas slide={slide} colors={colors} footer={footerData} width={cv.w} height={cv.h} />
                    </div>
                  </div>
                  <span className="dash-thumb-overlay">Open ↗</span>
                </button>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title || 'Untitled'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{new Date(d.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button className="dash-act" title="Make a copy" onClick={() => handleDuplicate(d.id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
                      Duplicate
                    </button>
                    <button className="dash-act dash-act-danger" title="Delete this design" onClick={() => setPendingDelete(d)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-title"
          onClick={() => setPendingDelete(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(27,22,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'dash-fade .15s ease' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: 24, boxShadow: '0 30px 80px rgba(27,22,14,0.3)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, flex: 'none', background: 'rgba(225,64,43,0.12)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>
              </span>
              <h3 id="del-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)' }}>Delete this design?</h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--ink)' }}>{pendingDelete.title || 'Untitled'}</strong> will be permanently removed from this browser. This can't be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" style={{ width: 'auto', height: 42, padding: '0 18px', fontSize: 14 }} onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn" style={{ width: 'auto', height: 42, padding: '0 20px', fontSize: 14, background: 'var(--danger)', color: '#fff' }} onClick={confirmDelete} autoFocus>Delete</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
