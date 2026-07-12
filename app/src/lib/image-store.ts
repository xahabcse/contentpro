// IndexedDB blob store for design images (background images + per-design
// avatar overrides). Designs live in localStorage as lightweight JSON that
// references images by id; the binaries live here. Object URLs are cached so
// a given image is only materialised once per session.

const DB_NAME = 'contentpro';
const STORE = 'images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Bounded LRU of object URLs. Object URLs are never garbage-collected on their
// own -- without a cap, browsing many designs leaks one per image for the whole
// session. On eviction we revoke the URL; the next getImageUrl re-materialises.
const URL_CACHE_MAX = 60;
const urlCache = new Map<string, string>();

function cacheTouch(id: string, url: string): void {
  urlCache.delete(id);
  urlCache.set(id, url);
  while (urlCache.size > URL_CACHE_MAX) {
    const oldest = urlCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    const stale = urlCache.get(oldest);
    if (stale) URL.revokeObjectURL(stale);
    urlCache.delete(oldest);
  }
}

export function newImageId(): string {
  return 'img_' + crypto.randomUUID();
}

export async function putImage(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  // refresh any cached url
  const old = urlCache.get(id);
  if (old) { URL.revokeObjectURL(old); urlCache.delete(id); }
}

export async function getImageBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Materialise an image id to an object URL (cached). Null if not found. */
export async function getImageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) { cacheTouch(id, cached); return cached; }
  const blob = await getImageBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  cacheTouch(id, url);
  return url;
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const old = urlCache.get(id);
  if (old) { URL.revokeObjectURL(old); urlCache.delete(id); }
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

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
