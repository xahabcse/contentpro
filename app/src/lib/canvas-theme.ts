// Fixed canvas/export tokens (docs/contentpro-spec.md §3.2, §6.1) -- these
// govern the actual exported design and are DELIBERATELY separate from the
// app-chrome tokens in styles/tokens.css. An exported PNG/PDF must always
// render exactly as chosen here, regardless of the app's own theme.

export const CURATED_FONTS = [
  'Plus Jakarta Sans',
  'Inter',
  'Manrope',
  'Sora',
  'IBM Plex Sans',
  'Work Sans',
  'Poppins',
] as const;
export type CuratedFont = typeof CURATED_FONTS[number];

export const CURATED_PALETTES = [
  { id: 'brand-green', label: 'Brand Green', bg: '#E7EFEA', glow: '#DBF0E2', text: '#11221A', muted: '#5E7369', accent: '#12A15C', accentStrong: '#0A703F', line: '#D7EADD' },
  { id: 'ocean', label: 'Ocean', bg: '#E8F1F8', glow: '#D6E9F5', text: '#0F2A3D', muted: '#4C7188', accent: '#1F7AB8', accentStrong: '#155B8C', line: '#CFE3EF' },
  { id: 'slate', label: 'Slate', bg: '#EDEFF2', glow: '#E1E4EA', text: '#1B1F27', muted: '#5B6474', accent: '#4A5568', accentStrong: '#2D3748', line: '#DDE1E8' },
  { id: 'amber', label: 'Amber', bg: '#FBF3E7', glow: '#F5E5CC', text: '#2E2410', muted: '#7A6A47', accent: '#C4841C', accentStrong: '#8F6014', line: '#EFE0C4' },
  { id: 'rose', label: 'Rose', bg: '#FBEDEE', glow: '#F6DCDE', text: '#2E1418', muted: '#7A555C', accent: '#C24B5A', accentStrong: '#8F3441', line: '#F0D6D9' },
  { id: 'violet', label: 'Violet', bg: '#F0EDF8', glow: '#E3DDF2', text: '#211A33', muted: '#5F5578', accent: '#6B4FB0', accentStrong: '#4E3684', line: '#DFD8EF' },
] as const;
export type PaletteId = typeof CURATED_PALETTES[number]['id'];

export function getPalette(id: string) {
  return CURATED_PALETTES.find((p) => p.id === id) ?? CURATED_PALETTES[0];
}

/**
 * Fully-transparent end-stop for a radial-gradient glow, matching the given
 * hex color's own hue rather than the CSS `transparent` keyword. html2canvas
 * (confirmed live) doesn't interpolate `transparent` (rgba(0,0,0,0)) the way
 * browsers do -- it blends toward black, rendering the glow as a muddy grey
 * blob in exported images even though it looks correct on-screen. An
 * explicit rgba(sameHue, 0) sidesteps the bug: even if html2canvas still
 * blends "wrong", it blends toward the same hue instead of black.
 */
export function transparentStop(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0)`;
}

export const SIZE_SCALE = {
  headline: { S: 40, M: 50, L: 60 },
  body: { S: 22, M: 26, L: 30 },
  heading: { S: 36, M: 44, L: 52 },
} as const;
export type SizeKey = keyof typeof SIZE_SCALE;
export type SizeToken = 'S' | 'M' | 'L';

export interface RegionStyle {
  font: CuratedFont;
  size: SizeToken;
  customHex?: string;
}

export const DEFAULT_REGION_STYLE: RegionStyle = { font: 'Plus Jakarta Sans', size: 'M' };
