/**
 * Phase 3 smoke tests: every schema and instrument renders (server-side) without throwing,
 * with an accessible title and finite coordinates, in statement and solution modes.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchemaGallery } from '../src/ui/SchemaGallery';
import { MicrometerScale, VernierScale } from '../src/ui/Instrument';
import { TaperRollersSchema } from '../src/ui/schema/schemasA';
import { parse, q } from '../src/core/rational';
import { STANDARD_MICROMETER, VERNIER_MICROMETER } from '../src/core/reading';

const TXT = { zoomOut: '-', zoomIn: '+', zoom: 'z', mainScale: 'm', vernier: 'v', sleeve: 's', thimble: 't' };
const finite = (html: string) => !/NaN|Infinity/.test(html);

describe('schemas render', () => {
  it('gallery (first demo) in both languages', () => {
    for (const lang of ['eu', 'es'] as const) {
      const html = renderToStaticMarkup(createElement(SchemaGallery, { lang }));
      expect(html).toContain('<svg');
      expect(finite(html)).toBe(true);
    }
  });

  it('cone over rollers: single view (Euskadi 2020) and side-by-side view (MG3)', () => {
    const mk = (d: { rollerD: number; h1: number; h2: number; M1: number; M2: number }) =>
      renderToStaticMarkup(
        createElement(TaperRollersSchema, { ...d, title: 'cone', txt: { noScale: 'ns' }, labels: { M1: 'M1', M2: 'M2', h1: 'h1', h2: 'h2', d: 'd', half: 'a/2' } }),
      );
    const eus = mk({ rollerD: 10, h1: 10, h2: 100, M1: 73, M2: 100 });
    const mg3 = mk({ rollerD: 10, h1: 0, h2: 60, M1: 40, M2: 46 });
    expect(eus).not.toContain('①');
    expect(mg3).toContain('①');
    expect(mg3).toContain('ns'); // 2.86° is drawn larger: "not to scale" note
    expect(finite(eus) && finite(mg3)).toBe(true);
  });

  it('instruments: vernier 0.02 / 0.05 and micrometers', () => {
    const html = [
      renderToStaticMarkup(createElement(VernierScale, { spec: { s: q(1), n: 50, modulus: 1 }, value: parse('23.34'), showCoincidence: true, title: 'v', txt: TXT })),
      renderToStaticMarkup(createElement(VernierScale, { spec: { s: q(1), n: 20, modulus: 2 }, value: parse('41.65'), title: 'v', txt: TXT })),
      renderToStaticMarkup(createElement(MicrometerScale, { spec: STANDARD_MICROMETER, value: parse('12.87'), showCoincidence: true, title: 'm', txt: TXT })),
      renderToStaticMarkup(createElement(MicrometerScale, { spec: VERNIER_MICROMETER, value: parse('12.873'), title: 'm', txt: TXT })),
    ];
    for (const h of html) expect(finite(h)).toBe(true);
    expect(html[0]).toContain('class="in-tick hit"'); // the coincident line is highlighted
  });
});
