import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GAUGE_SETS, blocks, checkStack, classicStack, getSet, minStack } from '../src/core/gaugeBlocks';
import { cmp, parse, sum, toFixed } from '../src/core/rational';

const S87 = getSet('87');
const S112 = getSet('112');

describe('gauge sets data', () => {
  it('87 and 112 sets have the documented compositions', () => {
    expect(S87.blocks).toHaveLength(87);
    expect(S112.blocks).toHaveLength(112);
    const f = (xs: typeof S87.blocks) => xs.map((b) => toFixed(b, 4));
    expect(f(S87.blocks)).toContain('1.0010');
    expect(f(S87.blocks)).not.toContain('1.0005');
    expect(f(S112.blocks)).toContain('1.0005');
    expect(f(S87.blocks)).toContain('9.5000');
    expect(f(S87.blocks)).not.toContain('10.5000');
    expect(f(S112.blocks)).toContain('24.5000');
    // no duplicates in either set
    for (const s of Object.values(GAUGE_SETS)) expect(new Set(f(s.blocks)).size).toBe(s.blocks.length);
  });
});

describe('stack checker', () => {
  it('flags wrong sum, blocks outside the set and repetitions', () => {
    const t = parse('25.882');
    expect(checkStack(blocks(['1.002', '1.38', '3.5', '20']), t, S87).ok).toBe(true);
    expect(checkStack(blocks(['1.002', '1.38', '3.5', '10', '10']), t, S87).problems).toEqual(['repeated']);
    expect(checkStack(blocks(['1.002', '1.38', '23.5']), t, S87).problems).toEqual(['notInSet']);
    expect(checkStack(blocks(['1.002', '1.38', '3.5', '30']), t, S87).problems).toEqual(['sum']);
    expect(checkStack([], t, S87).problems).toEqual(['empty', 'sum']);
  });
});

describe('solvers A (classic) and B (exact DP)', () => {
  it('classic examples', () => {
    const show = (t: string, set = S87) => classicStack(parse(t), set)?.map((b) => toFixed(b, 4));
    expect(show('41.125')).toEqual(['1.0050', '1.1200', '9.0000', '30.0000']);
    expect(show('10')).toEqual(['10.0000']);
    expect(show('125')).toEqual(['5.0000', '20.0000', '100.0000']);
    expect(show('58.6375', S112)).toEqual(['1.0005', '1.0070', '1.1300', '5.5000', '50.0000']);
  });

  it('impossible targets', () => {
    expect(minStack(parse('0.7'), S87)).toBeNull();
    expect(minStack(parse('1.2345'), S87)).toBeNull(); // finer than the set
    expect(classicStack(parse('0.7'), S87)).toBeNull();
  });

  it('B beats or equals A where A is not minimal', () => {
    // 2.5: classic → 2.5 (1 block); 1.5 is also one block.
    expect(minStack(parse('2.5'), S87)!.count).toBe(1);
    // 560: classic gets stuck (all tens used), B finds a stack.
    expect(classicStack(parse('560'), S87)).toBeNull();
    expect(minStack(parse('560'), S87)).not.toBeNull();
  });

  it('property: for any sum of distinct blocks, A (if found) and B are valid and B ≤ A ≤ subset size (2 000 cases)', () => {
    for (const set of [S87, S112]) {
      fc.assert(
        fc.property(fc.uniqueArray(fc.integer({ min: 0, max: set.blocks.length - 1 }), { minLength: 1, maxLength: 5 }), (idx) => {
          const chosen = idx.map((i) => set.blocks[i]!);
          const target = sum(chosen);
          const b = minStack(target, set);
          if (!b) return false;
          if (!checkStack(b.stack, target, set).ok || b.count > chosen.length || b.count !== b.stack.length) return false;
          const a = classicStack(target, set);
          if (a && (!checkStack(a, target, set).ok || a.length < b.count)) return false;
          return true;
        }),
        { numRuns: 1000 },
      );
    }
  });

  it('A stack is sorted ascending', () => {
    const a = classicStack(parse('73.456'), S87)!;
    for (let i = 1; i < a.length; i++) expect(cmp(a[i - 1]!, a[i]!)).toBeLessThan(0);
  });
});
