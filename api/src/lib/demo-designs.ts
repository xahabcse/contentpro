import type { CardContent, DesignStyle, NewDesignInput, RegionKey } from "../schema";

// Auto-created once, the first time a user completes their profile (name +
// designation + handle) -- gives every new account two ready, on-brand
// examples instead of an empty dashboard. Footer content (photo, handle,
// designation) is never baked into a design's stored content -- the editor
// reads it live from the user's own profile at render/export time -- so
// these examples automatically show the real signed-in user's own info.

const CARD_REGION_KEYS: RegionKey[] = ["eyebrow", "headline", "body", "footer"];
const DEFAULT_FONT = "Plus Jakarta Sans";

function cardStyle(paletteId: string): DesignStyle {
  const regions: DesignStyle["regions"] = {};
  for (const key of CARD_REGION_KEYS) {
    regions[key] = { font: DEFAULT_FONT, size: "M" };
  }
  return { paletteId, regions };
}

const DEMO_CARDS: Array<{ title: string; content: CardContent; paletteId: string }> = [
  {
    title: "Demo: Consistency Beats Intensity",
    content: {
      eyebrow: "CAREER TIP",
      headline: "Consistency Beats Intensity",
      body: [
        "Small, steady progress compounds faster than occasional bursts of effort.",
        "Show up daily, even in small ways — that's how real momentum builds.",
      ],
    },
    paletteId: "brand-green",
  },
  {
    title: "Demo: One Year of Continuous Learning",
    content: {
      eyebrow: "MILESTONE",
      headline: "One Year of Continuous Learning",
      body: [
        "Growth isn't about knowing everything — it's about staying curious.",
        "Here's what changed after choosing to learn something new every single week.",
      ],
    },
    paletteId: "ocean",
  },
];

export function buildDemoDesigns(userId: string): NewDesignInput[] {
  const now = new Date();
  return DEMO_CARDS.map(({ title, content, paletteId }) => ({
    userId,
    format: "card",
    title,
    content,
    style: cardStyle(paletteId),
    fileType: "image",
    createdAt: now,
    updatedAt: now,
  }));
}
