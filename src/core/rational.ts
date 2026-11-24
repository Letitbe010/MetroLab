/**
 * Exact rational arithmetic on BigInt (copied from KateLab, symbolic-π part removed).
 *
 * Every time, cycle time and efficiency in core/ is a Rational; decimals appear only
 * at the very end (toNumber / toFixed).
 */

export interface Rational {
  readonly n: bigint; // numerator (carries the sign)
  readonly d: bigint; // denominator, always > 0, gcd(|n|, d) = 1
}

const babs = (a: bigint): bigint => (a < 0n ? -a : a);

function gcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function make(n: bigint, d: bigint): Rational {
  if (d === 0n) throw new RangeError('Rational: zero denominator');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return g > 1n ? Object.freeze({ n: n / g, d: d / g }) : Object.freeze({ n, d });
}

function toBig(x: number | bigint): bigint {
  if (typeof x === 'bigint') return x;
  if (!Number.isSafeInteger(x)) throw new RangeError(`Rational: ${x} is not a safe integer (use parse for decimals)`);
  return BigInt(x);
}

/** Build p/q from integers. Non-integer numbers are rejected on purpose: use parse("2,5"). */
export function q(p: number | bigint, r: number | bigint = 1): Rational {
  return make(toBig(p), toBig(r));
}

export const ZERO = q(0);
export const ONE = q(1);

/**
 * Parse "3", "-3", "2,5", "2.5", "3/4", "-7/2", "1e3", "2,5e-1" exactly (no floats involved).
 * Decimal comma and point are both accepted.
 */
export function parse(input: string): Rational {
  const s = input.trim().replace(/\s+/g, '');
  if (s === '') throw new SyntaxError('Rational.parse: empty string');
  const slash = s.indexOf('/');
  if (slash >= 0) {
    if (s.indexOf('/', slash + 1) >= 0) throw new SyntaxError(`Rational.parse: more than one "/" in "${input}"`);
    const a = parse(s.slice(0, slash));
    const b = parse(s.slice(slash + 1));
    return div(a, b);
  }
  const m = /^([+-]?)(\d*)(?:[.,](\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
  if (!m || ((m[2] ?? '') === '' && (m[3] ?? '') === '')) throw new SyntaxError(`Rational.parse: invalid number "${input}"`);
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2] ?? '';
  const frac = m[3] ?? '';
  const exp = m[4] ? parseInt(m[4], 10) : 0;
  let num = BigInt((intPart || '0') + frac) * sign;
  let den = 10n ** BigInt(frac.length);
  if (exp > 0) num *= 10n ** BigInt(exp);
  if (exp < 0) den *= 10n ** BigInt(-exp);
  return make(num, den);
}

/** Accepts a Rational, a safe integer or a numeric string. */
export function from(x: Rational | number | bigint | string): Rational {
  if (typeof x === 'string') return parse(x);
  if (typeof x === 'number' || typeof x === 'bigint') return q(x);
  return x;
}

export const add = (a: Rational, b: Rational): Rational => make(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational): Rational => make(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational): Rational => make(a.n * b.n, a.d * b.d);
export function div(a: Rational, b: Rational): Rational {
  if (b.n === 0n) throw new RangeError('Rational: division by zero');
  return make(a.n * b.d, a.d * b.n);
}
export const neg = (a: Rational): Rational => make(-a.n, a.d);
export const inv = (a: Rational): Rational => div(ONE, a);
export const abs = (a: Rational): Rational => (a.n < 0n ? neg(a) : a);
export const sign = (a: Rational): -1 | 0 | 1 => (a.n < 0n ? -1 : a.n > 0n ? 1 : 0);
export const isZero = (a: Rational): boolean => a.n === 0n;
export const isInteger = (a: Rational): boolean => a.d === 1n;
export const eq = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;
export const cmp = (a: Rational, b: Rational): -1 | 0 | 1 => sign(sub(a, b));
export const lt = (a: Rational, b: Rational): boolean => cmp(a, b) < 0;
export const gt = (a: Rational, b: Rational): boolean => cmp(a, b) > 0;
export const min = (a: Rational, b: Rational): Rational => (lt(a, b) ? a : b);
export const max = (a: Rational, b: Rational): Rational => (gt(a, b) ? a : b);

export function pow(a: Rational, k: number): Rational {
  if (!Number.isInteger(k)) throw new RangeError('Rational.pow: integer exponent only');
  if (k < 0) return inv(pow(a, -k));
  return make(a.n ** BigInt(k), a.d ** BigInt(k));
}

export const prod = (xs: Rational[]): Rational => xs.reduce(mul, ONE);
export const sum = (xs: Rational[]): Rational => xs.reduce(add, ZERO);

/** Integer part towards -infinity. */
export function floor(a: Rational): bigint {
  const t = a.n / a.d; // truncates toward zero
  return a.n < 0n && t * a.d !== a.n ? t - 1n : t;
}

/** Integer part towards +infinity (N_min = ceil(sum t / C), spec §3). */
export function ceil(a: Rational): bigint {
  return -floor(neg(a));
}

/** "p/q" or "p" (canonical, used in JSON and tests). */
export function toString(a: Rational): string {
  return a.d === 1n ? a.n.toString() : `${a.n}/${a.d}`;
}

/**
 * Decimal string rounded half away from zero to `digits` places, with "." separator.
 * Exact: done in BigInt.
 */
export function toFixed(a: Rational, digits: number): string {
  const scale = 10n ** BigInt(digits);
  const neg_ = a.n < 0n;
  const num = babs(a.n) * scale;
  let qt = num / a.d;
  const rem = num % a.d;
  if (rem * 2n >= a.d) qt += 1n;
  let s = qt.toString();
  if (digits > 0) {
    s = s.padStart(digits + 1, '0');
    s = `${s.slice(0, -digits)}.${s.slice(-digits)}`;
  }
  return (neg_ && qt !== 0n ? '-' : '') + s;
}

/** Round to `digits` decimals, returning an exact Rational. */
export function round(a: Rational, digits: number): Rational {
  return parse(toFixed(a, digits));
}

/** Best double approximation (computed from a 30-digit exact decimal expansion). */
export function toNumber(a: Rational): number {
  return Number(toFixed(a, 30));
}
