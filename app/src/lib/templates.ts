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
  quote: { id: 'quote', name: 'Quote', fields: [{ k: 'quote', l: 'Quote', t: 'area' }, { k: 'highlight', l: 'Highlight (comma-separated)', t: 'text' }] },
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
      { k: 'highlight', l: 'Highlight (comma-separated)', t: 'text' },
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
      { k: 'highlight', l: 'Highlight (comma-separated)', t: 'text' },
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
      { k: 'highlight', l: 'Highlight (comma-separated)', t: 'text' },
      { k: 'buttonText', l: 'Button', t: 'text' },
    ],
  },
  statement: {
    id: 'statement',
    name: 'Statement',
    fields: [
      { k: 'statement', l: 'Statement', t: 'area' },
      { k: 'highlight', l: 'Highlight (comma-separated)', t: 'text' },
    ],
  },
  checklist: {
    id: 'checklist',
    name: 'Checklist',
    fields: [
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'items', l: 'Checklist (one per line)', t: 'list' },
    ],
  },
  timeline: {
    id: 'timeline',
    name: 'Timeline / Steps',
    fields: [
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'items', l: 'Steps — "Name — desc"', t: 'list' },
    ],
  },
  testimonial: {
    id: 'testimonial',
    name: 'Testimonial',
    fields: [
      { k: 'quote', l: 'Quote', t: 'area' },
      { k: 'name', l: 'Name', t: 'text' },
      { k: 'role', l: 'Role', t: 'text' },
    ],
  },
  agenda: {
    id: 'agenda',
    name: 'Agenda / Index',
    fields: [
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'items', l: 'Items (one per line)', t: 'list' },
    ],
  },
  comparison: {
    id: 'comparison',
    name: 'Comparison',
    fields: [
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'leftLabel', l: 'Left label', t: 'text' },
      { k: 'left', l: 'Left points', t: 'list' },
      { k: 'rightLabel', l: 'Right label', t: 'text' },
      { k: 'right', l: 'Right points', t: 'list' },
    ],
  },
  myth: {
    id: 'myth',
    name: 'Myth vs Fact',
    fields: [
      { k: 'myth', l: 'Myth', t: 'area' },
      { k: 'fact', l: 'Fact', t: 'area' },
    ],
  },
  divider: {
    id: 'divider',
    name: 'Section Divider',
    fields: [
      { k: 'index', l: 'Index (e.g. 02)', t: 'text' },
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'subtitle', l: 'Subtitle', t: 'text' },
    ],
  },
  bio: {
    id: 'bio',
    name: 'Intro / Bio',
    fields: [
      { k: 'name', l: 'Name', t: 'text' },
      { k: 'role', l: 'Role', t: 'text' },
      { k: 'bio', l: 'Bio', t: 'area' },
    ],
  },
  bignum: {
    id: 'bignum',
    name: 'Big Number + Ring',
    fields: [
      { k: 'label', l: 'Eyebrow', t: 'text' },
      { k: 'value', l: 'Value (e.g. 68%)', t: 'text' },
      { k: 'caption', l: 'Caption', t: 'area' },
    ],
  },
  closing: {
    id: 'closing',
    name: 'Closing / Thanks',
    fields: [
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'subtitle', l: 'Subtitle', t: 'area' },
      { k: 'cta', l: 'CTA line', t: 'text' },
    ],
  },
};

export const TEMPLATE_ORDER: TemplateId[] = [
  'cover',
  'quote',
  'statement',
  'question',
  'announce',
  'divider',
  'stat',
  'bignum',
  'tips',
  'checklist',
  'framework',
  'timeline',
  'agenda',
  'comparison',
  'contrast',
  'myth',
  'testimonial',
  'bio',
  'cta',
  'closing',
];

const DEFAULTS: Record<TemplateId, Record<string, FieldValue>> = {
  quote: {
    quote: 'The best way to future-proof your career is to build skills nobody can automate.',
    highlight: 'future-proof',
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
    highlight: '3 interviews',
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
  checklist: {
    title: 'Before you hit publish',
    items: [
      'A hook in the first line',
      'One idea per post, not five',
      'A clear takeaway near the end',
      'A question that invites replies',
      'Formatting that breathes',
    ],
  },
  timeline: {
    title: 'How the first 90 days went',
    items: [
      'Week 1 — Rebuilt the profile headline',
      'Week 3 — Posted three times a week',
      'Week 6 — Started replying to comments daily',
      'Week 12 — Landed the first inbound offer',
    ],
  },
  testimonial: {
    quote:
      'I went from invisible to booked out in a quarter. The only thing that changed was showing up consistently.',
    name: 'Priya Nair',
    role: 'Product Designer, Freelance',
  },
  agenda: {
    title: "What's inside this post",
    items: [
      'Why most profiles get skipped',
      'The three-line headline formula',
      'A posting cadence that lasts',
      'Turning views into conversations',
    ],
  },
  comparison: {
    title: 'Reach vs Resonance',
    leftLabel: 'Chasing reach',
    left: ['Post for the algorithm', 'Copy trending formats', 'Measure impressions'],
    rightLabel: 'Building resonance',
    right: ['Post for one real person', 'Share what only you know', 'Measure replies'],
  },
  myth: {
    myth: 'You need to post every single day to grow on LinkedIn.',
    fact: 'Three thoughtful posts a week beats seven rushed ones — consistency, not volume, compounds.',
  },
  divider: {
    index: '02',
    title: 'Building the habit',
    subtitle: 'How to keep showing up when motivation fades',
  },
  bio: {
    name: 'Alex Rahman',
    role: 'Career coach for new grads',
    bio: 'I help final-year students turn a blank profile into interviews — one honest post at a time.',
  },
  bignum: {
    label: 'The result',
    value: '68%',
    caption: 'of profile views came from posts published before 9 AM.',
  },
  closing: {
    title: 'Thanks for reading',
    subtitle: 'If one idea here stuck with you, save it for later and pass it on.',
    cta: 'Follow for a post like this every week →',
  },
};

export function templateDefaults(id: TemplateId): Record<string, FieldValue> {
  return JSON.parse(JSON.stringify(DEFAULTS[id]));
}
