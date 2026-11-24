/**
 * Profiles measured with rollers (spec §3: "ildaskak, buztan-enarak eta V-ak arrabolekin").
 *
 * 1. V gap of a splined shaft (Madrid 2025-4): two rollers in diametrically opposite gaps; the
 *    flank tangents at the contact points form an angle θ and meet at a distance Ra from the
 *    shaft centre (inside the roller). Measurement over the rollers:
 *        M = 2·(Ra + r / sin(θ/2) + r)
 * 2. Dovetail on a surface plate, rollers in the corners between the plate and the flanks;
 *    α = acute angle between the flank and the plate (measured in the corner the roller sits in):
 *        male (tongue, narrow side b on the plate):   X = b + d·(1 + cot(α/2))   (over rollers)
 *        female (slot, wide side B on the plate):     X = B − d·(1 + cot(α/2))   (between rollers)
 *
 * Solver A = these formulas; solver B = geometry.ts (offset lines intersected).
 * The two-level trapezoid of Euskadi 2022-B (rollers on the plate and on blocks) is the plane
 * version of the external cone over rollers and uses taper.ts (rollerTaperA/B).
 */
import { circleInCorner, lineThrough, pt, type Line } from './geometry';
import { toRad } from './angles';

// ---------------------------------------------------------------- spline V gap

export interface SplineGap {
  rollerD: number;
  /** Angle between the flank tangents, degrees. */
  vAngleDeg: number;
  /** Distance from the shaft centre to the point where the tangents meet. */
  apexRadius: number;
}

export function overSplineRollersA(s: SplineGap): number {
  const r = s.rollerD / 2;
  return 2 * (s.apexRadius + r / Math.sin(toRad(s.vAngleDeg / 2)) + r);
}

/** B: radial axis y; the two tangents from the apex (0, Ra) open outwards at ±θ/2. */
export function overSplineRollersB(s: SplineGap): number {
  const r = s.rollerD / 2;
  const h = toRad(s.vAngleDeg / 2);
  const apex = pt(0, s.apexRadius);
  // oriented so that the inside of the V is on the left of both lines
  const right: Line = lineThrough(apex, pt(Math.sin(h), s.apexRadius + Math.cos(h)));
  const left: Line = lineThrough(pt(-Math.sin(h), s.apexRadius + Math.cos(h)), apex);
  const c = circleInCorner(left, right, r);
  return 2 * (c.y + r);
}

// ---------------------------------------------------------------- dovetail

export type DovetailKind = 'male' | 'female';

export interface Dovetail {
  kind: DovetailKind;
  rollerD: number;
  /** Acute angle between flank and plate, degrees (usually 45°, 55°, 60°). */
  alphaDeg: number;
  /** Width on the plate: narrow side b (male) or wide side B (female). */
  width: number;
}

export function dovetailA(t: Dovetail): number {
  const k = t.rollerD * (1 + 1 / Math.tan(toRad(t.alphaDeg / 2)));
  return t.kind === 'male' ? t.width + k : t.width - k;
}

/** Inverse: width on the plate from the roller measurement. */
export function dovetailWidthA(kind: DovetailKind, rollerD: number, alphaDeg: number, X: number): number {
  const k = rollerD * (1 + 1 / Math.tan(toRad(alphaDeg / 2)));
  return kind === 'male' ? X - k : X + k;
}

/** B: right-hand corner at (w/2, 0); roller tangent to the plate and the flank. */
export function dovetailB(t: Dovetail): number {
  const r = t.rollerD / 2;
  const a = toRad(t.alphaDeg);
  const corner = pt(t.width / 2, 0);
  // the plate oriented +x: its left side is "up"
  const plate: Line = lineThrough(pt(corner.x - 1, 0), corner);
  if (t.kind === 'male') {
    // flank leans outwards going up (tongue wider at the top); the roller is outside, so on the
    // left of the flank oriented downwards (top → corner)
    const flankTop = pt(corner.x + Math.cos(a), Math.sin(a));
    const c = circleInCorner(plate, lineThrough(flankTop, corner), r);
    return 2 * (c.x + r);
  }
  // female: flank leans inwards going up (slot narrower at the top); the roller is inside the
  // slot, under the flank: on the left of the flank oriented upwards (corner → top)
  const flankTop = pt(corner.x - Math.cos(a), Math.sin(a));
  const c = circleInCorner(plate, lineThrough(corner, flankTop), r);
  return 2 * (c.x - r);
}
