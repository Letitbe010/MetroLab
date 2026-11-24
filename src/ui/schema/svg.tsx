/**
 * SVG building blocks for the measurement schemas (spec §6, §13.2 colour code):
 * part dark grey · rollers/balls blue · gauge blocks yellow · dimensions black ·
 * computed dimension orange · user's answer dashed.
 *
 * Drawings are made in model millimetres with y up; <Frame> flips them into SVG coordinates
 * and fits them to a fixed-width viewBox, so text keeps the same size whatever the part.
 */
import { createContext, useContext, type ReactNode } from 'react';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface FrameCtx {
  /** model → svg */
  X: (x: number) => number;
  Y: (y: number) => number;
  /** model length → svg length */
  S: (l: number) => number;
}

const Ctx = createContext<FrameCtx>({ X: (x) => x, Y: (y) => -y, S: (l) => l });
export const useFrame = () => useContext(Ctx);

export const VIEW_W = 480;
const PAD = 34;

export function Frame({
  box,
  title,
  desc,
  children,
  noScale,
  noScaleText,
  maxHeight = 380,
}: {
  box: Box;
  title: string;
  desc?: string;
  children: ReactNode;
  noScale?: boolean;
  noScaleText?: string;
  maxHeight?: number;
}) {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const k = Math.min((VIEW_W - 2 * PAD) / w, (maxHeight - 2 * PAD) / h);
  const H = h * k + 2 * PAD + (noScale ? 18 : 0);
  const ox = (VIEW_W - w * k) / 2;
  const ctx: FrameCtx = {
    X: (x) => ox + (x - box.x0) * k,
    Y: (y) => PAD + (box.y1 - y) * k,
    S: (l) => l * k,
  };
  return (
    <svg className="schema" viewBox={`0 0 ${VIEW_W} ${H.toFixed(1)}`} role="img" aria-label={title}>
      <title>{title}</title>
      {desc && <desc>{desc}</desc>}
      <Defs />
      <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
      {noScale && (
        <text className="sx-note" x={VIEW_W - 6} y={H - 6} textAnchor="end">
          {noScaleText}
        </text>
      )}
    </svg>
  );
}

function Defs() {
  return (
    <defs>
      <pattern id="sx-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" className="sx-hatchline" />
      </pattern>
      <marker id="sx-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,1 L10,5 L0,9 z" className="sx-arrowhead" />
      </marker>
      <marker id="sx-arrow-calc" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,1 L10,5 L0,9 z" className="sx-arrowhead calc" />
      </marker>
    </defs>
  );
}

export type Tone = 'dim' | 'calc' | 'user';

const toneClass = (t: Tone) => (t === 'calc' ? 'calc' : t === 'user' ? 'user' : '');

/** Polygon in model coordinates. */
export function Poly({ pts, className }: { pts: [number, number][]; className: string }) {
  const { X, Y } = useFrame();
  return <polygon className={className} points={pts.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' ')} />;
}

export function Seg({ a, b, className }: { a: [number, number]; b: [number, number]; className: string }) {
  const { X, Y } = useFrame();
  return <line className={className} x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} />;
}

export function Circle({ c, r, className }: { c: [number, number]; r: number; className: string }) {
  const { X, Y, S } = useFrame();
  return <circle className={className} cx={X(c[0])} cy={Y(c[1])} r={S(r)} />;
}

export function Rect({ x, y, w, h, className }: { x: number; y: number; w: number; h: number; className: string }) {
  const { X, Y, S } = useFrame();
  return <rect className={className} x={X(x)} y={Y(y + h)} width={S(w)} height={S(h)} />;
}

/** Centre/axis line (dash-dot). */
export function Axis({ a, b }: { a: [number, number]; b: [number, number] }) {
  return <Seg a={a} b={b} className="sx-axis" />;
}

/** Surface plate: thick line with hatching below. */
export function Plate({ x0, x1, y = 0 }: { x0: number; x1: number; y?: number }) {
  const { X, Y } = useFrame();
  return (
    <g>
      <rect className="sx-plate-hatch" x={X(x0)} y={Y(y)} width={X(x1) - X(x0)} height={10} />
      <line className="sx-plate" x1={X(x0)} y1={Y(y)} x2={X(x1)} y2={Y(y)} />
    </g>
  );
}

