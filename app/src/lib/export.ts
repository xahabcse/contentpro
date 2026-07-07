import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Client-side export pipeline (docs/contentpro-spec.md §4.3) -- no server
// rendering anywhere. Canvas nodes are rasterized directly in the browser.
// Font-embedding: the curated fonts (canvas-theme.ts) must be loaded as
// @font-face rules the browser has already painted at least once before
// capture, or html-to-image can silently miss them -- see index.css import.

export async function exportCardAsPng(node: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(node, { width: 1080, height: 1080, pixelRatio: 2, cacheBust: true });
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function exportCarouselAsPdf(slideNodes: HTMLElement[]): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'px', format: [1080, 1080], orientation: 'portrait' });

  for (let i = 0; i < slideNodes.length; i++) {
    const dataUrl = await toPng(slideNodes[i], { width: 1080, height: 1080, pixelRatio: 2, cacheBust: true });
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
