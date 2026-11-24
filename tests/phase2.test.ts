import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatDMS, fromDMS, toDMS } from '../src/core/angles';
import { gaugeSizesA, gaugeSizesB, limitsFromDesignation, parseDesignation } from '../src/core/fixedGauges';
import { abs, parse, q, sub, toFixed, toNumber } from '../src/core/rational';
import { sineAngleA, sineAngleB, sineHeightA, sineHeightB } from '../src/core/sineBar';
import {
  TAPERS,
  anglesFromC,
  ballTaperA,
  ballTaperB,
  overRollersA,
  overRollersB,
  rollerTaperA,
  rollerTaperB,
  rollerTaperCExact,
} from '../src/core/taper';
import {
  METRIC_THREADS,
  bestWireA,
  bestWireB,
  contactY,
  overWiresA,
  overWiresB,
  pitchDiameterA,
  pitchDiameterB,
} from '../src/core/threads';
import { deltaLA, deltaLB, lengthAt20A, lengthAt20B } from '../src/core/temperature';

const LEN = 1e-9; // |A − B| for lengths, mm (spec §5.2)
const ANG = 1e-9; // degrees
const RUNS = { numRuns: 10_000 };
const real = (min: number, max: number) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

describe('angles', () => {
  it('DMS conversion with carry', () => {
    expect(formatDMS(toDMS(2.8624052261))).toBe('2° 51′ 45″');
    expect(toDMS(7.5)).toEqual({ sign: 1, d: 7, m: 30, s: 0 });
    expect(toDMS(29.99999999)).toEqual({ sign: 1, d: 30, m: 0, s: 0 });
    expect(fromDMS(7, 30)).toBe(7.5);
  });
});

describe('sine bar', () => {
  it('property: A = B for h and α (10 000 cases)', () => {
    fc.assert(
      fc.property(fc.constantFrom(100, 200, 250), real(0.1, 45), (L, a) => {
        const h = sineHeightA(L, a);
        return Math.abs(h - sineHeightB(L, a)) < LEN && Math.abs(sineAngleA(L, h) - a) < ANG && Math.abs(sineAngleB(L, h) - a) < ANG;
      }),
      RUNS,
    );
  });
});

