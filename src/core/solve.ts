/**
 * Verified answer key of an exercise (spec §5, §8.1): for every ask, the expected value
 * computed from the displayed data with solver A and checked against solver B. If A and B
 * disagree, SolverMismatch is thrown and the exercise must not be shown.
 */
import { toDeg, toRad } from './angles';
import { checkStack, classicStack, getSet, minStack, type GaugeSet } from './gaugeBlocks';
import { gaugeSizesA, gaugeSizesB, limitsFromDesignation, type Feature } from './fixedGauges';
import type { Ask, Exercise, Setup } from './model';
import { dovetailA, dovetailB, dovetailWidthA, overSplineRollersA, overSplineRollersB } from './profiles';
import * as R from './rational';
import type { Rational } from './rational';
import {
  STANDARD_MICROMETER,
  VERNIER_MICROMETER,
  readMicrometer,
  readVernier,
  readVernierGeometric,
  simulateMicrometer,
  simulateVernier,
  vernierAppreciation,
  type VernierSpec,
} from './reading';
import { sineAngleA, sineAngleB, sineHeightA, sineHeightB } from './sineBar';
import { ballTaperA, ballTaperB, rollerTaperA, rollerTaperB, rollerTaperCExact } from './taper';
import { deltaLA, deltaLB } from './temperature';
import { bestWireA, bestWireB, overWiresA, overWiresB, pitchDiameterA, pitchDiameterB } from './threads';

export class SolverMismatch extends Error {
  constructor(what: string, a: number, b: number) {
    super(`solvers A and B disagree on ${what}: ${a} vs ${b}`);
    this.name = 'SolverMismatch';
  }
}

export type Quantity = 'length' | 'angle' | 'taper' | 'percent' | 'exact' | 'stack';

export interface StackKey {
  target: Rational;
  set: string;
  minCount: number;
  /** Reference stack shown in the solution: classic method (A) when it works, else B's. */
  reference: Rational[];
  classic: boolean;
}

export interface Expected {
  q: Quantity;
  /** Canonical value: mm, degrees, C as a ratio, percent. */
  value: number;
  /** Exact value when the answer is exact (readings, limits, ΔL...). */
  exact?: Rational;
  stack?: StackKey;
  /** Decimals used to show the value. */
  digits: number;
}

const TOL = 1e-9;
const n = (s: string | undefined): number => R.toNumber(R.parse(s ?? 'NaN'));
const r = (s: string): Rational => R.parse(s);

function agree(what: string, a: number, b: number, tol = TOL): number {
  if (!(Math.abs(a - b) <= tol) || !Number.isFinite(a)) throw new SolverMismatch(what, a, b);
  return a;
}

const len = (value: number, digits = 3): Expected => ({ q: 'length', value, digits });
const ang = (value: number, digits = 4): Expected => ({ q: 'angle', value, digits });
const exact = (x: Rational, digits = 3): Expected => ({ q: 'exact', value: R.toNumber(x), exact: x, digits });

/** Smallest unit of a set (gcd of its block values), as an exact rational. */
function setUnit(set: GaugeSet): Rational {
  let unit = set.blocks[0]!;
  const g = (a: Rational, b: Rational): Rational => {
    // gcd of two rationals p1/q1, p2/q2 = gcd(p1·q2, p2·q1)/(q1·q2)
    let x = a.n * b.d;
    let y = b.n * a.d;
    if (x < 0n) x = -x;
    if (y < 0n) y = -y;
    while (y) [x, y] = [y, x % y];
    return R.div(R.q(x), R.q(a.d * b.d));
  };
  for (const b of set.blocks) unit = g(unit, b);
  return unit;
}

const STACK_CACHE = new Map<string, StackKey | null>();

/** Stack key for a target (exact) in a set; null when the set cannot build it (memoised). */
export function stackKey(target: Rational, setId: string): StackKey | null {
  const ck = `${setId}|${R.toString(target)}`;
  if (STACK_CACHE.has(ck)) return STACK_CACHE.get(ck)!;
  const k = stackKeyUncached(target, setId);
  if (STACK_CACHE.size > 5000) STACK_CACHE.clear();
  STACK_CACHE.set(ck, k);
  return k;
}

function stackKeyUncached(target: Rational, setId: string): StackKey | null {
  const set = getSet(setId);
  const b = minStack(target, set);
  if (!b) return null;
  const a = classicStack(target, set);
  if (a && !checkStack(a, target, set).ok) throw new Error('classic stack invalid');
  return { target, set: setId, minCount: b.count, reference: a ?? b.stack, classic: a !== null };
}

/** Nearest composable height to h (sine bar with a coarse set, Madrid 2023-2.6). */
export function nearestFeasible(h: number, setId: string): Rational {
  const set = getSet(setId);
  const unit = setUnit(set);
  const u = R.toNumber(unit);
  const k0 = Math.round(h / u);
  for (let d = 0; d < 50; d++) {
    for (const k of d === 0 ? [k0] : [k0 - d, k0 + d].sort((x, y) => Math.abs(x * u - h) - Math.abs(y * u - h))) {
      const t = R.mul(R.q(k), unit);
      if (minStack(t, set)) return t;
    }
  }
  throw new Error('no composable height near h');
}

