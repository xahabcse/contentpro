export interface DesignSummary {
  id: string;
  format: 'card' | 'carousel';
  title: string;
  fileType: 'image' | 'pdf';
  hasExport: boolean;
  updatedAt: string;
}

export interface DesignCounts {
  images: number;
  pdfs: number;
}

export interface DesignsListResponse {
  designs: DesignSummary[];
  counts: DesignCounts;
}

const LIMIT = 5;

export async function listDesigns(): Promise<DesignsListResponse> {
  const res = await fetch('/api/designs', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load designs');
  return res.json();
}

export async function createDesign(format: 'card' | 'carousel'): Promise<{ id: string }> {
  const res = await fetch('/api/designs', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Could not start a new design — complete your profile first.');
  }
  return res.json();
}

export async function deleteDesign(id: string): Promise<void> {
  const res = await fetch(`/api/designs/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error('Failed to delete design');
}

export const DESIGN_LIMIT = LIMIT;