describe('tapers', () => {
  it('taper table: Morse ratios and 7:24', () => {
    const get = (id: string) => TAPERS.find((t) => t.id === id)!;
    expect(1 / toNumber(get('MT3').C)).toBeCloseTo(19.922, 9);
    expect(toNumber(get('7:24').C)).toBeCloseTo(7 / 24, 12);
    // 7:24 → α = 2·atan(7/48) = 16° 35′ 39.4″ (ISO 297 steep taper)
    const a = anglesFromC(7 / 24);
    expect(formatDMS(toDMS(a.angleDeg, 1))).toBe('16° 35′ 39.4″');
  });

  it('Euskadi 2020-2 (my reading of the figure): X = 73 over Ø10 on 10 mm blocks, X′ = 100 on 100 mm blocks → C = 30 %', () => {
    expect(toFixed(rollerTaperCExact(parse('73'), parse('100'), parse('10'), parse('100')), 4)).toBe('0.3000');
    const d = { rollerD: 10, h1: 10, h2: 100, M1: 73, M2: 100 };
    expect(Math.abs(rollerTaperA(d).halfAngleDeg - rollerTaperB(d).halfAngleDeg)).toBeLessThan(ANG);
    expect(rollerTaperA(d).halfAngleDeg.toFixed(4)).toBe('8.5308');
  });

  it('property: external cone over rollers, forward A = B and inverse A = B (10 000 cases)', () => {
    fc.assert(
      fc.property(
        real(10, 80),
        real(-0.5, 0.5).filter((c) => Math.abs(c) > 1e-3),
        fc.constantFrom(5, 6, 8, 10, 12),
        real(0, 40),
        real(10, 80),
        (D0, C, dr, h1, dh) => {
          const h2 = h1 + dh;
          const M1 = overRollersA(D0, C, dr, h1);
          const M2 = overRollersA(D0, C, dr, h2);
          if (Math.abs(M1 - overRollersB(D0, C, dr, h1)) > LEN || Math.abs(M2 - overRollersB(D0, C, dr, h2)) > LEN) return false;
          const data = { rollerD: dr, h1, h2, M1, M2 };
          const a = rollerTaperA(data);
          const b = rollerTaperB(data);
          return (
            Math.abs(a.C - Math.abs(C)) < 1e-9 &&
            Math.abs(a.halfAngleDeg - b.halfAngleDeg) < ANG &&
            Math.abs(a.diameterAt(0) - D0) < LEN &&
            Math.abs(b.diameterAt(0) - D0) < LEN &&
            a.widensUp === b.widensUp &&
            Math.abs(Math.tan((a.angleDeg * Math.PI) / 360) * 2 - a.C) < 1e-12
          );
        },
      ),
      RUNS,
    );
  });

  it('property: internal cone with balls, A = B (10 000 cases)', () => {
    fc.assert(
      fc.property(real(0.5, 20), real(10, 60), real(5, 15), real(2, 20), real(-5, 20), (halfDeg, Dtop, d1, dd, depth2) => {
        // build a consistent hole and drop two balls into it
        const t = Math.tan((halfDeg * Math.PI) / 180);
        const c = Math.cos((halfDeg * Math.PI) / 180);
        const d2 = d1 + dd;
        const zc = (r: number) => (Dtop / 2 - r / c) / t; // centre depth where the ball touches
        const z2 = zc(d2 / 2);
        const z1 = zc(d1 / 2);
        const b = { d1, d2, depth1: z1 - d1 / 2, depth2: z2 - d2 / 2 };
        if (z2 + (d2 / 2) * Math.sin((halfDeg * Math.PI) / 180) < 0) return true; // ball 2 would not touch inside the hole
        void depth2;
        const A = ballTaperA(b);
        const B = ballTaperB(b);
        return (
          Math.abs(A.halfAngleDeg - halfDeg) < 1e-7 &&
          Math.abs(A.halfAngleDeg - B.halfAngleDeg) < ANG &&
          Math.abs(A.Dtop - B.Dtop) < 1e-8 &&
          Math.abs(A.Dtop - Dtop) < 1e-7
        );
      }),
      RUNS,
    );
  });
});

describe('three wires', () => {
  it('ISO 724 table agrees with d2 = d − (3√3/8)·P rounded to 3 decimals', () => {
    for (const t of METRIC_THREADS) expect((t.d - ((3 * Math.sqrt(3)) / 8) * t.P).toFixed(3), t.name).toBe(t.d2Text);
  });

  it('best wire touches the flanks on the pitch line (global check §5.3)', () => {
    for (const t of METRIC_THREADS) {
      const dw = bestWireA(t.P, 60);
      expect(Math.abs(contactY(t.d2, dw, t.P, 60) - t.d2 / 2)).toBeLessThan(1e-9);
    }
  });

  it('property: A = B for M, d2 and the best wire; d2 < M (10 000 cases)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...METRIC_THREADS), fc.constantFrom(55, 60, 29, 30), real(0.6, 1.4), (th, ang, k) => {
        const dw = bestWireA(th.P, ang) * k;
        const M = overWiresA(th.d2, dw, th.P, ang);
        return (
          Math.abs(M - overWiresB(th.d2, dw, th.P, ang)) < LEN &&
          Math.abs(pitchDiameterA(M, dw, th.P, ang) - th.d2) < LEN &&
          Math.abs(pitchDiameterB(M, dw, th.P, ang) - th.d2) < LEN &&
          Math.abs(bestWireA(th.P, ang) - bestWireB(th.P, ang)) < LEN &&
          // global check d2 < M (§5.3) holds for 55°/60° threads with practical wires; with steep
          // flanks (29°/30°) and thin wires M can fall below d2, so the generator must not use them.
          (ang < 55 || th.d2 < M)
        );
      }),
      RUNS,
    );
  });

  it('coherence: changing the wire changes M but not d2', () => {
    const th = METRIC_THREADS.find((t) => t.name === 'M12')!;
    const d = [0.9, 1.0, 1.1].map((dw) => pitchDiameterA(overWiresB(th.d2, dw, th.P, 60), dw, th.P, 60));
    for (const x of d) expect(Math.abs(x - th.d2)).toBeLessThan(1e-9);
  });
});

