import { describe, expect, it } from 'vitest';
import { generate, LEVELS, TEMPLATES, rebuild, signature } from '../src/core/generator';
import { gradeExercise } from '../src/core/grader';
import { solveExercise } from '../src/core/solve';
import { answerFor } from './helpers';

const COMBOS = TEMPLATES.flatMap((t) => LEVELS[t].map((lv) => [t, lv] as const));

describe('generator (spec §10)', () => {
  it('same seed → same exercise; the stored seed rebuilds it', () => {
    for (const [t, lv] of COMBOS) {
      const a = generate(t, 42, lv).exercise;
      const b = generate(t, 42, lv).exercise;
      expect(signature(a)).toBe(signature(b));
      expect(signature(rebuild(t, a.seed!, lv))).toBe(signature(a));
    }
  });

  it('10 000 generated exercises: verified (A = B, global checks, diagnosable) and graded 10/10 with their key', () => {
    let count = 0;
    const seen = new Set<string>();
    for (let i = 0; count < 10_000; i++) {
      const [t, lv] = COMBOS[i % COMBOS.length]!;
      const { exercise } = generate(t, 1000 + i, lv);
      const key = solveExercise(exercise);
      const answers = Object.fromEntries(exercise.asks.map((a) => [a.id, answerFor(key[a.id]!, a.kind)]));
      const g = gradeExercise(exercise, answers);
      if (Math.abs(g.score10 - 10) > 1e-9) throw new Error(`${exercise.id}: ${JSON.stringify(g.asks.filter((x) => x.status !== 'correct'))}`);
      seen.add(signature(exercise));
      count++;
    }
    expect(count).toBe(10_000);
    // variety: almost all exercises differ
    expect(seen.size).toBeGreaterThan(8_000);
  }, 600_000);
});
