import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Client-side export pipeline (docs/contentpro-spec.md §4.3) -- no server
// rendering anywhere. Canvas nodes are rasterized directly in the browser.
//
// html-to-image internally awaits document.fonts.ready before rasterizing,
// which is known to hang indefinitely in some browser/automation contexts
// rather than reject -- without a bound, a hang here leaves the user stuck
// on "Exporting..." forever with no error. EXPORT_TIMEOUT_MS turns that into
// a clear, recoverable error instead.
const EXPORT_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), ms)),
  ]);
}

export async function exportCardAsPng(node: HTMLElement): Promise<Blob> {
  const dataUrl = await withTimeout(
    toPng(node, { width: 1080, height: 1080, pixelRatio: 2 }),
    EXPORT_TIMEOUT_MS,
    'Rendering the card',
  );
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function exportCarouselAsPdf(slideNodes: HTMLElement[]): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'px', format: [1080, 1080], orientation: 'portrait' });

  for (let i = 0; i < slideNodes.length; i++) {
    const dataUrl = await withTimeout(
      toPng(slideNodes[i], { width: 1080, height: 1080, pixelRatio: 2 }),
      EXPORT_TIMEOUT_MS,
      `Rendering slide ${i + 1}`,
    );
    if (i > 0) pdf.addPage([1080, 1080], 'portrait');
    pdf.addImage(dataUrl, 'PNG', 0, 0, 1080, 1080);
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