describe('temperature', () => {
  it('part and tool: aluminium part at 23 °C measured with a steel rule at 26 °C', () => {
    const t = { L: parse('150'), alphaPart: parse('23e-6'), tPart: q(23), alphaTool: parse('11.5e-6'), tTool: q(26) };
    // ΔL = 150 · (23e-6·3 − 11.5e-6·6) = 150 · (69e-6 − 69e-6) = 0
    expect(toFixed(deltaLA(t), 6)).toBe('0.000000');
  });

  it('property: the linear (A) and exact (B) models differ by < 0.5 µm in the generator ranges (10 000 cases)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 500 }),
        fc.constantFrom('11.5e-6', '23e-6', '17e-6', '19e-6'),
        fc.integer({ min: 10, max: 30 }),
        fc.constantFrom('11.5e-6', '0'),
        fc.integer({ min: 15, max: 25 }),
        (L, ap, tp, at, tt) => {
          const t = { L: q(L), alphaPart: parse(ap), tPart: q(tp), alphaTool: parse(at), tTool: q(tt) };
          const d = abs(sub(lengthAt20A(t), lengthAt20B(t)));
          return toNumber(d) < 0.0005 && toNumber(abs(sub(deltaLA(t), deltaLB(t)))) < 0.0005;
        },
      ),
      RUNS,
    );
  });
});

describe('limit gauges (ISO 286 subset)', () => {
  const lim = (d: string) => {
    const l = limitsFromDesignation(d);
    return `${toFixed(l.min, 3)}/${toFixed(l.max, 3)}`;
  };

  it('known designations', () => {
    expect(lim('23f6')).toBe('22.967/22.980'); // Andalucía 2023 4.2
    expect(lim('40H7')).toBe('40.000/40.025');
    expect(lim('30g6')).toBe('29.980/29.993');
    expect(lim('50k6')).toBe('50.002/50.018');
    expect(lim('60G7')).toBe('60.010/60.040');
    expect(lim('62g6')).toBe('61.971/61.990'); // Euskadi 2022-A, Ø62 H7/g6
    expect(lim('62H7')).toBe('62.000/62.030');
    expect(lim('10k8')).toBe('10.000/10.022'); // k above IT7: ei = 0
  });

  it('designation parser', () => {
    expect(parseDesignation('Ø25 g6')).toMatchObject({ letter: 'g', grade: 6, feature: 'shaft' });
    expect(parseDesignation('40H7').feature).toBe('hole');
    expect(() => limitsFromDesignation('40K7')).toThrow(); // K holes (Δ rule) not in the subset
    expect(() => limitsFromDesignation('150h6')).toThrow(); // above 120 mm
  });

  it('GO / NO-GO: A (Taylor rule) = B (material condition), and GO side first in material', () => {
    for (const d of ['23f6', '40H7', '30g6', '50k6', '60G7', '12p6', '100e8', '8d9']) {
      const l = limitsFromDesignation(d);
      const a = gaugeSizesA(l.feature, l.max, l.min);
      const b = gaugeSizesB(l.feature, l.min, l.max);
      expect([toFixed(a.go, 3), toFixed(a.noGo, 3), a.gauge]).toEqual([toFixed(b.go, 3), toFixed(b.noGo, 3), b.gauge]);
    }
    const h = gaugeSizesA('hole', parse('40.025'), parse('40'));
    expect([toFixed(h.go, 3), toFixed(h.noGo, 3)]).toEqual(['40.000', '40.025']);
  });
});
