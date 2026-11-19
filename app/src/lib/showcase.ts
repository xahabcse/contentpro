import { PALETTES } from '@/lib/palettes';
import { CATALOG_BY_ID, TEMPLATE_ORDER, TEMPLATES } from '@/lib/templates';

// Every registered template appears in the gallery. The groups only classify
// them; a newly registered template still appears in Flexible & More until it
// receives a specific category here.
export const SHOWCASE_GROUPS = [
  { category: 'Everyday & Social', ids: ['birthday', 'congratulations', 'congrats', 'thankyou', 'thank-you', 'holiday', 'awareness', 'quote', 'testimonial', 'bio', 'closing'], desc: 'A polished card for messages, milestones, and community.' },
  { category: 'Career & Community', ids: [], desc: 'Celebrate a career milestone or bring your community together.' },
  { category: 'Business & Events', ids: ['event', 'offer', 'hiring', 'product', 'announce', 'cta'], desc: 'Make an announcement, invitation, or offer easy to notice.' },
  { category: 'Hooks & Stories', ids: ['cover', 'question', 'statement', 'poll', 'divider'], desc: 'Open a story with a strong visual point of view.' },
  { category: 'Learning & Guides', ids: ['faq', 'howto', 'how-to', 'tips', 'protip', 'checklist', 'framework', 'roadmap', 'timeline', 'agenda', 'definition', 'myth', 'takeaway'], desc: 'Break a useful idea into clear, memorable parts.' },
  { category: 'Data & Comparisons', ids: ['stat', 'bignum', 'stattrio', 'comparison', 'contrast'], desc: 'Give a number or comparison room to speak.' },
  { category: 'Flexible & More', ids: ['custom', 'flexible'], desc: 'An adaptable layout for your own message.' },
] as const;

const TEMPLATE_DETAILS: Record<string, { palette: string; desc: string }> = {
  birthday: { palette: 'paper', desc: 'Send a personal birthday wish with space for a name and message.' },
  congrats: { palette: 'wine', desc: 'Celebrate a promotion, win, or milestone.' },
  thankyou: { palette: 'slate', desc: 'Thank a colleague, client, or community in a memorable way.' },
  holiday: { palette: 'forest', desc: 'Share a seasonal greeting without starting from a blank page.' },
  event: { palette: 'navy', desc: 'Invite people with a clear date, place, and next step.' },
  offer: { palette: 'cobalt', desc: 'Highlight a sale, special offer, or limited opportunity.' },
  hiring: { palette: 'ink', desc: 'Present an open role and the essentials at a glance.' },
  product: { palette: 'plum', desc: 'Introduce a product and its key benefits.' },
  awareness: { palette: 'sand', desc: 'Explain a cause and invite people to take action.' },
  faq: { palette: 'paper', desc: 'Answer one common question with clarity.' },
  howto: { palette: 'forest', desc: 'Teach a practical process in a few steps.' },
  flexible: { palette: 'charcoal', desc: 'Start with a simple, adaptable message layout.' },
  cover: { palette: 'ink', desc: 'A bold opening line for a post or the first slide of a deck.' },
  question: { palette: 'paper', desc: 'Ask a question that invites a thoughtful reply.' },
  announce: { palette: 'cobalt', desc: 'Share a launch, workshop, or milestone clearly.' },
  stat: { palette: 'cobalt', desc: 'Put one important number in the spotlight.' },
  comparison: { palette: 'forest', desc: 'Show two choices side by side.' },
  tips: { palette: 'plum', desc: 'Turn practical advice into a numbered list.' },
  framework: { palette: 'wine', desc: 'Explain a repeatable method one step at a time.' },
  contrast: { palette: 'sand', desc: 'Show what changed from before to after.' },
  checklist: { palette: 'forest', desc: 'Make an action list people can save and use.' },
};

export const SHOWCASE_ITEMS = TEMPLATE_ORDER.map((id, index) => {
  const catalog = CATALOG_BY_ID.get(id);
  const group = SHOWCASE_GROUPS.find((entry) => entry.category === catalog?.group || (entry.ids as readonly string[]).includes(id)) ?? SHOWCASE_GROUPS[SHOWCASE_GROUPS.length - 1];
  const detail = TEMPLATE_DETAILS[id];
  return {
    id,
    name: TEMPLATES[id].name,
    category: group.category,
    palette: catalog?.palette ?? detail?.palette ?? PALETTES[index % PALETTES.length].id,
    desc: catalog?.description ?? detail?.desc ?? group.desc,
  };
}).sort((a, b) =>
  SHOWCASE_GROUPS.findIndex((group) => group.category === a.category)
  - SHOWCASE_GROUPS.findIndex((group) => group.category === b.category),
);
