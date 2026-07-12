import type { DesignType, LocalDesign, Slide, TemplateId } from './design-types';
import { templateDefaults } from './templates';
import { blobToDataUrl, dataUrlToBlob, deleteImage, getImageBlob, putImage } from './image-store';

// Browser-only design persistence: designs live in localStorage as lightweight
// JSON (image binaries live in IndexedDB, referenced by id). No server round-trip.

const KEY = 'contentpro.designs.v1';
const SEEDED = 'contentpro.seeded.v1';

function readAll(): LocalDesign[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalDesign[]) : [];
  } catch {
    return [];
  }
}
function writeAll(designs: LocalDesign[]): void {
  localStorage.setItem(KEY, JSON.stringify(designs));
}

export function listDesigns(): LocalDesign[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDesign(id: string): LocalDesign | null {
  return readAll().find((d) => d.id === id) ?? null;
}

export function saveDesign(design: LocalDesign): void {
  const all = readAll();
  const i = all.findIndex((d) => d.id === design.id);
  const next = { ...design, updatedAt: Date.now() };
  if (i >= 0) all[i] = next;
  else all.push(next);
  writeAll(all);
}

export async function deleteDesign(id: string): Promise<void> {
  const all = readAll();
  const design = all.find((d) => d.id === id);
  if (design) {
    // free the design's images from IndexedDB
    for (const s of design.slides) if (s.bgImageId) await deleteImage(s.bgImageId).catch(() => {});
    if (design.authorOverride?.avatarImageId) await deleteImage(design.authorOverride.avatarImageId).catch(() => {});
  }
  writeAll(all.filter((d) => d.id !== id));
}

function starterSlides(type: DesignType): Slide[] {
  const mk = (t: TemplateId): Slide => ({ template: t, fields: templateDefaults(t), bgImageId: null });
  if (type === 'card') return [mk('quote')];
  return [mk('cover'), mk('stat'), mk('tips'), mk('framework'), mk('cta')];
}

export function createDesign(type: DesignType): LocalDesign {
  const now = Date.now();
  const design: LocalDesign = {
    id: 'dsn_' + crypto.randomUUID(),
    type,
    paletteId: type === 'card' ? 'bone' : 'ink',
    customBg: null,
    customText: null,
    customAccent: null,
    slides: starterSlides(type),
    createdAt: now,
    updatedAt: now,
  };
  saveDesign(design);
  return design;
}

// Seed two ready example cards the first time (empty + not seeded before).
export function ensureSeeded(): void {
  if (localStorage.getItem(SEEDED)) return;
  if (readAll().length > 0) { localStorage.setItem(SEEDED, '1'); return; }
  const now = Date.now();
  const mk = (title: string, paletteId: string, template: TemplateId, fields: Record<string, string | string[]>): LocalDesign => ({
    id: 'dsn_' + crypto.randomUUID(),
    type: 'card',
    title,
    paletteId,
    customBg: null,
    customText: null,
    customAccent: null,
    slides: [{ template, fields, bgImageId: null }],
    createdAt: now,
    updatedAt: now,
  });
  const examples: LocalDesign[] = [
    mk('Example: Consistency', 'ink', 'quote', { quote: 'Consistency beats intensity. Small, steady effort compounds faster than occasional bursts.' }),
    mk('Example: By the Numbers', 'cobalt', 'stat', { label: 'One year of learning', number: '52', caption: 'weeks of showing up and sharing something new — here is what changed.' }),
  ];
  writeAll([...readAll(), ...examples]);
  localStorage.setItem(SEEDED, '1');
}

// ---- storage quota (soft warning) ----

export async function storagePressure(): Promise<{ usage: number; quota: number; ratio: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, ratio: quota ? usage / quota : 0 };
}

// ---- backup / restore ----

interface BackupFile {
  app: 'contentpro';
  version: 1;
  designs: LocalDesign[];
  images: Record<string, string>; // imageId -> data URL
}

export async function buildBackup(): Promise<Blob> {
  const designs = readAll();
  const ids = new Set<string>();
  for (const d of designs) {
    for (const s of d.slides) if (s.bgImageId) ids.add(s.bgImageId);
    if (d.authorOverride?.avatarImageId) ids.add(d.authorOverride.avatarImageId);
  }
  const images: Record<string, string> = {};
  for (const id of ids) {
    const blob = await getImageBlob(id);
    if (blob) images[id] = await blobToDataUrl(blob);
  }
  const payload: BackupFile = { app: 'contentpro', version: 1, designs, images };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function restoreBackup(file: File): Promise<number> {
  const text = await file.text();
  const data = JSON.parse(text) as BackupFile;
  if (data.app !== 'contentpro' || !Array.isArray(data.designs)) {
    throw new Error('Not a valid ContentPro backup file.');
  }
  // restore images first
  for (const [id, dataUrl] of Object.entries(data.images || {})) {
    const blob = await dataUrlToBlob(dataUrl);
    await putImage(id, blob);
  }
  // merge designs (imported ones win on id collision)
  const existing = readAll();
  const byId = new Map(existing.map((d) => [d.id, d] as const));
  for (const d of data.designs) byId.set(d.id, d);
  writeAll(Array.from(byId.values()));
  return data.designs.length;
}
