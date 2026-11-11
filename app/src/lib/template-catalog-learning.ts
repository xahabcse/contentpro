/** Educational formats added to the shared card/carousel template registry. */
export type LearningLayout =
  | 'ordered-steps'
  | 'checklist'
  | 'code-window'
  | 'flow'
  | 'branch'
  | 'system-map'
  | 'layer-stack'
  | 'concept-map'
  | 'split'
  | 'equation'
  | 'reference-grid'
  | 'term-cards'
  | 'error-stack'
  | 'pillars'
  | 'story'
  | 'challenge'
  | 'quiz'
  | 'progress-bars'
  | 'bullet-list'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart';

export interface LearningTemplateDefinition {
  id: string;
  name: string;
  group: 'Learning & Guides' | 'Data & Comparisons';
  palette: string;
  description: string;
  /** Visual arrangement for the renderer; templates sharing one family can still vary by fields. */
  layout: LearningLayout;
  fields: readonly { k: string; l: string; t: 'text' | 'area' | 'list' }[];
  defaults: Record<string, string | readonly string[]>;
}

// Chart lists use "Label — value" entries. Values are illustrative and should
// be replaced with a creator's own data before publishing.
export const LEARNING_TEMPLATES = [
  {
    id: 'quickstart_guide', name: 'Quickstart Guide', group: 'Learning & Guides', palette: 'paper',
    description: 'Get a beginner from zero to a first result.', layout: 'ordered-steps',
    fields: [{ k: 'label', l: 'Topic label', t: 'text' }, { k: 'title', l: 'Guide title', t: 'area' }, { k: 'items', l: 'First steps (one per line)', t: 'list' }, { k: 'result', l: 'First result', t: 'area' }],
    defaults: { label: 'START HERE', title: 'Build a habit of learning in public', items: ['Choose one topic you are learning', 'Write down one useful example', 'Share what changed in your thinking'], result: 'One honest lesson is enough for your first post.' },
  },
  {
    id: 'prerequisites', name: 'Before You Begin', group: 'Learning & Guides', palette: 'sand',
    description: 'Show the skills and tools needed before a tutorial.', layout: 'checklist',
    fields: [{ k: 'label', l: 'Topic label', t: 'text' }, { k: 'title', l: 'Tutorial title', t: 'area' }, { k: 'items', l: 'Prerequisites (one per line)', t: 'list' }, { k: 'note', l: 'Helpful note', t: 'area' }],
    defaults: { label: 'BEFORE YOU BEGIN', title: 'Ready for your first API project?', items: ['A code editor', 'Basic HTTP vocabulary', 'A small problem to solve'], note: 'Start small. You can add complexity after the first working request.' },
  },
  {
    id: 'code_walkthrough', name: 'Code Walkthrough', group: 'Learning & Guides', palette: 'charcoal',
    description: 'Pair a short code example with plain-English explanation.', layout: 'code-window',
    fields: [{ k: 'label', l: 'Language or topic', t: 'text' }, { k: 'title', l: 'What this code does', t: 'area' }, { k: 'code', l: 'Code snippet', t: 'area' }, { k: 'items', l: 'Callouts (one per line)', t: 'list' }],
    defaults: { label: 'JAVASCRIPT', title: 'A tiny retry with a clear stop condition', code: 'for (let attempt = 0; attempt < 3; attempt++) {\n  const result = await fetchData();\n  if (result.ok) return result;\n}', items: ['Limit retries to three attempts', 'Return as soon as a request succeeds'] },
  },
  {
    id: 'debugging_playbook', name: 'Debugging Playbook', group: 'Learning & Guides', palette: 'navy',
    description: 'Turn a symptom into a repeatable diagnosis.', layout: 'flow',
    fields: [{ k: 'symptom', l: 'Symptom', t: 'area' }, { k: 'items', l: 'Checks in order', t: 'list' }, { k: 'resolution', l: 'Resolution', t: 'area' }],
    defaults: { symptom: 'The page loads, but the data is blank', items: ['Check the network request', 'Read the response status', 'Inspect the data shape'], resolution: 'Fix the first failing step, then rerun the same request.' },
  },
  {
    id: 'workflow_map', name: 'Workflow Map', group: 'Learning & Guides', palette: 'forest',
    description: 'Show how work moves from input to outcome.', layout: 'flow',
    fields: [{ k: 'title', l: 'Workflow title', t: 'area' }, { k: 'items', l: 'Stages (one per line)', t: 'list' }, { k: 'outcome', l: 'Outcome', t: 'area' }],
    defaults: { title: 'A simple research-to-post workflow', items: ['Collect one source', 'Extract the central idea', 'Write a concrete example', 'Publish and discuss'], outcome: 'Make the next post from a real reader question.' },
  },
  {
    id: 'decision_tree', name: 'Decision Tree', group: 'Learning & Guides', palette: 'cobalt',
    description: 'Help readers choose between two practical paths.', layout: 'branch',
    fields: [{ k: 'question', l: 'Decision question', t: 'area' }, { k: 'left', l: 'If yes', t: 'area' }, { k: 'right', l: 'If no', t: 'area' }, { k: 'note', l: 'Decision tip', t: 'area' }],
    defaults: { question: 'Is this task repeated every week?', left: 'Yes → document it, then automate the stable steps.', right: 'No → keep the process manual until the pattern is clear.', note: 'Automate a known process, not an assumption.' },
  },
  {
    id: 'architecture_map', name: 'Architecture Map', group: 'Learning & Guides', palette: 'ink',
    description: 'Explain the parts of a system and how they connect.', layout: 'system-map',
    fields: [{ k: 'title', l: 'System name', t: 'area' }, { k: 'items', l: 'Components in flow order', t: 'list' }, { k: 'note', l: 'Design note', t: 'area' }],
    defaults: { title: 'A small web app, end to end', items: ['Browser → user interaction', 'API → validation and rules', 'Database → durable records'], note: 'Draw the boundary before choosing the technology.' },
  },
  {
    id: 'concept_breakdown', name: 'Concept Breakdown', group: 'Learning & Guides', palette: 'paper',
    description: 'Unpack one idea into layers readers can remember.', layout: 'layer-stack',
    fields: [{ k: 'term', l: 'Concept', t: 'text' }, { k: 'items', l: 'Layers (one per line)', t: 'list' }, { k: 'takeaway', l: 'One-sentence takeaway', t: 'area' }],
    defaults: { term: 'Caching', items: ['What: store a reusable result', 'Why: avoid repeated work', 'Where: choose the right boundary'], takeaway: 'A good cache makes the common path faster without hiding stale data.' },
  },
  {
    id: 'mental_model', name: 'Mental Model', group: 'Learning & Guides', palette: 'plum',
    description: 'Give an abstract topic a simple visual model.', layout: 'concept-map',
    fields: [{ k: 'title', l: 'Model name', t: 'area' }, { k: 'center', l: 'Core idea', t: 'area' }, { k: 'items', l: 'Connected ideas', t: 'list' }],
    defaults: { title: 'The feedback loop', center: 'Make → share → learn', items: ['Make a small version', 'Show it to someone', 'Use the response to improve'] },
  },
  {
    id: 'analogy', name: 'Explain With an Analogy', group: 'Learning & Guides', palette: 'sand',
    description: 'Connect a new idea to something familiar.', layout: 'split',
    fields: [{ k: 'title', l: 'Concept', t: 'area' }, { k: 'familiar', l: 'Familiar example', t: 'area' }, { k: 'technical', l: 'What it means here', t: 'area' }, { k: 'limit', l: 'Where the analogy stops', t: 'area' }],
    defaults: { title: 'A queue is like a waiting line', familiar: 'People join at the back and are served in order.', technical: 'Work waits until a worker is free to process it.', limit: 'Real queues also need retries and failure handling.' },
  },
  {
    id: 'formula', name: 'Formula Explained', group: 'Learning & Guides', palette: 'cobalt',
    description: 'Put one equation in context with its parts.', layout: 'equation',
    fields: [{ k: 'label', l: 'Topic label', t: 'text' }, { k: 'formula', l: 'Formula', t: 'area' }, { k: 'items', l: 'What each part means', t: 'list' }, { k: 'example', l: 'Worked example', t: 'area' }],
    defaults: { label: 'BACK-OF-ENVELOPE', formula: 'Time saved = runs × minutes saved', items: ['Runs → how often the task happens', 'Minutes saved → time removed each run'], example: 'Use your own numbers before deciding whether to automate.' },
  },
  {
    id: 'cheatsheet', name: 'Cheat Sheet', group: 'Learning & Guides', palette: 'forest',
    description: 'Keep short reference rules together in one saveable card.', layout: 'reference-grid',
    fields: [{ k: 'title', l: 'Reference title', t: 'area' }, { k: 'items', l: 'Rules (one per line)', t: 'list' }, { k: 'note', l: 'Footer note', t: 'area' }],
    defaults: { title: 'HTTP status codes at a glance', items: ['2xx — request succeeded', '4xx — request needs a client fix', '5xx — server could not complete it'], note: 'Always read the response body for the useful detail.' },
  },
  {
    id: 'glossary', name: 'Mini Glossary', group: 'Learning & Guides', palette: 'paper',
    description: 'Define a small set of related terms without jargon.', layout: 'term-cards',
    fields: [{ k: 'title', l: 'Topic title', t: 'area' }, { k: 'items', l: 'Term — meaning pairs', t: 'list' }, { k: 'note', l: 'Context note', t: 'area' }],
    defaults: { title: 'Three words to know before your first API', items: ['Request — what the client asks for', 'Response — what the server sends back', 'Endpoint — the address for one operation'], note: 'Learn the words by making one real request.' },
  },
  {
    id: 'mistake_fix', name: 'Mistake → Fix', group: 'Learning & Guides', palette: 'wine',
    description: 'Show a common error and the specific correction.', layout: 'split',
    fields: [{ k: 'title', l: 'Lesson title', t: 'area' }, { k: 'mistake', l: 'The mistake', t: 'area' }, { k: 'fix', l: 'The fix', t: 'area' }, { k: 'why', l: 'Why it works', t: 'area' }],
    defaults: { title: 'A better way to write an update', mistake: 'Lead with everything that happened.', fix: 'Lead with the decision and its impact.', why: 'Readers can ask for detail after they understand the point.' },
  },
  {
    id: 'common_errors', name: 'Common Errors', group: 'Learning & Guides', palette: 'charcoal',
    description: 'List recurring failures with a short remedy for each.', layout: 'error-stack',
    fields: [{ k: 'title', l: 'Topic', t: 'area' }, { k: 'items', l: 'Error — fix pairs', t: 'list' }, { k: 'note', l: 'Final check', t: 'area' }],
    defaults: { title: 'Three mistakes in a first portfolio', items: ['No context — explain the problem', 'Only final screens — show your decisions', 'No result — say what changed'], note: 'Make your contribution easy to understand.' },
  },
  {
    id: 'do_dont', name: 'Do / Don’t', group: 'Learning & Guides', palette: 'forest',
    description: 'Put a good practice beside the tempting alternative.', layout: 'split',
    fields: [{ k: 'title', l: 'Topic', t: 'area' }, { k: 'do', l: 'Do this', t: 'list' }, { k: 'dont', l: 'Avoid this', t: 'list' }],
    defaults: { title: 'Writing a useful tutorial', do: ['Use one concrete example', 'Explain the expected result', 'Name the edge case'], dont: ['Skip setup steps', 'Hide the error state', 'Assume every reader knows the jargon'] },
  },
  {
    id: 'tradeoffs', name: 'Trade-offs', group: 'Learning & Guides', palette: 'navy',
    description: 'Explain what an option gains and what it costs.', layout: 'split',
    fields: [{ k: 'title', l: 'Decision', t: 'area' }, { k: 'gains', l: 'What you gain', t: 'list' }, { k: 'costs', l: 'What you give up', t: 'list' }, { k: 'decision', l: 'When to choose it', t: 'area' }],
    defaults: { title: 'When should you add a cache?', gains: ['Faster repeated reads', 'Less upstream work'], costs: ['Invalidation logic', 'Possible stale responses'], decision: 'Use one when the repeat traffic justifies the added complexity.' },
  },
  {
    id: 'principles', name: 'Core Principles', group: 'Learning & Guides', palette: 'ink',
    description: 'Make a few rules feel distinct and easy to recall.', layout: 'pillars',
    fields: [{ k: 'title', l: 'Subject', t: 'area' }, { k: 'items', l: 'Principles (one per line)', t: 'list' }, { k: 'closing', l: 'Closing thought', t: 'area' }],
    defaults: { title: 'Three principles for clearer teaching', items: ['Begin with the problem', 'Show one worked example', 'End with a reusable rule'], closing: 'Clarity is a service to the reader.' },
  },
  {
    id: 'case_study', name: 'Case Study', group: 'Learning & Guides', palette: 'plum',
    description: 'Present context, action, and a learning from real work.', layout: 'story',
    fields: [{ k: 'title', l: 'Case title', t: 'area' }, { k: 'context', l: 'Starting situation', t: 'area' }, { k: 'action', l: 'What changed', t: 'area' }, { k: 'result', l: 'Result or lesson', t: 'area' }],
    defaults: { title: 'A clearer onboarding flow', context: 'New teammates asked the same setup questions.', action: 'We put the first task and its expected result on one page.', result: 'The lesson: make the first successful step obvious.' },
  },
  {
    id: 'experiment', name: 'Experiment Notes', group: 'Learning & Guides', palette: 'cobalt',
    description: 'Share a hypothesis, test, observation, and next step.', layout: 'story',
    fields: [{ k: 'title', l: 'Experiment title', t: 'area' }, { k: 'hypothesis', l: 'Hypothesis', t: 'area' }, { k: 'test', l: 'What you tested', t: 'area' }, { k: 'observation', l: 'What you observed', t: 'area' }, { k: 'next', l: 'Next step', t: 'area' }],
    defaults: { title: 'Will a shorter update get clearer replies?', hypothesis: 'One focused question will invite more useful feedback.', test: 'Share the same idea as a short post with one question.', observation: 'Record the actual replies before drawing a conclusion.', next: 'Try a second topic and compare.' },
  },
  {
    id: 'postmortem', name: 'Postmortem', group: 'Learning & Guides', palette: 'charcoal',
    description: 'Turn an incident into a blameless sequence of lessons.', layout: 'story',
    fields: [{ k: 'title', l: 'Incident title', t: 'area' }, { k: 'trigger', l: 'What happened', t: 'area' }, { k: 'response', l: 'What you did', t: 'area' }, { k: 'learning', l: 'What changes next', t: 'area' }],
    defaults: { title: 'A release checklist we learned to need', trigger: 'A change reached users without its configuration.', response: 'We rolled it back, checked the impact, and fixed the missing step.', learning: 'Make the configuration check part of the release process.' },
  },
  {
    id: 'lessons_learned', name: 'Lessons Learned', group: 'Learning & Guides', palette: 'sand',
    description: 'Reflect on what a project taught you.', layout: 'bullet-list',
    fields: [{ k: 'title', l: 'Project or period', t: 'area' }, { k: 'items', l: 'Lessons (one per line)', t: 'list' }, { k: 'next', l: 'What you will try next', t: 'area' }],
    defaults: { title: 'What shipping a small tool taught me', items: ['Talk to users before polishing', 'Keep the first version narrow', 'Write down what failed'], next: 'Ship the next improvement from the strongest signal.' },
  },
  {
    id: 'resource_library', name: 'Resource Library', group: 'Learning & Guides', palette: 'forest',
    description: 'Curate a short list of resources by use.', layout: 'reference-grid',
    fields: [{ k: 'title', l: 'Subject', t: 'area' }, { k: 'items', l: 'Resource — why it helps', t: 'list' }, { k: 'note', l: 'How to use the list', t: 'area' }],
    defaults: { title: 'My starter kit for learning APIs', items: ['Official docs — check the contract', 'A sample project — try a request', 'A request log — inspect failures'], note: 'Save only resources you will actually revisit.' },
  },
  {
    id: 'practice_exercise', name: 'Practice Exercise', group: 'Learning & Guides', palette: 'paper',
    description: 'Give readers a small challenge and success criteria.', layout: 'challenge',
    fields: [{ k: 'label', l: 'Difficulty label', t: 'text' }, { k: 'challenge', l: 'The challenge', t: 'area' }, { k: 'constraints', l: 'Constraints', t: 'list' }, { k: 'success', l: 'Success looks like', t: 'area' }],
    defaults: { label: 'TRY THIS', challenge: 'Explain a concept using one everyday example.', constraints: ['Use fewer than five sentences', 'Avoid jargon', 'End with one useful rule'], success: 'Someone new to the topic can repeat the idea in their own words.' },
  },
  {
    id: 'quiz_reveal', name: 'Quiz + Reveal', group: 'Learning & Guides', palette: 'plum',
    description: 'Ask a knowledge check, then reveal the reasoning.', layout: 'quiz',
    fields: [{ k: 'question', l: 'Question', t: 'area' }, { k: 'options', l: 'Answer choices', t: 'list' }, { k: 'answer', l: 'Correct answer', t: 'text' }, { k: 'reason', l: 'Why it is correct', t: 'area' }],
    defaults: { question: 'Which part of an API response tells you whether a request succeeded?', options: ['A — status code', 'B — URL length', 'C — browser tab name'], answer: 'A — status code', reason: 'The status code gives the first signal; read the response body for detail.' },
  },
  {
    id: 'interview_answer', name: 'Interview Answer', group: 'Learning & Guides', palette: 'navy',
    description: 'Model a concise answer to a common interview question.', layout: 'quiz',
    fields: [{ k: 'question', l: 'Interview question', t: 'area' }, { k: 'answer', l: 'Short answer', t: 'area' }, { k: 'example', l: 'Concrete example', t: 'area' }, { k: 'tip', l: 'Answer tip', t: 'area' }],
    defaults: { question: 'How do you handle a production bug?', answer: 'Confirm impact, stabilize the service, then investigate the cause.', example: 'I start with logs and a reproducible request before changing code.', tip: 'Explain your process, not just the tool you used.' },
  },
  {
    id: 'progress_tracker', name: 'Learning Progress', group: 'Data & Comparisons', palette: 'cobalt',
    description: 'Show milestones with honest progress bars.', layout: 'progress-bars',
    fields: [{ k: 'label', l: 'Progress label', t: 'text' }, { k: 'title', l: 'Goal', t: 'area' }, { k: 'values', l: 'Milestone — percent pairs', t: 'list' }, { k: 'next', l: 'Next milestone', t: 'area' }],
    defaults: { label: 'SAMPLE PROGRESS', title: 'Building a portfolio from scratch', values: ['Choose projects — 100', 'Write case studies — 65', 'Ask for feedback — 25'], next: 'Next: publish one complete case study. Replace sample values before posting.' },
  },
  {
    id: 'bullet_lesson', name: 'Bullet Lesson', group: 'Learning & Guides', palette: 'paper',
    description: 'Teach one idea with a clear headline and strong bullets.', layout: 'bullet-list',
    fields: [{ k: 'label', l: 'Lesson label', t: 'text' }, { k: 'title', l: 'Main lesson', t: 'area' }, { k: 'items', l: 'Bullets (one per line)', t: 'list' }, { k: 'takeaway', l: 'Takeaway', t: 'area' }],
    defaults: { label: 'ONE-MINUTE LESSON', title: 'A useful update has three parts', items: ['What changed', 'Why it matters', 'What happens next'], takeaway: 'Give readers the decision before the details.' },
  },
  {
    id: 'line_chart', name: 'Line Graph', group: 'Data & Comparisons', palette: 'navy',
    description: 'Show a trend across ordered points.', layout: 'line-chart',
    fields: [{ k: 'label', l: 'Data source label', t: 'text' }, { k: 'title', l: 'Trend title', t: 'area' }, { k: 'values', l: 'Point — value pairs', t: 'list' }, { k: 'insight', l: 'What the trend means', t: 'area' }],
    defaults: { label: 'SAMPLE DATA', title: 'Practice sessions over four weeks', values: ['Week 1 — 2', 'Week 2 — 3', 'Week 3 — 5', 'Week 4 — 6'], insight: 'Replace these sample values with your measured trend before posting.' },
  },
  {
    id: 'bar_chart', name: 'Bar Graph', group: 'Data & Comparisons', palette: 'forest',
    description: 'Compare categories using an easy-to-read graph.', layout: 'bar-chart',
    fields: [{ k: 'label', l: 'Data source label', t: 'text' }, { k: 'title', l: 'Comparison title', t: 'area' }, { k: 'values', l: 'Category — value pairs', t: 'list' }, { k: 'insight', l: 'Key observation', t: 'area' }],
    defaults: { label: 'SAMPLE DATA', title: 'Where I spent my study time', values: ['Reading — 4', 'Building — 8', 'Reviewing — 3'], insight: 'Replace sample values with your own measured comparison.' },
  },
  {
    id: 'pie_chart', name: 'Pie Chart', group: 'Data & Comparisons', palette: 'wine',
    description: 'Explain parts of one whole with a labeled pie.', layout: 'pie-chart',
    fields: [{ k: 'label', l: 'Data source label', t: 'text' }, { k: 'title', l: 'Whole being divided', t: 'area' }, { k: 'values', l: 'Segment — value pairs', t: 'list' }, { k: 'insight', l: 'Key observation', t: 'area' }],
    defaults: { label: 'SAMPLE DATA', title: 'A week of learning time', values: ['Practice — 50', 'Reading — 30', 'Review — 20'], insight: 'Replace sample values; use parts of one measured whole.' },
  },
] as const satisfies readonly LearningTemplateDefinition[];
