import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generate, signature } from '../src/core/generator';
import type { Exercise } from '../src/core/model';
import { verifyExercise } from '../src/core/generator/verify';
import { POOL } from '../src/data/pool';
import type { TemplateId } from '../src/core/generator';

describe('pool (spec §9)', () => {
  it('ids are unique and every entry has eu/es text and a review status', () => {
    expect(new Set(POOL.map((e) => e.id)).size).toBe(POOL.length);
    for (const e of POOL) {
      expect(e.text.eu.length, e.id).toBeGreaterThan(20);
      expect(e.text.es.length, e.id).toBeGreaterThan(20);
      expect(['approved', 'review-needed']).toContain(e.status);
      if (e.origin !== 'generated') expect(e.sourceNote, e.id).toBeTruthy();
    }
  });

  it('starts with the hand-modelled entries of pool-ope.json, unchanged', () => {
    const ope = JSON.parse(readFileSync('src/data/pool-ope.json', 'utf8')) as Exercise[];
    expect(POOL.slice(0, ope.length)).toEqual(ope);
  });

  it('pinned generated entries are exactly what the generator builds (seed 1)', () => {
    for (const e of POOL.filter((x) => x.origin === 'generated')) {
      const g = generate(e.template as TemplateId, 1, e.difficulty).exercise;
      expect(signature(g), e.id).toBe(signature(e));
      expect(g.text).toEqual(e.text);
    }
  });

  it('every entry passes verification (A = B, global checks, diagnosable mistakes)', () => {
    for (const e of POOL) expect(verifyExercise(e).problems, e.id).toEqual([]);
  });

  it('includes the OPE exercises found in the research (spec §9.2)', () => {
    const ids = POOL.map((e) => e.id);
    for (const id of ['ope-euskadi-2020-2', 'ope-euskadi-2022-b', 'ope-madrid-2025-4', 'ope-madrid-2023-2-6', 'ope-aragon-2024-b2-2', 'adapted-andalucia-2023-4-2']) expect(ids).toContain(id);
  });
});
