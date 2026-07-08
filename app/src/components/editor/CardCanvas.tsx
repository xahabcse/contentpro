import { forwardRef } from 'react';
import { getPalette, SIZE_SCALE, type RegionStyle } from '@/lib/canvas-theme';
import SocialFooter, { type FooterData } from './SocialFooter';

export interface CardContent {
  eyebrow: string;
  headline: string;
  body: string[];
}

export interface CardStyle {
  paletteId: string;
  regions: {
    eyebrow: RegionStyle;
    headline: RegionStyle;
    body: RegionStyle;
    footer: RegionStyle;
  };
}

interface CardCanvasProps {
  content: CardContent;
  style: CardStyle;
  footerData: FooterData;
}

// Fixed-layout templated canvas -- mirrors templates/single-card.html
// exactly (eyebrow, headline, 1-2 body paragraphs, two-line centered
// footer). Regions cannot be moved/resized; only their filled content and
// curated font/size/color are editable (spec §6.1, decision 13).
const CardCanvas = forwardRef<HTMLDivElement, CardCanvasProps>(({ content, style, footerData }, ref) => {
  const palette = getPalette(style.paletteId);
  const { eyebrow, headline, body, footer } = style.regions;
  const headlineColor = headline.customHex ?? palette.text;
  const bodyColor = body.customHex ?? palette.text;

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background: palette.bg,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -220,
          bottom: -220,
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: `radial-gradient(circle at center, ${palette.glow} 0%, transparent 70%)`,
        }}
      />
      <div style={{ position: 'absolute', top: 80, right: 90, width: 88, height: 3, background: palette.text }} />

      <div style={{ position: 'relative', zIndex: 1, flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 90px' }}>
        <div style={{ fontFamily: eyebrow.font, fontSize: 20, fontWeight: 700, letterSpacing: 2, color: palette.accentStrong, textTransform: 'uppercase', marginBottom: 22 }}>
          {content.eyebrow}
        </div>
        <h1 style={{ fontFamily: headline.font, fontSize: SIZE_SCALE.headline[headline.size], fontWeight: 800, lineHeight: 1.2, color: headlineColor, maxWidth: 880, margin: '0 0 30px 0' }}>
          {content.headline}
        </h1>
        {content.body.filter(Boolean).map((p, i) => (
          <p key={i} style={{ fontFamily: body.font, fontSize: SIZE_SCALE.body[body.size], fontWeight: 400, lineHeight: 1.5, color: bodyColor, maxWidth: 860, margin: '0 0 20px 0' }}>
            {p}
          </p>
        ))}
      </div>

      <SocialFooter data={footerData} style={footer} palette={palette} />
    </div>
  );
});

CardCanvas.displayName = 'CardCanvas';
export default CardCanvas;
