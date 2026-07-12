import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Client-side export pipeline. Uses html2canvas (not html-to-image, which
// hangs on this browser awaiting img.decode() of an SVG data URI). Nodes are
// captured at their natural size × 2 for crisp output. Carousel pages use
// JPEG to stay under Cloudinary's 10MB free-tier upload cap.
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
async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll('img'));
  // Cap the wait per image so a stalled/never-settling load can never hang the
  // whole export -- worst case we proceed after IMG_WAIT_MS and let html2canvas
  // do its best with whatever is decoded.
  const IMG_WAIT_MS = 6000;
  await Promise.all(
    imgs.map(async (img) => {
      try {
        if (!img.complete || img.naturalWidth === 0) {
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            const timer = setTimeout(done, IMG_WAIT_MS);
            const settle = () => { clearTimeout(timer); done(); };
            img.addEventListener('load', settle, { once: true });
            img.addEventListener('error', settle, { once: true });
          });
        }
        if (typeof img.decode === 'function') await img.decode().catch(() => undefined);
      } catch {
        /* never let one image block the export */
      }
    }),
  );
}

async function renderNodeToCanvas(node: HTMLElement, w: number, h: number): Promise<HTMLCanvasElement> {
  await waitForImages(node);
  return withTimeout(
    html2canvas(node, { width: w, height: h, scale: 2, useCORS: true, backgroundColor: null }),
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
  const canvas = await renderNodeToCanvas(node, w, h);
  return canvasToPngBlob(canvas);
}

export async function exportCarouselAsPdf(slideNodes: HTMLElement[], w: number, h: number): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'px', format: [w, h], orientation: 'portrait', compress: true });
  for (let i = 0; i < slideNodes.length; i++) {
    const canvas = await renderNodeToCanvas(slideNodes[i], w, h);
    if (i > 0) pdf.addPage([w, h], 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', CAROUSEL_PAGE_JPEG_QUALITY), 'JPEG', 0, 0, w, h);
  }
  return pdf.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
