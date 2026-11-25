/**
 * Phase 6 (spec §15): worked exercises are built on verified pool exercises, have the three
 * layers for every ask in both languages, and their prose carries no hard-coded numbers of the
 * exercise (every number of a step comes from the solvers).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LEVELS, TEMPLATES, type TemplateId } from '../src/core/generator';
import { verifyExercise } from '../src/core/generator/verify';
import { DICT, LangContext, translate } from '../src/i18n';
import { WORKED, workedExercise, workedSteps } from '../src/ui/worked';
import { WorkedList, WorkedView } from '../src/ui/WorkedView';

/** Generic constants that may appear in explanations (formula constants, the 20 °C reference, standards). */
const GENERIC = new Set(['0', '1', '2', '3', '20', '50', '0,5', '0,01', '286']);

describe('worked exercises (spec §15)', () => {
  it('at least the 10 of §15.1, each on a verified pool exercise, with a valid "now you" template', () => {
    expect(WORKED.length).toBeGreaterThanOrEqual(10);
    for (const w of WORKED) {
      const ex = workedExercise(w);
      expect(verifyExercise(ex, { requireClassic: false }).problems, w.id).toEqual([]);
      expect(TEMPLATES).toContain(w.now.template);
      expect(LEVELS[w.now.template as TemplateId]).toContain(w.now.level);
    }
    const kinds = new Set(WORKED.map((w) => workedExercise(w).setup.kind));
    for (const k of ['vernier', 'micrometer', 'gaugeStack', 'sineBar', 'taperRollers', 'taperBalls', 'threeWire', 'dovetail', 'temperature', 'fixedGauge']) expect(kinds).toContain(k);
  });

  it('title, introduction and a "why" for every ask exist in eu and es', () => {
    for (const w of WORKED) {
      const keys = [`wk.${w.id}.title`, `wk.${w.id}.intro`, ...workedExercise(w).asks.map((a) => `wk.${w.id}.why.${a.id}`)];
      for (const k of keys) {
        expect(DICT.eu[k], k).toBeTruthy();
        expect(DICT.es[k], k).toBeTruthy();
      }
    }
  });

  it('every ask step has formulas with numbers (from the solver) and an explanation', () => {
    for (const lang of ['eu', 'es'] as const) {
      const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
      for (const w of WORKED) {
        const steps = workedSteps(w, t);
        expect(steps.length, w.id).toBe(workedExercise(w).asks.length + 1);
        for (const s of steps.slice(1)) {
          expect(s.what.length, `${w.id} ${s.askId}`).toBeGreaterThan(0);
          expect(s.what.some((l) => /\d/.test(l.text)), `${w.id} ${s.askId}`).toBe(true);
          expect(s.why.length).toBeGreaterThan(40);
        }
      }
    }
  });

  it('no hard-coded numbers in the prose (spec §15.3)', () => {
    for (const lang of ['eu', 'es'] as const) {
      for (const w of WORKED) {
        const keys = [`wk.${w.id}.intro`, ...workedExercise(w).asks.map((a) => `wk.${w.id}.why.${a.id}`)];
        for (const k of keys) {
          const nums = DICT[lang][k]!.match(/\d+(?:,\d+)?/g) ?? [];
          const bad = nums.filter((x) => !GENERIC.has(x));
          expect(bad, `${lang} ${k}`).toEqual([]);
        }
      }
    }
  });

  it('list and every worked exercise render in eu and es', () => {
    for (const lang of ['eu', 'es'] as const) {
      const wrap = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(LangContext.Provider, { value: lang }, el));
      expect(wrap(createElement(WorkedList))).toContain(DICT[lang]['worked.title']!);
      for (const w of WORKED) {
        const html = wrap(createElement(WorkedView, { id: w.id }));
        expect(html, w.id).toContain(DICT[lang][`wk.${w.id}.title`]!.replace(/"/g, '&quot;'));
        expect(/NaN|undefined/.test(html), w.id).toBe(false);
      }
    }
  });
});
