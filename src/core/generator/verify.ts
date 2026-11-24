/**
 * Common filters (spec §10.3, §5.3): an exercise is shown only if
 *  - solvers A and B agree on every ask (solve.ts throws otherwise);
 *  - every common mistake gives a result outside the tolerance (diagnosis possible);
 *  - the global checks hold: C > 0, α/2 < 45°, d2 < M, stack sum = target with the classic
 *    method working (worked solutions show it), GO and NO-GO in order, sine bar ≤ 45°,
 *    both balls touching inside the hole.
 */
import { indistinguishable } from '../grader';
import type { Exercise } from '../model';
import * as R from '../rational';
import { sineBarAngle, solveExercise, SolverMismatch } from '../solve';
import { ballTaperA } from '../taper';

export interface Verification {
  ok: boolean;
  problems: string[];
}

const num = (s: string | undefined) => R.toNumber(R.parse(s ?? 'NaN'));

export function verifyExercise(ex: Exercise, opts: { requireClassic?: boolean } = {}): Verification {
  const problems: string[] = [];
  let key;
  try {
    key = solveExercise(ex);
  } catch (e) {
    return { ok: false, problems: [e instanceof SolverMismatch ? e.message : `solve: ${(e as Error).message}`] };
  }
  const s = ex.setup;
  for (const a of ex.asks) {
    const e = key[a.id]!;
    if (!Number.isFinite(e.value)) problems.push(`${a.id}: not finite`);
    if (e.q === 'stack' && (opts.requireClassic ?? ex.origin === 'generated') && !e.stack!.classic) problems.push(`${a.id}: classic method fails`);
    if (a.kind === 'taperC' && !(e.value > 0)) problems.push('C ≤ 0');
    if (a.kind === 'halfAngle' && !(e.value > 0 && e.value < 45)) problems.push('α/2 outside (0, 45°)');
  }
  if (s.kind === 'sineBar' && sineBarAngle(s) > 45) problems.push('sine bar above 45°');
  if (s.kind === 'threeWire') {
    const M = s.M ? num(s.M) : key['M']?.value;
    const d2 = s.d2 ? num(s.d2) : key['d2']?.value;
    if (M !== undefined && d2 !== undefined && !(d2 < M)) problems.push('d2 ≥ M');
  }
  if (s.kind === 'taperBalls') {
    const b = { d1: num(s.d1), d2: num(s.d2), depth1: num(s.depth1), depth2: num(s.depth2) };
    const half = (ballTaperA(b).halfAngleDeg * Math.PI) / 180;
    if (b.depth2 + b.d2 / 2 + (b.d2 / 2) * Math.sin(half) < 0) problems.push('ball 2 does not touch inside the hole');
  }
  if (s.kind === 'fixedGauge') {
    const go = key['go'];
    const nogo = key['nogo'];
    if (go && nogo) {
      const okOrder = s.feature === 'hole' || /[A-Z]/.test(s.designation ?? '') ? go.value < nogo.value : go.value > nogo.value;
      if (!okOrder) problems.push('GO / NO-GO order');
    }
  }
  for (const d of indistinguishable(ex)) problems.push(`indistinguishable ${d}`);
  return { ok: problems.length === 0, problems };
}
