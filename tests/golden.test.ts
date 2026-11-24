import { describe, expect, it } from 'vitest';
import golden from './golden/golden.json';
import { checkStack, classicStack, getSet, minStack } from '../src/core/gaugeBlocks';
import { eq, parse, toFixed } from '../src/core/rational';
import {
  STANDARD_MICROMETER,
  readMicrometer,
  readVernier,
  readVernierGeometric,
  simulateMicrometer,
  simulateVernier,
  vernierAppreciation,
} from '../src/core/reading';

type Case = { id: string; data: Record<string, string | number>; expected: Record<string, unknown> };
const byId = (id: string): Case => (golden.cases as unknown as Case[]).find((c) => c.id === id)!;
const str = (x: unknown) => x as string;

describe('golden — phase 1', () => {
  it('MG1 (stack part): 25.882 with the 87 set = 1.002 + 1.38 + 3.5 + 20, 4 blocks minimum', () => {
    const c = byId('MG1');
    const set = getSet(str(c.data.set));
    const target = parse(str(c.expected.hMicron));
    const expected = (c.expected.stack as string[]).map(parse);
    // A: classic method gives exactly the published stack
    const a = classicStack(target, set)!;
    expect(a.map((b) => toFixed(b, 3))).toEqual(expected.map((b) => toFixed(b, 3)));
    // B: exact minimum
    const b = minStack(target, set)!;
    expect(b.count).toBe(c.expected.minBlocks);
    expect(checkStack(b.stack, target, set).ok).toBe(true);
    // the published stack is valid for B's checker
    expect(checkStack(expected, target, set).ok).toBe(true);
  });

  it('MG5: vernier 0.02, main 23, line 17 → 23.34 (A and B)', () => {
    const c = byId('MG5');
    const v = { s: parse(str(c.data.s)), n: c.data.divisions as number, modulus: 1 as const };
    expect(toFixed(vernierAppreciation(v), 2)).toBe(c.expected.appreciation);
    const a = readVernier(v, parse(str(c.data.main)), c.data.line as number);
    expect(eq(a, parse(str(c.expected.reading)))).toBe(true);
    const view = simulateVernier(v, parse(str(c.expected.reading)));
    expect(toFixed(view.main, 0)).toBe('23');
    expect(view.line).toBe(17);
    expect(eq(readVernierGeometric(v, view), a)).toBe(true);
  });

  it('MG6: micrometer sleeve 12.5, thimble 37 → 12.87 (A and B)', () => {
    const c = byId('MG6');
    const a = readMicrometer(STANDARD_MICROMETER, parse(str(c.data.sleeve)), c.data.thimble as number);
    expect(eq(a, parse(str(c.expected.reading)))).toBe(true);
    const view = simulateMicrometer(STANDARD_MICROMETER, a);
    expect(toFixed(view.sleeve, 1)).toBe('12.5');
    expect(view.halfMark).toBe(true);
    expect(view.thimble).toBe(37);
  });
});
