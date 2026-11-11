import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SlideCanvas from '@/components/editor/SlideCanvas';
import { PALETTES } from './palettes';
import { CATALOG_DEFINITIONS, TEMPLATE_ORDER, TEMPLATES, templateDefaults } from './templates';
import type { TemplateId } from './design-types';

const SOCIAL_TEMPLATE_MARKERS: Record<string, string> = {
  birthday: 'A day to celebrate',
  congrats: 'A well-earned milestone',
  thankyou: 'To our community',
  holiday: 'Seasonal greeting',
  event: 'You are invited',
  offer: 'Limited-time offer',
  hiring: 'We are hiring',
  product: 'Meet the new release',
  faq: 'Quick answer',
  howto: 'How to share an idea people remember',
  awareness: 'A cause worth sharing',
  flexible: 'A message from us',
};

describe('template catalog', () => {
  it('has one ordered entry and editable defaults for every listed template', () => {
    expect(TEMPLATE_ORDER).toHaveLength(100);
    expect(CATALOG_DEFINITIONS).toHaveLength(62);
    expect(new Set(TEMPLATE_ORDER).size).toBe(TEMPLATE_ORDER.length);
    expect(new Set(TEMPLATE_ORDER)).toEqual(new Set(Object.keys(TEMPLATES)));
    for (const id of TEMPLATE_ORDER) {
      const defaults = templateDefaults(id);
      const editableFields = new Set(TEMPLATES[id].fields.map((field) => field.k));
      expect(Object.keys(defaults).length).toBeGreaterThan(0);
      for (const key of Object.keys(defaults)) expect(editableFields.has(key)).toBe(true);
    }
  });

  for (const definition of CATALOG_DEFINITIONS) {
    for (const [format, height] of [['card', 1080], ['carousel', 1350]] as const) {
      it(`renders the new ${definition.id} template as a ${format}`, () => {
        const html = renderToStaticMarkup(
          <SlideCanvas
            slide={{ template: definition.id as TemplateId, fields: templateDefaults(definition.id as TemplateId), bgImage: null }}
            colors={PALETTES[0]}
            footer={{ name: 'Example Author', handle: 'example' }}
            width={1080}
            height={height}
          />,
        );
        expect(html).toContain(`height:${height}px`);
        expect(html).toContain('Example Author');
        expect(html).not.toContain('future-proof your career');
        expect(html).not.toContain('CARDSTOCK');
      });
    }
  }

  it('uses editable numeric data for progress and charts', () => {
    const draw = (id: TemplateId) => renderToStaticMarkup(<SlideCanvas
      slide={{ template: id, fields: templateDefaults(id) }}
      colors={PALETTES[0]} footer={{ name: 'Author', handle: 'author' }} width={1080} height={1080}
    />);
    expect(draw('progress_tracker')).toContain('width:65%');
    expect(draw('line_chart')).toContain('polyline');
    expect(draw('bar_chart')).toContain('<rect');
    expect(draw('pie_chart')).toContain('aria-label="Pie Chart:');
    expect(draw('budgetbreakdown')).toContain('aria-label="Budget Breakdown:');
  });

  it('shows every new template\'s editable text in the exported canvas', () => {
    const missing: string[] = [];
    for (const definition of CATALOG_DEFINITIONS) {
      const html = renderToStaticMarkup(<SlideCanvas
        slide={{ template: definition.id as TemplateId, fields: templateDefaults(definition.id as TemplateId) }}
        colors={PALETTES[0]} footer={{ name: 'Author', handle: 'author' }} width={1080} height={1080}
      />);
      const visibleText = html.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      for (const field of definition.fields) {
        const value = (definition.defaults as Record<string, string | readonly string[]>)[field.k];
        if (typeof value === 'string' && value) {
          if (!visibleText.includes(value)) missing.push(`${definition.id}.${field.k}`);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            for (const part of item.split(/\s+[—–]\s+/)) {
              if (part && !visibleText.includes(part)) missing.push(`${definition.id}.${field.k}: ${part}`);
            }
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  for (const [id, marker] of Object.entries(SOCIAL_TEMPLATE_MARKERS)) {
    for (const [format, height] of [['card', 1080], ['carousel', 1350]] as const) {
      it(`renders the ${id} design as a ${format}`, () => {
        const html = renderToStaticMarkup(
          <SlideCanvas
            slide={{ template: id as TemplateId, fields: templateDefaults(id as TemplateId), bgImage: null }}
            colors={PALETTES[0]}
            footer={{ name: 'Example Author', handle: 'example' }}
            width={1080}
            height={height}
          />,
        );
        expect(html).toContain(marker);
        expect(html).toContain(`height:${height}px`);
      });
    }
  }
});
