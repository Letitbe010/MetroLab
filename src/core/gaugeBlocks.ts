/**
 * Gauge block stacks (spec §3, §5.2).
 *
 * Solver A — the classic workshop method: start from the last decimal and, family by family
 * (finest step first), pick the block that makes the remainder a multiple of the next
 * family's step; the coarsest family is filled largest-first.
 * Solver B — exact minimum: 0/1 knapsack over integer units (dynamic programming), with
 * reconstruction. B also checks validity (exact sum, blocks of the set, no repetition).
 */
import setsData from '../data/gaugeSets.json';
import { add, cmp, div, eq, isInteger, parse, q, sub, sum, toString, type Rational } from './rational';

export interface Series {
  from: Rational;
  to: Rational;
  step: Rational;
}

export interface GaugeSet {
  id: string;
  name: { eu: string; es: string };
  source: string;
  sourceUrl: string;
  series: Series[];
  /** Every block (with multiplicity), ascending. */
  blocks: Rational[];
}

function expand(series: Series[]): Rational[] {
  const out: Rational[] = [];
  for (const s of series) {
    for (let v = s.from; cmp(v, s.to) <= 0; v = add(v, s.step)) out.push(v);
  }
  return out.sort(cmp);
}

interface RawSet {
  id: string;
  count: number;
  name: { eu: string; es: string };
  source: string;
  sourceUrl: string;
  series: { from: string; to: string; step: string }[];
}

export const GAUGE_SETS: Record<string, GaugeSet> = Object.fromEntries(
  (setsData.sets as RawSet[]).map((r) => {
    const series = r.series.map((s) => ({ from: parse(s.from), to: parse(s.to), step: parse(s.step) }));
    const blocks = expand(series);
    if (blocks.length !== r.count) throw new Error(`gauge set ${r.id}: ${blocks.length} blocks, expected ${r.count}`);
    return [r.id, { id: r.id, name: r.name, source: r.source, sourceUrl: r.sourceUrl, series, blocks }];
  }),
);

export function getSet(id: string): GaugeSet {
  const s = GAUGE_SETS[id];
  if (!s) throw new Error(`unknown gauge set ${id}`);
  return s;
}

const key = (r: Rational): string => toString(r);

function multiplicity(set: GaugeSet): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of set.blocks) m.set(key(b), (m.get(key(b)) ?? 0) + 1);
  return m;
}

// ---------------------------------------------------------------- validity (used by both and by the grader)

export type StackProblem = 'sum' | 'notInSet' | 'repeated' | 'empty';

export interface StackCheck {
  ok: boolean;
  total: Rational;
  problems: StackProblem[];
  /** Blocks not in the set, and blocks used more times than the set holds. */
  notInSet: Rational[];
  repeated: Rational[];
}

export function checkStack(stack: Rational[], target: Rational, set: GaugeSet): StackCheck {
  const have = multiplicity(set);
  const used = new Map<string, number>();
  const notInSet: Rational[] = [];
  const repeated: Rational[] = [];
  for (const b of stack) {
    const k = key(b);
    const n = (used.get(k) ?? 0) + 1;
    used.set(k, n);
    const cap = have.get(k) ?? 0;
    if (cap === 0) {
      if (n === 1) notInSet.push(b);
    } else if (n === cap + 1) repeated.push(b);
  }
  const total = sum(stack);
  const problems: StackProblem[] = [];
  if (stack.length === 0) problems.push('empty');
  if (!eq(total, target)) problems.push('sum');
  if (notInSet.length) problems.push('notInSet');
  if (repeated.length) problems.push('repeated');
  return { ok: problems.length === 0, total, problems, notInSet, repeated };
}

// ---------------------------------------------------------------- solver A: classic method

/**
 * Classic method. Families are the set's series sorted by step (finest first); for each family
 * whose step is finer than the next family's, choose the block b with remainder − b ≡ 0
 * (mod next step); several candidates → the smallest. The coarsest family is filled
 * largest-first. Returns null when the method gets stuck (the target may still be feasible:
 * solver B decides that).
 */
