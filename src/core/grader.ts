/**
 * Grader and error diagnosis (spec §8). Deterministic: every answer is compared with the
 * verified answer key (solve.ts). A wrong answer is re-checked against the result of each
 * common mistake (spec §8.3); the first hypothesis that matches is reported ("dirudienez...").
 *
 * Tolerances (spec §8.1):
 *  - lengths ±0.001 mm; instrument readings and limit-gauge sizes exact;
 *  - angles ±0.01°; taper C ±0.1 % relative (ratio, %, 1:x accepted);
 *  - MetroLab choices for µm-sized results (to be confirmed by the user): selection error of a
 *    stack ±0.0002 mm; absolute error of a mean ±0.0001 mm; relative error ±0.5 % of its value.
 *  - A mistake whose result equals the right answer exactly (e.g. "use the nominal size" for an
 *    H hole) is not a mistake there: it is not diagnosed and does not block the exercise.
 * Units are converted before comparing (mm/µm; decimal degrees or ° ′ ″).
 * An uninterpretable entry is 'invalid', never counted as wrong.
 */
import { toDeg, toRad } from './angles';
import { checkStack, getSet } from './gaugeBlocks';
import type { Ask, Exercise, Setup } from './model';
import * as R from './rational';
import type { Rational } from './rational';
import { simulateMicrometer, simulateVernier, VERNIER_MICROMETER, type VernierSpec } from './reading';
import { sineBarAngle, solveExercise, type AnswerKey, type Expected } from './solve';
import { ballTaperA, rollerTaperA } from './taper';

// ------------------------------------------------------------------ input

export interface Answer {
  value?: string;
  /** length: 'mm' | 'µm'; angle: 'deg' | 'dms'; taper: 'ratio' | 'percent' | 'oneTo'; percent: '%' | 'fraction' */
  unit?: string;
  /** gaugeStack: the blocks, one per entry */
  blocks?: string[];
}

/** "13,33", "13.33", "40/3", "−5" → exact value. Garbage → null, empty → undefined. */
export function parseUserNumber(raw: string | undefined): Rational | null | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (s === '') return undefined;
  if (s.includes(',') && s.includes('.')) return null;
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)(\/\d+([.,]\d*)?)?$/.test(s)) return null;
  try {
    return R.parse(s);
  } catch {
    return null;
  }
}

/** "8°31'51\"", "8° 31′ 51″", "8 31 51", "8°31,5'" → decimal degrees; plain number → itself. */
export function parseAngle(raw: string | undefined): number | null | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim().replace(/[−–]/g, '-').replace(/,/g, '.');
  if (s === '') return undefined;
  if (/^[+-]?\d+(\.\d*)?$/.test(s)) return Number(s);
  const m = /^([+-]?)(\d+(?:\.\d+)?)\s*(?:°|º|d|\s)\s*(?:(\d+(?:\.\d+)?)\s*(?:'|′|m|\s)?\s*)?(?:(\d+(?:\.\d+)?)\s*(?:"|″|''|′′|s)?)?\s*$/.exec(s);
  if (!m) return null;
  const v = Number(m[2]) + Number(m[3] ?? 0) / 60 + Number(m[4] ?? 0) / 3600;
  if ((m[3] && Number(m[3]) >= 60) || (m[4] && Number(m[4]) >= 60)) return null;
  return m[1] === '-' ? -v : v;
}

/** Taper as a ratio: "0.1", "1/10", "1:10" (ratio unit); "10" (percent); "10" (oneTo: 1:x). */
function parseTaper(raw: string | undefined, unit: string | undefined): number | null | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const s = raw.trim().replace(/\s+/g, '');
  const colon = /^(\d+(?:[.,]\d+)?):(\d+(?:[.,]\d+)?)$/.exec(s);
  if (colon) return Number(colon[1]!.replace(',', '.')) / Number(colon[2]!.replace(',', '.'));
  const v = parseUserNumber(s.replace(/%$/, ''));
  if (v === null || v === undefined) return v;
  const x = R.toNumber(v);
  if (unit === 'percent' || s.endsWith('%')) return x / 100;
  if (unit === 'oneTo') return x === 0 ? null : 1 / x;
  return x;
}

// ------------------------------------------------------------------ output

export type Status = 'correct' | 'wrong' | 'missing' | 'invalid';

