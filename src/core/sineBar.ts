/**
 * Sine bar (spec §3): h = L · sin α, α = asin(h / L).
 * A: the formula. B: the upper roller centre placed with the half-angle (rational)
 * parametrisation of the bar direction, and the angle from the two roller centres with
 * atan2 — different numerical paths.
 */
import { toDeg, toRad } from './angles';

/** Above 45° the sine bar loses sensitivity; the app does not set such exercises (spec §14.1). */
export const SINE_BAR_MAX_DEG = 45;

export function sineHeightA(L: number, alphaDeg: number): number {
  return L * Math.sin(toRad(alphaDeg));
}

export function sineAngleA(L: number, h: number): number {
  if (h <= 0 || h >= L) throw new RangeError('h must be between 0 and L');
  return toDeg(Math.asin(h / L));
}

/** B: bar direction u = ((1 − t²), 2t) / (1 + t²) with t = tan(α/2); upper centre = L·u. */
export function sineHeightB(L: number, alphaDeg: number): number {
  const t = Math.tan(toRad(alphaDeg) / 2);
  const uy = (2 * t) / (1 + t * t);
  return L * uy;
}

/** B: the horizontal run between roller centres is √(L² − h²); α = atan2(h, run). */
export function sineAngleB(L: number, h: number): number {
  return toDeg(Math.atan2(h, Math.sqrt(L * L - h * h)));
}
