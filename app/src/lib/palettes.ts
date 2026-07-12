// Curated card palettes (ported from ContentPro.dc.html). Each design picks
// one, optionally overriding bg / text / accent with custom hex values.

export interface Palette {
  id: string;
  name: string;
  bg: string;
  text: string;
  accent: string;
}

export const PALETTES: Palette[] = [
  { id: 'ink', name: 'Ink', bg: '#141109', text: '#F5F1E4', accent: '#FFDA36' },
  { id: 'bone', name: 'Bone', bg: '#F1EBDC', text: '#171310', accent: '#E1402B' },
  { id: 'cobalt', name: 'Cobalt', bg: '#1330E6', text: '#FBFAF6', accent: '#FFE24B' },
  { id: 'crimson', name: 'Crimson', bg: '#B41722', text: '#FDEFDF', accent: '#141109' },
  { id: 'forest', name: 'Forest', bg: '#0E3B2C', text: '#EEF0DC', accent: '#C6F24B' },
  { id: 'grape', name: 'Grape', bg: '#241546', text: '#F1E7FF', accent: '#F49BE6' },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export interface ResolvedColors {
  bg: string;
  text: string;
  accent: string;
}

/** Palette default with optional per-design custom overrides applied. */
export function resolveColors(
  paletteId: string,
  custom: { bg?: string | null; text?: string | null; accent?: string | null },
): ResolvedColors {
  const p = getPalette(paletteId);
  return {
    bg: custom.bg || p.bg,
    text: custom.text || p.text,
    accent: custom.accent || p.accent,
  };
}
