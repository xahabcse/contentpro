import type { DesignType, LocalDesign, Slide, TemplateId } from './design-types';
import { TEMPLATES, templateDefaults } from './templates';
import { blobToDataUrl, dataUrlToBlob, deleteImage, getImageBlob, getLegacyImageBlob, newImageId, putImage } from './image-store';

// The signed-in account is explicit on every operation. Legacy data has no
// owner, so it is never assigned to an account without a user action.
const KEY_PREFIX = 'contentpro.designs.v2.';
const SEEDED_PREFIX = 'contentpro.seeded.v2.';
const LEGACY_KEY = 'contentpro.designs.v1';
const LEGACY_IMPORT_OWNER = 'contentpro.legacy-import-owner.v1';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

function ownerKey(prefix: string, ownerId: string): string {
  if (!ownerId) throw new Error('A signed-in account is required to access designs.');
  return prefix + encodeURIComponent(ownerId);
}

export function designStorageKey(ownerId: string): string {
  return ownerKey(KEY_PREFIX, ownerId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isDesign(value: unknown): value is LocalDesign {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
      (value.type !== 'card' && value.type !== 'carousel') ||
      typeof value.paletteId !== 'string' ||
      !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt) ||
      !isOptionalText(value.title) || !isOptionalText(value.customBg) ||
      !isOptionalText(value.customText) || !isOptionalText(value.customAccent) ||
      !Array.isArray(value.slides) || value.slides.length < 1 || value.slides.length > 15) return false;
  if (value.authorOverride !== undefined && value.authorOverride !== null) {
    if (!isRecord(value.authorOverride) || !isOptionalText(value.authorOverride.name) ||
        !isOptionalText(value.authorOverride.handle) || !isOptionalText(value.authorOverride.avatarImageId)) return false;
  }
  for (const slide of value.slides) {
    if (!isRecord(slide) || typeof slide.template !== 'string' || !Object.hasOwn(TEMPLATES, slide.template) ||
        !isOptionalText(slide.bgImageId) || !isRecord(slide.fields)) return false;
    for (const field of Object.values(slide.fields)) {
      if (typeof field !== 'string' && !(Array.isArray(field) && field.every((part) => typeof part === 'string'))) return false;
    }
  }
  return true;
}

function parseDesigns(value: unknown): LocalDesign[] {
  if (!Array.isArray(value) || !value.every(isDesign)) {
    throw new Error('Saved designs are invalid. Restore a valid Cardstock backup.');
  }
  return value;
}

function readAll(ownerId: string): LocalDesign[] {
  const raw = localStorage.getItem(designStorageKey(ownerId));
  if (raw === null) return [];
  try { return parseDesigns(JSON.parse(raw)); }
  catch { throw new Error('Saved designs could not be read. Your data was not overwritten.'); }
}

export class StorageFullError extends Error {
  constructor() {
    super("Couldn't save — browser storage is full. Back up and delete old designs.");
    this.name = 'StorageFullError';
  }
}

