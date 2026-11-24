/**
 * Schemas, part A: external cone over rollers, internal cone with balls, sine bar, gauge stack.
 * Geometry comes from core/ (solver A); labels are passed in already formatted, so the same
 * drawing serves the statement ("?"), the solution (orange) and the theory widgets.
 */
import { rollerTaperA } from '../../core/taper';
import { AngleArc, Axis, Circle, Dim, Frame, Label, Plate, Poly, Rect, Seg, type Tone } from './svg';

export interface Txt {
  noScale: string;
}

const MIN_DRAW_DEG = 5; // smaller angles are drawn larger ("not to scale")
const rad = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------- external cone over rollers

export interface TaperRollersProps {
  rollerD: number;
  h1: number;
  h2: number;
  M1: number;
  M2: number;
  labels: { M1: string; M2: string; h1: string; h2: string; d: string; half?: string };
  halfTone?: Tone;
  title: string;
  txt: Txt;
  /** Plane version (trapezoid, Euskadi 2022-B): angle drawn from the base, not the axis. */
  plane?: boolean;
}

export function TaperRollersSchema(p: TaperRollersProps) {
  const r = p.rollerD / 2;
  const real = rollerTaperA({ rollerD: p.rollerD, h1: p.h1, h2: p.h2, M1: p.M1, M2: p.M2 });
  const beta = Math.max(real.halfAngleDeg, MIN_DRAW_DEG);
  const noScale = beta !== real.halfAngleDeg;
  const w = real.widensUp;
  const yc1 = p.h1 + r;
  const yc2 = p.h2 + r;
  const s = w * 2 * Math.tan(rad(beta));
  const Dc1 = real.diameterAt(yc1);
  const D = (y: number) => Dc1 + s * (y - yc1);
  const xc = (y: number) => D(y) / 2 + r / Math.cos(rad(beta));
  const H = yc2 + r + 0.25 * (p.h2 - p.h1 + p.rollerD);
  const x1 = xc(yc1);
  const x2 = xc(yc2);
  const xmax = Math.max(x1, x2) + r;
  const bw = p.rollerD * 1.25;
  // Blocks sit under the rollers but stick out outwards, clear of the cone.
  const blockIn = (x: number, h: number) => Math.max(x - 0.3 * r, Math.max(D(0), D(h)) / 2 + 0.15 * r);
  // Both positions fit in one drawing (as in Euskadi 2020 and 2022) unless the blocks of
  // position 2 would pass through the rollers of position 1: then draw them side by side.
  const clash = p.h2 > yc1 - r && blockIn(x2, p.h2) < x1 + r;
  const span = 2 * xmax + 2 * bw;
  const up = Math.PI / 2;
  const ym = (yc1 + yc2) / 2;

  const cone = (ox: number) => (
    <>
      <Poly
        className="sx-piece"
        pts={[
          [ox - D(0) / 2, 0],
          [ox + D(0) / 2, 0],
          [ox + D(H) / 2, H],
          [ox - D(H) / 2, H],
        ]}
      />
      {!p.plane && <Axis a={[ox, -0.03 * H]} b={[ox, H * 1.04]} />}
    </>
  );
  const position = (ox: number, x: number, h: number, yc: number) => (
    <>
      {h > 0 && (
        <>
          <Rect className="sx-block" x={ox + blockIn(x, h)} y={0} w={bw} h={h} />
          <Rect className="sx-block" x={ox - blockIn(x, h) - bw} y={0} w={bw} h={h} />
        </>
      )}
      <Circle className="sx-roller" c={[ox + x, yc]} r={r} />
      <Circle className="sx-roller" c={[ox - x, yc]} r={r} />
    </>
  );
  const angle = (ox: number) =>
    p.labels.half === undefined ? null : p.plane ? (
      <AngleArc c={[ox + D(0) / 2, 0]} a0={up - w * rad(beta)} a1={Math.PI} r={62} text={p.labels.half} tone={p.halfTone ?? 'dim'} />
    ) : (
      <>
        <Seg className="sx-ref" a={[ox - D(ym) / 2, ym - 0.12 * H]} b={[ox - D(ym) / 2, ym + 0.3 * H]} />
        <AngleArc c={[ox - D(ym) / 2, ym]} a0={up} a1={up + w * rad(beta)} r={54} text={p.labels.half} tone={p.halfTone ?? 'dim'} />
      </>
    );
  // M over the tops of the upper rollers, M1 below the plate; heights on the right
  const dimM2 = (ox: number) => <Dim a={[ox - (x2 + r), yc2 + r]} b={[ox + x2 + r, yc2 + r]} off={14} text={p.labels.M2} />;
  const dimM1 = (ox: number) => <Dim a={[ox - (x1 + r), yc1 - r]} b={[ox + x1 + r, yc1 - r]} off={-22} text={p.labels.M1} />;
  const dimH = (ox: number, x: number, h: number, text: string, off: number) =>
    h > 0 ? <Dim a={[ox + blockIn(x, h) + bw, 0]} b={[ox + blockIn(x, h) + bw, h]} off={-off} text={text} /> : null;
  const rollerLabel = (ox: number, x: number, yc: number) => <Label at={[ox - x - r, yc]} dx={-5} dy={5} anchor="end" text={p.labels.d} />;

  if (clash) {
    const o1 = -span / 2 - bw * 0.3;
    const o2 = span / 2 + bw * 0.3;
    const box = { x0: o1 - xmax - bw * 2, y0: -0.12 * H, x1: o2 + xmax + bw * 2.6, y1: H };
    return (
      <Frame box={box} title={p.title} noScale={noScale} noScaleText={p.txt.noScale}>
        <Plate x0={box.x0} x1={box.x1} />
        {cone(o1)}
        {cone(o2)}
        {position(o1, x1, p.h1, yc1)}
        {position(o2, x2, p.h2, yc2)}
        {dimM1(o1)}
        {dimM2(o2)}
        {dimH(o1, x1, p.h1, p.labels.h1, 14)}
        {dimH(o2, x2, p.h2, p.labels.h2, 14)}
        {rollerLabel(o1, x1, yc1)}
        <Label at={[o1, H]} dy={-8} text="①" />
        <Label at={[o2, H]} dy={-8} text="②" />
        {angle(o1)}
      </Frame>
    );
  }
  const box = { x0: -xmax - bw * 2, y0: -0.12 * H, x1: xmax + bw * 2.8, y1: H };
  return (
    <Frame box={box} title={p.title} noScale={noScale} noScaleText={p.txt.noScale}>
      <Plate x0={box.x0} x1={box.x1} />
      {cone(0)}
      {position(0, x1, p.h1, yc1)}
      {position(0, x2, p.h2, yc2)}
      {dimM2(0)}
      {dimM1(0)}
      {dimH(0, x2, p.h1, p.labels.h1, 14)}
      {dimH(0, x2, p.h2, p.labels.h2, p.h1 > 0 ? 36 : 14)}
      {rollerLabel(0, x2, yc2)}
      {angle(0)}
    </Frame>
  );
}

