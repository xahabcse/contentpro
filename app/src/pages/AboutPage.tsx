import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { PhoneCta, PublicFooter, PublicHeader } from '@/components/layout/PublicChrome';
import SlidePreview from '@/components/editor/SlidePreview';
import Icon from '@/components/ui/Icon';

const REPO_URL = 'https://github.com/xahabcse/contentpro';

const PILLARS: { title: string; subtitle: string; body: string }[] = [
  {
    title: 'Constraint Over Chaos',
    subtitle: 'Structured layouts that keep the focus on your message',
    body: 'When design tools give you an infinite blank canvas, you spend time aligning boxes and fixing line wraps. Cardstock replaces free-form dragging with curated templates and automatic font sizing. Preview longer copy before exporting to make sure every line fits.',
  },
  {
    title: 'Pixel-for-Pixel WYSIWYG',
    subtitle: 'What you see in the studio is what downloads',
    body: 'Cardstock compiles PNG cards (1080×1080), multi-page PDF carousels, and ordered PNG slide ZIPs (1080×1350 per slide) in your browser. Preview the design before exporting it for LinkedIn, Facebook, or another platform.',
  },
  {
    title: 'Radical Local-First Privacy',
    subtitle: 'Zero designs or drafts sent to our servers',
    body: 'Your draft thoughts, client case studies, and unpublished ideas belong to you. Cardstock keeps design JSON in account-scoped localStorage and design images in IndexedDB on your device. The edge server stores account data and profile details, including any profile images you upload.',
  },
  {
    title: 'Open Source & Freedom',
    subtitle: 'MIT Licensed · Fully inspectable and self-hostable',
    body: 'No hidden paywalls for basic features or watermarks. The entire codebase is open source. You can run the stack locally with Docker or deploy your own instance to Cloudflare. Login and signup require internet access for Cloudflare Turnstile verification.',
  },
];

const TECH_STACK: { name: string; role: string; desc: string; badge: string }[] = [
  {
    name: 'React 19 + TypeScript',
    role: 'Frontend UI & Studio Engine',
    desc: 'Typed editor with live previews across 100 templates for cards and carousels.',
    badge: 'Frontend',
  },
  {
    name: 'html2canvas, jsPDF & JSZip',
    role: 'Client-Side Export Pipeline',
    desc: 'Creates PNG cards, LinkedIn document PDFs, and ordered PNG slide ZIPs in the browser.',
    badge: 'Engine',
  },
  {
    name: 'Cloudflare Workers & Hono 4',
    role: 'Edge API Layer',
    desc: 'Edge runtime for accounts, profiles, and authentication.',
    badge: 'Backend',
  },
  {
    name: 'D1, R2 & Durable Objects',
    role: 'Data, Images & Rate Limiting',
    desc: 'D1 stores accounts, R2 stores profile images, and Durable Objects enforce atomic login limits.',
    badge: 'Database',
  },
  {
    name: 'Web Crypto (PBKDF2)',
    role: 'Stateless Auth & Security',
    desc: '100,000 PBKDF2-HMAC-SHA256 iterations, httpOnly Strict JWT cookies, and sessionVersion revocation.',
    badge: 'Security',
  },
  {
    name: 'Cloudflare Pages',
    role: 'Static Global Edge CDN',
    desc: 'Fast, secure static asset distribution with hardened CSP and HSTS security headers.',
    badge: 'Infra',
  },
];

