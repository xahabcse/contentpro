import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import SlidePreview from '@/components/editor/SlidePreview';
import Icon from '@/components/ui/Icon';
import SkySwitch from '@/components/ui/SkySwitch';
import { useAuth } from '@/lib/auth-context';
import { NETWORK_ERROR_MESSAGE, readApiError } from '@/lib/errorMessages';
import { useToast } from '@/lib/toast';

interface ProfileData {
  name: string;
  designation: string;
  companyName: string;
  handle: string;
  photoUrl: string | null;
  companyLogoUrl: string | null;
}

const EMPTY: ProfileData = { name: '', designation: '', companyName: '', handle: '', photoUrl: null, companyLogoUrl: null };

// GET /api/profile leaves out every field whose column is still NULL, so an
// account that has never saved its profile gets `{ photoUrl: null, companyLogoUrl: null }`.
// Fill the gaps here: the form calls string methods on these fields.
function toProfileData(p: Partial<ProfileData> | null | undefined): ProfileData {
  return {
    name: p?.name ?? '',
    designation: p?.designation ?? '',
    companyName: p?.companyName ?? '',
    handle: p?.handle ?? '',
    photoUrl: p?.photoUrl ?? null,
    companyLogoUrl: p?.companyLogoUrl ?? null,
  };
}

