/**
 * Phase 5: every UI string used by the pool and the generator exists in both languages, and
 * every pool exercise and one generated exercise per template render without throwing.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { generate, LEVELS, TEMPLATES } from '../src/core/generator';
import { gradeExercise, hypotheses } from '../src/core/grader';
import type { Exercise } from '../src/core/model';
import { solveExercise } from '../src/core/solve';
import { POOL } from '../src/data/pool';
import { DICT, LangContext } from '../src/i18n';
import { askLabel, exerciseTitle, unitsFor } from '../src/ui/describe';
import { PracticeExercise } from '../src/ui/PracticeExercise';
import { solutionLines } from '../src/ui/solution';

const generated = TEMPLATES.flatMap((t) => LEVELS[t].map((lv) => generate(t, 7, lv).exercise));
const all: Exercise[] = [...POOL, ...generated];

function keysOf(ex: Exercise): string[] {
  const k: string[] = [];
  const t = (key: string) => {
    k.push(key);
    return key;
  };
  exerciseTitle(ex, t);
  if (ex.origin !== 'generated') t(`poolNote.${ex.id}`);
  const key = solveExercise(ex);
  for (const a of ex.asks) {
    askLabel(a, t);
    for (const u of unitsFor(key[a.id]!)) t(`unit.${u}`);
    for (const h of hypotheses(ex.setup, a, key[a.id]!)) t(`diag.${h.id}`);
  }
  // instrument setups show the picture, not a data list
  if (ex.setup.kind !== 'vernier' && ex.setup.kind !== 'micrometer')
    for (const [f, v] of Object.entries(ex.setup)) if (!['kind', 'plane', 'given', 'material', 'thread', 'feature', 'dovetail'].includes(f) && v !== undefined) t(`data.${f}`);
  if ('set' in ex.setup && ex.setup.set) t(`set.${ex.setup.set}`);
  if (ex.setup.kind === 'temperature') t(`material.${ex.setup.material ?? 'steel'}`);
  solutionLines(ex, key, t);
  return k;
}

describe('UI strings', () => {
  it('eu and es have the same keys', () => {
    expect(Object.keys(DICT.es).sort()).toEqual(Object.keys(DICT.eu).sort());
  });
  it('every key used by the pool and the generator exists', () => {
    const missing = new Set<string>();
    for (const ex of all) for (const k of keysOf(ex)) if (!(k in DICT.eu)) missing.add(k);
    for (const d of ['stack-not-in-set', 'stack-sum', 'stack-repeated', 'gauge-swapped', 'gauge-nominal', 'not-identified']) if (!(`diag.${d}` in DICT.eu)) missing.add(`diag.${d}`);
    expect([...missing]).toEqual([]);
  });
});

describe('practice screen renders', () => {
  it('every pool exercise and one generated exercise per template, in both languages', () => {
    for (const lang of ['eu', 'es'] as const) {
      for (const ex of POOL) {
        const html = renderToStaticMarkup(createElement(LangContext.Provider, { value: lang }, createElement(PracticeExercise, { source: { kind: 'pool', id: ex.id } })));
        expect(html, ex.id).toContain(ex.text[lang].slice(0, 20));
        expect(/NaN|undefined/.test(html), ex.id).toBe(false);
      }
      for (const ex of generated) {
        const html = renderToStaticMarkup(
          createElement(LangContext.Provider, { value: lang }, createElement(PracticeExercise, { source: { kind: 'generated', template: ex.template!, level: ex.difficulty, seed: 7 } })),
        );
        expect(/NaN|undefined/.test(html), ex.id).toBe(false);
      }
    }
  });
  it('grading an empty form marks everything missing (never wrong)', () => {
    for (const ex of all) for (const r of gradeExercise(ex, {}).asks) expect(r.status, ex.id).toBe('missing');
  });
});
