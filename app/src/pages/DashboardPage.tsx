import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import SlideCanvas from '@/components/editor/SlideCanvas';
import SlidePreview from '@/components/editor/SlidePreview';
import Icon from '@/components/ui/Icon';
import SkySwitch from '@/components/ui/SkySwitch';
import { resolveColors } from '@/lib/palettes';
import { canvasSize, type FooterData, type LocalDesign, type ResolvedSlide, type TemplateId } from '@/lib/design-types';
import { TEMPLATES } from '@/lib/templates';
import { buildBackup, createDesign, deleteDesign, duplicateDesign, ensureSeeded, listDesigns, restoreBackup } from '@/lib/local-store';
import { getImageUrl, releaseImageUrls } from '@/lib/image-store';
import { useAuth } from '@/lib/auth-context';
import { importLegacyDesigns, legacyImportAvailable } from '@/lib/local-store';
import { useToast } from '@/lib/toast';

interface Profile { name?: string; handle?: string; photoUrl?: string | null; designation?: string; companyName?: string; companyLogoUrl?: string | null }

type Filter = 'all' | 'card' | 'carousel';

const STARTERS: [TemplateId, string, string][] = [
  ['birthday', 'paper', 'Birthday Wish'],
  ['event', 'navy', 'Event Invite'],
  ['congrats', 'wine', 'Congratulations'],
  ['hiring', 'charcoal', 'Hiring / Job'],
  ['contrast', 'sand', 'Before / After'],
  ['question', 'paper', 'Bold Question'],
];

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Dhaka' }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';

  return 'Good evening';
}

function firstName(name?: string): string {
  const parts = (name ?? '').replace(/^md\.?\s+/i, '').trim().split(/\s+/);

  return parts[0] ?? '';
}

