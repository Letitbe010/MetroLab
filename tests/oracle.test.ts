/**
 * Compares solvers A and B with the Python oracle (tools/oracle/oracle.py).
 * Locally the test is skipped when the oracle output is missing; in CI ORACLE_REQUIRED=1 makes it fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkStack, classicStack, getSet, minStack } from '../src/core/gaugeBlocks';
import { eq, parse } from '../src/core/rational';
import {
  STANDARD_MICROMETER,
  VERNIER_MICROMETER,
  readMicrometer,
  readVernier,
  readVernierGeometric,
  simulateMicrometer,
  simulateVernier,
} from '../src/core/reading';

const OUT = 'tools/oracle/out/oracle.json';
const required = process.env.ORACLE_REQUIRED === '1';
const present = existsSync(OUT);

interface Reading {
  id: string;
  kind: 'vernier' | 'micrometer';
  s?: string;
  n?: number;
  main?: string;
  line?: number;
  sleeve?: string;
  thimble?: number;
  vernier?: number;
  vdivs?: number;
  value: string;
}
interface Stack {
  id: string;
  set: string;
  target: string;
  min: number | null;
  stack: string[] | null;
}

describe.skipIf(!present && !required)('Python oracle', () => {
  const data = present ? (JSON.parse(readFileSync(OUT, 'utf8')) as { readings: Reading[]; stacks: Stack[] }) : { readings: [], stacks: [] };

  it('oracle output exists', () => {
    expect(present).toBe(true);
    expect(data.readings.length).toBeGreaterThan(600);
    expect(data.stacks.length).toBeGreaterThan(150);
  });

  it('readings: A and B agree with the oracle', () => {
    for (const r of data.readings) {
      const value = parse(r.value);
      if (r.kind === 'vernier') {
        const v = { s: parse(r.s!), n: r.n!, modulus: 1 as const };
        expect(eq(readVernier(v, parse(r.main!), r.line!), value), r.id).toBe(true);
        const view = simulateVernier(v, value);
        expect([view.line, eq(view.main, parse(r.main!)), eq(readVernierGeometric(v, view), value)], r.id).toEqual([r.line, true, true]);
      } else {
        const m = r.vdivs ? VERNIER_MICROMETER : STANDARD_MICROMETER;
        expect(eq(readMicrometer(m, parse(r.sleeve!), r.thimble!, r.vernier ?? 0), value), r.id).toBe(true);
        const view = simulateMicrometer(m, value);
        expect([eq(view.sleeve, parse(r.sleeve!)), view.thimble, view.vernier], r.id).toEqual([true, r.thimble, r.vernier ?? 0]);
      }
    }
  });

  it('gauge stacks: B minimum = oracle minimum; A, when found, is valid and never below it', () => {
    for (const s of data.stacks) {
      const set = getSet(s.set);
      const target = parse(s.target);
      const b = minStack(target, set);
      if (s.min === null) {
        // oracle searched up to 6 blocks: B must find nothing, or need more than 6
        expect(b === null || b.count > 6, s.id).toBe(true);
      } else {
        expect(b?.count, s.id).toBe(s.min);
        expect(checkStack(s.stack!.map(parse), target, set).ok, s.id).toBe(true);
      }
      const a = classicStack(target, set);
      if (a) {
        expect(checkStack(a, target, set).ok, s.id).toBe(true);
        expect(a.length, s.id).toBeGreaterThanOrEqual(b!.count);
      }
    }
  });
});
