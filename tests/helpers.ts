/** Test helpers: a correct answer for every expected value, as a user would type it. */
import type { Answer } from '../src/core/grader';
import * as R from '../src/core/rational';
import type { Expected } from '../src/core/solve';

export function exactDecimal(x: R.Rational): string {
  for (let d = 0; d <= 8; d++) {
    const s = R.toFixed(x, d);
    if (R.eq(R.parse(s), x)) return s;
  }
  return R.toFixed(x, 8);
}

export function answerFor(e: Expected, kind?: string): Answer {
  switch (e.q) {
    case 'stack':
      return { blocks: e.stack!.reference.map((b) => exactDecimal(b)) };
    case 'exact':
      return { value: exactDecimal(e.exact!), unit: 'mm' };
    case 'length':
      return { value: e.value.toFixed(kind === 'errorAbs' || kind === 'selectionError' ? 6 : 4), unit: 'mm' };
    case 'angle':
      return { value: e.value.toFixed(4), unit: 'deg' };
    case 'taper':
      return { value: e.value.toPrecision(8), unit: 'ratio' };
    case 'percent':
      return { value: e.value.toPrecision(8), unit: '%' };
  }
}

/** A value typed with enough decimals to land on a hypothesis value. */
export const typed = (x: number): string => x.toFixed(7);
