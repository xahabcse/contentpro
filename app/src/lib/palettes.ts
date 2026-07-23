// Curated card palettes (ported from ContentPro.dc.html). Each design picks
// one, optionally overriding bg / text / accent with custom hex values.

export interface Palette {
  id: string;
  name: string;
  bg: string;
  text: string;
  accent: string;
}

// Refined, editorial palettes. Each pair is muted/professional and AA-legible
// (near-white text on dark bg, or ink on warm light bg). Accents are chosen to
// clear ~4.5:1 on their own background so eyebrows/badges stay readable.
export const PALETTES: Palette[] = [
  { id: 'ink', name: 'Ink', bg: '#14110B', text: '#F5F1E4', accent: '#F2B441' },
  { id: 'paper', name: 'Paper', bg: '#F4EFE4', text: '#1A1712', accent: '#B4531F' },
  { id: 'slate', name: 'Slate', bg: '#24303A', text: '#E9EEF2', accent: '#8FC0D4' },
  { id: 'navy', name: 'Navy', bg: '#16233F', text: '#EDF0F5', accent: '#D6A84C' },
  { id: 'forest', name: 'Forest', bg: '#1B3A2E', text: '#EAF0E4', accent: '#8FC98C' },
  { id: 'wine', name: 'Wine', bg: '#3B1E27', text: '#F4E6E8', accent: '#E39AA6' },
  { id: 'sand', name: 'Sand', bg: '#E7DCC7', text: '#2A2117', accent: '#A8481F' },
  { id: 'charcoal', name: 'Charcoal', bg: '#1C1C1E', text: '#FAFAFA', accent: '#B7B7BC' },
  { id: 'cobalt', name: 'Cobalt', bg: '#21386E', text: '#EEF1F8', accent: '#EBC258' },
  { id: 'plum', name: 'Plum', bg: '#2E1F3F', text: '#EFE6F5', accent: '#C79BE0' },
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