export default function AboutPage() {
  const { user } = useAuth();
  const cta = user ? { to: '/dashboard', label: 'Open your dashboard' } : { to: '/signup', label: 'Start designing free' };

  return (
    <div className="page page--cta">
      <PublicHeader current="about" />

      <main className="wrap">
        <section className="about-hero rise">
          <span className="eyebrow eyebrow--accent">✦ The Cardstock manifesto · est. 2026</span>
          <h1 className="display">The antidote to <em>45-minute</em> design sessions.</h1>
          <p className="lede">Cardstock was born from a simple realisation: people who write good LinkedIn posts don&apos;t need another complex design tool. They need typographic guardrails that make a good idea look ready to publish in under three minutes.</p>
          <div className="hero__cta">
            <Link to={cta.to} className="btn btn--primary btn--lg">{cta.label} <Icon name="arrow-right" /></Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn--glass btn--lg"><Icon name="github" /> View on GitHub</a>
          </div>
        </section>

        <div className="about-grid">
          <article className="prose-card glass rise rise-2">
            <span className="eyebrow">The core problem</span>
            <h2 className="h2" style={{ fontSize: 'var(--fs-3xl)' }}>The tyranny of the <em>blank canvas.</em></h2>
            <p>Writing technical or career insights is already demanding. Turning them into a card or carousel often means opening heavy tools, aligning text boxes by hand, guessing line heights and fixing fonts on mobile. Most people give up, or post plain text that gets scrolled past.</p>
            <h3 style={{ fontSize: 'var(--fs-xl)' }}>Design built into code</h3>
            <p>Cardstock replaces manual placement with code. Templates size the type to your character count, lay a contrast scrim behind photos, and sign off with your profile, without you moving a single pixel by hand.</p>
          </article>
          <aside className="prose-card surface rise rise-3" style={{ padding: 28 }}>
            <div className="about-fan" aria-hidden="true">
              <SlidePreview template="quote" palette="paper" style={{ position: 'absolute', left: 0, top: 28, transform: 'rotate(-6deg)', width: '58%' }} />
              <SlidePreview template="takeaway" palette="ink" style={{ position: 'absolute', right: 0, top: 0, transform: 'rotate(5deg)', width: '58%', zIndex: 2 }} />
            </div>
          </aside>
        </div>

        <section className="sec" style={{ paddingTop: 80 }}>
          <span className="eyebrow">Our philosophy</span>
          <h2 className="h2" style={{ fontSize: 'var(--fs-4xl)', marginTop: 14 }}>Four principles behind every line of code.</h2>
          <div className="pillars">
            {PILLARS.map((p, i) => (
              <article key={p.title} className="surface">
                <b>{i + 1}</b>
                <h3>{p.title}</h3>
                <small>{p.subtitle}</small>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 80 }}>
          <div className="sec__head">
            <div>
              <span className="eyebrow">Honest about the stack</span>
              <h2 className="h2">Small, fast and <em>open source.</em></h2>
            </div>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn--glass"><Icon name="github" /> Star on GitHub</a>
          </div>
          <div className="stack-grid">
            {TECH_STACK.map((item) => (
              <article key={item.name} className="surface">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <h3>{item.name}</h3>
                  <span className="badge badge--accent">{item.badge}</span>
                </div>
                <small className="hint">{item.role}</small>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 80 }}>
          <div className="about-grid" style={{ marginTop: 0 }}>
            <article className="prose-card glass">
              <span className="eyebrow">Contributions &amp; local setup</span>
              <h2 className="h2" style={{ fontSize: 'var(--fs-3xl)' }}>Run it yourself.</h2>
              <p>Contribute a template, report an issue, or run a local instance with Docker from the open source repository.</p>
              <pre className="terminal">
                <small># clone and run everything locally</small>{'\n'}
                <span>$</span> git clone https://github.com/xahabcse/contentpro.git{'\n'}
                <span>$</span> cd contentpro &amp;&amp; docker compose up
              </pre>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn--glass"><Icon name="github" /> Repository</a>
                <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer" className="btn btn--glass"><Icon name="external" /> Contributing guide</a>
              </div>
            </article>
            <aside className="prose-card surface">
              <span className="eyebrow">Creator</span>
              <div className="creator">
                <span className="avatar avatar--lg">MS</span>
                <div><b>Md Sahabuddin Hossain</b><span>Creator &amp; Software Engineer · @xahabcse</span></div>
              </div>
              <p style={{ fontSize: 'var(--fs-md)' }}>Designs, builds and maintains Cardstock, part of the xahabcse.me family of projects.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href="https://github.com/xahabcse" target="_blank" rel="noopener noreferrer" className="btn btn--glass"><Icon name="github" /> @xahabcse</a>
                <a href="https://www.xahabcse.me/" target="_blank" rel="noopener noreferrer" className="btn btn--glass"><Icon name="external" /> xahabcse.me</a>
              </div>
            </aside>
          </div>
        </section>

        <section className="band">
          <div>
            <span className="eyebrow">No design skills · No watermark · No learning curve</span>
            <h2 className="h2">Design your first post in <em>three minutes.</em></h2>
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <Link to={cta.to} className="btn btn--amber btn--lg">{cta.label} <Icon name="arrow-right" /></Link>
            </div>
          </div>
          <div className="band__fan" aria-hidden="true">
            <SlidePreview template="hiring" palette="charcoal" lazy />
            <SlidePreview template="congrats" palette="wine" lazy />
            <SlidePreview template="event" palette="navy" lazy />
          </div>
        </section>

        <PublicFooter />
      </main>

      <PhoneCta />
    </div>
  );
}
