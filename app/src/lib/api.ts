import type { DesignType } from './design-types';

export interface DesignSummary {
  id: string;
  type: DesignType;
  title: string | null;
  fileType: 'image' | 'pdf';
  paletteId: string;
  slideCount: number;
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

export async function createDesign(type: DesignType): Promise<{ id: string }> {
  const res = await fetch('/api/designs', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Could not start a new design.');
  }
  return res.json();
}

export async function deleteDesign(id: string): Promise<void> {
  const res = await fetch(`/api/designs/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error('Failed to delete design');
}

export const DESIGN_LIMIT = LIMIT;
