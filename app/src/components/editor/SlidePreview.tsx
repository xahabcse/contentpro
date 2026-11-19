import { useEffect, useRef, useState, type CSSProperties } from 'react';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { resolveColors, type ResolvedColors } from '@/lib/palettes';
import { templateDefaults } from '@/lib/templates';
import type { FooterData, ResolvedSlide, TemplateId } from '@/lib/design-types';

// The demo signature used on public pages (landing, auth, about, 404).
const DEMO_FOOTER: FooterData = {
  name: 'Md Sahabuddin Hossain',
  handle: 'xahabcse',
  designation: 'Software Engineer',
  avatar: null,
};

interface SlidePreviewProps {
  // Either a ready slide + colours, or a template id + palette id.
  slide?: ResolvedSlide;
  colors?: ResolvedColors;
  template?: TemplateId;
  palette?: string;
  format?: 'card' | 'carousel';
  footer?: FooterData;
  // Render only when near the viewport (long galleries).
  lazy?: boolean;
  className?: string;
  style?: CSSProperties;
}

// A real exported-card render, scaled to whatever width its box has.
export default function SlidePreview({ slide, colors, template, palette = 'ink', format = 'card', footer = DEMO_FOOTER, lazy = false, className, style }: SlidePreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(!lazy);
  const height = format === 'card' ? 1080 : 1350;
  const resolvedColors = colors ?? resolveColors(palette, {});
  const resolvedSlide: ResolvedSlide = slide ?? { template: template ?? 'cover', fields: templateDefaults(template ?? 'cover'), bgImage: null };

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const update = () => {
      const next = Math.round(node.getBoundingClientRect().width);
      setWidth((old) => (old === next ? old : next));
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = boxRef.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className={`slide-preview${className ? ' ' + className : ''}`}
      style={{ aspectRatio: `1080 / ${height}`, background: resolvedColors.bg, ...style }}
    >
      {visible && width > 0 && (
        <div style={{ width: 1080, height, transform: `scale(${width / 1080})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <SlideCanvas slide={resolvedSlide} colors={resolvedColors} footer={footer} width={1080} height={height} />
        </div>
      )}
    </div>
  );
}
