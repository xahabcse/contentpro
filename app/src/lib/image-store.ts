// Browser images are keyed by both account and image id. The old unscoped keys
// remain readable only through getLegacyImageBlob for explicit migration.

const DB_NAME = 'contentpro';
const STORE = 'images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function imageKey(ownerId: string, id: string): string {
  if (!ownerId) throw new Error('A signed-in account is required to access images.');
  return JSON.stringify([ownerId, id]);
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

// Keep URLs valid while a route is rendering them. Revoking an LRU entry here
// breaks gallery thumbnails: Dashboard retains the URL after it leaves cache.
// Routes release their owner's URLs on unmount instead.
const urlCache = new Map<string, string>();

export function releaseImageUrls(ownerId: string): void {
  const prefix = `[${JSON.stringify(ownerId)},`;
  for (const [key, url] of urlCache) {
    if (!key.startsWith(prefix)) continue;
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

export function newImageId(): string {
  return 'img_' + crypto.randomUUID();
}

export async function putImage(ownerId: string, id: string, blob: Blob): Promise<void> {
  const key = imageKey(ownerId, id);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  // refresh any cached url
  const old = urlCache.get(key);
  if (old) { URL.revokeObjectURL(old); urlCache.delete(key); }
}

async function readImage(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function getImageBlob(ownerId: string, id: string): Promise<Blob | null> {
  return readImage(imageKey(ownerId, id));
}

/** Read the pre-account-scoping image only during an explicit legacy import. */
export function getLegacyImageBlob(id: string): Promise<Blob | null> {
  return readImage(id);
}

/** Materialise an image id to an object URL (cached). Null if not found. */
export async function getImageUrl(ownerId: string, id: string): Promise<string | null> {
  const key = imageKey(ownerId, id);
  const cached = urlCache.get(key);
  if (cached) return cached;
  const blob = await getImageBlob(ownerId, id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export async function deleteImage(ownerId: string, id: string): Promise<void> {
  const key = imageKey(ownerId, id);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const old = urlCache.get(key);
  if (old) { URL.revokeObjectURL(old); urlCache.delete(key); }
}

// ---- backup/restore helpers (base64 <-> blob) ----

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// Decoded by hand, not with fetch(dataUrl): the site's CSP (app/public/_headers)
// limits connect-src to 'self', so the browser refuses to fetch a data: URL and
// every backup with an image failed to restore in production.
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Not a data URL');
  const [, type, base64, payload] = match;
  if (!base64) return new Blob([decodeURIComponent(payload)], { type });
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
