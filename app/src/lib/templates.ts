import type { FieldValue, TemplateId } from './design-types';
import { LEARNING_TEMPLATES } from './template-catalog-learning';
import { EVERYDAY_TEMPLATE_DEFINITIONS } from './template-catalog-everyday';

export const CATALOG_DEFINITIONS = [
  ...LEARNING_TEMPLATES.map((definition) => ({ ...definition, group: definition.group })),
  ...EVERYDAY_TEMPLATE_DEFINITIONS.map((definition) => ({
    ...definition,
    group: definition.category === 'Data & Progress' ? 'Data & Comparisons'
      : definition.category === 'Career' ? 'Career & Community'
        : definition.category === 'Community' ? 'Career & Community' : 'Business & Events',
    palette: definition.category === 'Data & Progress' ? 'cobalt'
      : definition.category === 'Career' ? 'paper'
        : definition.category === 'Community' ? 'forest' : 'navy',
  })),
];
export const CATALOG_BY_ID = new Map<string, (typeof CATALOG_DEFINITIONS)[number]>(CATALOG_DEFINITIONS.map((definition) => [definition.id, definition]));

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

const ORIGINAL_TEMPLATES: Record<string, TemplateMeta> = {
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
  poll: {
    id: 'poll',
    name: 'Poll / This-or-That',
    fields: [
      { k: 'kicker', l: 'Kicker', t: 'text' },
      { k: 'question', l: 'Question', t: 'area' },
      { k: 'optionA', l: 'Option A', t: 'area' },
      { k: 'optionB', l: 'Option B', t: 'area' },
    ],
  },
  takeaway: {
    id: 'takeaway',
    name: 'Key Takeaway / TL;DR',
    fields: [
      { k: 'label', l: 'Eyebrow', t: 'text' },
      { k: 'takeaway', l: 'Takeaway', t: 'area' },
      { k: 'highlight', l: 'Highlight (comma-separated)', t: 'text' },
    ],
  },
  stattrio: {
    id: 'stattrio',
    name: 'Stat Trio',
    fields: [
      { k: 'label', l: 'Eyebrow', t: 'text' },
      { k: 'items', l: 'Stats — "Value — Label"', t: 'list' },
    ],
  },
  definition: {
    id: 'definition',
    name: 'Definition',
    fields: [
      { k: 'label', l: 'Eyebrow', t: 'text' },
      { k: 'term', l: 'Term', t: 'text' },
      { k: 'pronunciation', l: 'Pronunciation (optional)', t: 'text' },
      { k: 'meaning', l: 'Meaning', t: 'area' },
    ],
  },
  protip: {
    id: 'protip',
    name: 'Pro Tip / Callout',
    fields: [
      { k: 'label', l: 'Eyebrow', t: 'text' },
      { k: 'tip', l: 'Tip', t: 'area' },
      { k: 'highlight', l: 'Highlight (comma-separated)', t: 'text' },
    ],
  },
  roadmap: {
    id: 'roadmap',
    name: 'Roadmap / Phases',
    fields: [
      { k: 'title', l: 'Title', t: 'area' },
      { k: 'items', l: 'Phases — "Name — desc"', t: 'list' },
    ],
  },
  birthday: {
    id: 'birthday', name: 'Birthday Wish',
    fields: [{ k: 'label', l: 'Occasion label', t: 'text' }, { k: 'name', l: 'Name', t: 'text' }, { k: 'message', l: 'Wish', t: 'area' }],
  },
  congrats: {
    id: 'congrats', name: 'Congratulations',
    fields: [{ k: 'label', l: 'Occasion label', t: 'text' }, { k: 'headline', l: 'Headline', t: 'area' }, { k: 'achievement', l: 'Achievement', t: 'area' }],
  },
  thankyou: {
    id: 'thankyou', name: 'Thank You',
    fields: [{ k: 'recipient', l: 'Who you are thanking', t: 'text' }, { k: 'headline', l: 'Headline', t: 'area' }, { k: 'message', l: 'Message', t: 'area' }],
  },
  holiday: {
    id: 'holiday', name: 'Holiday Greeting',
    fields: [{ k: 'occasion', l: 'Occasion', t: 'text' }, { k: 'headline', l: 'Greeting', t: 'area' }, { k: 'message', l: 'Message', t: 'area' }],
  },
  event: {
    id: 'event', name: 'Event Invite',
    fields: [{ k: 'label', l: 'Event type', t: 'text' }, { k: 'title', l: 'Event title', t: 'area' }, { k: 'date', l: 'Date & time', t: 'text' }, { k: 'place', l: 'Place / link', t: 'text' }, { k: 'cta', l: 'Call to action', t: 'text' }],
  },
  offer: {
    id: 'offer', name: 'Offer / Sale',
    fields: [{ k: 'label', l: 'Offer label', t: 'text' }, { k: 'value', l: 'Offer amount', t: 'text' }, { k: 'headline', l: 'What is on offer', t: 'area' }, { k: 'detail', l: 'Validity / details', t: 'text' }, { k: 'cta', l: 'Call to action', t: 'text' }],
  },
  hiring: {
    id: 'hiring', name: 'Hiring / Job',
    fields: [{ k: 'label', l: 'Hiring label', t: 'text' }, { k: 'role', l: 'Role', t: 'area' }, { k: 'details', l: 'Location / work type', t: 'text' }, { k: 'benefits', l: 'Highlights (one per line)', t: 'list' }, { k: 'cta', l: 'How to apply', t: 'text' }],
  },
  product: {
    id: 'product', name: 'Product Spotlight',
    fields: [{ k: 'label', l: 'Launch label', t: 'text' }, { k: 'name', l: 'Product name', t: 'text' }, { k: 'headline', l: 'Main promise', t: 'area' }, { k: 'features', l: 'Benefits (one per line)', t: 'list' }, { k: 'cta', l: 'Call to action', t: 'text' }],
  },
  faq: {
    id: 'faq', name: 'FAQ / Answer',
    fields: [{ k: 'label', l: 'Topic', t: 'text' }, { k: 'question', l: 'Question', t: 'area' }, { k: 'answer', l: 'Answer', t: 'area' }],
  },
  howto: {
    id: 'howto', name: 'How-To',
    fields: [{ k: 'title', l: 'How-to title', t: 'area' }, { k: 'steps', l: 'Steps (one per line)', t: 'list' }, { k: 'result', l: 'Outcome / takeaway', t: 'area' }],
  },
  awareness: {
    id: 'awareness', name: 'Awareness / Cause',
    fields: [{ k: 'label', l: 'Cause / campaign', t: 'text' }, { k: 'headline', l: 'Main message', t: 'area' }, { k: 'context', l: 'Why it matters', t: 'area' }, { k: 'action', l: 'Action to take', t: 'text' }],
  },
  flexible: {
    id: 'flexible', name: 'Flexible Message',
    fields: [{ k: 'label', l: 'Optional label', t: 'text' }, { k: 'headline', l: 'Headline', t: 'area' }, { k: 'body', l: 'Body', t: 'area' }, { k: 'closing', l: 'Closing line', t: 'text' }],
  },
};

