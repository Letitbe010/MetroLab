/**
 * Worked exercises (spec §15): each one is a verified pool exercise; its steps are
 * an introduction plus one step per ask with three layers — what is done (formulas and numbers
 * from the solvers, ui/solution.ts), why (reviewed prose, i18n wk.*) and careful! (the common
 * mistake of that step). Texts are drafts until the user reviews them.
 */
import type { Exercise } from '../core/model';
import { solveExercise } from '../core/solve';
import { poolById } from '../data/pool';
import raw from '../data/worked.json';
import type { T } from './describe';
import { solutionLines, type Line } from './solution';

export interface WorkedEntry {
  id: string;
  base: string;
  topic: string;
  now: { template: string; level: number };
  status: 'draft' | 'reviewed';
}

export const WORKED: WorkedEntry[] = raw as WorkedEntry[];

export interface WorkedStep {
  kind: 'intro' | 'ask';
  askId?: string;
  what: Line[];
  why: string;
  careful: string[];
}

export function workedExercise(w: WorkedEntry): Exercise {
  const ex = poolById(w.base);
  if (!ex) throw new Error(`worked ${w.id}: pool exercise ${w.base} not found`);
  return ex;
}

export function workedSteps(w: WorkedEntry, t: T): WorkedStep[] {
  const ex = workedExercise(w);
  const key = solveExercise(ex);
  const sol = solutionLines(ex, key, t);
  return [
    { kind: 'intro', what: [], why: t(`wk.${w.id}.intro`), careful: [] },
    ...sol.map((s) => ({
      kind: 'ask' as const,
      askId: s.askId,
      // formulas and results; plain sentences only when they carry numbers (the readings) —
      // the explanation itself is the "why" layer
      what: s.lines.filter((l) => l.kind !== 'warn' && (l.kind !== 'text' || /\d/.test(l.text))),
      why: t(`wk.${w.id}.why.${s.askId}`),
      careful: s.lines.filter((l) => l.kind === 'warn').map((l) => l.text),
    })),
  ];
}