// ---------------------------------------------------------------- internal cone with balls

export interface TaperBallsProps {
  d1: number;
  d2: number;
  depth1: number;
  depth2: number;
  halfAngleDeg: number;
  Dtop: number;
  labels: { d1: string; d2: string; depth1: string; depth2: string; Dtop?: string; half?: string };
  tones?: { Dtop?: Tone; half?: Tone };
  title: string;
  txt: Txt;
}

export function TaperBallsSchema(p: TaperBallsProps) {
  const beta = Math.max(p.halfAngleDeg, MIN_DRAW_DEG);
  const noScale = beta !== p.halfAngleDeg;
  const t = Math.tan(rad(beta));
  const c = Math.cos(rad(beta));
  // drawing geometry: keep the top diameter, recompute where each ball sits for the drawn angle
  const R0 = p.Dtop / 2;
  const zc = (r: number) => (R0 - r / c) / t;
  const balls = [
    { r: p.d1 / 2, z: noScale ? zc(p.d1 / 2) : p.depth1 + p.d1 / 2, lab: p.labels.d1, dep: p.labels.depth1 },
    { r: p.d2 / 2, z: noScale ? zc(p.d2 / 2) : p.depth2 + p.d2 / 2, lab: p.labels.d2, dep: p.labels.depth2 },
  ];
  const depth = Math.max(...balls.map((b) => b.z + b.r)) * 1.12;
  const Rb = Math.max(R0 - depth * t, R0 * 0.2);
  const wall = R0 * 0.55;
  const panelW = 2 * (R0 + wall);
  const gap = R0 * 0.9;
  const top = Math.max(0, ...balls.map((b) => b.r - b.z)) + 0.08 * depth;
  const box = { x0: -panelW / 2, y0: -depth, x1: panelW * 1.5 + gap, y1: top + 0.06 * depth };
  const panel = (cx: number, i: number) => {
    const b = balls[i]!;
    return (
      <g key={i}>
        <Poly className="sx-piece-section" pts={[[cx - R0 - wall, 0], [cx - R0, 0], [cx - Rb, -depth], [cx - R0 - wall, -depth]]} />
        <Poly className="sx-piece-section" pts={[[cx + R0 + wall, 0], [cx + R0, 0], [cx + Rb, -depth], [cx + R0 + wall, -depth]]} />
        <Axis a={[cx, -depth * 1.03]} b={[cx, top]} />
        <Circle className="sx-roller" c={[cx, -b.z]} r={b.r} />
        <Seg className="sx-ref" a={[cx - R0 - wall * 0.6, 0]} b={[cx + R0 + wall * 0.6, 0]} />
        <Dim a={[cx + b.r * 0.2, 0]} b={[cx + b.r * 0.2, -(b.z - b.r)]} off={-(b.r * 0) - 30} text={b.dep} />
        <Label at={[cx, -b.z]} dy={5} text={b.lab} />
      </g>
    );
  };
  return (
    <Frame box={box} title={p.title} noScale={noScale} noScaleText={p.txt.noScale}>
      {panel(0, 0)}
      {panel(panelW + gap, 1)}
      {p.labels.Dtop !== undefined && <Dim a={[panelW + gap - R0, 0]} b={[panelW + gap + R0, 0]} off={22} text={p.labels.Dtop} tone={p.tones?.Dtop ?? 'dim'} />}
      {p.labels.half !== undefined && (
        <AngleArc c={[panelW + gap + Rb, -depth]} a0={Math.PI / 2} a1={Math.PI / 2 - rad(beta)} r={40} text={p.labels.half} tone={p.tones?.half ?? 'dim'} />
      )}
    </Frame>
  );
}

