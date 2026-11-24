/** Titles, ask labels, units and formatted answers for the UI. */
import type { Ask, Exercise } from '../core/model';
import * as R from '../core/rational';
import type { Expected } from '../core/solve';
import { dms, fmt } from './format';

export type T = (key: string, vars?: Record<string, string | number>) => string;

export const letter = (i: number): string => `${String.fromCharCode(97 + i)})`;

export function exerciseTitle(ex: Exercise, t: T): string {
  if (ex.origin !== 'generated') return t(`poolTitle.${ex.id}`);
  return t(`tpl.${ex.template ?? ex.setup.kind}`);
}

export function askLabel(a: Ask, t: T): string {
  if (a.kind === 'diameter') return t(`ask.diameter.${a.at ?? 'plate'}`);
  if (a.kind === 'gaugeStack' && a.minimal) return t('ask.gaugeStackMin');
  if (a.kind === 'gaugeStack' && a.nearestFeasible) return t('ask.gaugeStackNear');
  return t(`ask.${a.kind}`);
}

/** Unit choices offered for an answer (first = default). */
export function unitsFor(e: Expected): string[] {
  switch (e.q) {
    case 'length':
      return ['mm', 'µm'];
    case 'exact':
      return ['mm'];
    case 'angle':
      return ['deg', 'dms'];
    case 'taper':
      return ['ratio', 'percent', 'oneTo'];
    case 'percent':
      return ['%', 'fraction'];
    case 'stack':
      return [];
  }
}

export function exactText(x: R.Rational): string {
  for (let d = 0; d <= 6; d++) {
    const s = R.toFixed(x, d);
    if (R.eq(R.parse(s), x)) return s.replace('.', ',').replace('-', '−');
  }
  return fmt(R.toNumber(x), 6);
}

/** The expected answer as shown after grading. */
export function expectedText(e: Expected, t: T): string {
  switch (e.q) {
    case 'length':
      return `${fmt(e.value, e.digits === 3 ? 3 : 4)} mm${Math.abs(e.value) < 0.1 ? ` (${fmt(e.value * 1000, 1)} µm)` : ''}`;
    case 'exact':
      return `${exactText(e.exact!)} mm`;
    case 'angle':
      return `${fmt(e.value, 4)}° (${dms(e.value, 0)})`;
    case 'taper':
      return `${fmt(e.value, 5)} = 1:${fmt(1 / e.value, 3)} = ${fmt(100 * e.value, 3)} %`;
    case 'percent':
      return `${fmt(e.value, 4)} %`;
    case 'stack': {
      const k = e.stack!;
      return `${k.reference.map(exactText).join(' + ')} = ${exactText(k.target)} mm · ${t('stack.min', { n: k.minCount })}`;
    }
  }
}

/** The user's value, in canonical units, as shown next to the expected one. */
export function givenText(e: Expected, v: number): string {
  switch (e.q) {
    case 'angle':
      return `${fmt(v, 4)}°`;
    case 'taper':
      return `${fmt(v, 5)}`;
    case 'percent':
      return `${fmt(v, 4)} %`;
    default:
      return `${fmt(v, 4)} mm`;
  }
}