export type DiagnosisId =
  | 'half-full-angle'
  | 'rad-deg'
  | 'sin-tan'
  | 'c-half'
  | 'c-double'
  | 'single-height'
  | 'roller-term'
  | 'wrong-height'
  | 'plane-supplement'
  | 'plane-from-vertical'
  | 'wire-p-term'
  | 'wire-2dw'
  | 'wire-sign'
  | 'best-wire-trig'
  | 'radius-diameter'
  | 'cot-tan'
  | 'dovetail-sign'
  | 'mm-um'
  | 'temp-sign'
  | 'temp-tool-forgotten'
  | 'temp-delta-t'
  | 'temp-delta-only'
  | 'gauge-swapped'
  | 'gauge-nominal'
  | 'micro-half-mm'
  | 'micro-vernier-ignored'
  | 'vernier-appreciation'
  | 'stack-not-in-set'
  | 'stack-sum'
  | 'stack-repeated'
  | 'error-sign'
  | 'percent-fraction'
  | 'not-identified';

export type NoteId = 'could-be-fewer' | 'not-minimal';

export interface AskResult {
  id: string;
  kind: Ask['kind'];
  status: Status | 'partial';
  /** fraction of the ask's weight earned, 0…1 */
  score: number;
  expected: Expected;
  /** the user's value in canonical units (mm, °, ratio, %), when it could be read */
  given?: number;
  diagnosis?: DiagnosisId;
  /** e.g. the blocks that are not in the set */
  detail?: string;
  notes: NoteId[];
}

export interface GradeResult {
  asks: AskResult[];
  /** 0…10, weighted by exercise.weights (default 1 each) */
  score10: number;
}

// ------------------------------------------------------------------ tolerances

export function tolerance(ask: Ask, e: Expected): number {
  if (ask.kind === 'selectionError') return 0.0002;
  if (ask.kind === 'errorAbs') return 0.0001;
  switch (e.q) {
    case 'length':
      return 0.001;
    case 'angle':
      return 0.01;
    case 'taper':
      return 0.001 * Math.abs(e.value);
    case 'percent':
      return Math.max(0.005 * Math.abs(e.value), 1e-9);
    case 'exact':
      return 0;
    case 'stack':
      return 0;
  }
}

const within = (x: number, e: Expected, tol: number): boolean =>
  e.q === 'exact' ? Math.abs(x - e.value) < 1e-9 : Math.abs(x - e.value) <= tol + 1e-9;

// ------------------------------------------------------------------ hypotheses (spec §8.3)

export interface Hypothesis {
  id: DiagnosisId;
  value: number;
}

const num = (s: string | undefined): number => R.toNumber(R.parse(s ?? 'NaN'));

