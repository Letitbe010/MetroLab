/**
 * Limit (fixed) gauges and Taylor's principle (spec §3).
 *   GO ("pasa") side = maximum material limit: hole → D_min, shaft → d_max.
 *   NO-GO ("ez pasa") side = least material limit: hole → D_max, shaft → d_min.
 * Limits come from the ISO 286 subset (src/data/iso286_subset.json) or are given in the statement.
 *
 * Solver A reads the deviations from the tables (es/ei rules); solver B derives GO/NO-GO from
 * the material condition (which limit leaves more material), and the oracle recomputes the
 * limits independently.
 */
import iso from '../data/iso286_subset.json';
import { add, cmp, div, parse, q, sub, type Rational } from './rational';

export type Feature = 'hole' | 'shaft';

export interface Limits {
  feature: Feature;
  nominal: Rational;
  /** Upper and lower limits of size, mm. */
  max: Rational;
  min: Rational;
  /** Deviations in µm. */
  upperDev: number;
  lowerDev: number;
  IT: number;
}

export interface Designation {
  nominal: Rational;
  letter: string;
  grade: number;
  feature: Feature;
}

/** "23f6", "Ø40 H7", "40H7" → parts. Throws on anything else. */
export function parseDesignation(text: string): Designation {
  const m = /^\s*(?:Ø|ø|⌀)?\s*(\d+(?:[.,]\d+)?)\s*([A-Za-z]{1,2})\s*(\d{1,2})\s*$/.exec(text);
  if (!m) throw new SyntaxError(`invalid ISO designation "${text}"`);
  const letter = m[2]!;
  const feature: Feature = letter === letter.toUpperCase() ? 'hole' : 'shaft';
  return { nominal: parse(m[1]!), letter, grade: Number(m[3]), feature };
}

const RANGES = iso.ranges;

/** Index of the ISO size range (above, up to] that contains the nominal size. */
export function rangeIndex(nominal: Rational): number {
  if (cmp(nominal, q(0)) <= 0) throw new RangeError('nominal size must be positive');
  const i = RANGES.findIndex((up) => cmp(nominal, q(up)) <= 0);
  if (i < 0) throw new RangeError(`nominal size above ${RANGES[RANGES.length - 1]} mm is not in the subset`);
  return i;
}

export function itValue(grade: number, range: number): number {
  const row = (iso.IT as Record<string, number[]>)[String(grade)];
  if (!row) throw new RangeError(`IT${grade} is not in the subset`);
  return row[range]!;
}

const UPPER = iso.shaftUpper as unknown as Record<string, number[]>;
const LOWER = iso.shaftLower as unknown as Record<string, number[]>;

/** Shaft deviations (µm). */
function shaftDeviations(letter: string, grade: number, r: number): { es: number; ei: number } {
  const IT = itValue(grade, r);
  if (letter in UPPER && letter !== '_comment') {
    const es = UPPER[letter]![r]!;
    return { es, ei: es - IT };
  }
  if (letter in LOWER && letter !== '_comment') {
    const ei = letter === 'k' && (grade < 4 || grade > 7) ? 0 : LOWER[letter]![r]!;
    return { es: ei + IT, ei };
  }
  throw new RangeError(`shaft position "${letter}" is not in the subset`);
}

/** Hole deviations (µm): positions D..H only, by the general rule EI = −es. */
function holeDeviations(letter: string, grade: number, r: number): { ES: number; EI: number } {
  const lower = letter.toLowerCase();
  if (!['d', 'e', 'f', 'g', 'h'].includes(lower)) throw new RangeError(`hole position "${letter}" is not in the subset`);
  const IT = itValue(grade, r);
  const EI = -UPPER[lower]![r]!;
  return { EI, ES: EI + IT };
}

const um = (x: number): Rational => div(q(x), q(1000));

export function limitsFromDesignation(text: string): Limits {
  const d = parseDesignation(text);
  const r = rangeIndex(d.nominal);
  const IT = itValue(d.grade, r);
  if (d.feature === 'shaft') {
    const { es, ei } = shaftDeviations(d.letter, d.grade, r);
    return { feature: 'shaft', nominal: d.nominal, max: add(d.nominal, um(es)), min: add(d.nominal, um(ei)), upperDev: es, lowerDev: ei, IT };
  }
  const { ES, EI } = holeDeviations(d.letter, d.grade, r);
  return { feature: 'hole', nominal: d.nominal, max: add(d.nominal, um(ES)), min: add(d.nominal, um(EI)), upperDev: ES, lowerDev: EI, IT };
}

export interface GaugeSizes {
  go: Rational;
  noGo: Rational;
  /** Plug gauge for holes, ring/snap gauge for shafts. */
  gauge: 'plug' | 'snap';
}

/** A: Taylor's rule as stated. */
export function gaugeSizesA(feature: Feature, max: Rational, min: Rational): GaugeSizes {
  if (cmp(max, min) < 0) throw new RangeError('max < min');
  return feature === 'hole' ? { go: min, noGo: max, gauge: 'plug' } : { go: max, noGo: min, gauge: 'snap' };
}

/**
 * B: material condition. For a hole the material is the plate around it, so material grows as
 * the size shrinks; for a shaft it grows with the size. GO = the limit with more material.
 */
export function gaugeSizesB(feature: Feature, a: Rational, b: Rational): GaugeSizes {
  const material = (size: Rational) => (feature === 'hole' ? sub(q(0), size) : size);
  const [mmc, lmc] = cmp(material(a), material(b)) >= 0 ? [a, b] : [b, a];
  return { go: mmc, noGo: lmc, gauge: feature === 'hole' ? 'plug' : 'snap' };
}
