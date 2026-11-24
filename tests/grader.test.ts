import { describe, expect, it } from 'vitest';
import { gradeExercise, hypotheses, parseAngle, tolerance, type Answer } from '../src/core/grader';
import type { Exercise } from '../src/core/model';
import { solveExercise } from '../src/core/solve';
import { POOL, poolById } from '../src/data/pool';
import { answerFor, typed } from './helpers';

const ex = (id: string): Exercise => poolById(id)!;
const one = (e: Exercise, askId: string, a: Answer) => gradeExercise(e, { [askId]: a }).asks.find((x) => x.id === askId)!;

describe('grader: right answers', () => {
  it('every pool exercise answered with its key scores 10/10', () => {
    for (const e of POOL) {
      const key = solveExercise(e);
      const answers = Object.fromEntries(e.asks.map((a) => [a.id, answerFor(key[a.id]!, a.kind)]));
      const g = gradeExercise(e, answers);
      expect(g.score10, e.id + JSON.stringify(g.asks.filter((x) => x.status !== 'correct'))).toBeCloseTo(10, 9);
    }
  });

  it('golden values as a user writes them', () => {
    expect(one(ex('spec-mg5'), 'reading', { value: '23,34' }).status).toBe('correct');
    expect(one(ex('spec-mg5'), 'appr', { value: '0,02' }).status).toBe('correct');
    expect(one(ex('spec-mg6'), 'reading', { value: '12,870' }).status).toBe('correct');
    expect(one(ex('spec-mg2'), 'd2', { value: '9,026' }).status).toBe('correct');
    expect(one(ex('spec-mg2'), 'dw', { value: '0,866' }).status).toBe('correct');
    expect(one(ex('spec-mg3'), 'half', { value: '2,8624' }).status).toBe('correct');
    expect(one(ex('spec-mg3'), 'full', { value: '5,7248' }).status).toBe('correct');
    expect(one(ex('spec-mg4'), 'dL', { value: '0,0115' }).status).toBe('correct');
    expect(one(ex('spec-mg1'), 'h', { value: '25,882' }).status).toBe('correct');
    expect(one(ex('spec-mg1'), 'stack', { blocks: ['1,002', '1,38', '3,5', '20'] }).status).toBe('correct');
    expect(one(ex('ope-madrid-2025-4'), 'M', { value: '29,99' }).status).toBe('correct');
    expect(one(ex('ope-euskadi-2022-b'), 'a', { value: '110,05' }).status).toBe('correct');
    expect(one(ex('adapted-andalucia-2023-4-2'), 'go', { value: '22,980' }).status).toBe('correct');
    expect(one(ex('adapted-andalucia-2023-4-2'), 'nogo', { value: '22,967' }).status).toBe('correct');
  });
});

describe('grader: units and formats', () => {
  it('lengths in µm', () => {
    expect(one(ex('spec-mg2'), 'd2', { value: '9026', unit: 'µm' }).status).toBe('correct');
    expect(one(ex('spec-mg4'), 'dL', { value: '11,5', unit: 'µm' }).status).toBe('correct');
  });
  it('taper as ratio, 1:x, % (spec §8.1)', () => {
    const e = ex('ope-euskadi-2020-2');
    for (const a of [{ value: '0,3' }, { value: '3:10' }, { value: '30', unit: 'percent' }, { value: '30%' }, { value: '3,3333', unit: 'oneTo' }]) {
      expect(one(e, 'C', a).status, JSON.stringify(a)).toBe('correct');
    }
  });
  it('angles in decimal degrees or ° ′ ″', () => {
    expect(parseAngle('2°51\'45"')).toBeCloseTo(2.8625, 6);
    expect(parseAngle('2° 51′ 45″')).toBeCloseTo(2.8625, 6);
    expect(parseAngle('2 51 45')).toBeCloseTo(2.8625, 6);
    expect(parseAngle('8°31,5\'')).toBeCloseTo(8.525, 6);
    expect(parseAngle('8°75\'')).toBeNull();
    expect(one(ex('spec-mg3'), 'half', { value: '2°51\'45"' }).status).toBe('correct');
  });
  it('missing and uninterpretable entries are never counted as wrong', () => {
    expect(one(ex('spec-mg2'), 'd2', { value: '' }).status).toBe('missing');
    expect(one(ex('spec-mg2'), 'd2', { value: 'abc' }).status).toBe('invalid');
    expect(one(ex('spec-mg2'), 'd2', { value: '9,0.26' }).status).toBe('invalid');
    expect(one(ex('spec-mg1'), 'stack', { blocks: ['1,002', 'x'] }).status).toBe('invalid');
  });
  it('readings are exact: 23,32 is wrong, 23,340 is right', () => {
    expect(one(ex('spec-mg5'), 'reading', { value: '23,32' }).status).toBe('wrong');
    expect(one(ex('spec-mg5'), 'reading', { value: '23,340' }).status).toBe('correct');
  });
  it('length tolerance ±0,001 mm', () => {
    expect(one(ex('spec-mg2'), 'd2', { value: '9,027' }).status).toBe('correct');
    expect(one(ex('spec-mg2'), 'd2', { value: '9,0275' }).status).toBe('wrong');
  });
});

