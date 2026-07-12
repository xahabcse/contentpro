import type { DesignSlide, DesignType, TemplateId } from "../schema";

// Default field content for the templates used to seed a brand-new design, so
// a freshly-created card/carousel is immediately meaningful in the editor
// rather than blank. Mirrors the `defaults()` map in
// app/src/lib/templates.tsx for these starter templates only (the editor owns
// the full set for the other templates a user switches to later).

const DEFAULTS: Partial<Record<TemplateId, Record<string, string | string[]>>> = {
  quote: {
    quote: "The best way to future-proof your career is to build skills nobody can automate.",
  },
  cover: {
    kicker: "Carousel · swipe →",
    headline: "How I landed 3 interviews from one LinkedIn post",
  },
  stat: {
    label: "By the numbers",
    number: "73%",
    caption: "of recruiters say a strong LinkedIn presence changed how they viewed a candidate.",
  },
  tips: {
    title: "5 habits that grew my network",
    items: [
      "Comment before you post",
      "Reply to every DM you get",
      "Share what you learn each week",
      "Feature others, not just yourself",
      "Show up on the same days",
    ],
  },
  framework: {
    title: "The 3-part hook",
    items: [
      "Tension — name the real problem",
      "Turn — show the shift that fixed it",
      "Take — give them one clear action",
    ],
  },
  cta: {
    headline: "Ready to fix your profile this week?",
    buttonText: "Save this post →",
  },
};

function slide(template: TemplateId): DesignSlide {
  return { template, fields: JSON.parse(JSON.stringify(DEFAULTS[template] ?? {})), bgImage: null };
}

export function starterSlides(type: DesignType): DesignSlide[] {
  if (type === "card") return [slide("quote")];
  return [slide("cover"), slide("stat"), slide("tips"), slide("framework"), slide("cta")];
}
