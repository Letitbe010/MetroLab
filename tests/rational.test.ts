import { describe, expect, it } from 'vitest';
import { add, div, eq, mul, parse, q, round, sub, toFixed } from '../src/core/rational';

describe('rational (smoke test for phase 0)', () => {
  it('parses decimals with comma or point exactly', () => {
    expect(eq(parse('25,882'), q(12941, 500))).toBe(true);
    expect(eq(parse('0.866025'), q(173205, 200000))).toBe(true);
  });
  it('keeps exact sums of gauge blocks (MG1 stack)', () => {
    const s = [parse('1.002'), parse('1.38'), parse('3.5'), parse('20')].reduce(add);
    expect(toFixed(s, 3)).toBe('25.882');
  });
  it('arithmetic and rounding', () => {
    expect(toFixed(div(sub(q(46), q(40)), q(60)), 4)).toBe('0.1000');
    expect(eq(round(mul(q(2), parse('0.0115')), 3), parse('0.023'))).toBe(true);
  });
});
