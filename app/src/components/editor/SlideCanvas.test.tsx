import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SlideCanvas from './SlideCanvas';
import { PALETTES } from '@/lib/palettes';

describe('SlideCanvas list fields', () => {
  it('skips blank lines instead of drawing empty numbered rows', () => {
    // The editor splits a list box on "\n", so a trailing Enter leaves '' items.
    const html = renderToStaticMarkup(
      <SlideCanvas
        slide={{ template: 'agenda', fields: { title: 'Plan', items: ['Kick-off', '', '   ', 'Wrap-up', ''] }, bgImage: null }}
        colors={PALETTES[0]}
        footer={{ name: 'Author', handle: 'author' }}
        width={1080}
        height={1080}
      />,
    );

    expect(html).toContain('Kick-off');
    expect(html).toContain('Wrap-up');
    expect(html).toMatch(/>02</);
    expect(html).not.toMatch(/>03</);
  });
});
