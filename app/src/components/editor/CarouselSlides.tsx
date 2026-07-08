import { forwardRef } from 'react';
import { getPalette, SIZE_SCALE, transparentStop, type RegionStyle } from '@/lib/canvas-theme';
import SocialFooter, { type FooterData } from './SocialFooter';

export type SlideType = 'cover' | 'content' | 'cta';

export interface Slide {
  type: SlideType;
  headline?: string;   // cover
  heading?: string;    // content, cta
  bullets?: string[];  // content
  body?: string;       // content (paragraph mode), cta
  cta?: string;        // cta
}

export interface CarouselStyle {
  paletteId: string;
  regions: {
    coverHeadline: RegionStyle;
    contentHeading: RegionStyle;
    contentBody: RegionStyle;
    ctaHeading: RegionStyle;
    ctaBody: RegionStyle;
    ctaLine: RegionStyle;
  };
}

interface SlideCanvasProps {
  slide: Slide;
  index: number;
  total: number;
  style: CarouselStyle;
  footerData: FooterData;
}

// One 1080x1080 slide -- mirrors templates/carousel-styles.css's three slide
// types exactly (cover / content / cta). Cover is pinned to index 0, CTA to
// the last index -- enforced by the parent editor, not this component.
const SlideCanvas = forwardRef<HTMLDivElement, SlideCanvasProps>(({ slide, index, total, style, footerData }, ref) => {
  const palette = getPalette(style.paletteId);
  const { coverHeadline, contentHeading, contentBody, ctaHeading, ctaBody, ctaLine } = style.regions;
  const base: React.CSSProperties = { width: 1080, height: 1080, position: 'relative', overflow: 'hidden' };

  if (slide.type === 'cover') {
    return (
      <div ref={ref} style={{ ...base, background: palette.bg }}>
        <div style={{ position: 'absolute', right: -220, bottom: -220, width: 900, height: 900, borderRadius: '50%', background: `radial-gradient(circle at center, ${palette.glow} 0%, ${transparentStop(palette.glow)} 70%)` }} />
        <div style={{ position: 'absolute', top: 92, right: 96, width: 88, height: 3, background: palette.text }} />
        <div style={{ position: 'absolute', top: 420, left: 90, right: 0, fontFamily: coverHeadline.font, fontSize: SIZE_SCALE.headline[coverHeadline.size], fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.25, letterSpacing: 0.5, color: coverHeadline.customHex ?? palette.text, maxWidth: 900 }}>
          {slide.headline}
        </div>
        <SocialFooter data={footerData} style={coverHeadline} palette={palette} />
      </div>
    );
  }

  if (slide.type === 'cta') {
    return (
      <div ref={ref} style={{ ...base, background: palette.bg, padding: '130px 110px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', left: -220, top: -220, width: 900, height: 900, borderRadius: '50%', background: `radial-gradient(circle at center, ${palette.glow} 0%, ${transparentStop(palette.glow)} 70%)` }} />
        <h2 style={{ position: 'relative', zIndex: 1, fontFamily: ctaHeading.font, fontSize: SIZE_SCALE.heading[ctaHeading.size], fontWeight: 800, color: ctaHeading.customHex ?? palette.text, lineHeight: 1.3, margin: '0 0 36px 0' }}>
          {slide.heading}
        </h2>
        <p style={{ position: 'relative', zIndex: 1, fontFamily: ctaBody.font, fontSize: SIZE_SCALE.body[ctaBody.size], color: ctaBody.customHex ?? palette.text, lineHeight: 1.6, margin: '0 0 44px 0' }}>
          {slide.body}
        </p>
        <p style={{ position: 'relative', zIndex: 1, fontFamily: ctaLine.font, fontSize: 32, fontWeight: 700, color: ctaLine.customHex ?? palette.accent, margin: 0 }}>
          {slide.cta}
        </p>
      </div>
    );
  }

  // content
  const hasBullets = Array.isArray(slide.bullets) && slide.bullets.length > 0;
  return (
    <div ref={ref} style={{ ...base, background: '#FFFFFF', padding: '110px 96px' }}>
      <h2 style={{ fontFamily: contentHeading.font, fontSize: SIZE_SCALE.heading[contentHeading.size], fontWeight: 800, color: contentHeading.customHex ?? palette.text, textAlign: 'center', margin: '0 0 70px 0' }}>
        {slide.heading}
      </h2>
      {hasBullets ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {slide.bullets!.map((b, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 48, fontFamily: contentBody.font, fontSize: SIZE_SCALE.body[contentBody.size], fontWeight: 600, lineHeight: 1.5, color: contentBody.customHex ?? palette.text }}>
              <span style={{ flex: '0 0 64px', height: 64, borderRadius: '50%', background: palette.glow, color: palette.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontFamily: contentBody.font, fontSize: SIZE_SCALE.body[contentBody.size], fontWeight: 400, lineHeight: 1.6, color: contentBody.customHex ?? palette.text }}>
          {slide.body}
        </p>
      )}
      <div style={{ position: 'absolute', bottom: 50, left: 96, fontSize: 20, fontWeight: 600, color: palette.muted }}>
        {index + 1} / {total}
      </div>
    </div>
  );
});

SlideCanvas.displayName = 'SlideCanvas';
export default SlideCanvas;

export const DEFAULT_CAROUSEL_STYLE: CarouselStyle = {
  paletteId: 'brand-green',
  regions: {
    coverHeadline: { font: 'Plus Jakarta Sans', size: 'M' },
    contentHeading: { font: 'Plus Jakarta Sans', size: 'M' },
    contentBody: { font: 'Plus Jakarta Sans', size: 'M' },
    ctaHeading: { font: 'Plus Jakarta Sans', size: 'M' },
    ctaBody: { font: 'Plus Jakarta Sans', size: 'M' },
    ctaLine: { font: 'Plus Jakarta Sans', size: 'M' },
  },
};

export function newContentSlide(): Slide {
  return { type: 'content', heading: '', body: '' };
}

export function defaultSlides(): Slide[] {
  return [
    { type: 'cover', headline: '' },
    newContentSlide(),
    { type: 'cta', heading: '', body: '', cta: '' },
  ];
}