/** Text label placed at a model point, offset in svg pixels. */
export function Label({
  at,
  text,
  dx = 0,
  dy = 0,
  anchor = 'middle',
  tone = 'dim',
}: {
  at: [number, number];
  text: string;
  dx?: number;
  dy?: number;
  anchor?: 'start' | 'middle' | 'end';
  tone?: Tone;
}) {
  const { X, Y } = useFrame();
  return (
    <text className={`sx-label ${toneClass(tone)}`} x={X(at[0]) + dx} y={Y(at[1]) + dy} textAnchor={anchor}>
      {text}
    </text>
  );
}

/**
 * Linear dimension between model points a and b, with the dimension line offset `off` svg px
 * to the left of a→b (negative: to the right), extension lines and the text in the middle.
 */
export function Dim({ a, b, off, text, tone = 'dim', textSide = 1 }: { a: [number, number]; b: [number, number]; off: number; text: string; tone?: Tone; textSide?: 1 | -1 }) {
  const { X, Y } = useFrame();
  const ax = X(a[0]);
  const ay = Y(a[1]);
  const bx = X(b[0]);
  const by = Y(b[1]);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  // svg y is down: the left normal of (dx, dy) in svg is (dy, −dx)
  const nx = (by - ay) / len;
  const ny = -(bx - ax) / len;
  const p1 = [ax + nx * off, ay + ny * off];
  const p2 = [bx + nx * off, by + ny * off];
  const ext = (sx: number, sy: number, ex: number, ey: number) => {
    const ux = ex - sx;
    const uy = ey - sy;
    const l = Math.hypot(ux, uy) || 1;
    return <line className="sx-ext" x1={sx + (ux / l) * 3} y1={sy + (uy / l) * 3} x2={ex + (ux / l) * 4} y2={ey + (uy / l) * 4} />;
  };
  let ang = (Math.atan2(p2[1]! - p1[1]!, p2[0]! - p1[0]!) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const mx = (p1[0]! + p2[0]!) / 2;
  const my = (p1[1]! + p2[1]!) / 2;
  const tOff = 6 * textSide;
  const tx = mx + nx * tOff * (off >= 0 ? 1 : -1);
  const ty = my + ny * tOff * (off >= 0 ? 1 : -1);
  const cls = toneClass(tone);
  return (
    <g className={`sx-dim ${cls}`}>
      {Math.abs(off) > 0.5 && ext(ax, ay, p1[0]!, p1[1]!)}
      {Math.abs(off) > 0.5 && ext(bx, by, p2[0]!, p2[1]!)}
      <line
        className={`sx-dimline ${cls}`}
        x1={p1[0]}
        y1={p1[1]}
        x2={p2[0]}
        y2={p2[1]}
        markerStart={`url(#${tone === 'calc' ? 'sx-arrow-calc' : 'sx-arrow'})`}
        markerEnd={`url(#${tone === 'calc' ? 'sx-arrow-calc' : 'sx-arrow'})`}
      />
      <text className={`sx-label ${cls}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${ang.toFixed(2)} ${tx} ${ty})`}>
        <tspan className="sx-halo" stroke="var(--card)">
          {text}
        </tspan>
      </text>
    </g>
  );
}

/**
 * Angle arc at model point c from direction angle a0 to a1 (radians, model frame, CCW),
 * radius in svg px, label outside the arc.
 */
export function AngleArc({ c, a0, a1, r, text, tone = 'dim' }: { c: [number, number]; a0: number; a1: number; r: number; text: string; tone?: Tone }) {
  const { X, Y } = useFrame();
  const cx = X(c[0]);
  const cy = Y(c[1]);
  const p = (a: number, rr = r) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const;
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  const am = (a0 + a1) / 2;
  const [tx, ty] = p(am, r + 14);
  const cls = toneClass(tone);
  return (
    <g className={`sx-dim ${cls}`}>
      <path className={`sx-dimline ${cls}`} d={`M${x0},${y0} A${r},${r} 0 ${large} ${sweep} ${x1},${y1}`} fill="none" />
      <text className={`sx-label ${cls}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle">
        <tspan className="sx-halo" stroke="var(--card)">
          {text}
        </tspan>
      </text>
    </g>
  );
}

/** Small legend explaining the colour code (spec §13.2: never colour alone). */
export function Legend({ items }: { items: { cls: string; text: string }[] }) {
  return (
    <ul className="sx-legend">
      {items.map((i) => (
        <li key={i.cls}>
          <span className={`sw ${i.cls}`} aria-hidden="true" />
          {i.text}
        </li>
      ))}
    </ul>
  );
}
