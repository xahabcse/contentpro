import type { DesignAuthor, NewDesignInput } from "../schema";

// Auto-created once, the first time a user completes their profile -- gives
// every new account two ready, on-brand example cards instead of an empty
// dashboard. Uses the new template model (ContentPro.dc.html redesign).

interface DemoSpec {
  title: string;
  paletteId: string;
  template: string;
  fields: Record<string, string | string[]>;
}

const DEMO_CARDS: DemoSpec[] = [
  {
    title: "Demo: Consistency Beats Intensity",
    paletteId: "ink",
    template: "quote",
    fields: {
      quote: "Consistency beats intensity. Small, steady effort compounds faster than occasional bursts.",
    },
  },
  {
    title: "Demo: By the Numbers",
    paletteId: "cobalt",
    template: "stat",
    fields: {
      label: "One year of learning",
      number: "52",
      caption: "weeks of showing up and sharing something new — here's what changed.",
    },
  },
];

export function buildDemoDesigns(userId: string, author: DesignAuthor): NewDesignInput[] {
  const now = new Date();
  return DEMO_CARDS.map(({ title, paletteId, template, fields }) => ({
    userId,
    type: "card",
    title,
    paletteId,
    customBg: null,
    customText: null,
    customAccent: null,
    author,
    slides: [{ template: template as NewDesignInput["slides"][number]["template"], fields, bgImage: null }],
    fileType: "image",
    createdAt: now,
    updatedAt: now,
  }));
}