function initials(name: string): string {
  const parts = name.replace(/^md\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);

  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function ProfileSettingsPage() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileData>(EMPTY);
  const [saved, setSaved] = useState<ProfileData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [format, setFormat] = useState<'card' | 'carousel'>('card');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        if (cancelled) return;
        if (!res.ok) {
          // A blank form here looks like "no profile yet" and invites overwriting it.
          toast.error(await readApiError(res, "We couldn't load your profile. Reload the page to try again."));
          return;
        }
        const p = toProfileData((await res.json()) as Partial<ProfileData>);
        if (!cancelled) { setProfile(p); setSaved(p); }
      } catch {
        if (!cancelled) toast.error(NETWORK_ERROR_MESSAGE);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = profile.name !== saved.name || profile.designation !== saved.designation
    || profile.companyName !== saved.companyName || profile.handle !== saved.handle;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          designation: profile.designation,
          companyName: profile.companyName,
          handle: profile.handle,
        }),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, "We couldn't save your profile. Please try again."));
        return;
      }
      await refresh();
      setSaved(profile);
      toast.success('Profile saved.');
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(kind: 'photo' | 'logo', file: File) {
    const label = kind === 'photo' ? 'Profile photo' : 'Company logo';
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`/api/profile/${kind}`, { method: 'POST', credentials: 'include', body: form });
      if (!res.ok) {
        toast.error(await readApiError(res, `We couldn't upload that ${label.toLowerCase()}. Please try again.`));
        return;
      }
      const { url } = (await res.json()) as { url?: string };
      if (!url) {
        toast.info(`${label} uploaded, but we couldn't load a preview. Reload the page to check it.`);
        return;
      }
      const patch = kind === 'photo' ? { photoUrl: url } : { companyLogoUrl: url };
      setProfile((p) => ({ ...p, ...patch }));
      setSaved((p) => ({ ...p, ...patch }));
      toast.success(`${label} updated.`);
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    }
  }

  const footer = {
    name: profile.name || 'Your name',
    handle: profile.handle.replace(/^@/, '') || 'yourhandle',
    avatar: profile.photoUrl,
    designation: profile.designation || null,
    companyName: profile.companyName || null,
    companyLogo: profile.companyLogoUrl,
  };

  return (
    <AppShell title="Profile & Company">
      <header className="page-head rise">
        <div>
          <span className="eyebrow"><Link to="/dashboard" style={{ color: 'inherit' }}>Dashboard</Link> / Account</span>
          <h1 className="display">Profile &amp; <em>Company</em></h1>
          <p className="lede">Every design is signed with these details. Set them once; override them in any single design.</p>
        </div>
        <div className="page-head__tools"><SkySwitch /></div>
      </header>

      <div className="profile">
        <form onSubmit={handleSubmit}>
          <section className="form-card surface">
            <div className="form-card__head">
              <span className="new__icon"><Icon name="user" /></span>
              <div><h2>Personal</h2><p>Shown at the foot of every slide.</p></div>
            </div>
            <div className="upload">
              <span className="avatar avatar--lg">
                {profile.photoUrl ? <img src={profile.photoUrl} alt="" /> : initials(profile.name)}
              </span>
              <div className="upload__acts">
                <b style={{ fontSize: 'var(--fs-sm)' }}>Profile photo</b>
                <label className="btn btn--sm btn--glass file-btn" style={{ width: 'fit-content' }}>
                  <Icon name="upload" /> {profile.photoUrl ? 'Replace photo' : 'Upload photo'}
                  <input id="photo" type="file" accept="image/*" className="visually-hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload('photo', e.target.files[0])} />
                </label>
                <span className="hint">Square JPG or PNG works best. Shown as a circle.</span>
              </div>
            </div>
            <div className="form-2">
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input id="name" className="input" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label" htmlFor="designation">Designation</label>
                <input
                  id="designation"
                  className="input"
                  placeholder="e.g. Assistant Software Engineer at OnnoRokom Projukti Limited"
                  value={profile.designation}
                  onChange={(e) => setProfile((p) => ({ ...p, designation: e.target.value }))}
                  required
                />
              </div>
            </div>
          </section>

          <section className="form-card surface">
            <div className="form-card__head">
              <span className="new__icon"><Icon name="building" /></span>
              <div><h2>Company</h2><p>Optional. Adds a logo next to your name.</p></div>
            </div>
            <div className="upload">
              <span className="upload__logo">
                {profile.companyLogoUrl ? <img src={profile.companyLogoUrl} alt="" /> : <Icon name="image" />}
              </span>
              <div className="upload__acts">
                <b style={{ fontSize: 'var(--fs-sm)' }}>Company logo</b>
                <label className="btn btn--sm btn--glass file-btn" style={{ width: 'fit-content' }}>
                  <Icon name="upload" /> {profile.companyLogoUrl ? 'Replace logo' : 'Upload logo'}
                  <input id="logo" type="file" accept="image/*" className="visually-hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload('logo', e.target.files[0])} />
                </label>
                <span className="hint">PNG with a transparent background looks best.</span>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="companyName">Company name</label>
              <input id="companyName" className="input" value={profile.companyName} onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))} />
            </div>
          </section>

          <section className="form-card surface">
            <div className="form-card__head">
              <span className="new__icon"><Icon name="at" /></span>
              <div><h2>Social</h2><p>One handle, shown under all four footer icons (Facebook, WhatsApp, Gmail, LinkedIn).</p></div>
            </div>
            <div>
              <label className="label" htmlFor="handle">Handle</label>
              <div className="prefix">
                <span>@</span>
                <input id="handle" className="input" placeholder="yourhandle" value={profile.handle.replace(/^@/, '')} onChange={(e) => setProfile((p) => ({ ...p, handle: e.target.value.replace(/^@/, '') }))} required />
              </div>
            </div>
          </section>

          <div className="savebar glass-strong">
            <span className="dot" style={{ background: dirty ? 'var(--brand)' : 'var(--ok)' }} />
            <span>{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              <Icon name="check" /> {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>

        <aside className="preview-card glass-strong" aria-label="Live preview">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="eyebrow"><span className="dot dot--ok" /> Live preview</span>
            <div className="seg" role="group" aria-label="Preview format">
              <button type="button" aria-pressed={format === 'card'} onClick={() => setFormat('card')}>Card</button>
              <button type="button" aria-pressed={format === 'carousel'} onClick={() => setFormat('carousel')}>Slide</button>
            </div>
          </div>
          <div className="preview-card__stage">
            <SlidePreview template="cover" palette="ink" format={format} footer={footer} />
          </div>
          <p className="hint" style={{ margin: 0 }}>Your name, role, photo, company and handle sign every slide. Saved changes apply to designs without their own override.</p>
        </aside>
      </div>
    </AppShell>
  );
}