/** Values a typical mistake would produce, in the ask's canonical unit. */
export function hypotheses(setup: Setup, ask: Ask, e: Expected): Hypothesis[] {
  const H: Hypothesis[] = [];
  const add = (id: DiagnosisId, value: number) => {
    if (Number.isFinite(value)) H.push({ id, value });
  };
  const s = setup;
  switch (s.kind) {
    case 'vernier': {
      if (ask.kind !== 'reading') break;
      const spec: VernierSpec = { s: R.parse(s.s), n: s.n, modulus: s.modulus };
      const v = simulateVernier(spec, R.parse(s.value));
      for (const a of [0.1, 0.05, 0.02]) {
        const own = num(s.s) / s.n;
        if (Math.abs(a - own) > 1e-12) add('vernier-appreciation', R.toNumber(v.main) + v.line * a);
      }
      break;
    }
    case 'micrometer': {
      if (ask.kind !== 'reading') break;
      const m = s.vernierDivs ? VERNIER_MICROMETER : { ...VERNIER_MICROMETER, vernierDivs: 0 };
      const v = simulateMicrometer(m, R.parse(s.value));
      add('micro-half-mm', e.value + (v.halfMark ? -0.5 : 0.5));
      if (s.vernierDivs) {
        add('micro-vernier-ignored', e.value - v.vernier * 0.001);
        add('vernier-appreciation', R.toNumber(v.sleeve) + v.thimble * 0.01 + v.vernier * 0.01);
      }
      break;
    }
    case 'sineBar': {
      const L = num(s.L);
      const a = sineBarAngle(s);
      if (ask.kind === 'sineHeight') {
        add('sin-tan', L * Math.tan(toRad(a)));
        add('rad-deg', L * Math.sin(a));
        if (s.taperC) add('half-full-angle', L * Math.sin(toRad(2 * a)));
      }
      if (ask.kind === 'sineAngle' && s.h) {
        add('sin-tan', toDeg(Math.atan(num(s.h) / L)));
        add('rad-deg', Math.asin(num(s.h) / L));
      }
      break;
    }
    case 'taperRollers': {
      const d = { rollerD: num(s.rollerD), h1: num(s.h1), h2: num(s.h2), M1: num(s.M1), M2: num(s.M2) };
      const C = Math.abs(d.M2 - d.M1) / (d.h2 - d.h1);
      const A = rollerTaperA(d);
      const half = A.halfAngleDeg;
      const cosB = Math.cos(toRad(half));
      if (ask.kind === 'taperC') {
        add('c-half', C / 2);
        add('c-double', 2 * C);
        if (d.h1 > 0) add('single-height', Math.abs(d.M2 - d.M1) / d.h2);
      }
      if (ask.kind === 'halfAngle') {
        add('half-full-angle', 2 * half);
        add('c-double', toDeg(Math.atan(C)));
        add('rad-deg', toRad(half));
      }
      if (ask.kind === 'fullAngle') {
        add('half-full-angle', half);
        add('rad-deg', toRad(2 * half));
      }
      if (ask.kind === 'planeAngle') {
        add('plane-supplement', 90 - half);
        add('plane-from-vertical', half);
        add('half-full-angle', 90 + 2 * half);
      }
      if (ask.kind === 'diameter') {
        const y = ask.at === 'top' ? num(s.coneLength) : 0;
        const D = A.diameterAt(y);
        add('roller-term', D + d.rollerD * (1 / cosB - 1));
        add('roller-term', D + d.rollerD / cosB);
        const yc = ask.at === 'top' ? d.h2 + d.rollerD / 2 : d.h1 + d.rollerD / 2;
        add('wrong-height', A.diameterAt(yc));
      }
      break;
    }
    case 'taperBalls': {
      const b = { d1: num(s.d1), d2: num(s.d2), depth1: num(s.depth1), depth2: num(s.depth2) };
      const A = ballTaperA(b);
      if (ask.kind === 'halfAngle') {
        add('half-full-angle', 2 * A.halfAngleDeg);
        add('rad-deg', toRad(A.halfAngleDeg));
        add('sin-tan', toDeg(Math.atan((b.d2 - b.d1) / 2 / (b.depth1 + b.d1 / 2 - b.depth2 - b.d2 / 2))));
      }
      if (ask.kind === 'fullAngle') add('half-full-angle', A.halfAngleDeg);
      if (ask.kind === 'taperC') {
        add('c-half', A.C / 2);
        add('c-double', 2 * A.C);
      }
      if (ask.kind === 'diameter') {
        const t = Math.tan(toRad(A.halfAngleDeg));
        add('roller-term', 2 * (b.d2 / 2 + (b.depth2 + b.d2 / 2) * t));
      }
      break;
    }
    case 'threeWire': {
      const P = num(s.P);
      const t = toRad(num(s.flankAngleDeg) / 2);
      const dw = num(s.wireD);
      const k = dw * (1 + 1 / Math.sin(t));
      const pt = P / 2 / Math.tan(t);
      if (ask.kind === 'pitchDiameter' && s.M) {
        const M = num(s.M);
        add('wire-p-term', M - k + P);
        add('wire-2dw', M - dw / Math.sin(t) + pt);
        add('wire-sign', M - k - pt);
      }
      if (ask.kind === 'measure' && s.d2) {
        const d2 = num(s.d2);
        add('wire-p-term', d2 + k - P);
        add('wire-2dw', d2 + dw / Math.sin(t) - pt);
        add('wire-sign', d2 + k + pt);
      }
      if (ask.kind === 'bestWire') {
        add('best-wire-trig', P / (2 * Math.sin(t)));
        add('best-wire-trig', (P * Math.cos(t)) / 2);
      }
      break;
    }
    case 'spline': {
      if (ask.kind !== 'measure') break;
      const r = num(s.rollerD) / 2;
      const h = toRad(num(s.vAngleDeg) / 2);
      const Ra = num(s.apexRadius);
      add('roller-term', 2 * (Ra + r / Math.sin(h)));
      add('half-full-angle', 2 * (Ra + r / Math.sin(2 * h) + r));
      add('radius-diameter', Ra + r / Math.sin(h) + r);
      break;
    }
    case 'dovetail': {
      const d = num(s.rollerD);
      const a = toRad(num(s.alphaDeg));
      const sg = s.dovetail === 'male' ? 1 : -1;
      if (ask.kind === 'measure' && s.width) {
        const w = num(s.width);
        add('cot-tan', w + sg * d * (1 + Math.tan(a / 2)));
        add('half-full-angle', w + sg * d * (1 + 1 / Math.tan(a)));
        add('dovetail-sign', w - sg * d * (1 + 1 / Math.tan(a / 2)));
      }
      if (ask.kind === 'width' && s.X) {
        const X = num(s.X);
        add('cot-tan', X - sg * d * (1 + Math.tan(a / 2)));
        add('half-full-angle', X - sg * d * (1 + 1 / Math.tan(a)));
        add('dovetail-sign', X + sg * d * (1 + 1 / Math.tan(a / 2)));
      }
      break;
    }
    case 'temperature': {
      const L = num(s.L);
      const ap = num(s.alphaPart);
      const tp = num(s.tPart);
      const tool = s.alphaTool && s.tTool ? num(s.alphaTool) * (num(s.tTool) - 20) : 0;
      const part = ap * (tp - 20);
      if (s.given === 'measured') {
        const dL = L * (part - tool);
        if (ask.kind === 'tempDelta') {
          add('temp-sign', -dL);
          if (tool !== 0) add('temp-tool-forgotten', L * part);
          add('temp-delta-t', L * ap * tp);
        }
        if (ask.kind === 'length20') {
          add('temp-sign', L + dL);
          if (tool !== 0) add('temp-tool-forgotten', L - L * part);
        }
      } else {
        const dL = L * part;
        if (ask.kind === 'lengthAtT') {
          add('temp-sign', L - dL);
          add('temp-delta-only', dL);
          add('temp-delta-t', L + L * ap * tp);
        }
        if (ask.kind === 'tempDelta') add('temp-delta-t', L * ap * tp);
      }
      break;
    }
    case 'fixedGauge': {
      // swapped sides: the other limit; the nominal size instead of a limit
      break;
    }
    case 'error': {
      const xs = s.measured.map(num);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const t = num(s.trueValue);
      if (ask.kind === 'errorAbs') add('error-sign', t - mean);
      if (ask.kind === 'errorRel') {
        add('error-sign', (100 * (t - mean)) / t);
        add('percent-fraction', (mean - t) / t);
      }
      break;
    }
    case 'gaugeStack':
      break;
  }
  // mm ↔ µm (every length)
  if (e.q === 'length' || (e.q === 'exact' && ask.kind !== 'appreciation')) {
    add('mm-um', e.value * 1000);
    add('mm-um', e.value / 1000);
  }
  return H;
}