export function classicStack(target: Rational, set: GaugeSet): Rational[] | null {
  const families = [...set.series].sort((a, b) => cmp(a.step, b.step));
  let rest = target;
  const out: Rational[] = [];
  const used = new Map<string, number>();
  const have = multiplicity(set);
  const take = (b: Rational) => {
    out.push(b);
    used.set(key(b), (used.get(key(b)) ?? 0) + 1);
    rest = sub(rest, b);
  };
  const free = (b: Rational) => (used.get(key(b)) ?? 0) < (have.get(key(b)) ?? 0);
  for (let i = 0; i < families.length - 1; i++) {
    const fam = families[i]!;
    const next = families[i + 1]!.step;
    if (isInteger(div(rest, next))) continue; // nothing to fix at this decimal
    let chosen: Rational | null = null;
    for (let b = fam.from; cmp(b, fam.to) <= 0; b = add(b, fam.step)) {
      if (cmp(b, rest) <= 0 && free(b) && isInteger(div(sub(rest, b), next))) {
        chosen = b;
        break;
      }
    }
    if (!chosen) return null;
    take(chosen);
  }
  // Coarsest family: largest block first, without repeating.
  const last = families[families.length - 1]!;
  for (let b = last.to; cmp(b, last.from) >= 0 && cmp(rest, q(0)) > 0; b = sub(b, last.step)) {
    if (cmp(b, rest) <= 0 && free(b)) take(b);
  }
  if (cmp(rest, q(0)) !== 0) return null;
  return out.sort((a, b) => cmp(a, b));
}

// ---------------------------------------------------------------- solver B: exact minimum (DP)

const UNIT = q(1, 10000); // 0.1 µm: every block of the sets is a multiple of it

function toUnits(r: Rational): number | null {
  const u = div(r, UNIT);
  if (!isInteger(u)) return null;
  const n = Number(u.n);
  return Number.isSafeInteger(n) ? n : null;
}

function gcdInt(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export interface MinStackResult {
  /** Minimum number of blocks. */
  count: number;
  /** One minimum stack, ascending. */
  stack: Rational[];
}

/** Exact minimum-block stack, or null when the target cannot be built with the set. */
export function minStack(target: Rational, set: GaugeSet): MinStackResult | null {
  const units = set.blocks.map((b) => toUnits(b)!);
  const g = units.reduce(gcdInt, 0);
  const tu = toUnits(target);
  if (tu === null || tu <= 0 || tu % g !== 0) return null;
  const T = tu / g;
  const vals = units.map((u) => u / g);
  if (T > 5_000_000) throw new RangeError('target too large for the DP');
  const INF = 255;
  const dp = new Uint8Array(T + 1).fill(INF);
  dp[0] = 0;
  const took: Uint8Array[] = []; // bitsets: item i improved state s
  for (const v of vals) {
    const bits = new Uint8Array((T >> 3) + 1);
    for (let s = T; s >= v; s--) {
      const c = dp[s - v]! + 1;
      if (c < dp[s]!) {
        dp[s] = c;
        bits[s >> 3]! |= 1 << (s & 7);
      }
    }
    took.push(bits);
  }
  if (dp[T] === INF) return null;
  const stack: Rational[] = [];
  let s = T;
  for (let i = vals.length - 1; i >= 0 && s > 0; i--) {
    if ((took[i]![s >> 3]! >> (s & 7)) & 1) {
      stack.push(set.blocks[i]!);
      s -= vals[i]!;
    }
  }
  if (s !== 0) throw new Error('DP reconstruction failed');
  return { count: dp[T]!, stack: stack.sort(cmp) };
}

/** Convenience for tests and UI: decimal strings → Rationals. */
export const blocks = (xs: string[]): Rational[] => xs.map(parse);