// ---------------------------------------------------------------- sine bar

export interface SineBarProps {
  L: number;
  angleDeg: number;
  /** Optional stack, bottom to top, for the drawing (block sizes in mm). */
  stack?: number[];
  labels: { L: string; h: string; angle: string; stack?: string[] };
  tones?: { h?: Tone; angle?: Tone };
  title: string;
  txt: Txt;
}

export function SineBarSchema(p: SineBarProps) {
  const a = Math.max(p.angleDeg, MIN_DRAW_DEG);
  const noScale = a !== p.angleDeg;
  const r = p.L * 0.07;
  const h = p.L * Math.sin(rad(a));
  const run = p.L * Math.cos(rad(a));
  const c1: [number, number] = [0, r];
  const c2: [number, number] = [run, r + h];
  const ux = Math.cos(rad(a));
  const uy = Math.sin(rad(a));
  const nx = -uy;
  const ny = ux;
  const thick = r * 1.6;
  const e = r * 1.6; // bar overhang beyond the rollers
  const base = (k: number, off: number): [number, number] => [c1[0] + ux * k + nx * off, c1[1] + uy * k + ny * off];
  const bar: [number, number][] = [base(-e, r * 0.2), base(p.L + e, r * 0.2), base(p.L + e, r * 0.2 + thick), base(-e, r * 0.2 + thick)];
  const bw = 2.6 * r;
  const blocks = p.stack && p.stack.length ? p.stack : [h];
  const total = blocks.reduce((s, b) => s + b, 0);
  let y = 0;
  const box = { x0: -e - r, y0: -0.03 * p.L, x1: run + e + 3.2 * r, y1: r + h + thick + 1.8 * r };
  return (
    <Frame box={box} title={p.title} noScale={noScale} noScaleText={p.txt.noScale}>
      <Plate x0={box.x0} x1={box.x1} />
      {blocks.map((b, i) => {
        const hh = (b / total) * h;
        const el = <Rect key={i} className="sx-block" x={run - bw / 2} y={y} w={bw} h={hh} />;
        y += hh;
        return el;
      })}
      <Poly className="sx-piece" pts={bar} />
      <Circle className="sx-roller" c={c1} r={r} />
      <Circle className="sx-roller" c={c2} r={r} />
      <Dim a={c1} b={c2} off={r * 0 + 46} text={p.labels.L} />
      <Dim a={[run + bw / 2, 0]} b={[run + bw / 2, h]} off={-18} text={p.labels.h} tone={p.tones?.h ?? 'dim'} />
      <Seg className="sx-ref" a={c1} b={[run * 0.45, r]} />
      <AngleArc c={c1} a0={0} a1={rad(a)} r={56} text={p.labels.angle} tone={p.tones?.angle ?? 'dim'} />
    </Frame>
  );
}

// ---------------------------------------------------------------- gauge stack

export function GaugeStackSchema({ blocks, labels, total, title, txt, tone = 'dim' }: { blocks: number[]; labels: string[]; total: string; title: string; txt: Txt; tone?: Tone }) {
  const sum = blocks.reduce((s, b) => s + b, 0) || 1;
  const minH = sum * 0.07;
  const hs = blocks.map((b) => Math.max(b, minH));
  const H = hs.reduce((s, b) => s + b, 0);
  const w = H * 0.35;
  let y = 0;
  const box = { x0: -w * 1.4, y0: -H * 0.03, x1: w * 2.6, y1: H * 1.02 };
  const noScale = hs.some((h, i) => h !== blocks[i]);
  return (
    <Frame box={box} title={title} noScale={noScale} noScaleText={txt.noScale} maxHeight={340}>
      <Plate x0={box.x0} x1={box.x1} />
      {hs.map((h, i) => {
        const el = (
          <g key={i}>
            <Rect className="sx-block" x={0} y={y} w={w} h={h} />
            <Label at={[w, y + h / 2]} dx={10} dy={5} anchor="start" text={labels[i] ?? ''} />
          </g>
        );
        y += h;
        return el;
      })}
      <Dim a={[0, 0]} b={[0, H]} off={18} text={total} tone={tone} />
    </Frame>
  );
}