/** Limit-gauge hypotheses need the other side's value: computed from the full key. */
function gaugeHypotheses(ex: Exercise, ask: Ask, key: AnswerKey): Hypothesis[] {
  if (ex.setup.kind !== 'fixedGauge') return [];
  const other = ex.asks.find((a) => a.kind === (ask.kind === 'gaugeGo' ? 'gaugeNoGo' : 'gaugeGo'));
  const H: Hypothesis[] = [];
  const s = ex.setup;
  let otherValue: number | undefined = other ? key[other.id]?.value : undefined;
  if (otherValue === undefined) {
    // derive the other side even when it is not asked
    const k2 = solveExercise({ ...ex, asks: [{ id: '_o', kind: ask.kind === 'gaugeGo' ? 'gaugeNoGo' : 'gaugeGo' }] });
    otherValue = k2['_o']!.value;
  }
  H.push({ id: 'gauge-swapped', value: otherValue });
  const nominal = s.designation ? Number(/(\d+(?:[.,]\d+)?)/.exec(s.designation)![1]!.replace(',', '.')) : s.nominal ? num(s.nominal) : NaN;
  if (Number.isFinite(nominal)) H.push({ id: 'gauge-nominal', value: nominal });
  return H;
}

// ------------------------------------------------------------------ grading

function readValue(ask: Ask, e: Expected, ans: Answer): number | null | undefined {
  if (e.q === 'angle') {
    const v = parseAngle(ans.value);
    return v;
  }
  if (e.q === 'taper') return parseTaper(ans.value, ans.unit);
  const v = parseUserNumber(ans.value);
  if (v === null || v === undefined) return v;
  let x = R.toNumber(v);
  if ((e.q === 'length' || e.q === 'exact') && ans.unit === 'µm') x /= 1000;
  if (e.q === 'percent' && ans.unit === 'fraction') x *= 100;
  void ask;
  return x;
}

/** Exact comparison for readings and limits: the user's decimal must equal the exact value. */
function readExact(ans: Answer): Rational | null | undefined {
  const v = parseUserNumber(ans.value);
  if (v === null || v === undefined) return v;
  return ans.unit === 'µm' ? R.div(v, R.q(1000)) : v;
}

