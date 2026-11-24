/**
 * Three-wire method (spec §3), without lead-angle correction:
 *   d2 = M − dw·(1 + 1/sin(α/2)) + (P/2)·cot(α/2)
 *   metric (α = 60°): d2 = M − 3·dw + 0.866025·P
 *   best wire: dw = P / (2·cos(α/2))  (touches the flanks exactly on the pitch line)
 *
 * Solver A = the formulas. Solver B builds the axial section: two flanks through the pitch
 * points (±P/4, d2/2) at ±α/2 from the radial direction, the wire as the circle tangent to
 * both (offset lines intersected), M = 2·(y_centre + r), and solves d2 from M with Newton;
 * the best wire is found by bisection on the contact height.
 */
import threadsData from '../data/threads.json';
import { bisect, circleInCorner, foot, newton, pt, type Line } from './geometry';
import { toRad } from './angles';

export interface MetricThread {
  name: string;
  d: number;
  P: number;
  /** Basic pitch diameter (ISO 724), as tabulated. */
  d2: number;
  d2Text: string;
  PText: string;
}

export const METRIC_THREADS: MetricThread[] = threadsData.threads.map((t) => ({
  name: t.name,
  d: Number(t.d),
  P: Number(t.P),
  d2: Number(t.d2),
  d2Text: t.d2,
  PText: t.P,
}));

export function pitchDiameterA(M: number, dw: number, P: number, flankAngleDeg: number): number {
  const half = toRad(flankAngleDeg / 2);
  return M - dw * (1 + 1 / Math.sin(half)) + (P / 2) / Math.tan(half);
}

export function overWiresA(d2: number, dw: number, P: number, flankAngleDeg: number): number {
  const half = toRad(flankAngleDeg / 2);
  return d2 + dw * (1 + 1 / Math.sin(half)) - (P / 2) / Math.tan(half);
}

export function bestWireA(P: number, flankAngleDeg: number): number {
  return P / (2 * Math.cos(toRad(flankAngleDeg / 2)));
}

/** The two flanks of the groove around x = 0 (axial x, radial y), oriented so the groove is on their left. */
function flanks(d2: number, P: number, flankAngleDeg: number): { left: Line; right: Line } {
  const t = toRad(flankAngleDeg / 2);
  const left: Line = { p: pt(-P / 4, d2 / 2), u: pt(Math.sin(t), -Math.cos(t)) }; // going down to the root
  const right: Line = { p: pt(P / 4, d2 / 2), u: pt(Math.sin(t), Math.cos(t)) }; // going up from the root
  return { left, right };
}

function wireCentre(d2: number, dw: number, P: number, flankAngleDeg: number) {
  const f = flanks(d2, P, flankAngleDeg);
  return { c: circleInCorner(f.left, f.right, dw / 2), f };
}

/** B forward: measurement over the wires for a given d2. */
export function overWiresB(d2: number, dw: number, P: number, flankAngleDeg: number): number {
  const { c } = wireCentre(d2, dw, P, flankAngleDeg);
  return 2 * (c.y + dw / 2);
}

/** B inverse: d2 such that the simulated measurement equals M (Newton). */
export function pitchDiameterB(M: number, dw: number, P: number, flankAngleDeg: number): number {
  return newton((d2) => overWiresB(d2, dw, P, flankAngleDeg) - M, M - 2 * dw);
}

/** Radial position (y) of the wire's contact with the right flank. */
export function contactY(d2: number, dw: number, P: number, flankAngleDeg: number): number {
  const { c, f } = wireCentre(d2, dw, P, flankAngleDeg);
  return foot(c, f.right).y;
}

/** B: the wire whose contact point lies on the pitch line (bisection on the diameter). */
export function bestWireB(P: number, flankAngleDeg: number): number {
  const d2 = 10 * P; // any pitch diameter: the result does not depend on it
  return bisect((dw) => contactY(d2, dw, P, flankAngleDeg) - d2 / 2, 1e-6 * P, 2 * P);
}
