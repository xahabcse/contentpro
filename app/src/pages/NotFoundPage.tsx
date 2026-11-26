import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '@/components/layout/PublicChrome';
import SlidePreview from '@/components/editor/SlidePreview';
import Icon from '@/components/ui/Icon';

// The 404 for any address the app doesn't know (App.tsx's catch-all route):
// it says plainly that nothing is here instead of quietly redirecting.
export default function NotFoundPage() {
  return (
    <div className="page">
      <PublicHeader />
      <main className="wrap">
        <section className="lost">
          <div className="rise">
            <span className="eyebrow eyebrow--accent">Error 404</span>
            <h1 className="display">Page not <em>found.</em></h1>
            <p className="lede">There is nothing at this address. The link may be old, or the page may have moved.</p>
            <div className="lost__acts">
              <Link to="/" className="btn btn--primary btn--lg"><Icon name="home" /> Go to Cardstock</Link>
              <Link to="/dashboard" className="btn btn--glass btn--lg">Open dashboard</Link>
            </div>
            <nav className="lost__links" aria-label="Popular pages">
              <Link className="surface" to="/#templates"><Icon name="grid" /> Browse 100 templates <Icon name="chevron-right" /></Link>
              <Link className="surface" to="/about"><Icon name="info" /> About Cardstock <Icon name="chevron-right" /></Link>
            </nav>
          </div>
          <div className="lost__art" aria-hidden="true">
            <SlidePreview template="question" palette="sand" />
            <div className="lost__blank">404</div>
          </div>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
