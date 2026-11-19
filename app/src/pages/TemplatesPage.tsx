import AppShell from '@/components/layout/AppShell';
import TemplateGallery from '@/components/TemplateGallery';
import SkySwitch from '@/components/ui/SkySwitch';
import { SHOWCASE_ITEMS } from '@/lib/showcase';

// The template gallery inside the app. A tile opens a new design that starts
// with that template (the dashboard creates it from ?template=&create=).
export default function TemplatesPage() {
  return (
    <AppShell title="Templates">
      <header className="page-head rise">
        <div>
          <span className="eyebrow">{SHOWCASE_ITEMS.length} templates · cards + carousels</span>
          <h1 className="display">Start from a <em>template.</em></h1>
          <p className="lede">Pick Card or Carousel slide, then tap a template. It opens in the editor as your first slide.</p>
        </div>
        <div className="page-head__tools"><SkySwitch /></div>
      </header>
      <TemplateGallery action="Start" linkFor={(id, format) => `/dashboard?template=${encodeURIComponent(id)}&create=${format}`} />
    </AppShell>
  );
}