function gradeStack(ask: Ask, e: Expected, ans: Answer | undefined): AskResult {
  const base = { id: ask.id, kind: ask.kind, expected: e, notes: [] as NoteId[] };
  const raw = (ans?.blocks ?? []).map((b) => b.trim()).filter((b) => b !== '');
  if (raw.length === 0) return { ...base, status: 'missing', score: 0 };
  const blocks = raw.map((b) => parseUserNumber(b));
  if (blocks.some((b) => b === null || b === undefined)) return { ...base, status: 'invalid', score: 0 };
  const key = e.stack!;
  const set = getSet(key.set);
  const c = checkStack(blocks as Rational[], key.target, set);
  const given = R.toNumber(c.total);
  if (!c.ok) {
    const diagnosis: DiagnosisId = c.problems.includes('notInSet') ? 'stack-not-in-set' : c.problems.includes('repeated') ? 'stack-repeated' : 'stack-sum';
    const detail = diagnosis === 'stack-not-in-set' ? c.notInSet.map((b) => R.toFixed(b, 4).replace(/0+$/, '').replace(/\.$/, '')).join(', ') : diagnosis === 'stack-repeated' ? c.repeated.map((b) => R.toFixed(b, 4).replace(/0+$/, '').replace(/\.$/, '')).join(', ') : R.toFixed(c.total, 4);
    return { ...base, status: 'wrong', score: 0, given, diagnosis, detail };
  }
  if (blocks.length > key.minCount) {
    if (ask.minimal) return { ...base, status: 'partial', score: 0.5, given, notes: ['not-minimal'] };
    return { ...base, status: 'correct', score: 1, given, notes: ['could-be-fewer'] };
  }
  return { ...base, status: 'correct', score: 1, given };
}

function gradeAsk(ex: Exercise, ask: Ask, key: AnswerKey, ans: Answer | undefined): AskResult {
  const e = key[ask.id]!;
  if (e.q === 'stack') return gradeStack(ask, e, ans);
  const base = { id: ask.id, kind: ask.kind, expected: e, notes: [] as NoteId[] };
  if (!ans || ans.value === undefined || ans.value.trim() === '') return { ...base, status: 'missing', score: 0 };
  const tol = tolerance(ask, e);
  let given: number;
  if (e.q === 'exact') {
    const v = readExact(ans);
    if (v === undefined) return { ...base, status: 'missing', score: 0 };
    if (v === null) return { ...base, status: 'invalid', score: 0 };
    given = R.toNumber(v);
    if (R.eq(v, e.exact!)) return { ...base, status: 'correct', score: 1, given };
  } else {
    const v = readValue(ask, e, ans);
    if (v === undefined) return { ...base, status: 'missing', score: 0 };
    if (v === null) return { ...base, status: 'invalid', score: 0 };
    given = v;
    if (within(v, e, tol)) return { ...base, status: 'correct', score: 1, given };
  }
  const hyps = [...hypotheses(ex.setup, ask, e), ...gaugeHypotheses(ex, ask, key)].filter((h) => Math.abs(h.value - e.value) > 1e-12);
  const hit = hyps.find((h) => (e.q === 'exact' ? Math.abs(given - h.value) < 1e-9 : Math.abs(given - h.value) <= Math.max(tol, 1e-9) + 1e-9));
  return { ...base, status: 'wrong', score: 0, given, diagnosis: hit?.id ?? 'not-identified' };
}

/** Grades every ask of an exercise; score on 0–10 weighted by exercise.weights (spec §8.4). */
export function gradeExercise(ex: Exercise, answers: Record<string, Answer>): GradeResult {
  const key = solveExercise(ex);
  const asks = ex.asks.map((a) => gradeAsk(ex, a, key, answers[a.id]));
  let acc = 0;
  let wsum = 0;
  for (const r of asks) {
    const w = ex.weights[r.id] ?? 1;
    wsum += w;
    acc += w * r.score;
  }
  return { asks, score10: wsum > 0 ? (10 * acc) / wsum : 0 };
}

/**
 * Common mistakes whose result cannot be told apart from the right answer (spec §10.3), as
 * "askId:diagnosis". Uses the grader's own hypotheses, so the generator filter and the grader
 * never diverge. Empty list = every mistake is diagnosable.
 */
export function indistinguishable(ex: Exercise): string[] {
  const key = solveExercise(ex);
  const out: string[] = [];
  for (const ask of ex.asks) {
    const e = key[ask.id]!;
    if (e.q === 'stack') continue;
    const tol = tolerance(ask, e);
    for (const h of [...hypotheses(ex.setup, ask, e), ...gaugeHypotheses(ex, ask, key)]) {
      if (Math.abs(h.value - e.value) <= 1e-12) continue; // not a mistake for these data
      if (within(h.value, e, Math.max(tol, 1e-9))) out.push(`${ask.id}:${h.id}`);
    }
  }
  return [...new Set(out)];
}
