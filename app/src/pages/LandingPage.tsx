import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { PhoneCta, PublicFooter, PublicHeader } from '@/components/layout/PublicChrome';
import SlidePreview from '@/components/editor/SlidePreview';
import Icon from '@/components/ui/Icon';
import { resolveColors, PALETTES } from '@/lib/palettes';
import { templateDefaults } from '@/lib/templates';
import { SHOWCASE_ITEMS } from '@/lib/showcase';
import TemplateGallery from '@/components/TemplateGallery';
import type { ResolvedSlide, TemplateId } from '@/lib/design-types';

const HERO_TEMPLATES: { id: TemplateId; label: string; quickKey: string; initialText: string }[] = [
  { id: 'cover', label: 'Cover Hook', quickKey: 'headline', initialText: 'How We Scaled Our Edge API to 50M Requests/Day' },
  { id: 'stat', label: 'Big Stat', quickKey: 'number', initialText: '99.99%' },
  { id: 'quote', label: 'Quote', quickKey: 'quote', initialText: 'The best engineering is the one that solves the problem and gets out of the way.' },
  { id: 'tips', label: 'Numbered Tips', quickKey: 'title', initialText: '4 Architecture Rules We Never Break' },
  { id: 'framework', label: 'Framework', quickKey: 'title', initialText: 'The 3-Step Edge Caching Playbook' },
  { id: 'contrast', label: 'Before / After', quickKey: 'after', initialText: 'A high-converting post published in under 3 minutes.' },
];

const CAROUSEL_DECK_SLIDES: { template: TemplateId; fields: Record<string, string | string[]>; palette: string }[] = [
  {
    template: 'cover',
    palette: 'ink',
    fields: {
      kicker: 'Engineering Leadership · Swipe →',
      headline: 'The 5 System Design Rules Every Senior Engineer Follows',
      highlight: 'Senior Engineer',
    },
  },
  {
    template: 'stat',
    palette: 'cobalt',
    fields: {
      label: 'Performance Benchmark',
      number: '4.2×',
      caption: 'Faster time-to-market when design guardrails are built directly into code.',
    },
  },
  {
    template: 'tips',
    palette: 'forest',
    fields: {
      title: '3 Principles for High-Traffic APIs',
      items: [
        'Cache aggressively at the edge before hitting databases',
        'Use atomic Durable Objects for distributed locks',
        'Keep client payloads strictly typed and validated',
      ],
    },
  },
  {
    template: 'framework',
    palette: 'plum',
    fields: {
      title: 'The Post-Mortem Framework',
      items: [
        'Tension — Identify root cause without personal blame',
        'Turn — Ship automated regression tests within 24h',
        'Take — Document lessons in public for team learning',
      ],
    },
  },
  {
    template: 'cta',
    palette: 'wine',
    fields: {
      headline: 'Want the full architecture diagram & code examples?',
      highlight: 'architecture diagram',
      buttonText: 'Save this post & comment below →',
    },
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I export for LinkedIn or Facebook?',
    a: 'Single cards export as 1080×1080 PNG images. For a carousel, choose a multi-page PDF for a LinkedIn document post or a ZIP of 1080×1350 PNG slides to upload as ordered images on Facebook or another platform.',
  },
  {
    q: 'Why fixed templates instead of a free-form canvas like Canva?',
    a: 'Structured layouts keep spacing and type consistent while you write. Each template includes automatic font sizing and an image scrim. Check the live preview before exporting longer copy.',
  },
  {
    q: 'Are my designs saved on your server?',
    a: 'No. Designs live 100% on your device inside your browser (localStorage for structure and IndexedDB for uploaded photos). Your content never touches our servers. You can export a full JSON backup at any time to move your designs between computers.',
  },
  {
    q: 'Can I add my own profile picture, logo, and brand colors?',
    a: `Yes! Set your name, handle, designation, avatar, and company logo once in your profile. Every template automatically signs your post in the footer. You can also pick from ${PALETTES.length} curated palettes or enter custom hex colors for any design.`,
  },
  {
    q: 'Is there any watermark on exported designs?',
    a: 'None. Exported PNGs and PDFs are completely unbranded and 100% yours to publish.',
  },
  {
    q: 'Can I test it without creating an account?',
    a: 'You can test the live interactive sandbox right here on this page, or log in with the instant demo account (demo@contentpro.local / demo1234) if running locally.',
  },
];

