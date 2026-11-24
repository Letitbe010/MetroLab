import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dovetailA, dovetailB, dovetailWidthA, overSplineRollersA, overSplineRollersB } from '../src/core/profiles';
import { rollerTaperA, rollerTaperB } from '../src/core/taper';

const real = (min: number, max: number) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

describe('spline gap over rollers', () => {
  it('Madrid 2025-4: Ø3 rollers, 70°, apex at 10.88 mm → M = 29.990 mm', () => {
    const s = { rollerD: 3, vAngleDeg: 70, apexRadius: 10.88 };
    expect(overSplineRollersA(s).toFixed(3)).toBe('29.990');
    expect(Math.abs(overSplineRollersA(s) - overSplineRollersB(s))).toBeLessThan(1e-9);
  });

  it('property: A = B (10 000 cases)', () => {
    fc.assert(
      fc.property(real(1, 8), real(30, 120), real(5, 60), (d, th, ra) => {
        const s = { rollerD: d, vAngleDeg: th, apexRadius: ra };
        return Math.abs(overSplineRollersA(s) - overSplineRollersB(s)) < 1e-9;
      }),
      { numRuns: 10_000 },
    );
  });
});

describe('dovetail', () => {
  it('classic 60° male dovetail: b = 50, Ø10 → X = 50 + 10·(1 + cot 30°) = 77.321', () => {
    expect(dovetailA({ kind: 'male', rollerD: 10, alphaDeg: 60, width: 50 }).toFixed(3)).toBe('77.321');
    expect(dovetailA({ kind: 'female', rollerD: 10, alphaDeg: 60, width: 80 }).toFixed(3)).toBe('52.679');
  });

  it('property: A = B and the inverse returns the width (10 000 cases)', () => {
    fc.assert(
      fc.property(fc.constantFrom('male' as const, 'female' as const), real(3, 12), real(40, 75), real(40, 150), (kind, d, a, w) => {
        const t = { kind, rollerD: d, alphaDeg: a, width: w };
        const X = dovetailA(t);
        return Math.abs(X - dovetailB(t)) < 1e-9 && Math.abs(dovetailWidthA(kind, d, a, X) - w) < 1e-9;
      }),
      { numRuns: 10_000 },
    );
  });
});

describe('Euskadi 2022-B (my reading of the figure): trapezoid over Ø10 rollers', () => {
  it('rollers on the plate: 74.3; on 20 mm blocks: 88.9 → flank 20.05° from the vertical, angle a = 110.05°', () => {
    const d = { rollerD: 10, h1: 0, h2: 20, M1: 74.3, M2: 88.9 };
    const a = rollerTaperA(d);
    const b = rollerTaperB(d);
    expect(Math.abs(a.halfAngleDeg - b.halfAngleDeg)).toBeLessThan(1e-9);
    expect(a.halfAngleDeg.toFixed(4)).toBe('20.0521');
    expect((90 + a.halfAngleDeg).toFixed(2)).toBe('110.05');
  });
});
