// Design types for the browser-only model. Designs live in localStorage;
// images (backgrounds + per-design avatar overrides) live in IndexedDB and
// are referenced here by id (see image-store.ts).

export type DesignType = 'card' | 'carousel';

export type TemplateId =
  | 'quote'
  | 'stat'
  | 'tips'
  | 'cover'
  | 'announce'
  | 'question'
  | 'contrast'
  | 'framework'
  | 'cta'
  | 'statement'
  | 'checklist'
  | 'timeline'
  | 'testimonial'
  | 'agenda'
  | 'comparison'
  | 'myth'
  | 'divider'
  | 'bio'
  | 'bignum'
  | 'closing';

export type FieldValue = string | string[];

export interface Slide {
  template: TemplateId;
  fields: Record<string, FieldValue>;
  /** IndexedDB image id for an optional background; null/undefined = none. */
  bgImageId?: string | null;
}

/** Per-design overrides of the profile author (all optional). */
export interface AuthorOverride {
  name?: string;
  handle?: string;
  /** IndexedDB image id overriding the profile photo. */
  avatarImageId?: string | null;
}

export interface LocalDesign {
  id: string;
  type: DesignType;
  title?: string;
  paletteId: string;
  customBg?: string | null;
  customText?: string | null;
  customAccent?: string | null;
  authorOverride?: AuthorOverride;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

/** Fully-resolved footer data passed to the renderer (urls already materialised). */
export interface FooterData {
  name: string;
  handle: string;
  avatar?: string | null;
  designation?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
}

/** A slide with its background image id resolved to an object URL for rendering. */
export interface ResolvedSlide extends Omit<Slide, 'bgImageId'> {
  bgImage?: string | null;
}

/** Canvas dimensions per type -- card square, carousel LinkedIn portrait. */
export function canvasSize(type: DesignType): { w: number; h: number } {
  return type === 'card' ? { w: 1080, h: 1080 } : { w: 1080, h: 1350 };
}
