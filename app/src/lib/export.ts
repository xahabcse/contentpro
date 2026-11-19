// Client-side export pipeline. Uses html2canvas (not html-to-image, which
// hangs on this browser awaiting img.decode() of an SVG data URI). Cards export
// at their stated 1080×1080 size; PDF pages rasterize at 2× for sharp text.
// Carousel pages use JPEG to keep a multi-page PDF's file size manageable.
const EXPORT_TIMEOUT_MS = 25_000;
const CAROUSEL_PAGE_JPEG_QUALITY = 0.92;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), ms)),
  ]);
}

// Guarantee every <img> inside the node (background photo, avatar, company
// logo) is fully loaded AND decoded before html2canvas reads it. Without this,
// a capture fired right after a background change could race the browser's
// async image decode and paint a stale/blank frame -- the "downloaded card
// still shows the previous background" class of bug.
// Resolve after `ms`, regardless of what else happens. Used to cap every wait
// below so nothing can hang the export.
function timeoutAfter(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settleImage(img: HTMLImageElement): Promise<void> {
  try {
    // Wait for a still-loading image to finish, capped so a stalled load can't
    // block. A broken image is already `complete` with naturalWidth 0 -- don't
    // wait on it (no further load/error event will ever fire).
    if (!img.complete) {
      await Promise.race([
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
        timeoutAfter(5000),
      ]);
    }
    // decode() is best-effort: it removes the stale-frame race for freshly-
    // swapped backgrounds, but on some cross-origin / broken images it can
    // REJECT *or never settle at all* -- .catch() only covers rejection, so it
    // must be raced against a timeout or it hangs the whole export. Skip it
    // entirely for images that failed to load.
    if (img.naturalWidth > 0 && typeof img.decode === 'function') {
      await Promise.race([img.decode().catch(() => undefined), timeoutAfter(1500)]);
    }
  } catch {
    /* never let one image block the export */
  }
}

// Guarantee every <img> inside the node (background photo, avatar, company
// logo) is loaded/decoded before html2canvas reads it -- without this, a capture
// fired right after a background change could paint a stale/blank frame. The
// whole thing is also hard-capped so it can never hang the export.
async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.race([Promise.all(imgs.map(settleImage)), timeoutAfter(8000)]);
}

async function renderNodeToCanvas(node: HTMLElement, w: number, h: number, scale: number): Promise<HTMLCanvasElement> {
  await waitForImages(node);
  const { default: html2canvas } = await import('html2canvas');
  return withTimeout(
    html2canvas(node, { width: w, height: h, scale, useCORS: true, backgroundColor: null, logging: false }),
    EXPORT_TIMEOUT_MS,
    'Rendering',
  );
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not generate the image.'))), 'image/png');
  });
}

export async function exportCardAsPng(node: HTMLElement, w: number, h: number): Promise<Blob> {
  const canvas = await renderNodeToCanvas(node, w, h, 1);
  return canvasToPngBlob(canvas);
}

/** Called before each slide is drawn: (slide number starting at 1, total slides). */
export type ExportProgress = (done: number, total: number) => void;

export async function exportCarouselAsPdf(slideNodes: HTMLElement[], w: number, h: number, onProgress?: ExportProgress): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'px', format: [w, h], orientation: 'portrait', compress: true });
  for (let i = 0; i < slideNodes.length; i++) {
    onProgress?.(i + 1, slideNodes.length);
    const canvas = await renderNodeToCanvas(slideNodes[i], w, h, 2);
    if (i > 0) pdf.addPage([w, h], 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', CAROUSEL_PAGE_JPEG_QUALITY), 'JPEG', 0, 0, w, h);
  }
  return pdf.output('blob');
}

/** PNG slides can be uploaded individually to platforms that do not accept PDF carousels. */
export async function exportCarouselAsPngZip(slideNodes: HTMLElement[], w: number, h: number, onProgress?: ExportProgress): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (let i = 0; i < slideNodes.length; i++) {
    onProgress?.(i + 1, slideNodes.length);
    const canvas = await renderNodeToCanvas(slideNodes[i], w, h, 1);
    zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, await canvasToPngBlob(canvas));
  }
  // PNG is already compressed; storing avoids slow, redundant recompression.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