function initials(name?: string): string {
  const parts = (name ?? '').replace(/^md\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);

  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function editedLabel(time: number): string {
  const diff = Date.now() - time;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;

  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const ownerId = user?.id;
  const requestedTemplate = searchParams.get('template');
  const selectedTemplate = requestedTemplate && Object.hasOwn(TEMPLATES, requestedTemplate) ? requestedTemplate as TemplateId : null;
  const selectedFormat = searchParams.get('format');
  const createRequest = searchParams.get('create');
  const [designs, setDesigns] = useState<LocalDesign[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [bgUrls, setBgUrls] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<LocalDesign | null>(null);
  const [legacyAvailable, setLegacyAvailable] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const restoreInput = useRef<HTMLInputElement>(null);

  function reload() {
    if (!ownerId) return;
    setDesigns(listDesigns(ownerId));
  }

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        ensureSeeded(ownerId);
        setDesigns(listDesigns(ownerId));
        setLegacyAvailable(legacyImportAvailable());
        setBgUrls({});
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not read saved designs.');
      }
    });
    fetch('/api/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (!cancelled && p) setProfile(p); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setProfileLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    return () => releaseImageUrls(ownerId);
  }, [ownerId]);

  // resolve first-slide background images for thumbnails
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const d of designs) {
        const id = d.slides[0]?.bgImageId;
        if (id && ownerId && !bgUrls[id]) { const u = await getImageUrl(ownerId, id); if (u) next[id] = u; }
      }
      if (!cancelled && Object.keys(next).length) setBgUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designs, ownerId]);

  // Esc closes the delete confirmation modal.
  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPendingDelete(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingDelete]);

  // "New card" / "New carousel" from the app chrome arrive as ?create=...
  useEffect(() => {
    if (!profileLoaded || (createRequest !== 'card' && createRequest !== 'carousel')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
    handleCreate(createRequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded, createRequest]);

  const footerData: FooterData = {
    name: profile.name ?? '',
    handle: profile.handle ?? '',
    avatar: profile.photoUrl ?? null,
    designation: profile.designation ?? null,
    companyName: profile.companyName ?? null,
    companyLogo: profile.companyLogoUrl ?? null,
  };

  function handleCreate(type: 'card' | 'carousel') {
    if (!ownerId) return;
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
      const d = createDesign(ownerId, type, selectedTemplate ?? undefined);
      navigate('/designs/' + d.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the design.');
    }
  }
  async function confirmDelete() {
    if (!ownerId) return;
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    try {
      await deleteDesign(ownerId, target.id);
      reload();
      toast.success(`Deleted “${target.title || 'Untitled'}”.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete that design.');
    }
  }
  async function handleDuplicate(id: string) {
    if (!ownerId) return;
    try {
      const copy = await duplicateDesign(ownerId, id);
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
    if (!ownerId) return;
    try {
      const blob = await buildBackup(ownerId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'contentpro-designs-backup.json'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not build a backup.'); }
  }
  async function handleRestore(file: File) {
    if (!ownerId) return;
    try {
      const n = await restoreBackup(ownerId, file);
      reload();
      toast.success(`Restored ${n} design${n === 1 ? '' : 's'}.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not restore that file.'); }
  }
  async function handleLegacyImport() {
    if (!ownerId) return;
    if (!window.confirm('These older designs have no account owner recorded. Import them only if they are yours. Continue?')) return;
    try {
      const count = await importLegacyDesigns(ownerId);
      setLegacyAvailable(false);
      reload();
      toast.success(`Imported ${count} older design${count === 1 ? '' : 's'} into this account.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import older designs.');
    }
  }

  const cardCount = designs.filter((d) => d.type === 'card').length;
  const carouselCount = designs.filter((d) => d.type === 'carousel').length;
  const visible = designs.filter((d) => (filter === 'all' || d.type === filter)
    && (d.title || 'Untitled').toLowerCase().includes(query.trim().toLowerCase()));
  const who = firstName(profile.name);
  const profileReady = Boolean(profile.name && profile.handle);
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' }).format(new Date());

  return (
    <AppShell title="Designs">
      <header className="page-head rise">
        <div>
          <span className="eyebrow">{today}</span>
          <h1 className="display">{greeting()}{who ? <>, <em>{who}.</em></> : '.'}</h1>
          <p className="lede">Pick up where you left off, or start something new.</p>
        </div>
        <div className="page-head__tools">
          <SkySwitch />
          <button type="button" className="btn btn--glass" onClick={() => restoreInput.current?.click()} title="Restore designs from a backup file"><Icon name="upload" /> Restore</button>
          <button type="button" className="btn btn--glass" onClick={handleBackup} title="Download a JSON backup of all designs"><Icon name="download" /> Backup</button>
          <input ref={restoreInput} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRestore(f); e.currentTarget.value = ''; }} />
        </div>
      </header>

      {selectedTemplate && (
        <div className="note glass" role="note">
          <Icon name="sparkle" />
          <div>
            <b>{TEMPLATES[selectedTemplate].name} template selected</b>
            <p>Start a card or carousel below. This template will be the first slide; you can change it in the editor.</p>
          </div>
        </div>
      )}

      <section className="create rise rise-2" aria-label="Start a design">
        <button type="button" className="new glass" data-selected={selectedFormat === 'card'} onClick={() => handleCreate('card')}>
          <div>
            <span className="new__icon"><Icon name="square" /></span>
            <h2>{selectedTemplate ? `New ${TEMPLATES[selectedTemplate].name} card` : 'New card'}</h2>
            <p>Single square post · 1080 × 1080</p>
            <span className="new__go">Start a card <Icon name="arrow-right" /></span>
          </div>
          <div className="new__art" aria-hidden="true">
            <SlidePreview template={selectedTemplate ?? 'quote'} palette="forest" footer={footerData} />
          </div>
        </button>
        <button type="button" className="new glass" data-selected={selectedFormat === 'carousel'} onClick={() => handleCreate('carousel')}>
          <div>
            <span className="new__icon"><Icon name="layers" /></span>
            <h2>{selectedTemplate ? `New ${TEMPLATES[selectedTemplate].name} carousel` : 'New carousel'}</h2>
            <p>Multi-slide swipe deck · up to 15</p>
            <span className="new__go">Start a deck <Icon name="arrow-right" /></span>
          </div>
          <div className="new__art new__art--deck" aria-hidden="true">
            <SlidePreview template="stat" palette="cobalt" format="carousel" footer={footerData} />
            <SlidePreview template={selectedTemplate ?? 'cover'} palette="cobalt" format="carousel" footer={footerData} />
            <SlidePreview template="tips" palette="cobalt" format="carousel" footer={footerData} />
          </div>
        </button>
        <aside className="sig surface">
          <div className="sig__head">
            <span className="eyebrow">Your signature</span>
            <Link to="/settings/profile" className="btn btn--sm btn--quiet">Edit <Icon name="chevron-right" /></Link>
          </div>
          <div className="sig__who">
            <span className="avatar" style={{ width: 52, height: 52, fontSize: 15 }}>
              {profile.photoUrl ? <img src={profile.photoUrl} alt="" /> : initials(profile.name)}
            </span>
            <div><b>{profile.name || 'Add your name'}</b><span>{profile.designation || 'Add your designation'}</span></div>
          </div>
          {profileReady ? (
            <div className="sig__rows">
              <div>Handle <b>@{profile.handle}</b></div>
              <div>Company <b>{profile.companyName || '—'}</b></div>
              <div>Logo <b>{profile.companyLogoUrl ? <span className="badge badge--ok"><Icon name="check" /> Added</span> : '—'}</b></div>
            </div>
          ) : (
            <p className="hint" style={{ margin: 0 }}>Designs are signed with your name and handle. Add them once before you start.</p>
          )}
        </aside>
      </section>

      <div className="block-head">
        <h2>Start from a template</h2>
        <Link to="/#templates" className="btn btn--quiet">Browse all 100 <Icon name="arrow-right" /></Link>
      </div>
      <div className="starter">
        {STARTERS.map(([template, palette, label]) => (
          <Link key={template} to={`/dashboard?template=${template}`}>
            <SlidePreview template={template} palette={palette} footer={footerData} lazy />
            {label}
          </Link>
        ))}
      </div>

      {legacyAvailable && (
        <div className="note glass" role="note" style={{ marginTop: 24 }}>
          <Icon name="info" />
          <div>
            <b>Older browser designs found</b>
            <p>These designs were saved before accounts had separate browser storage. Their owner is unknown, so import them only if they belong to you. The originals will stay on this browser.</p>
            <button type="button" className="btn btn--sm btn--glass" style={{ marginTop: 10 }} onClick={handleLegacyImport}>Import my older designs</button>
          </div>
        </div>
      )}

      <div className="block-head">
        <h2>Saved designs <span className="badge">{designs.length}</span></h2>
        <div className="block-head__tools">
          <div className="seg" role="group" aria-label="Filter designs">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
            <button type="button" aria-pressed={filter === 'card'} onClick={() => setFilter('card')}>Cards {cardCount ? <span className="chip__n">{cardCount}</span> : null}</button>
            <button type="button" aria-pressed={filter === 'carousel'} onClick={() => setFilter('carousel')}>Carousels {carouselCount ? <span className="chip__n">{carouselCount}</span> : null}</button>
          </div>
          <div className="input-wrap" style={{ width: 240 }}>
            <Icon name="search" />
            <input className="input" style={{ minHeight: 40 }} type="search" placeholder="Search designs" aria-label="Search designs" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {!designs.length ? (
        <div className="empty">
          <Icon name="image" size={34} />
          <b>No designs yet</b>
          <span>Create your first card or carousel above — it takes about a minute.</span>
        </div>
      ) : !visible.length ? (
        <p className="empty-note" role="status">No designs match this filter.</p>
      ) : (
        <div className="saved-grid">
          {visible.map((d) => {
            const cv = canvasSize(d.type);
            const colors = resolveColors(d.paletteId, { bg: d.customBg, text: d.customText, accent: d.customAccent });
            const first = d.slides[0];
            const slide: ResolvedSlide = { template: first.template, fields: first.fields, bgImage: first.bgImageId ? bgUrls[first.bgImageId] ?? null : null };
            return (
              <article key={d.id} className="saved surface">
                <button type="button" className="saved__art" data-type={d.type} onClick={() => navigate('/designs/' + d.id)} aria-label={`Open ${d.title || 'Untitled'}`}>
                  {d.type === 'carousel' && <span className="saved__stack" aria-hidden="true" />}
                  <ThumbCanvas slide={slide} colors={colors} footer={footerData} w={cv.w} h={cv.h} />
                </button>
                <div className="saved__body">
                  <h3 className="saved__name">{d.title || 'Untitled'}</h3>
                  <p className="saved__meta">
                    <Icon name={d.type === 'card' ? 'square' : 'layers'} />
                    <span>{d.type === 'card' ? 'Card · 1080²' : `Carousel · ${d.slides.length} slide${d.slides.length === 1 ? '' : 's'}`}</span>
                    <span>{editedLabel(d.updatedAt)}</span>
                  </p>
                </div>
                <div className="saved__acts">
                  <button type="button" className="btn btn--sm btn--glass" onClick={() => navigate('/designs/' + d.id)}>Open</button>
                  <button type="button" className="btn btn--sm btn--quiet btn--icon" title="Make a copy" aria-label="Make a copy" onClick={() => handleDuplicate(d.id)}><Icon name="copy" /></button>
                  <button type="button" className="btn btn--sm btn--quiet btn--icon" title="Delete this design" aria-label="Delete this design" onClick={() => setPendingDelete(d)}><Icon name="trash" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="store-note glass">
        <Icon name="drive" />
        <span><b>Saved in this browser only.</b> Designs don't sync across devices; clearing site data removes them. Back up to keep or move them.</span>
        <button type="button" className="btn btn--sm btn--primary" onClick={handleBackup}><Icon name="download" /> Download backup</button>
      </div>

      {pendingDelete && (
        <div role="dialog" aria-modal="true" aria-labelledby="del-title" className="modal" onClick={() => setPendingDelete(null)}>
          <div className="modal__card glass-strong" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="new__icon" style={{ background: 'rgba(225,64,43,0.14)', color: 'var(--danger)' }}><Icon name="trash" /></span>
              <h3 id="del-title">Delete this design?</h3>
            </div>
            <p>
              <strong style={{ color: 'var(--ink)' }}>{pendingDelete.title || 'Untitled'}</strong> will be permanently removed from this browser. This can't be undone.
            </p>
            <div className="modal__acts">
              <button type="button" className="btn btn--glass" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button type="button" className="btn btn--danger" onClick={confirmDelete} autoFocus>Delete</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// A saved design's first slide, fitted to the tile's width.
function ThumbCanvas({ slide, colors, footer, w, h }: { slide: ResolvedSlide; colors: ReturnType<typeof resolveColors>; footer: FooterData; w: number; h: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const update = () => setWidth(Math.round(node.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="slide-preview" style={{ aspectRatio: `${w} / ${h}`, background: colors.bg }}>
      {width > 0 && (
        <div style={{ width: w, height: h, transform: `scale(${width / w})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <SlideCanvas slide={slide} colors={colors} footer={footer} width={w} height={h} />
        </div>
      )}
    </div>
  );
}
