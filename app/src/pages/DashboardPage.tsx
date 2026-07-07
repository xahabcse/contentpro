import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { listDesigns, createDesign, deleteDesign, DESIGN_LIMIT, type DesignsListResponse } from '@/lib/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DesignsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<'card' | 'carousel' | null>(null);

  async function load() {
    try {
      setData(await listDesigns());
    } catch {
      setError('Could not load your designs.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(format: 'card' | 'carousel') {
    setError(null);
    const atLimit = format === 'card'
      ? (data?.counts.images ?? 0) >= DESIGN_LIMIT
      : (data?.counts.pdfs ?? 0) >= DESIGN_LIMIT;

    if (atLimit) {
      setError(
        `You've reached your limit of ${DESIGN_LIMIT} saved ${format === 'card' ? 'images' : 'PDFs'}. ` +
        `Delete an existing one below to free up a slot before creating a new one.`,
      );
      return;
    }

    setCreating(format);
    try {
      const { id } = await createDesign(format);
      navigate(`/designs/${format}/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a new design.');
    } finally {
      setCreating(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this design? This removes both the design and its exported file.')) return;
    try {
      await deleteDesign(id);
      await load();
    } catch {
      setError('Could not delete that design.');
    }
  }

  return (
    <AppShell title="Your designs">
      {/* Usage counters (spec §7) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="card-surface" style={{ padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{data?.counts.images ?? '–'}/{DESIGN_LIMIT}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Images (Cards)</div>
        </div>
        <div className="card-surface" style={{ padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{data?.counts.pdfs ?? '–'}/{DESIGN_LIMIT}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>PDFs (Carousels)</div>
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        <button className="btn btn-primary" onClick={() => handleCreate('card')} disabled={creating !== null}>
          {creating === 'card' ? 'Creating…' : '+ New Single Card'}
        </button>
        <button className="btn btn-outline" onClick={() => handleCreate('carousel')} disabled={creating !== null}>
          {creating === 'carousel' ? 'Creating…' : '+ New Carousel'}
        </button>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Saved designs</h2>

      {!data?.designs.length && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No designs yet — create your first one above.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data?.designs.map((d) => (
          <div key={d.id} className="card-surface" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{d.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {d.format === 'card' ? 'Single Card' : 'Carousel'} · {d.hasExport ? 'Exported' : 'Draft'} · {new Date(d.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                className="btn btn-outline"
                style={{ width: 'auto', height: 36, padding: '0 12px', fontSize: 13 }}
                onClick={() => navigate(`/designs/${d.format}/${d.id}`)}
              >
                Open
              </button>
              <button
                className="btn btn-outline"
                style={{ width: 'auto', height: 36, padding: '0 12px', fontSize: 13, color: 'var(--danger)' }}
                onClick={() => handleDelete(d.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
