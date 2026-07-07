import type { CURATED_PALETTES } from '@/lib/canvas-theme';
import type { RegionStyle } from '@/lib/canvas-theme';

export interface FooterData {
  photoUrl: string | null;
  companyLogoUrl: string | null;
  handle: string;
  designation: string;
}

interface SocialFooterProps {
  data: FooterData;
  style: RegionStyle;
  palette: (typeof CURATED_PALETTES)[number];
}

// Two-line centered contact footer -- line 1: photo + 4 fixed social icons +
// shared handle; line 2: company logo + designation. Matches
// templates/single-card.html and templates/carousel-styles.css exactly
// (decision 16: fixed field set, not per-platform configurable).
export default function SocialFooter({ data, style, palette }: SocialFooterProps) {
  const designationColor = style.customHex ?? palette.muted;

  return (
    <div style={{ position: 'relative', zIndex: 1, flex: '0 0 auto', padding: '0 90px 56px 90px' }}>
      <div style={{ height: 1, background: palette.line, marginBottom: 20 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {data.photoUrl ? (
          <img
            src={data.photoUrl}
            alt=""
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #FFFFFF', boxShadow: '0 3px 10px rgba(17,34,26,0.18)' }}
          />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: palette.line }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6 }}>
          {SOCIAL_ICONS.map((Icon, i) => (
            <span
              key={i}
              style={{ width: 34, height: 34, borderRadius: '50%', background: palette.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon />
            </span>
          ))}
        </div>

        <div style={{ fontFamily: style.font, fontSize: 22, fontWeight: 700, color: palette.accentStrong, marginLeft: 8, whiteSpace: 'nowrap' }}>
          {data.handle}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
        {data.companyLogoUrl ? (
          <img src={data.companyLogoUrl} alt="" style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'contain', background: '#FFFFFF', border: `1px solid ${palette.line}`, padding: 3 }} />
        ) : (
          <div style={{ width: 30, height: 30, borderRadius: 7, background: palette.line }} />
        )}
        <div style={{ fontFamily: style.font, fontSize: 19, fontWeight: 500, color: designationColor, whiteSpace: 'nowrap' }}>
          {data.designation}
        </div>
      </div>
    </div>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="#FFFFFF">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7c-.28-.04-1.24-.12-2.36-.12-2.34 0-3.94 1.43-3.94 4.04V9.9H8v3.1h2.4v8h3.1z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="#FFFFFF">
      <path d="M12 3a9 9 0 00-7.6 13.8L3 21l4.3-1.4A9 9 0 1012 3zm0 1.8a7.2 7.2 0 016.1 11.1l-.2.4.7 2.4-2.5-.7-.4.2A7.2 7.2 0 1112 4.8zm-3.2 3.6c-.2 0-.5 0-.7.3-.2.3-.9.8-.9 2s.9 2.3 1 2.5c.1.1 1.7 2.7 4.1 3.7 2 .8 2.4.7 2.9.6.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.6-.3-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.1-.2.3-.7.9-.8 1.1-.2.2-.3.2-.5.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.5.1-.6l.4-.5c.1-.1.1-.3.2-.4.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4z" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="#FFFFFF">
      <path d="M3 6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5v11a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-11zm2 .3v.4l7 4.9 7-4.9v-.4l-7 4.4-7-4.4z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="#FFFFFF">
      <path d="M6.94 8.5H4.5V19h2.44V8.5zM5.72 4.5a1.42 1.42 0 100 2.84 1.42 1.42 0 000-2.84zM19.5 19h-2.44v-5.4c0-1.29-.03-2.94-1.8-2.94-1.8 0-2.08 1.4-2.08 2.85V19h-2.44V8.5h2.34v1.43h.03c.33-.62 1.12-1.28 2.31-1.28 2.47 0 2.93 1.63 2.93 3.74V19z" />
    </svg>
  );
}

const SOCIAL_ICONS = [FacebookIcon, WhatsAppIcon, GmailIcon, LinkedInIcon];
