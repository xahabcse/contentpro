// Cardstock "Studio Glass" mockups: the shared script for every view.
//
// 1. Sky: ?sky=day|night, else the Dhaka clock (day 07–18). Runs in <head>, so no flash.
//    Buttons with data-sky-set switch it; the choice follows links between mockup pages.
// 2. Icons: <i data-i="name"></i> becomes an inline SVG (no sprite, so file:// works too).
// 3. Card previews: <div class="cp" data-card="cover" data-pal="ink"></div> is filled with a
//    rendered card. data-h / data-e override the heading and eyebrow.
// 4. Lists: [data-catalog="12"] fills template tiles, [data-saved] fills saved designs.
// 5. Small mockup behaviour: [data-toggle="#id"] shows/hides, aria-pressed groups, tabs.
(function () {
  var SKIES = ['day', 'night'];

  function fromClock() {
    var hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Dhaka' }).format(new Date()));

    return hour >= 7 && hour < 18 ? 'day' : 'night';
  }

  function chosen() {
    var param = new URLSearchParams(location.search).get('sky');

    return SKIES.indexOf(param) >= 0 ? param : null;
  }

  document.documentElement.dataset.sky = chosen() || fromClock();

  // ---- Icons ---------------------------------------------------------------------------
  var P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-up': '<path d="M6 15l6-6 6 6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    layers: '<rect x="8" y="4" width="12" height="16" rx="2"/><path d="M5 7v10M2 9v6"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    building: '<path d="M3 20h18M5 20V6l7-3v17M12 9h7v11M8 8v.01M8 12v.01M8 16v.01M15.5 13v.01M15.5 17v.01"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
    home: '<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    'text-size': '<path d="M3 19l5-14 5 14M5 14h6M14 19l3.5-8 3.5 8M15 16.5h5"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.3-1.7-.4-1.1.3-2.3 1.5-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/><circle cx="14.5" cy="7" r="1" fill="currentColor"/><circle cx="17" cy="10.5" r="1" fill="currentColor"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
    tablet: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M11 18h2"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    zip: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M10 7h1M11 9h1M10 11h1M11 13h1M10 15h2v2h-2z"/>',
    github: '<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
    undo: '<path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    drive: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 16.5h.01M3 13l3-8h12l3 8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3"/>',
    wand: '<path d="M4 20L15 9M13 7l2-2 4 4-2 2zM8 3v3M6.5 4.5h3M19 14v3M17.5 15.5h3"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-1 8.9z"/>',
    'cloud-off': '<path d="M3 3l18 18M8.5 5.6A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1 2.7 7.6M16 18H7a4.5 4.5 0 0 1-.6-9"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01"/>'
  };

  function icon(name, extraClass) {
    var body = P[name] || P.square;

    return '<svg class="i' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }

  // ---- Card previews --------------------------------------------------------------------
  var AUTHOR = { initials: 'MS', name: 'Md Sahabuddin Hossain', role: 'Software Engineer' };

  function foot(swipe) {
    return '<div class="cp__foot"><span class="cp__av">' + AUTHOR.initials + '</span>' +
      '<span class="cp__who"><b>' + AUTHOR.name + '</b><span>' + AUTHOR.role + '</span></span>' +
      (swipe ? '<span class="cp__swipe">SWIPE →</span>' : '') + '</div>';
  }

  function eyebrow(text) {
    return '<div class="cp__eyebrow">' + text + '</div>';
  }

  var CARDS = {
    cover: function (d) {
      return eyebrow(d.e || 'Carousel · Swipe') + '<div class="cp__grow"></div>' +
        '<h4 class="cp__h">' + (d.h || 'How we scaled our edge API to <em>50M requests</em> a day') + '</h4>' +
        '<div class="cp__grow"></div>' + foot(true);
    },
    stat: function (d) {
      return eyebrow(d.e || 'By the numbers') + '<div class="cp__grow"></div>' +
        '<div class="cp__num">' + (d.h || '73%') + '</div>' +
        '<p class="cp__p" style="font-size:4.4cqw;opacity:.92">of readers decide in the first slide whether to keep swiping.</p>' +
        '<div class="cp__grow"></div>' + foot(false);
    },
    quote: function (d) {
      return '<div class="cp__quote">“</div>' +
        '<p class="cp__qt">' + (d.h || 'Simple is not the same as easy. Simple is what is left when you have done the hard part.') + '</p>' +
        '<div class="cp__grow"></div>' + foot(false);
    },
    tips: function (d) {
      return eyebrow(d.e || 'Save this') + '<h4 class="cp__h" style="font-size:7cqw">' + (d.h || '5 habits of engineers who <em>ship</em>') + '</h4>' +
        '<ol class="cp__list"><li><b>01</b>Write the test before the fix</li><li><b>02</b>Small pull requests, daily</li><li><b>03</b>Read the logs, not the guess</li></ol>' +
        foot(true);
    },
    framework: function (d) {
      return eyebrow(d.e || 'Framework') + '<h4 class="cp__h" style="font-size:6.6cqw">' + (d.h || 'The 4-part <em>review</em> loop') + '</h4>' +
        '<div class="cp__grid"><div><b>1 · Plan</b>Name the outcome</div><div><b>2 · Build</b>Smallest slice</div><div><b>3 · Check</b>Measure it live</div><div><b>4 · Share</b>Write what you learnt</div></div>';
    },
    compare: function (d) {
      return eyebrow(d.e || 'Before / After') + '<h4 class="cp__h" style="font-size:6.6cqw">' + (d.h || 'Homepage weight') + '</h4>' +
        '<div class="cp__vs"><div><b>Before</b><span style="font-family:var(--font-card);font-weight:900;font-size:7.6cqw;white-space:nowrap">4.0 MB</span>Full-size images on every visit</div>' +
        '<div><b>After</b><span style="font-family:var(--font-card);font-weight:900;font-size:7.6cqw;white-space:nowrap">607 KB</span>WebP sizes, made at upload</div></div>';
    },
    wish: function (d) {
      return '<span class="cp__confetti"></span><div class="cp__center">' + eyebrow(d.e || 'Happy birthday').replace('cp__eyebrow"', 'cp__eyebrow" style="justify-content:center"') +
        '<p class="cp__script">' + (d.h || 'Nadia, here’s to your best year yet') + '</p>' +
        '<p class="cp__p">Thank you for the laughs, the code reviews and the tea.</p></div>' + foot(false);
    },
    congrats: function (d) {
      return '<span class="cp__confetti"></span>' + eyebrow(d.e || 'Congratulations') + '<div class="cp__grow"></div>' +
        '<h4 class="cp__h cp__h--xl">' + (d.h || 'Promoted to <em>Tech Lead</em>') + '</h4>' +
        '<p class="cp__p">Proud of the team that got us here.</p><div class="cp__grow"></div>' + foot(false);
    },
    invite: function (d) {
      return eyebrow(d.e || 'You’re invited') + '<div class="cp__grow"></div>' +
        '<div style="display:flex;gap:4cqw;align-items:center"><div class="cp__date"><span>NOV</span><b>28</b></div>' +
        '<h4 class="cp__h" style="font-size:7.4cqw">' + (d.h || 'Dhaka Dev Meetup: <em>Edge</em> night') + '</h4></div>' +
        '<div class="cp__tags"><span>6:30 PM</span><span>Banani, Dhaka</span><span>Free entry</span></div><div class="cp__grow"></div>' + foot(false);
    },
    hiring: function (d) {
      return eyebrow(d.e || 'We’re hiring') + '<h4 class="cp__h">' + (d.h || 'Senior <em>Frontend</em> Engineer') + '</h4>' +
        '<div class="cp__tags"><span>React</span><span>TypeScript</span><span>Hybrid · Dhaka</span></div>' +
        '<div class="cp__grow"></div><p class="cp__p">Apply by 15 December · link in comments</p>' + foot(false);
    },
    question: function (d) {
      return '<div class="cp__center"><span style="font-family:var(--font-serif);font-size:30cqw;line-height:.7;color:var(--c-accent)">?</span>' +
        '<h4 class="cp__h" style="font-size:8cqw">' + (d.h || 'What is one tool you would never code without?') + '</h4></div>' + foot(false);
    },
    announce: function (d) {
      return eyebrow(d.e || 'New chapter') + '<div class="cp__grow"></div>' +
        '<p class="cp__p" style="font-size:4cqw">I’m happy to share that I’m starting a new position as</p>' +
        '<h4 class="cp__h">' + (d.h || 'Assistant Software Engineer at <em>OnnoRokom</em>') + '</h4><div class="cp__grow"></div>' + foot(false);
    },
    thanks: function (d) {
      return '<div class="cp__center"><p class="cp__script" style="font-size:16cqw">' + (d.h || 'Thank you') + '</p>' +
        '<p class="cp__p">To every mentor who answered a “quick question” that was never quick.</p></div>' + foot(false);
    },
    release: function (d) {
      return eyebrow(d.e || 'Release notes · v1.9') + '<h4 class="cp__h" style="font-size:7cqw">' + (d.h || 'What’s new this <em>week</em>') + '</h4>' +
        '<ol class="cp__list"><li><b>+</b>Admin moved to its own home</li><li><b>+</b>Faster template search</li><li><b>~</b>Export keeps your fonts</li></ol>' + foot(false);
    },
    tldr: function (d) {
      return eyebrow(d.e || 'TL;DR') + '<div class="cp__grow"></div><h4 class="cp__h" style="font-size:9.6cqw">' + (d.h || 'Ship small. <em>Measure.</em> Repeat.') + '</h4>' +
        '<p class="cp__p">Three words that replaced our 40-page process doc.</p><div class="cp__grow"></div>' + foot(true);
    },
    progress: function (d) {
      return eyebrow(d.e || 'Goal tracker') + '<h4 class="cp__h" style="font-size:7cqw">' + (d.h || '100 days of <em>LeetCode</em>') + '</h4><div class="cp__grow"></div>' +
        '<div style="display:flex;justify-content:space-between;font-family:var(--font-ui);font-size:3cqw"><span>Day 64</span><b>64%</b></div>' +
        '<div class="cp__bar"><i style="width:64%"></i></div><div class="cp__grow"></div>' + foot(false);
    },
    blank: function () {
      return '<div class="cp__center" style="opacity:.5"><span style="font-family:var(--font-mono);font-size:3cqw;letter-spacing:.14em">1080 × 1080</span></div>';
    }
  };

  function renderCard(el) {
    var pal = el.dataset.pal || 'ink';
    el.style.setProperty('--c-bg', 'var(--pal-' + pal + '-bg)');
    el.style.setProperty('--c-text', 'var(--pal-' + pal + '-text)');
    el.style.setProperty('--c-accent', 'var(--pal-' + pal + '-accent)');
    var make = CARDS[el.dataset.card] || CARDS.cover;
    var page = el.dataset.page ? '<span class="cp__page">' + el.dataset.page + '</span>' : '';
    el.innerHTML = page + '<div class="cp__in">' + make({ h: el.dataset.h, e: el.dataset.e }) + '</div>';
  }

  // ---- Data for lists -------------------------------------------------------------------
  var CATALOG = [
    { n: 'Cover / Hook', g: 'Hooks & Stories', p: 'ink', t: 'cover', d: 'A bold opening line for a post or the first slide of a deck.' },
    { n: 'Birthday Wish', g: 'Everyday & Social', p: 'paper', t: 'wish', d: 'Send a personal wish with room for a name and message.' },
    { n: 'Big Stat', g: 'Data & Comparisons', p: 'cobalt', t: 'stat', d: 'Lead with the one number people will remember.' },
    { n: 'Numbered Tips', g: 'Learning & Guides', p: 'plum', t: 'tips', d: 'Turn practical advice into a numbered list.' },
    { n: 'Event Invite', g: 'Business & Events', p: 'navy', t: 'invite', d: 'Invite people with a clear date, place and next step.' },
    { n: 'Quote', g: 'Everyday & Social', p: 'forest', t: 'quote', d: 'A polished card for messages and milestones.' },
    { n: 'Before / After', g: 'Data & Comparisons', p: 'slate', t: 'compare', d: 'Show the change side by side.' },
    { n: 'Congratulations', g: 'Everyday & Social', p: 'wine', t: 'congrats', d: 'Celebrate a promotion, win or milestone.' },
    { n: 'Hiring / Job', g: 'Business & Events', p: 'charcoal', t: 'hiring', d: 'Present an open role and the essentials at a glance.' },
    { n: 'Framework', g: 'Learning & Guides', p: 'forest', t: 'framework', d: 'Explain a model in four clear parts.' },
    { n: 'Promotion Announcement', g: 'Career & Community', p: 'paper', t: 'announce', d: 'Share a new role and thank the people who helped.' },
    { n: 'Bold Question', g: 'Hooks & Stories', p: 'sand', t: 'question', d: 'Ask a question that invites a thoughtful reply.' },
    { n: 'Key Takeaway / TL;DR', g: 'Learning & Guides', p: 'wine', t: 'tldr', d: 'Break a useful idea into one memorable line.' },
    { n: 'Release Notes', g: 'Business & Events', p: 'navy', t: 'release', d: 'Summarise a product update in short points.' },
    { n: 'Thank You', g: 'Everyday & Social', p: 'slate', t: 'thanks', d: 'Thank a colleague, client or community.' },
    { n: 'Progress / Goal', g: 'Data & Comparisons', p: 'cobalt', t: 'progress', d: 'Track a goal people can follow along with.' }
  ];

  var SAVED = [
    { n: 'How we scaled our edge API', k: 'Carousel', s: 7, p: 'ink', t: 'cover', w: '2 min ago' },
    { n: 'Nadia’s birthday', k: 'Card', p: 'paper', t: 'wish', w: 'Today, 9:12' },
    { n: 'Homepage weight: before / after', k: 'Card', p: 'slate', t: 'compare', w: 'Yesterday' },
    { n: '5 habits of engineers who ship', k: 'Carousel', s: 6, p: 'plum', t: 'tips', w: '17 Nov' },
    { n: 'Dhaka Dev Meetup invite', k: 'Card', p: 'navy', t: 'invite', w: '15 Nov' },
    { n: 'Hiring: Senior Frontend', k: 'Card', p: 'charcoal', t: 'hiring', w: '12 Nov' },
    { n: 'Review loop framework', k: 'Carousel', s: 5, p: 'forest', t: 'framework', w: '9 Nov' },
    { n: '73% stat for launch post', k: 'Card', p: 'cobalt', t: 'stat', w: '2 Nov' }
  ];

  function catalogTile(item) {
    return '<a class="tpl sheen" href="../' + (document.documentElement.dataset.view || 'desktop') + '/signup.html">' +
      '<div class="cp" data-card="' + item.t + '" data-pal="' + item.p + '"></div>' +
      '<div class="tpl__body"><div class="tpl__row"><h3 class="tpl__name">' + item.n + '</h3>' +
      '<span class="tpl__pal" style="--sw:var(--pal-' + item.p + '-bg);--sw-a:var(--pal-' + item.p + '-accent)"></span></div>' +
      '<p class="tpl__desc">' + item.d + '</p>' +
      '<div class="tpl__foot"><span class="badge">' + item.g + '</span><span class="tpl__use">Use ' + icon('arrow-right') + '</span></div></div></a>';
  }

  function miniTile(item, index) {
    return '<button class="mini' + (index === 0 ? ' is-on' : '') + '" type="button" aria-pressed="' + (index === 0) + '">' +
      '<div class="cp" data-card="' + item.t + '" data-pal="' + item.p + '"></div><span>' + item.n + '</span></button>';
  }

  function savedTile(item) {
    var view = document.documentElement.dataset.view || 'desktop';

    return '<article class="saved surface sheen"><a class="saved__art" href="../' + view + '/editor.html">' +
      '<div class="cp" data-card="' + item.t + '" data-pal="' + item.p + '"' + (item.k === 'Carousel' ? ' data-ratio="45"' : '') + '></div>' +
      (item.k === 'Carousel' ? '<span class="saved__stack" aria-hidden="true"></span>' : '') + '</a>' +
      '<div class="saved__body"><h3 class="saved__name">' + item.n + '</h3>' +
      '<p class="saved__meta">' + icon(item.k === 'Carousel' ? 'layers' : 'square') + ' ' + item.k + (item.s ? ' · ' + item.s + ' slides' : ' · 1080²') + '<span>' + item.w + '</span></p></div>' +
      '<div class="saved__acts"><a class="btn btn--sm btn--glass" href="../' + view + '/editor.html">Open</a>' +
      '<button class="btn btn--sm btn--quiet btn--icon" type="button" aria-label="Make a copy">' + icon('copy') + '</button>' +
      '<button class="btn btn--sm btn--quiet btn--icon" type="button" aria-label="Delete this design">' + icon('trash') + '</button></div></article>';
  }

  // ---- Boot -------------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-catalog]').forEach(function (el) {
      var count = Number(el.dataset.catalog) || CATALOG.length;
      el.innerHTML = CATALOG.slice(0, count).map(catalogTile).join('');
    });

    document.querySelectorAll('[data-mini]').forEach(function (el) {
      var count = Number(el.dataset.mini) || CATALOG.length;
      el.innerHTML = CATALOG.slice(0, count).map(miniTile).join('');
    });

    document.querySelectorAll('[data-saved]').forEach(function (el) {
      var count = Number(el.dataset.saved) || SAVED.length;
      el.innerHTML = SAVED.slice(0, count).map(savedTile).join('');
    });

    document.querySelectorAll('.cp[data-card]').forEach(renderCard);

    document.querySelectorAll('i[data-i]').forEach(function (el) {
      el.outerHTML = icon(el.dataset.i, el.className);
    });

    // Sky buttons.
    var skyButtons = document.querySelectorAll('[data-sky-set]');

    function markSky() {
      skyButtons.forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.skySet === document.documentElement.dataset.sky));
      });
    }

    skyButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        document.documentElement.dataset.sky = button.dataset.skySet;
        var url = new URL(location.href);
        url.searchParams.set('sky', button.dataset.skySet);
        history.replaceState(null, '', url);
        markSky();
        document.querySelectorAll('iframe').forEach(function (frame) {
          try {
            frame.contentDocument.documentElement.dataset.sky = button.dataset.skySet;
          } catch (error) {
            // Cross-origin frame: leave it.
          }
        });
      });
    });
    markSky();

    // Keep the sky across mockup links.
    document.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href]') : null;
      var sky = chosen();
      if (!link || !sky || link.target) {
        return;
      }
      var href = link.getAttribute('href');
      if (/^(https?:|mailto:|#)/.test(href)) {
        return;
      }
      event.preventDefault();
      var target = new URL(href, location.href);
      target.searchParams.set('sky', sky);
      location.href = target.href;
    });

    // Show / hide: drawers, menus, sheets.
    document.querySelectorAll('[data-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var target = document.querySelector(button.dataset.toggle);
        if (!target) {
          return;
        }
        var open = target.hasAttribute('hidden');
        target.toggleAttribute('hidden', !open);
        button.setAttribute('aria-expanded', String(open));
      });
    });

    // Pressed groups (chips, segmented controls, swatches): one on at a time.
    document.querySelectorAll('[data-group]').forEach(function (group) {
      group.addEventListener('click', function (event) {
        var button = event.target.closest('[aria-pressed]');
        if (!button || !group.contains(button)) {
          return;
        }
        group.querySelectorAll('[aria-pressed]').forEach(function (other) {
          other.setAttribute('aria-pressed', 'false');
          other.classList.remove('is-on');
        });
        button.setAttribute('aria-pressed', 'true');
        button.classList.add('is-on');
      });
    });

    // Tabs: visual only.
    document.querySelectorAll('[role="tablist"]').forEach(function (list) {
      list.addEventListener('click', function (event) {
        var tab = event.target.closest('[role="tab"]');
        if (!tab) {
          return;
        }
        list.querySelectorAll('[role="tab"]').forEach(function (other) {
          other.setAttribute('aria-selected', String(other === tab));
          var panel = other.getAttribute('aria-controls');
          if (panel && document.getElementById(panel)) {
            document.getElementById(panel).hidden = other !== tab;
          }
        });
      });
    });
  });
})();
