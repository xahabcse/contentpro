import { useState } from 'react';
import { Link } from 'react-router-dom';
import SlidePreview from '@/components/editor/SlidePreview';
import Icon from '@/components/ui/Icon';
import { resolveColors } from '@/lib/palettes';
import { SHOWCASE_GROUPS, SHOWCASE_ITEMS } from '@/lib/showcase';
import type { FooterData, TemplateId } from '@/lib/design-types';

const PAGE_SIZE = 12;

interface TemplateGalleryProps {
  // Where a template tile goes, for the chosen preview format.
  linkFor: (id: TemplateId, format: 'card' | 'carousel') => string;
  // Words for the tile's call to action ("Use", "Open").
  action?: string;
  // Signature on every preview. Left out on public pages, which show the demo one.
  footer?: FooterData;
}

// The 100-template gallery: category chips, card/slide preview switch, search,
// and 12 tiles at a time with "show more". Used on the landing page and in the app.
export default function TemplateGallery({ linkFor, action = 'Use', footer }: TemplateGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState<'card' | 'carousel'>('card');
  const [shown, setShown] = useState(PAGE_SIZE);
  const matching = SHOWCASE_ITEMS.filter((item) => (selectedCategory === 'All' || item.category === selectedCategory)
    && `${item.name} ${item.desc} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase()));
  const visible = matching.slice(0, shown);

  return (
    <>
      <div className="filters">
        <div className="filters__chips" role="group" aria-label="Template category">
          {['All', ...SHOWCASE_GROUPS.map((group) => group.category)].map((cat) => (
            <button key={cat} type="button" className="chip" aria-pressed={selectedCategory === cat} onClick={() => { setSelectedCategory(cat); setShown(PAGE_SIZE); }}>
              {cat}{cat === 'All' ? <span className="chip__n">{SHOWCASE_ITEMS.length}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="filters">
        <div className="seg" role="group" aria-label="Template preview format">
          <button type="button" aria-pressed={format === 'card'} onClick={() => setFormat('card')}><Icon name="square" />Card</button>
          <button type="button" aria-pressed={format === 'carousel'} onClick={() => setFormat('carousel')}><Icon name="layers" />Carousel slide</button>
        </div>
        <div className="input-wrap">
          <Icon name="search" />
          <input type="search" className="input" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE_SIZE); }} placeholder={`Search ${SHOWCASE_ITEMS.length} templates…`} aria-label="Find a template" />
        </div>
      </div>

      <div className="tpl-grid">
        {visible.map((item) => {
          const colors = resolveColors(item.palette, {});
          return (
            <Link key={item.id} className="tpl surface" to={linkFor(item.id, format)}>
              <SlidePreview key={format} template={item.id} palette={item.palette} format={format} footer={footer} lazy />
              <div className="tpl__body">
                <div className="tpl__row">
                  <h3 className="tpl__name">{item.name}</h3>
                  <span className="tpl__pal" title={item.palette} style={{ background: `linear-gradient(135deg, ${colors.bg} 55%, ${colors.accent} 55%)` }} />
                </div>
                <p className="tpl__desc">{item.desc}</p>
                <div className="tpl__foot">
                  <span className="badge">{item.category}</span>
                  <span className="tpl__use">{action} <Icon name="arrow-right" /></span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {matching.length === 0 && <p className="empty-note" role="status">No templates match your search. Try another topic or choose All.</p>}
      {matching.length > 0 && (
        <div className="more">
          <span>Showing {visible.length} of {matching.length}</span>
          {visible.length < matching.length && (
            <button type="button" className="btn btn--glass" onClick={() => setShown((n) => n + 24)}>
              Show {Math.min(24, matching.length - visible.length)} more <Icon name="chevron-down" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
