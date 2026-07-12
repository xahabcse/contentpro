import type { FieldValue, TemplateId } from './design-types';

// Template metadata (ported from ContentPro.dc.html): the field set each
// template exposes in the inspector, plus the default content used when a
// slide first adopts a template. Rendering lives in SlideCanvas.tsx.

export type FieldType = 'text' | 'area' | 'list';

export interface FieldSpec {
  k: string;
  l: string;
  t: FieldType;
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  fields: FieldSpec[];
}

export const TEMPLATES: Record<TemplateId, TemplateMeta> = {
  quote: { id: 'quote', name: 'Quote', fields: [{ k: 'quote', l: 'Quote', t: 'area' }] },
  stat: {
    id: 'stat',
    name: 'Big Stat',
    fields: [
      { k: 'label', l: 'Eyebrow', t: 'text' },
      { k: 'number', l: 'Number', t: 'text' },
      { k: 'caption', l: 'Caption', t: 'area' },
    ],
  },
  tips: {
    id: 'tips',
    name: 'Numbered Tips',
    fields: [
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'items', l: 'Tips (one per line)', t: 'list' },
    ],
  },
  cover: {
    id: 'cover',
    name: 'Cover / Hook',
    fields: [
      { k: 'kicker', l: 'Kicker', t: 'text' },
      { k: 'headline', l: 'Headline', t: 'area' },
    ],
  },
  announce: {
    id: 'announce',
    name: 'Announcement',
    fields: [
      { k: 'badge', l: 'Badge', t: 'text' },
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'subtitle', l: 'Subtitle', t: 'area' },
      { k: 'detail', l: 'Detail', t: 'text' },
    ],
  },
  question: {
    id: 'question',
    name: 'Bold Question',
    fields: [
      { k: 'kicker', l: 'Kicker', t: 'text' },
      { k: 'question', l: 'Question', t: 'area' },
    ],
  },
  contrast: {
    id: 'contrast',
    name: 'Before / After',
    fields: [
      { k: 'beforeLabel', l: 'Left label', t: 'text' },
      { k: 'before', l: 'Left text', t: 'area' },
      { k: 'afterLabel', l: 'Right label', t: 'text' },
      { k: 'after', l: 'Right text', t: 'area' },
    ],
  },
  framework: {
    id: 'framework',
    name: 'Framework',
    fields: [
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'items', l: 'Steps — "Name — desc"', t: 'list' },
    ],
  },
  cta: {
    id: 'cta',
    name: 'Call to Action',
    fields: [
      { k: 'headline', l: 'Headline', t: 'area' },
      { k: 'buttonText', l: 'Button', t: 'text' },
    ],
  },
  statement: {
    id: 'statement',
    name: 'Statement',
    fields: [
      { k: 'statement', l: 'Statement', t: 'area' },
      { k: 'highlight', l: 'Highlight word', t: 'text' },
    ],
  },
};

export const TEMPLATE_ORDER: TemplateId[] = [
  'quote',
  'stat',
  'tips',
  'cover',
  'announce',
  'question',
  'contrast',
  'framework',
  'cta',
  'statement',
];

const DEFAULTS: Record<TemplateId, Record<string, FieldValue>> = {
  quote: {
    quote: 'The best way to future-proof your career is to build skills nobody can automate.',
  },
  stat: {
    label: 'By the numbers',
    number: '73%',
    caption: 'of recruiters say a strong LinkedIn presence changed how they viewed a candidate.',
  },
  tips: {
    title: '5 habits that grew my network',
    items: [
      'Comment before you post',
      'Reply to every DM you get',
      'Share what you learn each week',
      'Feature others, not just yourself',
      'Show up on the same days',
    ],
  },
  cover: {
    kicker: 'Carousel · swipe →',
    headline: 'How I landed 3 interviews from one LinkedIn post',
  },
  announce: {
    badge: 'NEW',
    title: 'Free workshop: build your first portfolio',
    subtitle: 'A hands-on session for final-year BSc students.',
    detail: 'Sat · 6 PM · Online',
  },
  question: {
    kicker: "Let's talk",
    question: "What's one skill you wish you'd learned in your first year?",
  },
  contrast: {
    beforeLabel: 'Before',
    before: 'A generic headline nobody remembers.',
    afterLabel: 'After',
    after: 'A headline that says exactly who you help.',
  },
  framework: {
    title: 'The 3-part hook',
    items: [
      'Tension — name the real problem',
      'Turn — show the shift that fixed it',
      'Take — give them one clear action',
    ],
  },
  cta: {
    headline: 'Ready to fix your profile this week?',
    buttonText: 'Save this post →',
  },
  statement: {
    statement: 'Your degree opens the door. Your portfolio gets you the seat.',
    highlight: 'portfolio',
  },
};

export function templateDefaults(id: TemplateId): Record<string, FieldValue> {
  return JSON.parse(JSON.stringify(DEFAULTS[id]));
}
