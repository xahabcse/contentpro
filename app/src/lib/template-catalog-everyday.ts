// Practical social, career, community, and small-business post starters.
// Each entry has a distinct purpose and an explicit visual layout hint so the
// editor can offer useful formats rather than 31 renamed copies of one card.
// The generic renderer consumes the common field roles below; all copy is
// editable and the examples are intentionally illustrative.

export interface EverydayTemplateDefinition {
  id: string;
  name: string;
  category: 'Career' | 'Business' | 'Community' | 'Data & Progress';
  description: string;
  layout: string;
  fields: readonly { readonly k: string; readonly l: string; readonly t: 'text' | 'area' | 'list' }[];
  defaults: Readonly<Record<string, string | readonly string[]>>;
}

export const EVERYDAY_TEMPLATE_DEFINITIONS = [
  {
    id: 'promotion', name: 'Promotion Announcement', category: 'Career', layout: 'career-hero',
    description: 'Share a new role and thank the people who helped you grow.',
    fields: [{ k: 'label', l: 'Occasion', t: 'text' }, { k: 'title', l: 'Announcement', t: 'area' }, { k: 'role', l: 'New role', t: 'text' }, { k: 'subtitle', l: 'Personal note', t: 'area' }],
    defaults: { label: 'Career milestone', title: 'A new chapter begins', role: 'Senior Product Designer', subtitle: 'Grateful for the team, mentors and projects that helped me get here. Excited to keep learning.' },
  },
  {
    id: 'newjob', name: 'New Job', category: 'Career', layout: 'career-split',
    description: 'Introduce a new team and the work you are excited to do.',
    fields: [{ k: 'label', l: 'Occasion', t: 'text' }, { k: 'title', l: 'Headline', t: 'area' }, { k: 'role', l: 'Role and company', t: 'text' }, { k: 'items', l: 'What drew you here', t: 'list' }],
    defaults: { label: 'Next chapter', title: 'I joined a new team', role: 'Product Manager at Northstar', items: ['A mission I believe in', 'Thoughtful people to learn from', 'A chance to solve real customer problems'] },
  },
  {
    id: 'firstday', name: 'First Day at Work', category: 'Career', layout: 'day-one-plan',
    description: 'Mark day one with three intentions or first impressions.',
    fields: [{ k: 'label', l: 'Day label', t: 'text' }, { k: 'title', l: 'Headline', t: 'area' }, { k: 'subtitle', l: 'Date', t: 'text' }, { k: 'items', l: 'Day-one intentions', t: 'list' }],
    defaults: { label: 'Day one', title: 'A fresh start with a new team', subtitle: 'Monday · Week 1', items: ['Listen before suggesting', 'Learn the product and the people', 'Write down every useful question'] },
  },
  {
    id: 'workanniversary', name: 'Work Anniversary', category: 'Career', layout: 'milestone-timeline',
    description: 'Look back on a year or several years of meaningful work.',
    fields: [{ k: 'label', l: 'Occasion', t: 'text' }, { k: 'subtitle', l: 'Years', t: 'text' }, { k: 'title', l: 'Reflection', t: 'area' }, { k: 'items', l: 'Milestones', t: 'list' }],
    defaults: { label: 'Work anniversary', subtitle: '3 years together', title: 'Still learning, still building', items: ['Year 1 — Found my footing', 'Year 2 — Led my first launch', 'Year 3 — Helped the next teammate grow'] },
  },
  {
    id: 'graduation', name: 'Graduation', category: 'Career', layout: 'ceremony-badge',
    description: 'Celebrate finishing a course, degree, or training program.',
    fields: [{ k: 'label', l: 'Occasion', t: 'text' }, { k: 'title', l: 'Headline', t: 'area' }, { k: 'person', l: 'Graduate', t: 'text' }, { k: 'subtitle', l: 'Program and reflection', t: 'area' }],
    defaults: { label: 'Graduation', title: 'One chapter complete. The next begins.', person: 'Alex Rahman', subtitle: 'Class of 2026 · Thank you to everyone who taught, challenged and supported me.' },
  },
  {
    id: 'certification', name: 'Certification Earned', category: 'Career', layout: 'credential-stamp',
    description: 'Show what you studied and how you will put it to work.',
    fields: [{ k: 'label', l: 'Occasion', t: 'text' }, { k: 'title', l: 'Credential', t: 'area' }, { k: 'subtitle', l: 'What you learned', t: 'area' }, { k: 'cta', l: 'Next step', t: 'text' }],
    defaults: { label: 'Certified', title: 'Cloud Practitioner', subtitle: 'A useful checkpoint after weeks of hands-on practice, notes and small experiments.', cta: 'Now to apply it in a real project →' },
  },
  {
    id: 'portfolio', name: 'Portfolio Highlights', category: 'Career', layout: 'project-grid',
    description: 'Put several pieces of work in one scannable card.',
    fields: [{ k: 'label', l: 'Section', t: 'text' }, { k: 'title', l: 'Headline', t: 'area' }, { k: 'items', l: 'Projects and outcomes', t: 'list' }, { k: 'cta', l: 'Portfolio link prompt', t: 'text' }],
    defaults: { label: 'Selected work', title: 'Three projects that shaped my craft', items: ['Onboarding refresh — made the first step clearer', 'Community dashboard — turned feedback into a daily view', 'Design system — helped teams ship consistently'], cta: 'Explore the full portfolio →' },
  },
  {
    id: 'openforwork', name: 'Open to Work', category: 'Career', layout: 'profile-availability',
    description: 'Present the role, strengths, and location you are looking for.',
    fields: [{ k: 'label', l: 'Status', t: 'text' }, { k: 'title', l: 'Role sought', t: 'area' }, { k: 'items', l: 'Strengths', t: 'list' }, { k: 'subtitle', l: 'Location or work style', t: 'text' }, { k: 'cta', l: 'Contact prompt', t: 'text' }],
    defaults: { label: 'Open to work', title: 'Looking for a product design role', items: ['Research-led problem solving', 'Accessible interaction design', 'Clear cross-team communication'], subtitle: 'Remote-friendly · Dhaka or anywhere', cta: 'Know a team? Let us talk →' },
  },
  {
    id: 'mentorappreciation', name: 'Mentor Appreciation', category: 'Career', layout: 'tribute-quote',
    description: 'Thank a mentor with one specific lesson that stayed with you.',
    fields: [{ k: 'label', l: 'Occasion', t: 'text' }, { k: 'person', l: 'Mentor name', t: 'text' }, { k: 'title', l: 'Headline', t: 'area' }, { k: 'quote', l: 'Lesson or quote', t: 'area' }],
    defaults: { label: 'A note of thanks', person: 'Samira', title: 'The person who taught me to ask better questions', quote: 'Start by understanding the problem. A clever solution can wait.' },
  },
  {
    id: 'teamspotlight', name: 'Team Spotlight', category: 'Career', layout: 'people-grid',
    description: 'Introduce the people and roles behind a shared achievement.',
    fields: [{ k: 'label', l: 'Section', t: 'text' }, { k: 'title', l: 'Headline', t: 'area' }, { k: 'items', l: 'People and roles', t: 'list' }, { k: 'subtitle', l: 'Team note', t: 'area' }],
    defaults: { label: 'Behind the work', title: 'Meet the team that made it happen', items: ['Amina — Research', 'Rafi — Engineering', 'Nadia — Design'], subtitle: 'A small cross-functional team, a lot of patient collaboration.' },
  },
  {
    id: 'projectlaunch', name: 'Project Launch', category: 'Career', layout: 'launch-feature',
    description: 'Share a finished project, its purpose, and a few outcomes.',
    fields: [{ k: 'label', l: 'Launch label', t: 'text' }, { k: 'title', l: 'Project name', t: 'area' }, { k: 'subtitle', l: 'What it helps with', t: 'area' }, { k: 'items', l: 'Highlights', t: 'list' }, { k: 'cta', l: 'Next step', t: 'text' }],
    defaults: { label: 'Project launch', title: 'The Community Toolkit is live', subtitle: 'A simpler starting point for volunteers organizing local events.', items: ['Reusable planning pages', 'Clear role handoffs', 'Easy-to-share updates'], cta: 'See the project →' },
  },
  {
    id: 'service', name: 'Service Menu', category: 'Business', layout: 'service-list',
    description: 'Explain what a business or freelancer can help with.',
    fields: [{ k: 'label', l: 'Category', t: 'text' }, { k: 'title', l: 'Service headline', t: 'area' }, { k: 'items', l: 'Services', t: 'list' }, { k: 'cta', l: 'Contact prompt', t: 'text' }],
    defaults: { label: 'What we do', title: 'Thoughtful design for growing teams', items: ['Brand identity — a system people recognize', 'Web design — clear paths for your visitors', 'Design support — extra hands when you need them'], cta: 'Tell us what you are building →' },
  },
  {
    id: 'pricing', name: 'Pricing Options', category: 'Business', layout: 'pricing-columns',
    description: 'Compare clear packages without making people hunt for details.',
    fields: [{ k: 'label', l: 'Category', t: 'text' }, { k: 'title', l: 'Pricing headline', t: 'area' }, { k: 'items', l: 'Packages — name, price and summary', t: 'list' }, { k: 'cta', l: 'Next step', t: 'text' }],
    defaults: { label: 'Choose your fit', title: 'Simple options for your next project', items: ['Starter — $99 · a focused first step', 'Growth — $249 · room to build momentum', 'Partner — custom · ongoing support'], cta: 'Ask for the full details →' },
  },
  {
    id: 'restaurantmenu', name: 'Food Menu', category: 'Business', layout: 'menu-board',
    description: 'Share a few featured dishes and prices in a clean list.',
    fields: [{ k: 'label', l: 'Menu label', t: 'text' }, { k: 'title', l: 'Menu headline', t: 'area' }, { k: 'items', l: 'Dishes and prices', t: 'list' }, { k: 'subtitle', l: 'Availability note', t: 'text' }],
    defaults: { label: 'This week', title: 'Fresh from our kitchen', items: ['Herb rice bowl — $8', 'Roasted vegetable wrap — $7', 'Citrus iced tea — $3'], subtitle: 'Available while fresh batches last.' },
  },
  {
    id: 'reviewrequest', name: 'Review Request', category: 'Business', layout: 'review-callout',
    description: 'Invite customers to leave an honest review with a simple prompt.',
    fields: [{ k: 'label', l: 'Category', t: 'text' }, { k: 'title', l: 'Request', t: 'area' }, { k: 'subtitle', l: 'Why it matters', t: 'area' }, { k: 'cta', l: 'Review prompt', t: 'text' }],
    defaults: { label: 'Your voice matters', title: 'How was your experience?', subtitle: 'A short, honest review helps other people know what to expect and helps us keep improving.', cta: 'Share your feedback →' },
  },
  {
    id: 'waitlist', name: 'Waitlist Open', category: 'Business', layout: 'availability-counter',
    description: 'Announce early access and explain why someone should join.',
    fields: [{ k: 'label', l: 'Status', t: 'text' }, { k: 'title', l: 'Announcement', t: 'area' }, { k: 'value', l: 'Available spots', t: 'text' }, { k: 'subtitle', l: 'What is coming', t: 'area' }, { k: 'cta', l: 'Join prompt', t: 'text' }],
    defaults: { label: 'Early access', title: 'The waitlist is open', value: '100 spots', subtitle: 'Get a first look at a calmer way to plan and publish your ideas.', cta: 'Join the waitlist →' },
  },
  {
    id: 'webinar', name: 'Webinar Speaker', category: 'Business', layout: 'speaker-poster',
    description: 'Promote an online session with the speaker and key details.',
    fields: [{ k: 'label', l: 'Event type', t: 'text' }, { k: 'title', l: 'Session title', t: 'area' }, { k: 'person', l: 'Speaker', t: 'text' }, { k: 'date', l: 'Date and time', t: 'text' }, { k: 'cta', l: 'Join prompt', t: 'text' }],
    defaults: { label: 'Live webinar', title: 'Make your first portfolio easier to review', person: 'With Amina Rahman', date: 'Thursday · 7 PM', cta: 'Save your seat →' },
  },
  {
    id: 'workshop', name: 'Workshop Outcomes', category: 'Business', layout: 'outcome-bullets',
    description: 'Show what participants will learn or make in a workshop.',
    fields: [{ k: 'label', l: 'Event type', t: 'text' }, { k: 'title', l: 'Workshop title', t: 'area' }, { k: 'subtitle', l: 'Date and time', t: 'text' }, { k: 'items', l: 'What you will leave with', t: 'list' }, { k: 'cta', l: 'Join prompt', t: 'text' }],
    defaults: { label: 'Hands-on workshop', title: 'Build a clearer content plan', subtitle: 'Saturday · 10 AM', items: ['A one-page audience brief', 'Three repeatable post formats', 'A realistic weekly schedule'], cta: 'Reserve a place →' },
  },
  {
    id: 'fundraiser', name: 'Fundraiser Goal', category: 'Community', layout: 'fundraiser-thermometer',
    description: 'Explain a cause, a funding goal, and one way to contribute.',
    fields: [{ k: 'label', l: 'Cause', t: 'text' }, { k: 'title', l: 'Fundraiser headline', t: 'area' }, { k: 'value', l: 'Progress percentage', t: 'text' }, { k: 'subtitle', l: 'Raised, goal and purpose', t: 'area' }, { k: 'cta', l: 'Support prompt', t: 'text' }],
    defaults: { label: 'Community fundraiser', title: 'Help equip our local learning space', value: '48%', subtitle: '$2,400 raised toward a $5,000 goal for books, desks and free weekend sessions.', cta: 'Contribute or share →' },
  },
  {
    id: 'volunteer', name: 'Volunteer Call', category: 'Community', layout: 'volunteer-cards',
    description: 'Show the roles and time commitment needed for a local project.',
    fields: [{ k: 'label', l: 'Call', t: 'text' }, { k: 'title', l: 'Opportunity', t: 'area' }, { k: 'items', l: 'Ways to help', t: 'list' }, { k: 'subtitle', l: 'When and where', t: 'text' }, { k: 'cta', l: 'Join prompt', t: 'text' }],
    defaults: { label: 'Volunteers wanted', title: 'Help make the next community day happen', items: ['Welcome guests', 'Set up the space', 'Share skills with learners'], subtitle: 'Saturday morning · Central library', cta: 'Send us a message to join →' },
  },
  {
    id: 'communityspotlight', name: 'Community Spotlight', category: 'Community', layout: 'community-portrait',
    description: 'Highlight someone whose work helps the community.',
    fields: [{ k: 'label', l: 'Section', t: 'text' }, { k: 'person', l: 'Person', t: 'text' }, { k: 'role', l: 'Role or contribution', t: 'text' }, { k: 'quote', l: 'Their words', t: 'area' }],
    defaults: { label: 'Community spotlight', person: 'Nadia Islam', role: 'Weekend reading volunteer', quote: 'A small hour of attention can change how a child sees their own possibilities.' },
  },
  {
    id: 'partnership', name: 'Partnership Announcement', category: 'Business', layout: 'two-partners',
    description: 'Introduce a collaboration and what it will make possible.',
    fields: [{ k: 'label', l: 'Category', t: 'text' }, { k: 'title', l: 'Announcement', t: 'area' }, { k: 'role', l: 'Partners', t: 'text' }, { k: 'subtitle', l: 'Shared purpose', t: 'area' }, { k: 'items', l: 'What you will build together', t: 'list' }],
    defaults: { label: 'Better together', title: 'A new partnership begins', role: 'Northstar + Reach', subtitle: 'Two teams joining strengths to make useful learning resources easier to access.', items: ['Share practical expertise', 'Co-create free guides', 'Listen to the community'] },
  },
  {
    id: 'behindscenes', name: 'Behind the Scenes', category: 'Business', layout: 'process-glimpses',
    description: 'Show the people or steps behind a finished piece of work.',
    fields: [{ k: 'label', l: 'Section', t: 'text' }, { k: 'title', l: 'Headline', t: 'area' }, { k: 'items', l: 'Moments in the process', t: 'list' }, { k: 'subtitle', l: 'Reflection', t: 'area' }],
    defaults: { label: 'Behind the scenes', title: 'What went into this launch', items: ['Dozens of customer conversations', 'Early drafts we were willing to change', 'One final round of careful testing'], subtitle: 'The visible result is only a small part of the story.' },
  },
  {
    id: 'customerstory', name: 'Customer Story', category: 'Business', layout: 'customer-journey',
    description: 'Explain a real customer problem, the change, and their words.',
    fields: [{ k: 'label', l: 'Section', t: 'text' }, { k: 'title', l: 'Story headline', t: 'area' }, { k: 'before', l: 'Challenge', t: 'area' }, { k: 'after', l: 'Result', t: 'area' }, { k: 'quote', l: 'Customer quote', t: 'area' }],
    defaults: { label: 'Customer story', title: 'A clearer first step for a busy team', before: 'New teammates had to ask around for every process.', after: 'One shared onboarding page made the essentials easy to find.', quote: 'We spend less time searching and more time helping each other.' },
  },
  {
    id: 'changelog', name: 'Release Notes', category: 'Business', layout: 'release-bullets',
    description: 'Summarize a product update in short, readable points.',
    fields: [{ k: 'label', l: 'Version', t: 'text' }, { k: 'title', l: 'Update headline', t: 'area' }, { k: 'items', l: 'What changed', t: 'list' }, { k: 'cta', l: 'Next step', t: 'text' }],
    defaults: { label: 'New this week', title: 'A little less friction, a lot more clarity', items: ['Faster search for saved work', 'Cleaner mobile navigation', 'More helpful empty states'], cta: 'See what changed →' },
  },
  {
    id: 'campaignprogress', name: 'Campaign Progress', category: 'Data & Progress', layout: 'progress-meter',
    description: 'Show progress toward a campaign goal with a clear percentage.',
    fields: [{ k: 'label', l: 'Campaign', t: 'text' }, { k: 'title', l: 'Goal', t: 'area' }, { k: 'value', l: 'Progress percentage', t: 'text' }, { k: 'subtitle', l: 'Context', t: 'area' }, { k: 'cta', l: 'How to help', t: 'text' }],
    defaults: { label: 'Campaign update', title: 'Halfway to our reading-room goal', value: '52%', subtitle: 'Your support has brought us closer to a welcoming place for weekly reading sessions.', cta: 'Help us reach the next milestone →' },
  },
  {
    id: 'surveyresults', name: 'Survey Results', category: 'Data & Progress', layout: 'pie-segments',
    description: 'Turn a simple percentage split into a visual survey result.',
    fields: [{ k: 'label', l: 'Survey label', t: 'text' }, { k: 'title', l: 'Question or finding', t: 'area' }, { k: 'segments', l: 'Answers — label and percent', t: 'list' }, { k: 'subtitle', l: 'Sample or context', t: 'text' }],
    defaults: { label: 'Community survey', title: 'How do people prefer to learn?', segments: ['Short guides — 52%', 'Live sessions — 31%', 'Peer groups — 17%'], subtitle: 'Illustrative sample · replace with your own results' },
  },
  {
    id: 'growthchart', name: 'Growth Chart', category: 'Data & Progress', layout: 'vertical-bars',
    description: 'Plot a few periods of progress as a simple bar chart.',
    fields: [{ k: 'label', l: 'Metric', t: 'text' }, { k: 'title', l: 'Trend headline', t: 'area' }, { k: 'segments', l: 'Periods — numeric value', t: 'list' }, { k: 'subtitle', l: 'What changed', t: 'area' }],
    defaults: { label: 'Monthly progress', title: 'Our learning circle kept growing', segments: ['Jan — 20', 'Feb — 35', 'Mar — 48', 'Apr — 61'], subtitle: 'A steadier rhythm helped more people join and stay.' },
  },
  {
    id: 'impactscorecard', name: 'Impact Scorecard', category: 'Data & Progress', layout: 'metric-grid',
    description: 'Give a small set of outcomes equal weight in a number grid.',
    fields: [{ k: 'label', l: 'Report label', t: 'text' }, { k: 'title', l: 'Impact headline', t: 'area' }, { k: 'items', l: 'Metrics — value and label', t: 'list' }, { k: 'subtitle', l: 'Context', t: 'area' }],
    defaults: { label: 'Quarterly impact', title: 'The work behind the numbers', items: ['Volunteers — 120', 'Learning hours — 840', 'Community events — 24'], subtitle: 'A snapshot of what a committed local team can make possible.' },
  },
  {
    id: 'budgetbreakdown', name: 'Budget Breakdown', category: 'Data & Progress', layout: 'donut-segments',
    description: 'Show where a budget goes with a labeled donut chart.',
    fields: [{ k: 'label', l: 'Budget label', t: 'text' }, { k: 'title', l: 'Budget headline', t: 'area' }, { k: 'segments', l: 'Categories — percentage', t: 'list' }, { k: 'subtitle', l: 'Context', t: 'area' }],
    defaults: { label: 'Where support goes', title: 'Every contribution has a job', segments: ['Materials — 45%', 'Venue — 30%', 'Outreach — 25%'], subtitle: 'Illustrative breakdown · update with verified numbers before posting' },
  },
  {
    id: 'weekinreview', name: 'Week in Review', category: 'Data & Progress', layout: 'bullet-roundup',
    description: 'Publish a concise weekly update with useful bullet points.',
    fields: [{ k: 'label', l: 'Time period', t: 'text' }, { k: 'title', l: 'Weekly headline', t: 'area' }, { k: 'items', l: 'Highlights', t: 'list' }, { k: 'cta', l: 'Next week', t: 'text' }],
    defaults: { label: 'This week', title: 'A few things we shipped and learned', items: ['Published a clearer getting-started guide', 'Asked five users what still felt confusing', 'Fixed the two most common pain points'], cta: 'More next week →' },
  },
] as const satisfies readonly EverydayTemplateDefinition[];