/** Sine-bar angle in degrees from the setup (given angle, or half-angle of a taper C). */
export function sineBarAngle(s: Extract<Setup, { kind: 'sineBar' }>): number {
  if (s.angleDeg) return n(s.angleDeg);
  if (s.taperC) return toDeg(Math.atan(n(s.taperC) / 2));
  if (s.h) return agree('sine angle', sineAngleA(n(s.L), n(s.h)), sineAngleB(n(s.L), n(s.h)));
  throw new Error('sineBar setup without angle, taper or height');
}

function solveAsk(setup: Setup, ask: Ask): Expected {
  const s = setup;
  switch (s.kind) {
    case 'vernier': {
      const spec: VernierSpec = { s: r(s.s), n: s.n, modulus: s.modulus };
      const x = r(s.value);
      const view = simulateVernier(spec, x);
      if (!R.eq(readVernier(spec, view.main, view.line), x) || !R.eq(readVernierGeometric(spec, view), x)) throw new SolverMismatch('vernier', 0, 1);
      const a = vernierAppreciation(spec);
      if (ask.kind === 'appreciation') return exact(a, 2);
      if (ask.kind === 'reading') return exact(x, a.d > 10n ? 2 : 1);
      break;
    }
    case 'micrometer': {
      const m = s.vernierDivs ? VERNIER_MICROMETER : STANDARD_MICROMETER;
      const x = r(s.value);
      const v = simulateMicrometer(m, x);
      if (!R.eq(readMicrometer(m, v.sleeve, v.thimble, v.vernier), x)) throw new SolverMismatch('micrometer', 0, 1);
      if (ask.kind === 'reading') return exact(x, s.vernierDivs ? 3 : 2);
      break;
    }
    case 'gaugeStack': {
      if (ask.kind === 'gaugeStack') {
        const key = stackKey(r(s.target), s.set);
        if (!key) throw new Error('target not composable');
        return { q: 'stack', value: R.toNumber(key.target), stack: key, digits: 3 };
      }
      break;
    }
    case 'sineBar': {
      const L = n(s.L);
      const alpha = sineBarAngle(s);
      const h = s.h ? n(s.h) : agree('sine height', sineHeightA(L, alpha), sineHeightB(L, alpha));
      if (ask.kind === 'sineHeight') return len(h, 3);
      if (ask.kind === 'sineAngle') return ang(alpha, 4);
      if (ask.kind === 'gaugeStack' || ask.kind === 'selectionError') {
        const setId = s.set ?? '87';
        const target = ask.nearestFeasible || ask.kind === 'selectionError' ? nearestFeasible(h, setId) : R.parse(h.toFixed(3));
        if (ask.kind === 'gaugeStack') {
          const key = stackKey(target, setId);
          if (!key) throw new Error('sine height not composable');
          return { q: 'stack', value: R.toNumber(target), stack: key, digits: 3 };
        }
        // error over the check length: Lc·tan(α_stack − α)
        const Lc = s.checkLength ? n(s.checkLength) : L;
        const aS = sineAngleA(L, R.toNumber(target));
        const bS = sineAngleB(L, R.toNumber(target));
        agree('stack angle', aS, bS);
        return len(Lc * Math.tan(toRad(aS - alpha)), 4);
      }
      break;
    }
    case 'taperRollers': {
      const d = { rollerD: n(s.rollerD), h1: n(s.h1), h2: n(s.h2), M1: n(s.M1), M2: n(s.M2) };
      const A = rollerTaperA(d);
      const B = rollerTaperB(d);
      const C = R.toNumber(rollerTaperCExact(r(s.M1), r(s.M2), r(s.h1), r(s.h2)));
      agree('taper C', A.C, C, 1e-12);
      agree('taper C (B)', B.C, C, TOL);
      const half = agree('half-angle', A.halfAngleDeg, B.halfAngleDeg);
      if (ask.kind === 'taperC') return { q: 'taper', value: C, exact: rollerTaperCExact(r(s.M1), r(s.M2), r(s.h1), r(s.h2)), digits: 4 };
      if (ask.kind === 'halfAngle') return ang(half);
      if (ask.kind === 'fullAngle') return ang(2 * half);
      if (ask.kind === 'planeAngle') return ang(90 + half);
      if (ask.kind === 'diameter') {
        const y = ask.at === 'top' ? n(s.coneLength) : 0;
        return len(agree('diameter', A.diameterAt(y), B.diameterAt(y)), 3);
      }
      break;
    }
    case 'taperBalls': {
      const d = { d1: n(s.d1), d2: n(s.d2), depth1: n(s.depth1), depth2: n(s.depth2) };
      const A = ballTaperA(d);
      const B = ballTaperB(d);
      const half = agree('half-angle', A.halfAngleDeg, B.halfAngleDeg);
      if (ask.kind === 'halfAngle') return ang(half);
      if (ask.kind === 'fullAngle') return ang(2 * half);
      if (ask.kind === 'taperC') return { q: 'taper', value: agree('C', A.C, B.C), digits: 4 };
      if (ask.kind === 'diameter') return len(agree('D top', A.Dtop, B.Dtop), 3);
      break;
    }
    case 'threeWire': {
      const P = n(s.P);
      const a = n(s.flankAngleDeg);
      const dw = n(s.wireD);
      if (ask.kind === 'bestWire') return len(agree('best wire', bestWireA(P, a), bestWireB(P, a)), 3);
      if (ask.kind === 'pitchDiameter' && s.M) return len(agree('d2', pitchDiameterA(n(s.M), dw, P, a), pitchDiameterB(n(s.M), dw, P, a)), 3);
      if (ask.kind === 'measure' && s.d2) return len(agree('M', overWiresA(n(s.d2), dw, P, a), overWiresB(n(s.d2), dw, P, a)), 3);
      break;
    }
    case 'spline': {
      const sp = { rollerD: n(s.rollerD), vAngleDeg: n(s.vAngleDeg), apexRadius: n(s.apexRadius) };
      if (ask.kind === 'measure') return len(agree('M', overSplineRollersA(sp), overSplineRollersB(sp)), 3);
      break;
    }
    case 'dovetail': {
      const base = { kind: s.dovetail, rollerD: n(s.rollerD), alphaDeg: n(s.alphaDeg) };
      if (ask.kind === 'measure' && s.width) {
        const t = { ...base, width: n(s.width) };
        return len(agree('X', dovetailA(t), dovetailB(t)), 3);
      }
      if (ask.kind === 'width' && s.X) {
        const w = dovetailWidthA(s.dovetail, base.rollerD, base.alphaDeg, n(s.X));
        agree('width (B: X back)', dovetailB({ ...base, width: w }), n(s.X));
        return len(w, 3);
      }
      break;
    }
    case 'temperature': {
      const t = { L: r(s.L), alphaPart: r(s.alphaPart), tPart: r(s.tPart), alphaTool: s.alphaTool ? r(s.alphaTool) : undefined, tTool: s.tTool ? r(s.tTool) : undefined };
      if (s.given === 'measured') {
        const dA = deltaLA(t);
        agree('ΔL (linear vs exact model)', R.toNumber(dA), R.toNumber(deltaLB(t)), 0.0005);
        if (ask.kind === 'tempDelta') return { ...exact(dA, 4), q: 'length' };
        if (ask.kind === 'length20') return { ...exact(R.sub(t.L, dA), 4), q: 'length' };
      } else {
        // L at 20 °C; free expansion of the part to tPart
        const dL = R.mul(t.L, R.mul(t.alphaPart, R.sub(t.tPart, R.q(20))));
        const dB = R.toNumber(t.L) * R.toNumber(t.alphaPart) * (R.toNumber(t.tPart) - 20);
        agree('ΔL', R.toNumber(dL), dB, 1e-9);
        if (ask.kind === 'tempDelta') return { ...exact(dL, 4), q: 'length' };
        if (ask.kind === 'lengthAtT') return { ...exact(R.add(t.L, dL), 4), q: 'length' };
      }
      break;
    }
    case 'fixedGauge': {
      let feature: Feature = s.feature;
      let max: Rational;
      let min: Rational;
      if (s.designation) {
        const l = limitsFromDesignation(s.designation);
        feature = l.feature;
        max = l.max;
        min = l.min;
      } else {
        max = r(s.max!);
        min = r(s.min!);
      }
      const A = gaugeSizesA(feature, max, min);
      const B = gaugeSizesB(feature, min, max);
      if (!R.eq(A.go, B.go) || !R.eq(A.noGo, B.noGo)) throw new SolverMismatch('gauge', 0, 1);
      if (ask.kind === 'gaugeGo') return exact(A.go, 3);
      if (ask.kind === 'gaugeNoGo') return exact(A.noGo, 3);
      break;
    }
    case 'error': {
      const xs = s.measured.map(r);
      const mean = R.div(R.sum(xs), R.q(xs.length));
      const t = r(s.trueValue);
      const e = R.sub(mean, t);
      // B: mean of the individual errors
      const eB = R.div(R.sum(xs.map((x) => R.sub(x, t))), R.q(xs.length));
      if (!R.eq(e, eB)) throw new SolverMismatch('error', 0, 1);
      if (ask.kind === 'errorAbs') return { ...exact(e, 4), q: 'length' };
      if (ask.kind === 'errorRel') return { q: 'percent', value: R.toNumber(R.mul(R.div(e, t), R.q(100))), exact: R.mul(R.div(e, t), R.q(100)), digits: 4 };
      break;
    }
  }
  throw new Error(`ask ${ask.id} (${ask.kind}) does not fit setup ${s.kind}`);
}

export type AnswerKey = Record<string, Expected>;

export function solveExercise(ex: Exercise): AnswerKey {
  return Object.fromEntries(ex.asks.map((a) => [a.id, solveAsk(ex.setup, a)]));
}

/** Re-exported for the grader: decimals of an exact value. */
export const isExact = (e: Expected): boolean => e.q === 'exact';
export { setUnit };