export const TEMPLATES = {
  ...ORIGINAL_TEMPLATES,
  ...Object.fromEntries(CATALOG_DEFINITIONS.map((definition) => [definition.id, {
    id: definition.id as TemplateId,
    name: definition.name,
    fields: definition.fields.map((field) => ({ ...field })),
  }])),
} as Record<TemplateId, TemplateMeta>;

export const TEMPLATE_ORDER: TemplateId[] = [
  'cover',
  'flexible',
  'birthday',
  'congrats',
  'thankyou',
  'holiday',
  'event',
  'offer',
  'hiring',
  'product',
  'awareness',
  'faq',
  'howto',
  'quote',
  'statement',
  'takeaway',
  'question',
  'poll',
  'announce',
  'divider',
  'definition',
  'stat',
  'bignum',
  'stattrio',
  'tips',
  'protip',
  'checklist',
  'framework',
  'roadmap',
  'timeline',
  'agenda',
  'comparison',
  'contrast',
  'myth',
  'testimonial',
  'bio',
  'cta',
  'closing',
  ...CATALOG_DEFINITIONS.map((definition) => definition.id as TemplateId),
];

const ORIGINAL_DEFAULTS: Record<string, Record<string, FieldValue>> = {
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
  poll: {
    kicker: 'Poll · you decide',
    question: 'Which matters more early in your career?',
    optionA: 'Learning fast at a scrappy startup',
    optionB: 'A strong brand name on your résumé',
  },
  takeaway: {
    label: 'TL;DR',
    takeaway:
      'Consistency beats intensity — three honest posts a week will outgrow one viral post a year.',
    highlight: 'Consistency',
  },
  stattrio: {
    label: 'By the numbers',
    items: ['3× — profile views', '48% — reply rate', '12 — weeks to offer'],
  },
  definition: {
    label: 'Definition',
    term: 'Personal brand',
    pronunciation: '/ˈpərs(ə)nəl brand/ · noun',
    meaning:
      'The reputation that arrives before you do — what people say about your work when you are not in the room.',
  },
  protip: {
    label: 'Pro tip',
    tip: 'Comment on ten posts before you publish your own — you warm up the same audience that later sees your post.',
    highlight: 'ten posts',
  },
  roadmap: {
    title: 'Your first 90 days on LinkedIn',
    items: [
      'Set up — Fix the headline, photo and about section',
      'Engage — Comment daily and reply to every response',
      'Publish — Ship one real post a week',
      'Compound — Double down on what actually landed',
    ],
  },
  birthday: { label: 'A day to celebrate', name: 'Alex', message: 'Wishing you a year filled with good people, bold ideas and moments worth remembering.' },
  congrats: { label: 'A well-earned milestone', headline: 'Congratulations!', achievement: 'You did it. Here is to the work behind this moment and everything still ahead.' },
  thankyou: { recipient: 'To our community', headline: 'Thank you.', message: 'Every conversation, share and kind word helped us get here. We are grateful you are part of the journey.' },
  holiday: { occasion: 'Seasonal greeting', headline: 'Wishing you a wonderful holiday', message: 'May this season bring a little rest, a lot of joy and time with the people who matter.' },
  event: { label: 'You are invited', title: 'Creative Community Meetup', date: 'Saturday · 5 PM', place: 'Dhaka + online', cta: 'Save your seat →' },
  offer: { label: 'Limited-time offer', value: '20% OFF', headline: 'Make your next idea happen for less.', detail: 'Available through the end of the month', cta: 'Explore the offer →' },
  hiring: { label: 'We are hiring', role: 'Product Designer', details: 'Full-time · Remote-friendly', benefits: ['Own meaningful projects', 'Work with a thoughtful team', 'Grow your craft'], cta: 'Apply or share with a friend →' },
  product: { label: 'Meet the new release', name: 'Your Product', headline: 'A simpler way to get great work done.', features: ['Less busywork', 'More clarity', 'Built for your team'], cta: 'See what is new →' },
  faq: { label: 'Quick answer', question: 'How does it work?', answer: 'Start with a template, add your message and make it yours. You can create a card or build a full carousel.' },
  howto: { title: 'How to share an idea people remember', steps: ['Lead with the problem', 'Show one useful example', 'End with one clear takeaway'], result: 'Keep it simple enough to save and share.' },
  awareness: { label: 'A cause worth sharing', headline: 'Small actions can make a real difference.', context: 'A conversation can help someone feel seen. Share a resource, listen closely and invite others to join in.', action: 'Start a conversation today →' },
  flexible: { label: 'A message from us', headline: 'Your story goes here.', body: 'Use this space for a launch, a personal update, a reflection or anything you want your community to know.', closing: 'Keep the conversation going →' },
};

const DEFAULTS = {
  ...ORIGINAL_DEFAULTS,
  ...Object.fromEntries(CATALOG_DEFINITIONS.map((definition) => [definition.id, definition.defaults])),
} as Record<TemplateId, Record<string, FieldValue>>;

export function templateDefaults(id: TemplateId): Record<string, FieldValue> {
  return JSON.parse(JSON.stringify(DEFAULTS[id]));
}