const DECK_STEPS: { title: string; note: string; detail: string }[] = [
  { title: 'Hook cover', note: 'One line that earns the first swipe', detail: 'A clear, high-contrast title with a highlighted hook, so a reader on a phone gets the point in under a second.' },
  { title: 'Big stat', note: 'A number that makes it real', detail: 'Follow the hook with one metric that builds credibility and curiosity.' },
  { title: 'Numbered tips', note: 'The value, in steps people save', detail: 'Three short, high-signal rules with no filler, so readers start bookmarking.' },
  { title: 'Framework', note: 'The model to remember', detail: 'A named model (Tension, Turn, Take) that makes the advice easy to recall and apply.' },
  { title: 'Call to action', note: 'What to do next', detail: 'Ask readers to save the post or comment, which is what spreads it further.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Sandbox
  const [sandboxTemplate, setSandboxTemplate] = useState<TemplateId>('cover');
  const [sandboxPalette, setSandboxPalette] = useState<string>('ink');
  const [sandboxFormat, setSandboxFormat] = useState<'card' | 'carousel'>('card');
  const [customText, setCustomText] = useState('How We Scaled Our Edge API to 50M Requests/Day');

  // Carousel deck
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [feedSimulation, setFeedSimulation] = useState(false);

  // FAQ
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  function handleSelectSandboxTemplate(t: typeof HERO_TEMPLATES[0]) {
    setSandboxTemplate(t.id);
    setCustomText(t.initialText);
  }

  const currentHeroConfig = HERO_TEMPLATES.find((t) => t.id === sandboxTemplate) || HERO_TEMPLATES[0];
  const baseFields = templateDefaults(sandboxTemplate);
  const sandboxSlide: ResolvedSlide = {
    template: sandboxTemplate,
    fields: { ...baseFields, [currentHeroConfig.quickKey]: customText || baseFields[currentHeroConfig.quickKey] },
    bgImage: null,
  };
  const sandboxColors = resolveColors(sandboxPalette, {});

  const deckSlides = CAROUSEL_DECK_SLIDES.map((item) => ({
    slide: { template: item.template, fields: item.fields, bgImage: null } as ResolvedSlide,
    colors: resolveColors(item.palette, {}),
  }));
  const currentDeck = deckSlides[activeSlideIndex];

  const cta = user ? { to: '/dashboard', label: 'Go to your dashboard' } : { to: '/signup', label: 'Start designing free' };

  return (
    <div className="page page--cta">
      <PublicHeader />

      <main className="wrap">
        {/* Hero + live sandbox */}
        <section className="hero" id="playground">
          <div className="rise">
            <span className="hero-pill glass"><span className="dot dot--ok" /><b>Free</b> · Runs in your browser · No watermark</span>
            <h1 className="display">Cards for <em>every day.</em><br /> Carousels worth a&nbsp;swipe.</h1>
            <p className="lede">Make a birthday wish, event invite, work update, or useful guide for Facebook and LinkedIn. Pick a template, write your message, and export a PNG card, PDF carousel, or PNG slide pack.</p>
            <div className="hero__cta">
              <Link to={cta.to} className="btn btn--primary btn--lg">{cta.label} <Icon name="arrow-right" /></Link>
              {!user && (
                <button type="button" className="btn btn--glass btn--lg" onClick={() => navigate('/login')}>
                  <Icon name="eye" /> Demo account
                </button>
              )}
            </div>
            <div className="hero__trust">
              <span><Icon name="check" /> Drafts stay on your device</span>
              <span><Icon name="check" /> 1080 × 1080 PNG export</span>
              <span><Icon name="check" /> No watermarks, ever</span>
              <span><Icon name="check" /> Profile footer added for you</span>
            </div>
          </div>

          <div className="studio glass-strong rise rise-2" aria-label="Live studio sandbox">
            <div className="studio__head">
              <span className="eyebrow"><span className="dot dot--ok" />Live studio</span>
              <div className="seg" role="group" aria-label="Format">
                <button type="button" aria-pressed={sandboxFormat === 'card'} onClick={() => setSandboxFormat('card')}><Icon name="square" />1:1 Card</button>
                <button type="button" aria-pressed={sandboxFormat === 'carousel'} onClick={() => setSandboxFormat('carousel')}><Icon name="layers" />4:5 Slide</button>
              </div>
            </div>
            <div className="studio__chips" role="group" aria-label="Template">
              {HERO_TEMPLATES.map((t) => (
                <button key={t.id} type="button" className="chip" aria-pressed={sandboxTemplate === t.id} onClick={() => handleSelectSandboxTemplate(t)}>{t.label}</button>
              ))}
            </div>
            <div className="studio__stage">
              <SlidePreview key={sandboxFormat} slide={sandboxSlide} colors={sandboxColors} format={sandboxFormat} />
            </div>
            <div className="studio__edit">
              <input type="text" className="input" value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Type your words live…" aria-label="Your words" />
              <div className="swatches" role="group" aria-label="Palette">
                {PALETTES.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="swatch"
                    aria-label={`Palette ${p.name}`}
                    aria-pressed={sandboxPalette === p.id}
                    onClick={() => setSandboxPalette(p.id)}
                    style={{ background: p.bg, ['--sw-accent' as string]: p.accent } as CSSProperties}
                  />
                ))}
              </div>
            </div>
            <div className="studio__foot">
              <span><Icon name="bolt" /> Rendered live in your browser</span>
              <Link to={cta.to}>Open in full studio <Icon name="arrow-right" /></Link>
            </div>
          </div>
        </section>

        <section className="stats glass rise rise-3" aria-label="At a glance">
          <div><b>{SHOWCASE_ITEMS.length}</b><span>templates for real messages</span></div>
          <div><b>{PALETTES.length}</b><span>tuned colour palettes</span></div>
          <div><b>15</b><span>slides per carousel</span></div>
          <div><b>0</b><span>watermarks, ever</span></div>
        </section>

        {/* Carousel deck */}
        <section className="sec" id="carousels">
          <div className="deck">
            <div>
              <span className="eyebrow eyebrow--accent">Carousel studio</span>
              <h2 className="h2">Decks readers actually <em>swipe through.</em></h2>
              <p className="lede">A carousel is five to fifteen slides that tell one story. Each slide has one job, so the deck keeps moving. {DECK_STEPS[activeSlideIndex].detail}</p>
              <ol className="steps">
                {DECK_STEPS.map((step, idx) => (
                  <li key={step.title}>
                    <button type="button" className="step" aria-pressed={activeSlideIndex === idx} onClick={() => setActiveSlideIndex(idx)}>
                      <b>{String(idx + 1).padStart(2, '0')}</b>
                      <span><strong>{step.title}</strong><small>{step.note}</small></span>
                      {activeSlideIndex === idx ? <Icon name="chevron-right" /> : <span />}
                    </button>
                  </li>
                ))}
              </ol>
              <div className="deck__cta">
                <Link to={cta.to} className="btn btn--primary btn--lg">Create a carousel <Icon name="arrow-right" /></Link>
                <button type="button" className="btn btn--glass btn--lg" aria-pressed={feedSimulation} onClick={() => setFeedSimulation(!feedSimulation)}>
                  <Icon name="linkedin" /> {feedSimulation ? 'Show the deck' : 'Preview in feed'}
                </button>
              </div>
            </div>

            <div className="deck__view glass-strong">
              {feedSimulation ? (
                <div className="feed">
                  <div className="feed__head">
                    <span className="avatar" style={{ background: '#0a66c2', color: '#fff', boxShadow: 'none' }}>MS</span>
                    <div><b>Md Sahabuddin Hossain</b>Software Engineer · 1h</div>
                  </div>
                  <p>Most engineering posts fail to travel because the insight is trapped in a block of text. Here is a 5-slide way to document architecture in swipeable carousels:</p>
                  <div className="feed__doc">
                    <SlidePreview slide={currentDeck.slide} colors={currentDeck.colors} format="carousel" />
                    <span className="feed__page">{activeSlideIndex + 1} / {deckSlides.length}</span>
                  </div>
                </div>
              ) : (
                <div className="deck__stage">
                  {deckSlides.map((item, idx) => {
                    const offset = idx - activeSlideIndex;
                    const distance = Math.abs(offset);
                    if (distance > 2) return null;
                    const transform = `translateX(${offset * 96}px) scale(${1 - distance * 0.11}) rotate(${offset * 3}deg)`;
                    return (
                      <div
                        key={idx}
                        className="deck__slide"
                        data-offset={offset}
                        style={{ transform, opacity: 1 - distance * 0.25, zIndex: 5 - distance }}
                        onClick={() => setActiveSlideIndex(idx)}
                      >
                        <SlidePreview slide={item.slide} colors={item.colors} format="carousel" />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="deck__nav">
                <button type="button" className="btn btn--glass btn--icon" aria-label="Previous slide" disabled={activeSlideIndex === 0} onClick={() => setActiveSlideIndex((i) => Math.max(0, i - 1))}><Icon name="chevron-left" /></button>
                <div className="pager" aria-label={`Slide ${activeSlideIndex + 1} of ${deckSlides.length}`}>
                  {deckSlides.map((_, idx) => <i key={idx} data-on={idx === activeSlideIndex} />)}
                </div>
                <button type="button" className="btn btn--glass btn--icon" aria-label="Next slide" disabled={activeSlideIndex === deckSlides.length - 1} onClick={() => setActiveSlideIndex((i) => Math.min(deckSlides.length - 1, i + 1))}><Icon name="chevron-right" /></button>
              </div>
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="sec">
          <div className="sec__head">
            <div>
              <span className="eyebrow">The problem</span>
              <h2 className="h2">Most LinkedIn graphics take 45 minutes and <em>still</em> look rushed.</h2>
            </div>
            <p className="lede">Fixed layouts that are already right beat a blank canvas you have to fix.</p>
          </div>
          <div className="why">
            <article className="surface is-bad">
              <span className="why__icon"><Icon name="phone" /></span>
              <h3>Phone-notes screenshots</h3>
              <ul>
                <li><Icon name="x" /> Compression makes text fuzzy on sharp screens</li>
                <li><Icon name="x" /> No author or company signature</li>
                <li><Icon name="x" /> Can't become a multi-page PDF document</li>
              </ul>
            </article>
            <article className="surface is-bad">
              <span className="why__icon"><Icon name="layout" /></span>
              <h3>Free-form canvas tools</h3>
              <ul>
                <li><Icon name="x" /> 30–45 minutes of dragging and aligning boxes</li>
                <li><Icon name="x" /> Templates sized for other platforms</li>
                <li><Icon name="x" /> Multi-page carousels take extra setup</li>
              </ul>
            </article>
            <article className="glass-strong is-good">
              <span className="why__icon"><Icon name="sparkle" /></span>
              <h3>The Cardstock standard</h3>
              <ul>
                <li><Icon name="check" /> Type sizes that fit automatically</li>
                <li><Icon name="check" /> PDF carousels made in your browser</li>
                <li><Icon name="check" /> Your name, role and photo on every slide</li>
              </ul>
            </article>
          </div>
        </section>

        {/* Templates */}
        <section className="sec" id="templates">
          <div className="sec__head">
            <div>
              <span className="eyebrow">{SHOWCASE_ITEMS.length} templates · cards + carousels</span>
              <h2 className="h2">A template for every <em>message.</em></h2>
            </div>
            <p className="lede">Each one is built for a single job: a wish, an invite, a launch, a lesson. Use it as a card or as a carousel slide.</p>
          </div>
          <TemplateGallery linkFor={(id, format) => `/dashboard?template=${encodeURIComponent(id)}&format=${format}`} />
        </section>

        {/* Privacy */}
        <section className="sec" id="privacy">
          <div className="privacy glass">
            <div>
              <span className="eyebrow eyebrow--accent">Private by design</span>
              <h2 className="h2">Your drafts never leave <em>this device.</em></h2>
              <p className="lede">Cardstock runs in your browser. The server only handles your login and the profile details that sign your cards.</p>
              <div className="points">
                <div><span className="why__icon"><Icon name="drive" /></span><div><b>Saved in your browser</b><p>Designs in local storage, background images in IndexedDB.</p></div></div>
                <div><span className="why__icon"><Icon name="download" /></span><div><b>One-click JSON backup</b><p>Export every card and deck as one file and restore it anywhere.</p></div></div>
                <div><span className="why__icon"><Icon name="cloud-off" /></span><div><b>No upload to export</b><p>PNG, PDF and ZIP files are made on your device and saved straight to it.</p></div></div>
              </div>
            </div>
            <div className="pipe surface">
              <span className="eyebrow">How an export happens</span>
              <ol>
                <li><span>1</span><div><b>You write in the studio</b><small>Template, text, palette, photo</small></div></li>
                <li><span>2</span><div><b>Your browser lays out the card</b><small>Type sizes and readable scrims, computed locally</small></div></li>
                <li><span>3</span><div><b>The file is saved to your device</b><small>PNG 1080², PDF for LinkedIn, or a ZIP of slides</small></div></li>
              </ol>
              <div className="pipe__ok"><Icon name="shield" /> Zero server hops for your designs</div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec">
          <div className="faq">
            <div>
              <span className="eyebrow">FAQ</span>
              <h2 className="h2">Questions, <em>answered.</em></h2>
              <p className="lede" style={{ marginTop: 16 }}>Something else? Open an issue on <a className="link" href="https://github.com/xahabcse/contentpro" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
            </div>
            <div className="faq__list">
              {FAQS.map((faq, idx) => (
                <div key={faq.q} className="faq__item surface">
                  <button type="button" className="faq__q" aria-expanded={openFaq === idx} onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                    <span>{faq.q}</span>
                    <Icon name="plus" />
                  </button>
                  {openFaq === idx && <p className="faq__a">{faq.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="band">
          <div>
            <span className="eyebrow">Stop fighting design tools</span>
            <h2 className="h2">Publish your next post in <em>three minutes.</em></h2>
            <p>Free to start · Instant export · No credit card</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <Link to={cta.to} className="btn btn--amber btn--lg">{cta.label} <Icon name="arrow-right" /></Link>
            </div>
          </div>
          <div className="band__fan" aria-hidden="true">
            <SlidePreview template="birthday" palette="paper" lazy />
            <SlidePreview template="stat" palette="cobalt" lazy />
            <SlidePreview template="quote" palette="forest" lazy />
          </div>
        </section>

        <PublicFooter />
      </main>

      <PhoneCta />
    </div>
  );
}
