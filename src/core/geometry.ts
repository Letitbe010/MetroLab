/**
 * Solver B: computational geometry (spec §5.2).
 *
 * Rollers, balls and wires are circles in a cross-section; flanks are lines. Instead of the
 * closed formulas of solver A, B builds the picture: it offsets lines, intersects them,
 * finds tangent lines common to two circles and solves positions with Newton's method,
 * and then reads the requested dimension from coordinates. Floats (float64) throughout.
 */

export interface Pt {
  x: number;
  y: number;
}

/** A line through `p` with unit direction `u`. */
export interface Line {
  p: Pt;
  u: Pt;
}

export const pt = (x: number, y: number): Pt => ({ x, y });
const sub = (a: Pt, b: Pt): Pt => pt(a.x - b.x, a.y - b.y);
const addv = (a: Pt, b: Pt): Pt => pt(a.x + b.x, a.y + b.y);
const scale = (a: Pt, k: number): Pt => pt(a.x * k, a.y * k);
const cross = (a: Pt, b: Pt): number => a.x * b.y - a.y * b.x;
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
const norm = (a: Pt): number => Math.hypot(a.x, a.y);
const unit = (a: Pt): Pt => scale(a, 1 / norm(a));
/** Left normal of a direction (rotated +90°). */
const leftNormal = (u: Pt): Pt => pt(-u.y, u.x);

export function lineThrough(a: Pt, b: Pt): Line {
  return { p: a, u: unit(sub(b, a)) };
}

/** Line through `p` making angle `theta` (rad) with the +x axis. */
export function lineAt(p: Pt, theta: number): Line {
  return { p, u: pt(Math.cos(theta), Math.sin(theta)) };
}

/** Signed distance of q to the line: positive on the left of the direction. */
export function signedDistance(q: Pt, l: Line): number {
  return cross(l.u, sub(q, l.p));
}

/** Parallel line moved `d` to the left (negative: to the right). */
export function offset(l: Line, d: number): Line {
  return { p: addv(l.p, scale(leftNormal(l.u), d)), u: l.u };
}

export function intersect(a: Line, b: Line): Pt {
  const den = cross(a.u, b.u);
  if (Math.abs(den) < 1e-15) throw new Error('parallel lines');
  const t = cross(sub(b.p, a.p), b.u) / den;
  return addv(a.p, scale(a.u, t));
}

export function foot(q: Pt, l: Line): Pt {
  return addv(l.p, scale(l.u, dot(sub(q, l.p), l.u)));
}

/** x where the line crosses the horizontal y = y0. */
export function xAtY(l: Line, y0: number): number {
  return intersect(l, { p: pt(0, y0), u: pt(1, 0) }).x;
}

/** Acute angle (rad) between the line and the vertical axis. */
export function angleToVertical(l: Line): number {
  return Math.atan2(Math.abs(l.u.x), Math.abs(l.u.y));
}

/**
 * Newton's method on a scalar function (numerical derivative). Used where B "solves the
 * position" instead of applying a formula.
 */
export function newton(f: (x: number) => number, x0: number, tol = 1e-13, maxIt = 60): number {
  let x = x0;
  for (let i = 0; i < maxIt; i++) {
    const fx = f(x);
    if (Math.abs(fx) < tol) return x;
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const d = (f(x + h) - f(x - h)) / (2 * h);
    if (d === 0) break;
    const nx = x - fx / d;
    if (Math.abs(nx - x) < tol * Math.max(1, Math.abs(x))) return nx;
    x = nx;
  }
  if (Math.abs(f(x)) < 1e-9) return x;
  throw new Error('newton did not converge');
}

/** Bisection for monotone problems (bracket [a, b] with a sign change). */
export function bisect(f: (x: number) => number, a: number, b: number, tol = 1e-14): number {
  let fa = f(a);
  if (fa * f(b) > 0) throw new Error('bisect: no sign change');
  for (let i = 0; i < 200 && b - a > tol; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === 0) return m;
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * Common external tangent of two circles on the side given by `side` (+1: the tangent lies
 * to the right of the line c1→c2, i.e. the circles are on its left). Works for different radii.
 */
export function externalTangent(c1: Pt, r1: number, c2: Pt, r2: number, side: 1 | -1): Line {
  const d = norm(sub(c2, c1));
  const v = unit(sub(c2, c1));
  const cosA = (r1 - r2) / d;
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  // unit normal n (pointing from the line towards the circles' outside), n·v = cosA
  const perp = side === 1 ? pt(v.y, -v.x) : pt(-v.y, v.x);
  const n = addv(scale(v, cosA), scale(perp, sinA));
  const t1 = addv(c1, scale(n, r1));
  const t2 = addv(c2, scale(n, r2));
  return lineThrough(t1, t2);
}

/** Centre of a circle of radius r tangent to two lines, on the left side of both. */
export function circleInCorner(a: Line, b: Line, r: number): Pt {
  return intersect(offset(a, r), offset(b, r));
}
