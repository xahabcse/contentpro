import { useEffect, useState, type FormEvent } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth';

interface ProfileData {
  name: string;
  designation: string;
  companyName: string;
  handle: string;
  photoUrl: string | null;
  companyLogoUrl: string | null;
}

const EMPTY: ProfileData = { name: '', designation: '', companyName: '', handle: '', photoUrl: null, companyLogoUrl: null };

export default function ProfileSettingsPage() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<ProfileData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then(setProfile)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
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
      if (!res.ok) throw new Error('Could not save profile');
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(kind: 'photo' | 'logo', file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/profile/${kind}`, { method: 'POST', credentials: 'include', body: form });
    if (res.ok) {
      const { url } = await res.json();
      setProfile((p) => ({ ...p, ...(kind === 'photo' ? { photoUrl: url } : { companyLogoUrl: url }) }));
    }
  }

  return (
    <AppShell title="Profile &amp; company info">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section className="card-surface" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Personal</h2>

          <div style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="photo">Profile photo</label>
            {profile.photoUrl && (
              <img src={profile.photoUrl} alt="" style={{ width: 64, height: 64, borderRadius: 9999, objectFit: 'cover', marginBottom: 8, display: 'block' }} />
            )}
            <input id="photo" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload('photo', e.target.files[0])} />
          </div>

          <div style={{ marginBottom: 14 }}>
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
        </section>

        <section className="card-surface" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Company</h2>

          <div style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="logo">Company logo</label>
            {profile.companyLogoUrl && (
              <img src={profile.companyLogoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', marginBottom: 8, display: 'block' }} />
            )}
            <input id="logo" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload('logo', e.target.files[0])} />
          </div>

          <div>
            <label className="label" htmlFor="companyName">Company name</label>
            <input id="companyName" className="input" value={profile.companyName} onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))} />
          </div>
        </section>

        <section className="card-surface" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Social</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            One shared handle is shown under all four icons (Facebook, WhatsApp, Gmail, LinkedIn) in your
            designs' footer — per-platform handles aren't supported yet.
          </p>
          <div>
            <label className="label" htmlFor="handle">Handle</label>
            <input id="handle" className="input" placeholder="@yourhandle" value={profile.handle} onChange={(e) => setProfile((p) => ({ ...p, handle: e.target.value }))} required />
          </div>
        </section>

        {error && <p className="error-text" role="alert">{error}</p>}
        {saved && <p className="pill pill-brand" role="status" style={{ alignSelf: 'flex-start' }}>Saved.</p>}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </AppShell>
  );
}
