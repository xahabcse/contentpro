// Shared design types -- mirror the backend api/src/schema.ts shape exactly.

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
  | 'statement';

export type FieldValue = string | string[];

export interface Slide {
  template: TemplateId;
  fields: Record<string, FieldValue>;
  bgImage?: string | null;
}

export interface Author {
  name: string;
  handle: string;
  avatar?: string | null;
}

export interface Design {
  _id: string;
  type: DesignType;
  title?: string;
  paletteId: string;
  customBg?: string | null;
  customText?: string | null;
  customAccent?: string | null;
  author: Author;
  slides: Slide[];
  fileType: 'image' | 'pdf';
  export?: { url?: string };
  createdAt: string;
  updatedAt: string;
}

/** Canvas dimensions per type -- card square, carousel LinkedIn portrait. */
export function canvasSize(type: DesignType): { w: number; h: number } {
  return type === 'card' ? { w: 1080, h: 1080 } : { w: 1080, h: 1350 };
}