export class DesignConflictError extends Error {
  constructor() {
    super('Another tab changed this design. Your changes remain in this tab; reload before editing further.');
    this.name = 'DesignConflictError';
  }
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

function writeAll(ownerId: string, designs: LocalDesign[]): void {
  try { localStorage.setItem(designStorageKey(ownerId), JSON.stringify(designs)); }
  catch (error) {
    if (isQuotaError(error)) throw new StorageFullError();
    throw error;
  }
}

function imageIds(designs: LocalDesign[]): Set<string> {
  const ids = new Set<string>();
  for (const design of designs) {
    for (const slide of design.slides) if (slide.bgImageId) ids.add(slide.bgImageId);
    if (design.authorOverride?.avatarImageId) ids.add(design.authorOverride.avatarImageId);
  }
  return ids;
}

async function cleanupRemovedImages(ownerId: string, candidates: Set<string>): Promise<void> {
  if (!candidates.size) return;
  const stillUsed = imageIds(readAll(ownerId));
  for (const id of candidates) if (!stillUsed.has(id)) await deleteImage(ownerId, id);
}

export function listDesigns(ownerId: string): LocalDesign[] {
  return readAll(ownerId).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDesign(ownerId: string, id: string): LocalDesign | null {
  return readAll(ownerId).find((design) => design.id === id) ?? null;
}

/** expectedUpdatedAt prevents a stale editor tab from replacing a newer save. */
export function saveDesign(ownerId: string, design: LocalDesign, expectedUpdatedAt?: number): LocalDesign {
  const all = readAll(ownerId);
  const index = all.findIndex((item) => item.id === design.id);
  const previous = index >= 0 ? all[index] : null;
  if (expectedUpdatedAt !== undefined && previous?.updatedAt !== expectedUpdatedAt) throw new DesignConflictError();
  const next = { ...design, updatedAt: Math.max(Date.now(), (previous?.updatedAt ?? 0) + 1) };
  if (index >= 0) all[index] = next;
  else all.push(next);
  writeAll(ownerId, all);
  if (previous) {
    const removed = imageIds([previous]);
    for (const id of imageIds([next])) removed.delete(id);
    void cleanupRemovedImages(ownerId, removed).catch(() => {});
  }
  return next;
}

export async function deleteDesign(ownerId: string, id: string): Promise<void> {
  const all = readAll(ownerId);
  const previous = all.find((design) => design.id === id);
  if (!previous) return;
  writeAll(ownerId, all.filter((design) => design.id !== id));
  await cleanupRemovedImages(ownerId, imageIds([previous])).catch(() => {});
}

function starterSlides(type: DesignType, firstTemplate?: TemplateId): Slide[] {
  const make = (template: TemplateId): Slide => ({ template, fields: templateDefaults(template), bgImageId: null });
  if (type === 'card') return [make(firstTemplate ?? 'quote')];
  return [make(firstTemplate ?? 'cover'), make('stat'), make('tips'), make('framework'), make('cta')];
}

export function createDesign(ownerId: string, type: DesignType, firstTemplate?: TemplateId): LocalDesign {
  const now = Date.now();
  const design: LocalDesign = {
    id: 'dsn_' + crypto.randomUUID(), type, paletteId: type === 'card' ? 'paper' : 'ink',
    customBg: null, customText: null, customAccent: null,
    slides: starterSlides(type, firstTemplate), createdAt: now, updatedAt: now,
  };
  return saveDesign(ownerId, design);
}

export async function duplicateDesign(ownerId: string, id: string): Promise<LocalDesign | null> {
  const source = getDesign(ownerId, id);
  if (!source) return null;
  const mapped = new Map<string, string>();
  const created: string[] = [];
  const cloneImage = async (oldId: string | null | undefined): Promise<string | null> => {
    if (!oldId) return null;
    if (mapped.has(oldId)) return mapped.get(oldId)!;
    const blob = await getImageBlob(ownerId, oldId);
    if (!blob) throw new Error('One of the design images is missing. The copy was not created.');
    const newId = newImageId();
    await putImage(ownerId, newId, blob);
    created.push(newId);
    mapped.set(oldId, newId);
    return newId;
  };
  try {
    const slides: Slide[] = [];
    for (const slide of source.slides) slides.push({ ...slide, bgImageId: await cloneImage(slide.bgImageId) });
    const avatarId = await cloneImage(source.authorOverride?.avatarImageId);
    const now = Date.now();
    const copy: LocalDesign = {
      ...source, id: 'dsn_' + crypto.randomUUID(), title: (source.title || 'Untitled') + ' (copy)',
      slides,
      authorOverride: source.authorOverride ? { ...source.authorOverride, avatarImageId: avatarId } : undefined,
      createdAt: now, updatedAt: now,
    };
    return saveDesign(ownerId, copy);
  } catch (error) {
    await Promise.allSettled(created.map((imageId) => deleteImage(ownerId, imageId)));
    throw error;
  }
}

export function ensureSeeded(ownerId: string): void {
  const seededKey = ownerKey(SEEDED_PREFIX, ownerId);
  if (localStorage.getItem(seededKey)) return;
  if (readAll(ownerId).length > 0) { localStorage.setItem(seededKey, '1'); return; }
  const now = Date.now();
  const make = (title: string, paletteId: string, template: TemplateId, fields: Record<string, string | string[]>): LocalDesign => ({
    id: 'dsn_' + crypto.randomUUID(), type: 'card', title, paletteId,
    customBg: null, customText: null, customAccent: null,
    slides: [{ template, fields, bgImageId: null }], createdAt: now, updatedAt: now,
  });
  writeAll(ownerId, [
    make('Example: Consistency', 'ink', 'quote', { quote: 'Consistency beats intensity. Small, steady effort compounds faster than occasional bursts.' }),
    make('Example: By the Numbers', 'cobalt', 'stat', { label: 'One year of learning', number: '52', caption: 'weeks of showing up and sharing something new — here is what changed.' }),
  ]);
  localStorage.setItem(seededKey, '1');
}

export async function storagePressure(): Promise<{ usage: number; quota: number; ratio: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, ratio: quota ? usage / quota : 0 };
}

interface BackupFile {
  app: 'contentpro';
  version: 1;
  designs: LocalDesign[];
  images: Record<string, string>;
}

export async function buildBackup(ownerId: string): Promise<Blob> {
  const designs = readAll(ownerId);
  const images: Record<string, string> = {};
  for (const id of imageIds(designs)) {
    const blob = await getImageBlob(ownerId, id);
    if (!blob) throw new Error('A design image is missing. The backup was not created.');
    images[id] = await blobToDataUrl(blob);
  }
  const payload: BackupFile = { app: 'contentpro', version: 1, designs, images };
  const backup = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  if (backup.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 100 MB. Remove some large images before downloading it.');
  return backup;
}

async function importDesigns(
  ownerId: string,
  designs: LocalDesign[],
  readImage: (id: string) => Promise<Blob | null>,
  requireImages: boolean,
): Promise<number> {
  const mapped = new Map<string, string>();
  const created: string[] = [];
  const blobs = new Map<string, Blob>();
  for (const oldId of imageIds(designs)) {
    const blob = await readImage(oldId);
    if (!blob) {
      if (requireImages) throw new Error('The backup is missing a design image. Nothing was restored.');
      continue;
    }
    if (!blob.type.startsWith('image/')) throw new Error('The backup contains a non-image file. Nothing was restored.');
    const newId = newImageId();
    mapped.set(oldId, newId);
    blobs.set(newId, blob);
  }
  const remap = (oldId: string | null | undefined): string | null => oldId ? mapped.get(oldId) ?? null : null;
  const incoming = designs.map((design) => ({
    ...design,
    id: 'dsn_' + crypto.randomUUID(),
    slides: design.slides.map((slide) => ({ ...slide, bgImageId: remap(slide.bgImageId) })),
    authorOverride: design.authorOverride ? { ...design.authorOverride, avatarImageId: remap(design.authorOverride.avatarImageId) } : undefined,
  }));
  // New ids protect existing designs and images from collisions. If any write
  // fails, remove only images created by this import; existing data is intact.
  try {
    for (const [id, blob] of blobs) { await putImage(ownerId, id, blob); created.push(id); }
    writeAll(ownerId, [...readAll(ownerId), ...incoming]);
    return incoming.length;
  } catch (error) {
    await Promise.allSettled(created.map((id) => deleteImage(ownerId, id)));
    throw error;
  }
}

export async function restoreBackup(ownerId: string, file: File): Promise<number> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('That backup file is too large to restore.');
  let raw: unknown;
  try { raw = JSON.parse(await file.text()); }
  catch { throw new Error('Not a valid Cardstock backup file.'); }
  if (!isRecord(raw) || raw.app !== 'contentpro') throw new Error('Not a valid Cardstock backup file.');
  if (raw.version !== 1) throw new Error('This backup version is not supported.');
  const designs = parseDesigns(raw.designs);
  if (!isRecord(raw.images)) throw new Error('The backup image list is invalid.');
  const imageData = raw.images;
  const referenced = imageIds(designs);
  for (const id of referenced) {
    if (typeof imageData[id] !== 'string' || !/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(imageData[id])) {
      throw new Error('The backup is missing a valid design image. Nothing was restored.');
    }
  }
  const blobs = new Map<string, Blob>();
  try {
    for (const id of referenced) blobs.set(id, await dataUrlToBlob(imageData[id] as string));
  } catch {
    throw new Error('The backup contains an unreadable image. Nothing was restored.');
  }
  return importDesigns(ownerId, designs, async (id) => blobs.get(id) ?? null, true);
}

/** Legacy designs have no owner. Never assign them automatically on login. */
export function legacyImportAvailable(): boolean {
  if (localStorage.getItem(LEGACY_IMPORT_OWNER)) return false;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return false;
  try { return parseDesigns(JSON.parse(raw)).length > 0; }
  catch { return false; }
}

export async function importLegacyDesigns(ownerId: string): Promise<number> {
  if (localStorage.getItem(LEGACY_IMPORT_OWNER)) throw new Error('Legacy designs were already imported into an account on this browser.');
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return 0;
  const designs = parseDesigns(JSON.parse(raw));
  const count = await importDesigns(ownerId, designs, getLegacyImageBlob, false);
  localStorage.setItem(LEGACY_IMPORT_OWNER, ownerId);
  return count;
}
