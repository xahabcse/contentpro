import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Client-side export pipeline (docs/contentpro-spec.md §4.3) -- no server
// rendering anywhere. Canvas nodes are rasterized directly in the browser.
//
// Uses html2canvas (the spec's named fallback, §4.3) rather than
// html-to-image: the latter serializes the DOM to an SVG data URI and awaits
// HTMLImageElement.decode() on it before drawing to canvas, which hangs
// indefinitely on affected Chromium versions (a real, reproduced browser
// bug, not a config issue) -- decode() never settles for SVG-sourced images
// in that scenario, and nothing here ever gets to fire onload/onerror.
// html2canvas walks the DOM and paints directly via Canvas 2D APIs instead,
// with no SVG/decode() step to hang on.
const EXPORT_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), ms)),
  ]);
}

function renderNodeToCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  return withTimeout(
    html2canvas(node, { width: 1080, height: 1080, scale: 2, useCORS: true, backgroundColor: null }),
    EXPORT_TIMEOUT_MS,
    'Rendering',
  );
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not generate the image.'))), 'image/png');
  });
}

export async function exportCardAsPng(node: HTMLElement): Promise<Blob> {
  const canvas = await renderNodeToCanvas(node);
  return canvasToPngBlob(canvas);
}

// JPEG, not PNG, for carousel pages -- Cloudinary's free-tier plan caps
// uploads at 10MB (a real, reproduced account-tier limit, confirmed live: a
// 2-slide PDF with PNG-embedded 1080x1080@2x pages already hit ~32MB, and
// jsPDF embeds PNGs close to raw size with no re-compression of its own).
// JPEG's DCT compression shrinks flat-design/text content dramatically with
// no visible quality loss at this quality level, keeping even a full
// 15-slide carousel (spec §8's hard cap) well under the limit.
const CAROUSEL_PAGE_JPEG_QUALITY = 0.92;

export async function exportCarouselAsPdf(slideNodes: HTMLElement[]): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'px', format: [1080, 1080], orientation: 'portrait' });

  for (let i = 0; i < slideNodes.length; i++) {
    const canvas = await renderNodeToCanvas(slideNodes[i]);
    if (i > 0) pdf.addPage([1080, 1080], 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', CAROUSEL_PAGE_JPEG_QUALITY), 'JPEG', 0, 0, 1080, 1080);
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
