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

function renderNodeToCanvas(node: HTMLElement, w: number, h: number): Promise<HTMLCanvasElement> {
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
