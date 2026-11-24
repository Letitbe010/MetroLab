/** Angle helpers: degrees ↔ radians and degrees ↔ ° ′ ″ (spec §3: both forms shown). */

export const DEG = Math.PI / 180;
export const toRad = (deg: number): number => deg * DEG;
export const toDeg = (rad: number): number => rad / DEG;

export interface DMS {
  sign: 1 | -1;
  d: number;
  m: number;
  /** Seconds, rounded to `secDigits` decimals. */
  s: number;
}

/** Decimal degrees → ° ′ ″ with carry handled after rounding the seconds. */
export function toDMS(deg: number, secDigits = 0): DMS {
  const sign: 1 | -1 = deg < 0 ? -1 : 1;
  const k = 10 ** secDigits;
  let totalSec = Math.round(Math.abs(deg) * 3600 * k) / k;
  const d = Math.floor(totalSec / 3600 + 1e-12);
  totalSec -= d * 3600;
  const m = Math.floor(totalSec / 60 + 1e-12);
  const s = Math.round((totalSec - m * 60) * k) / k;
  return { sign, d, m, s };
}

export const fromDMS = (d: number, m = 0, s = 0, sign: 1 | -1 = 1): number => sign * (d + m / 60 + s / 3600);

export function formatDMS(x: DMS): string {
  return `${x.sign < 0 ? '−' : ''}${x.d}° ${x.m}′ ${x.s}″`;
}
