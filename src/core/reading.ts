/**
 * Instrument readings (spec §3): vernier caliper and micrometer.
 *
 * Solver A is the closed formula (reading = main + k · a).
 * Solver B simulates the scales: it draws every mark as an exact rational position and
 * finds the coincident line, i.e. what the user actually sees. The property
 * "simulate(x) then read with A = x" ties both together (spec §5.2, §11.1).
 */
import { add, div, eq, floor, isInteger, mul, q, sub, type Rational } from './rational';

// ---------------------------------------------------------------- vernier caliper

export interface VernierSpec {
  /** Main-scale division, mm (usually 1). */
  s: Rational;
  /** Number of vernier divisions n (10, 20, 50). */
  n: number;
  /** Modulus γ: the vernier spans (γ·n − 1)·s. 1 = normal, 2 = extended (easier to read). */
  modulus: 1 | 2;
}

/** Appreciation (resolution) a = s / n. Independent of the modulus. */
export const vernierAppreciation = (v: VernierSpec): Rational => div(v.s, q(v.n));

/** Spacing of the vernier marks: g = ((γ·n − 1)·s) / n = γ·s − a. */
export const vernierSpacing = (v: VernierSpec): Rational => div(mul(q(v.modulus * v.n - 1), v.s), q(v.n));

/** Solver A: reading = main + k · a. */
export function readVernier(v: VernierSpec, main: Rational, line: number): Rational {
  if (!Number.isInteger(line) || line < 0 || line >= v.n) throw new RangeError(`vernier line ${line} outside 0..${v.n - 1}`);
  return add(main, mul(q(line), vernierAppreciation(v)));
}

export interface VernierView {
  /** Last main-scale mark at or before the vernier zero (what the user reads on the main scale). */
  main: Rational;
  /** Index of the vernier line that coincides with a main-scale mark. */
  line: number;
  /** Position of the main-scale mark that the coincident line meets. */
  coincidentMark: Rational;
}

/**
 * Solver B: place the vernier zero at x, draw marks, find the coincidence.
 * Throws when x is not a multiple of the appreciation (no line coincides exactly).
 */
export function simulateVernier(v: VernierSpec, x: Rational): VernierView {
  const g = vernierSpacing(v);
  const main = mul(q(floor(div(x, v.s))), v.s);
  for (let j = 0; j < v.n; j++) {
    const pos = add(x, mul(q(j), g));
    if (isInteger(div(pos, v.s))) return { main, line: j, coincidentMark: pos };
  }
  throw new RangeError('no vernier line coincides: value is not a multiple of the appreciation');
}

/** Solver B's own reading from the picture: the coincident mark minus j vernier spacings. */
export function readVernierGeometric(v: VernierSpec, view: VernierView): Rational {
  return sub(view.coincidentMark, mul(q(view.line), vernierSpacing(v)));
}

// ---------------------------------------------------------------- micrometer

export interface MicrometerSpec {
  /** Spindle pitch, mm (0.5). */
  pitch: Rational;
  /** Thimble divisions (50). */
  thimbleDivs: number;
  /** Vernier divisions on the sleeve (10 → 0.001 mm), or 0 when there is none. */
  vernierDivs: number;
}

export const STANDARD_MICROMETER: MicrometerSpec = { pitch: q(1, 2), thimbleDivs: 50, vernierDivs: 0 };
export const VERNIER_MICROMETER: MicrometerSpec = { pitch: q(1, 2), thimbleDivs: 50, vernierDivs: 10 };

/** Value of one thimble division: pitch / N (0.01 mm). */
export const thimbleValue = (m: MicrometerSpec): Rational => div(m.pitch, q(m.thimbleDivs));

/** Resolution of the instrument. */
export const micrometerResolution = (m: MicrometerSpec): Rational =>
  m.vernierDivs > 0 ? div(thimbleValue(m), q(m.vernierDivs)) : thimbleValue(m);

/** Solver A: sleeve (incl. the 0.5 mm mark) + thimble · c + vernier · c/10. */
export function readMicrometer(m: MicrometerSpec, sleeve: Rational, thimble: number, vernier = 0): Rational {
  if (!isInteger(div(sleeve, m.pitch))) throw new RangeError('sleeve reading must be a multiple of the pitch');
  if (!Number.isInteger(thimble) || thimble < 0 || thimble >= m.thimbleDivs) throw new RangeError('thimble line out of range');
  if (!Number.isInteger(vernier) || vernier < 0 || vernier >= Math.max(1, m.vernierDivs)) throw new RangeError('vernier line out of range');
  let r = add(sleeve, mul(q(thimble), thimbleValue(m)));
  if (m.vernierDivs > 0) r = add(r, mul(q(vernier), div(thimbleValue(m), q(m.vernierDivs))));
  return r;
}

export interface MicrometerView {
  /** Last visible sleeve mark (whole mm or half mm). */
  sleeve: Rational;
  /** True when that mark is a half-millimetre mark (lower row). */
  halfMark: boolean;
  thimble: number;
  vernier: number;
}

/**
 * Solver B: spindle at x. The thimble has turned x / pitch revolutions; the sleeve shows
 * the last mark it uncovered; the thimble line under the reference line is the integer part
 * of the fractional turn · N; the vernier line that coincides is found by drawing the
 * vernier marks (spacing (V−1)/V thimble divisions) against the thimble marks.
 */
export function simulateMicrometer(m: MicrometerSpec, x: Rational): MicrometerView {
  const turns = div(x, m.pitch);
  const whole = floor(turns);
  const sleeve = mul(q(whole), m.pitch);
  const halfMark = !isInteger(sleeve);
  const frac = mul(sub(turns, q(whole)), q(m.thimbleDivs)); // in thimble divisions, [0, N)
  const thimble = Number(floor(frac));
  const rest = sub(frac, q(thimble)); // fraction of one thimble division
  let vernier = 0;
  if (m.vernierDivs > 0) {
    const V = m.vernierDivs;
    const spacing = q(V - 1, V); // vernier marks, in thimble divisions
    let found = -1;
    for (let j = 0; j < V; j++) {
      // vernier line j sits j·spacing above the reference; the thimble marks are at k − rest.
      if (isInteger(add(mul(q(j), spacing), rest))) {
        found = j;
        break;
      }
    }
    if (found < 0) throw new RangeError('no vernier line coincides: value is not a multiple of the resolution');
    vernier = found;
  } else if (!eq(rest, q(0))) {
    throw new RangeError('value is not a multiple of the thimble division');
  }
  return { sleeve, halfMark, thimble, vernier };
}
