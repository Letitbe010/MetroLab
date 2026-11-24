import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { add, eq, mul, parse, q } from '../src/core/rational';
import {
  STANDARD_MICROMETER,
  VERNIER_MICROMETER,
  micrometerResolution,
  readMicrometer,
  readVernier,
  readVernierGeometric,
  simulateMicrometer,
  simulateVernier,
  vernierAppreciation,
  type VernierSpec,
} from '../src/core/reading';

const VERNIERS: VernierSpec[] = [
  { s: q(1), n: 10, modulus: 1 },
  { s: q(1), n: 20, modulus: 1 },
  { s: q(1), n: 20, modulus: 2 },
  { s: q(1), n: 50, modulus: 1 },
  { s: q(1), n: 50, modulus: 2 },
];

describe('vernier caliper', () => {
  it('appreciations 0.1, 0.05, 0.02 (independent of the modulus)', () => {
    expect(VERNIERS.map((v) => vernierAppreciation(v)).map((r) => `${r.n}/${r.d}`)).toEqual([
      '1/10',
      '1/20',
      '1/20',
      '1/50',
      '1/50',
    ]);
  });

  it('property: simulate a value, read it with A and B → the original value (10 000 cases)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VERNIERS), fc.integer({ min: 0, max: 150 * 50 }), (v, k) => {
        const x = mul(q(k), vernierAppreciation(v));
        const view = simulateVernier(v, x);
        return eq(readVernier(v, view.main, view.line), x) && eq(readVernierGeometric(v, view), x);
      }),
      { numRuns: 10_000 },
    );
  });

  it('rejects values that are not a multiple of the appreciation', () => {
    expect(() => simulateVernier(VERNIERS[3]!, parse('12.345'))).toThrow();
  });
});

describe('micrometer', () => {
  it('resolutions 0.01 and 0.001', () => {
    expect(eq(micrometerResolution(STANDARD_MICROMETER), parse('0.01'))).toBe(true);
    expect(eq(micrometerResolution(VERNIER_MICROMETER), parse('0.001'))).toBe(true);
  });

  it('0.5 mm mark: 7.5 + 0.23 = 7.73, and 7.23 shows no half mark', () => {
    const a = simulateMicrometer(STANDARD_MICROMETER, parse('7.73'));
    expect(a).toMatchObject({ halfMark: true, thimble: 23 });
    const b = simulateMicrometer(STANDARD_MICROMETER, parse('7.23'));
    expect(b).toMatchObject({ halfMark: false, thimble: 23 });
  });

  it('vernier micrometer: 12.873 = 12.5 + 37 · 0.01 + 3 · 0.001', () => {
    expect(eq(readMicrometer(VERNIER_MICROMETER, parse('12.5'), 37, 3), parse('12.873'))).toBe(true);
    expect(simulateMicrometer(VERNIER_MICROMETER, parse('12.873'))).toMatchObject({ thimble: 37, vernier: 3, halfMark: true });
  });

  it('property: simulate → read = original value, with and without vernier (10 000 cases)', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.integer({ min: 0, max: 25_000 }), (withV, k) => {
        const m = withV ? VERNIER_MICROMETER : STANDARD_MICROMETER;
        const x = mul(q(withV ? k * 10 + (k % 10) : k), micrometerResolution(m));
        const view = simulateMicrometer(m, x);
        return eq(readMicrometer(m, view.sleeve, view.thimble, view.vernier), x);
      }),
      { numRuns: 10_000 },
    );
  });

  it('readings stay below the next sleeve mark', () => {
    const x = add(parse('3.5'), parse('0.49'));
    expect(simulateMicrometer(STANDARD_MICROMETER, x)).toMatchObject({ thimble: 49, halfMark: true });
  });
});