describe('grader: gauge stacks (spec §8.2)', () => {
  it('a valid stack with more blocks: partial when the minimum is demanded, full otherwise', () => {
    const five = ['1,002', '1,38', '1,5', '2', '20'];
    const r = one(ex('spec-mg1'), 'stack', { blocks: five });
    expect([r.status, r.score, r.notes]).toEqual(['partial', 0.5, ['not-minimal']]);
    const free: Exercise = { ...ex('spec-mg1'), asks: [{ id: 'stack', kind: 'gaugeStack' }] };
    const r2 = one(free, 'stack', { blocks: five });
    expect([r2.status, r2.score, r2.notes]).toEqual(['correct', 1, ['could-be-fewer']]);
  });
  it('diagnoses: block not in the set, repeated block, wrong sum', () => {
    expect(one(ex('spec-mg1'), 'stack', { blocks: ['1,002', '1,38', '23,5'] })).toMatchObject({ status: 'wrong', diagnosis: 'stack-not-in-set', detail: '23.5' });
    expect(one(ex('spec-mg1'), 'stack', { blocks: ['1,002', '1,38', '3,5', '10', '10'] }).diagnosis).toBe('stack-repeated');
    expect(one(ex('spec-mg1'), 'stack', { blocks: ['1,002', '1,38', '3,5', '30'] }).diagnosis).toBe('stack-sum');
  });
  it('Madrid 2023-2.6: the nearest stack the set can build (7,480) is the key', () => {
    expect(one(ex('ope-madrid-2023-2-6'), 'stack', { blocks: ['1,08', '1,4', '5'] }).status).toBe('correct');
    expect(one(ex('ope-madrid-2023-2-6'), 'stack', { blocks: ['1,005', '1,07', '1,4', '4'] }).status).toBe('wrong'); // 7,475: farther from h
  });
});

describe('grader: diagnosis of common mistakes (spec §8.3)', () => {
  const diag = (id: string, askId: string, a: Answer) => one(ex(id), askId, a).diagnosis;
  it('named cases', () => {
    expect(diag('spec-mg3', 'half', { value: '5,7248' })).toBe('half-full-angle');
    expect(diag('spec-mg3', 'full', { value: '2,8624' })).toBe('half-full-angle');
    expect(diag('ope-euskadi-2020-2', 'C', { value: '0,15' })).toBe('c-half');
    expect(diag('ope-euskadi-2020-2', 'C', { value: '27/100' })).toBe('single-height');
    expect(diag('spec-mg2', 'd2', { value: '9,227' })).toBe('wire-p-term');
    expect(diag('spec-mg2', 'd2', { value: '9,892' })).toBe('wire-2dw');
    expect(diag('spec-mg4', 'dL', { value: '−0,0115' })).toBe('temp-sign');
    expect(diag('spec-mg4', 'dL', { value: '11,5' })).toBe('mm-um');
    expect(diag('adapted-andalucia-2023-4-2', 'go', { value: '22,967' })).toBe('gauge-swapped');
    expect(diag('adapted-andalucia-2023-4-2', 'go', { value: '23' })).toBe('gauge-nominal');
    expect(diag('spec-mg6', 'reading', { value: '12,37' })).toBe('micro-half-mm');
    expect(diag('spec-mg5', 'reading', { value: '23,85' })).toBe('vernier-appreciation');
    expect(diag('spec-mg1', 'h', { value: '26,795' })).toBe('sin-tan');
    expect(diag('ope-aragon-2024-b2-2', 'LT', { value: '1,44' })).toBe('temp-delta-only');
    expect(diag('ope-madrid-2025-4', 'M', { value: '26,99' })).toBe('roller-term');
    expect(diag('spec-mg2', 'd2', { value: '8,5' })).toBe('not-identified');
  });

  it('every hypothesis of every pool exercise is recognised when typed', () => {
    let checked = 0;
    for (const e of POOL) {
      const key = solveExercise(e);
      for (const ask of e.asks) {
        const exp = key[ask.id]!;
        if (exp.q === 'stack') continue;
        const tol = tolerance(ask, exp);
        for (const h of hypotheses(e.setup, ask, exp)) {
          if (Math.abs(h.value - exp.value) <= 1e-12) continue;
          const unit = exp.q === 'taper' ? 'ratio' : exp.q === 'percent' ? '%' : exp.q === 'angle' ? 'deg' : 'mm';
          const r = one(e, ask.id, { value: typed(h.value), unit });
          expect(r.status, `${e.id} ${ask.id} ${h.id}`).toBe('wrong');
          // the reported diagnosis has a hypothesis at that value (several mistakes may coincide)
          const same = hypotheses(e.setup, ask, exp).filter((x) => x.id === r.diagnosis);
          const ok = r.diagnosis === 'gauge-swapped' || r.diagnosis === 'gauge-nominal' || same.some((x) => Math.abs(x.value - h.value) <= tol + 1e-6);
          expect(ok, `${e.id} ${ask.id} ${h.id} → ${r.diagnosis}`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
