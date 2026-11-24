/**
 * Tapers (spec §3). C = (D − d)/L = 2·tan(α/2); α = full (included) angle, α/2 = half-angle.
 *
 * External cone with two equal rollers (axis vertical, cone standing on the surface plate):
 * each roller (diameter dr) rests on gauge blocks of height h, so its centre is at y = h + dr/2;
 * M is the measurement over both rollers.
 *   C = (M2 − M1)/(h2 − h1)                (exact: ΔM over Δh, same roller diameter)
 *   D(y_c) = M − dr·(1 + 1/cos(α/2))       (diameter of the cone at the roller-centre height)
 *
 * Internal cone with two balls (hole widening towards its top face): ball i (diameter di)
 * has its top at depth_i below the top face (negative: it sticks out); centre depth z = depth + r.
 *   sin(α/2) = (r2 − r1)/(z1 − z2)
 *   D_top = 2·(r2/cos(α/2) + z2·tan(α/2))
 *
 * Solver A = these closed forms. Solver B = geometry.ts (tangent lines of circles, Newton).
 */
import tapersData from '../data/tapers.json';
import { angleToVertical, externalTangent, lineThrough, newton, pt, signedDistance, xAtY, type Line } from './geometry';
import { toDeg } from './angles';
import { abs, div, parse, sub, type Rational } from './rational';

export interface TaperInfo {
  id: string;
  name: string;
  /** C as an exact rational (num/den). */
  C: Rational;
}

export const TAPERS: TaperInfo[] = tapersData.tapers.map((t) => ({ id: t.id, name: t.name, C: div(parse(t.num), parse(t.den)) }));

export interface TaperAngles {
  /** C = 2·tan(α/2) (ratio, e.g. 0.1 = 1:10 = 10 %). */
  C: number;
  halfAngleDeg: number;
  angleDeg: number;
}

export function anglesFromC(C: number): TaperAngles {
  const half = toDeg(Math.atan(C / 2));
  return { C, halfAngleDeg: half, angleDeg: 2 * half };
}

/** "1:x" form of a taper: x = 1/C. */
export const oneTo = (C: number): number => 1 / C;

// ---------------------------------------------------------------- external cone over rollers

export interface RollerTaperData {
  rollerD: number;
  /** Heights of the gauge blocks under the rollers (0 = on the plate). h2 > h1. */
  h1: number;
  h2: number;
  M1: number;
  M2: number;
}

/** A: the exact ratio C = |M2 − M1| / (h2 − h1) on the shown data. */
export function rollerTaperCExact(M1: Rational, M2: Rational, h1: Rational, h2: Rational): Rational {
  return div(abs(sub(M2, M1)), sub(h2, h1));
}

export interface RollerTaperSolution extends TaperAngles {
  /** +1: the cone widens upwards (M2 > M1); −1: it narrows upwards. */
  widensUp: 1 | -1;
  /** Cone diameter at height y (mm). */
  diameterAt: (y: number) => number;
}

export function rollerTaperA(t: RollerTaperData): RollerTaperSolution {
  if (!(t.h2 > t.h1)) throw new RangeError('h2 must be greater than h1');
  const signed = (t.M2 - t.M1) / (t.h2 - t.h1);
  const ang = anglesFromC(Math.abs(signed));
  const yc1 = t.h1 + t.rollerD / 2;
  const cosB = Math.cos((ang.halfAngleDeg * Math.PI) / 180);
  const D1 = t.M1 - t.rollerD * (1 + 1 / cosB);
  return { ...ang, widensUp: signed >= 0 ? 1 : -1, diameterAt: (y) => D1 + signed * (y - yc1) };
}

/** B: right-hand roller centres from the data; flank = their common tangent on the axis side. */
export function rollerTaperFlankB(t: RollerTaperData): Line {
  const r = t.rollerD / 2;
  const c1 = pt(t.M1 / 2 - r, t.h1 + r);
  const c2 = pt(t.M2 / 2 - r, t.h2 + r);
  // c1 → c2 points upwards; the axis (x = 0) is on the left, so the tangent is on the left side.
  return externalTangent(c1, r, c2, r, -1);
}

export function rollerTaperB(t: RollerTaperData): RollerTaperSolution {
  const flank = rollerTaperFlankB(t);
  const half = angleToVertical(flank);
  const C = 2 * Math.tan(half);
  const widens = xAtY(flank, 1) > xAtY(flank, 0);
  return {
    C,
    halfAngleDeg: toDeg(half),
    angleDeg: 2 * toDeg(half),
    widensUp: widens ? 1 : -1,
    diameterAt: (y) => 2 * xAtY(flank, y),
  };
}

/**
 * Forward problem (used by the generator): cone of diameter D0 at the plate and taper C
 * (signed: > 0 widens upwards). A: closed form.
 */
export function overRollersA(D0: number, Csigned: number, rollerD: number, h: number): number {
  const half = Math.atan(Math.abs(Csigned) / 2);
  const yc = h + rollerD / 2;
  return D0 + Csigned * yc + rollerD * (1 + 1 / Math.cos(half));
}

/** Forward problem, B: place the roller with Newton so that it touches the flank. */
export function overRollersB(D0: number, Csigned: number, rollerD: number, h: number): number {
  const r = rollerD / 2;
  const flank = lineThrough(pt(D0 / 2, 0), pt(D0 / 2 + Csigned / 2, 1)); // upwards
  const yc = h + r;
  // the roller is outside the cone: on the right of the upward flank → signed distance −r
  const xc = newton((x) => signedDistance(pt(x, yc), flank) + r, D0 / 2 + r);
  return 2 * (xc + r);
}

// ---------------------------------------------------------------- internal cone with balls

export interface BallTaperData {
  /** Small ball (deeper) and large ball diameters. */
  d1: number;
  d2: number;
  /** Depth of each ball's top below the top face (negative = above the face). */
  depth1: number;
  depth2: number;
}

export interface BallTaperSolution extends TaperAngles {
  /** Hole diameter at the top face. */
  Dtop: number;
}

export function ballTaperA(b: BallTaperData): BallTaperSolution {
  const r1 = b.d1 / 2;
  const r2 = b.d2 / 2;
  const z1 = b.depth1 + r1;
  const z2 = b.depth2 + r2;
  if (!(r2 > r1) || !(z1 > z2)) throw new RangeError('the large ball must sit higher than the small one');
  const s = (r2 - r1) / (z1 - z2);
  if (s >= 1) throw new RangeError('impossible ball data (sin ≥ 1)');
  const half = Math.asin(s);
  const C = 2 * Math.tan(half);
  return { C, halfAngleDeg: toDeg(half), angleDeg: 2 * toDeg(half), Dtop: 2 * (r2 / Math.cos(half) + z2 * Math.tan(half)) };
}

export function ballTaperFlankB(b: BallTaperData): Line {
  const r1 = b.d1 / 2;
  const r2 = b.d2 / 2;
  const c1 = pt(0, -(b.depth1 + r1));
  const c2 = pt(0, -(b.depth2 + r2));
  // c1 → c2 points up the axis; the right-hand flank is to the right of it.
  return externalTangent(c1, r1, c2, r2, 1);
}

export function ballTaperB(b: BallTaperData): BallTaperSolution {
  const flank = ballTaperFlankB(b);
  const half = angleToVertical(flank);
  return { C: 2 * Math.tan(half), halfAngleDeg: toDeg(half), angleDeg: 2 * toDeg(half), Dtop: 2 * xAtY(flank, 0) };
}
