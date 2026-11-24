/**
 * Schemas, part B: three wires, spline gap over rollers, dovetail, limit gauges, temperature.
 */
import { overSplineRollersA, dovetailA, type DovetailKind } from '../../core/profiles';
import { overWiresA } from '../../core/threads';
import { AngleArc, Axis, Circle, Dim, Frame, Label, Plate, Poly, Rect, Seg, type Tone } from './svg';
import type { Txt } from './schemasA';

const rad = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------- three wires

export interface ThreeWireProps {
  P: number;
  flankAngleDeg: number;
  d2: number;
  dw: number;
  labels: { M: string; P: string; dw: string; angle: string; d2?: string };
  tones?: { M?: Tone; d2?: Tone };
  title: string;
  txt: Txt;
}

export function ThreeWireSchema(p: ThreeWireProps) {
  const th = rad(p.flankAngleDeg / 2);
  const Hs = p.P / (2 * Math.tan(th)); // sharp V height
  const crest = p.d2 / 2 + 0.375 * Hs; // ISO basic profile: d − d2 = 0.75·H
  const root = p.d2 / 2 - 0.25 * Hs; // root flat of width P/4 (basic profile)
  const r = p.dw / 2;
  const M = overWiresA(p.d2, p.dw, p.P, p.flankAngleDeg);
  // Broken view: the core of the shaft is cut out so the profile can be drawn large.
  const g = 0.45 * p.P;
  const cut = Math.max(0, root - 0.9 * p.P);
  const Y = (y: number) => (y >= 0 ? y - cut + g : y + cut - g);
  const half = 2.5 * p.P; // drawn length each side of the centre
  // grooves (thread spaces) centred on x = shift + k·P
  const profile = (shift: number, sign: 1 | -1): [number, number][] => {
    const pts: [number, number][] = [];
    for (let k = -4; k <= 4; k++) {
      const gc = shift + k * p.P;
      const rh = p.P / 8;
      const flank = (crest - root) * Math.tan(th);
      pts.push([gc - rh - flank, crest], [gc - rh, root], [gc + rh, root], [gc + rh + flank, crest]);
    }
    const inside = pts.filter(([x]) => x > -half && x < half);
    const all: [number, number][] = [[-half, crest], ...inside, [half, crest]];
    return all.map(([x, y]) => [x, Y(sign * y)] as [number, number]);
  };
  const topBand: [number, number][] = [[-half, Y(cut)], ...profile(p.P / 2, 1), [half, Y(cut)]];
  const botBand: [number, number][] = [[-half, Y(-cut)], ...profile(0, -1), [half, Y(-cut)]];
  const zig = (y: number): [number, number][] => {
    const n = 10;
    return Array.from({ length: n + 1 }, (_, i) => [-half + (2 * half * i) / n, y + (i % 2 ? 0.12 : -0.12) * g] as [number, number]);
  };
  const wy = M / 2 - r;
  const anvil = 0.5 * p.P;
  const xr = half + 0.35 * p.P;
  const box = { x0: -half - 0.6 * p.P, y0: Y(-M / 2) - anvil * 1.4, x1: half + 1.2 * p.P, y1: Y(M / 2) + anvil * 1.6 };
  const apex = p.d2 / 2 - Hs / 2; // sharp V apex of a groove
  const ax = -2 * p.P; // a groove of the lower band
  return (
    <Frame box={box} title={p.title} noScaleText={p.txt.noScale}>
      <Poly className="sx-piece" pts={topBand} />
      <Poly className="sx-piece" pts={botBand} />
      <Poly className="sx-gap" pts={[...zig(Y(cut)), ...zig(Y(-cut)).reverse()]} />
      <Rect className="sx-anvil" x={-1.4 * p.P} y={Y(M / 2)} w={2.8 * p.P} h={anvil} />
      <Rect className="sx-anvil" x={-0.9 * p.P} y={Y(-M / 2) - anvil} w={1.8 * p.P} h={anvil} />
      <Circle className="sx-roller" c={[-p.P / 2, Y(wy)]} r={r} />
      <Circle className="sx-roller" c={[p.P / 2, Y(wy)]} r={r} />
      <Circle className="sx-roller" c={[0, Y(-wy)]} r={r} />
      <Dim a={[xr, Y(-M / 2)]} b={[xr, Y(M / 2)]} off={-14} text={p.labels.M} tone={p.tones?.M ?? 'dim'} />
      <Seg className="sx-ext" a={[0.9 * p.P, Y(-M / 2)]} b={[xr + 0.1 * p.P, Y(-M / 2)]} />
      <Seg className="sx-ext" a={[1.4 * p.P, Y(M / 2)]} b={[xr + 0.1 * p.P, Y(M / 2)]} />
      <Dim a={[-p.P / 2, Y(root)]} b={[p.P / 2, Y(root)]} off={-26} text={p.labels.P} />
      <Label at={[-p.P / 2 - r, Y(wy + r)]} dx={-6} dy={-4} anchor="end" text={p.labels.dw} />
      {p.labels.d2 !== undefined && (
        <>
          <Seg className={`sx-pitch ${p.tones?.d2 === 'calc' ? 'calc' : ''}`} a={[-half, Y(p.d2 / 2)]} b={[half, Y(p.d2 / 2)]} />
          <Label at={[half, Y(p.d2 / 2)]} dx={6} dy={5} anchor="start" text={p.labels.d2} tone={p.tones?.d2 ?? 'dim'} />
        </>
      )}
      <Seg className="sx-ref" a={[ax, Y(-apex)]} b={[ax - Math.sin(th) * p.P, Y(-apex - Math.cos(th) * p.P)]} />
      <Seg className="sx-ref" a={[ax, Y(-apex)]} b={[ax + Math.sin(th) * p.P, Y(-apex - Math.cos(th) * p.P)]} />
      <AngleArc c={[ax, Y(-apex)]} a0={-Math.PI / 2 - th} a1={-Math.PI / 2 + th} r={30} text={p.labels.angle} />
    </Frame>
  );
}

// ---------------------------------------------------------------- spline gap

export interface SplineProps {
  rollerD: number;
  vAngleDeg: number;
  apexRadius: number;
  labels: { M: string; d: string; angle: string; Ra: string };
  tones?: { M?: Tone };
  title: string;
  txt: Txt;
}

export function SplineSchema(p: SplineProps) {
  const r = p.rollerD / 2;
  const h = rad(p.vAngleDeg / 2);
  const Rc = p.apexRadius + r / Math.sin(h); // roller centre radius
  const Rt = Rc; // tooth tips at the roller centre: the roller sticks out by r
  const M = overSplineRollersA(p);
  // flank meets the tip circle at distance t from the apex
  const t = -p.apexRadius * Math.cos(h) + Math.sqrt(p.apexRadius ** 2 * Math.cos(h) ** 2 - p.apexRadius ** 2 + Rt ** 2);
  const notch = (dir: 1 | -1): [number, number][] => {
    // local frame: radial axis along ±y
    const a = dir * p.apexRadius;
    return [
      [-t * Math.sin(h), dir * (p.apexRadius + t * Math.cos(h))],
      [0, a],
      [t * Math.sin(h), dir * (p.apexRadius + t * Math.cos(h))],
    ];
  };
  const edgeAng = Math.atan2(p.apexRadius + t * Math.cos(h), t * Math.sin(h)); // from +x
  const arc = (from: number, to: number): [number, number][] => {
    const pts: [number, number][] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      pts.push([Rt * Math.cos(a), Rt * Math.sin(a)]);
    }
    return pts;
  };
  const top = notch(1);
  const bot = notch(-1);
  const shape: [number, number][] = [
    top[2]!,
    ...arc(edgeAng, -edgeAng).slice(1, -1),
    [bot[2]![0], bot[2]![1]],
    bot[1]!,
    bot[0]!,
    ...arc(Math.PI + edgeAng, Math.PI - edgeAng).slice(1, -1),
    top[0]!,
    top[1]!,
  ];
  const ext = M / 2;
  const box = { x0: -Rt * 1.15, y0: -ext * 1.06, x1: Rt * 1.75, y1: ext * 1.06 };
  return (
    <Frame box={box} title={p.title} noScaleText={p.txt.noScale}>
      <Poly className="sx-piece" pts={shape} />
      <Axis a={[0, -ext * 1.04]} b={[0, ext * 1.04]} />
      <Axis a={[-Rt * 1.1, 0]} b={[Rt * 1.1, 0]} />
      <Circle className="sx-roller" c={[0, Rc]} r={r} />
      <Circle className="sx-roller" c={[0, -Rc]} r={r} />
      <Seg className="sx-ref" a={[0, p.apexRadius]} b={[-(t + 2 * r) * Math.sin(h), p.apexRadius + (t + 2 * r) * Math.cos(h)]} />
      <Seg className="sx-ref" a={[0, p.apexRadius]} b={[(t + 2 * r) * Math.sin(h), p.apexRadius + (t + 2 * r) * Math.cos(h)]} />
      <AngleArc c={[0, p.apexRadius]} a0={Math.PI / 2 - h} a1={Math.PI / 2 + h} r={26} text={p.labels.angle} />
      <Dim a={[0, 0]} b={[0, p.apexRadius]} off={-Rt * 0 - 0.001} text={p.labels.Ra} textSide={-1} />
      <Dim a={[Rt * 1.05, -ext]} b={[Rt * 1.05, ext]} off={-24} text={p.labels.M} tone={p.tones?.M ?? 'dim'} />
      <Seg className="sx-ext" a={[0, ext]} b={[Rt * 1.05, ext]} />
      <Seg className="sx-ext" a={[0, -ext]} b={[Rt * 1.05, -ext]} />
      <Label at={[r, Rc + r]} dx={6} dy={-4} anchor="start" text={p.labels.d} />
    </Frame>
  );
}

// ---------------------------------------------------------------- dovetail

export interface DovetailProps {
  kind: DovetailKind;
  rollerD: number;
  alphaDeg: number;
  width: number;
  labels: { X: string; width: string; d: string; alpha: string };
  tones?: { X?: Tone; width?: Tone };
  title: string;
  txt: Txt;
}

export function DovetailSchema(p: DovetailProps) {
  const r = p.rollerD / 2;
  const a = rad(p.alphaDeg);
  const X = dovetailA(p);
  const Ht = p.rollerD * 1.6;
  const w2 = p.width / 2;
  const k = r / Math.tan(a / 2); // corner → tangent point along the plate
  const big = Math.max(p.width, X) / 2 + 3 * r;
  if (p.kind === 'male') {
    const topHalf = w2 + Ht / Math.tan(a);
    const xc = w2 + k;
    const box = { x0: -big, y0: -0.9 * Ht, x1: big, y1: Ht * 1.2 };
    return (
      <Frame box={box} title={p.title} noScaleText={p.txt.noScale}>
        <Plate x0={-big} x1={big} />
        <Poly className="sx-piece" pts={[[-w2, 0], [w2, 0], [topHalf, Ht], [-topHalf, Ht]]} />
        <Circle className="sx-roller" c={[xc, r]} r={r} />
        <Circle className="sx-roller" c={[-xc, r]} r={r} />
        <Dim a={[-w2, 0]} b={[w2, 0]} off={-20} text={p.labels.width} tone={p.tones?.width ?? 'dim'} />
        <Dim a={[-(X / 2), 0]} b={[X / 2, 0]} off={-46} text={p.labels.X} tone={p.tones?.X ?? 'dim'} />
        <AngleArc c={[w2, 0]} a0={0} a1={a} r={30} text={p.labels.alpha} />
        <Label at={[-xc - r, r]} dx={-6} dy={5} anchor="end" text={p.labels.d} />
      </Frame>
    );
  }
  const topHalf = w2 - Ht / Math.tan(a);
  const xc = w2 - k;
  const outer = w2 + 3 * r;
  const box = { x0: -outer, y0: -0.3 * Ht, x1: outer, y1: Ht * 1.5 };
  return (
    <Frame box={box} title={p.title} noScaleText={p.txt.noScale}>
      <Poly className="sx-piece-section" pts={[[-outer, -0.2 * Ht], [outer, -0.2 * Ht], [outer, Ht], [topHalf, Ht], [w2, 0], [-w2, 0], [-topHalf, Ht], [-outer, Ht]]} />
      <Circle className="sx-roller" c={[xc, r]} r={r} />
      <Circle className="sx-roller" c={[-xc, r]} r={r} />
      <Dim a={[-(X / 2), r]} b={[X / 2, r]} off={Ht * 0 + 0.001} text={p.labels.X} tone={p.tones?.X ?? 'dim'} />
      <Dim a={[-w2, 0]} b={[w2, 0]} off={-28} text={p.labels.width} tone={p.tones?.width ?? 'dim'} />
      <AngleArc c={[w2, 0]} a0={Math.PI - a} a1={Math.PI} r={30} text={p.labels.alpha} />
      <Label at={[-xc, 2 * r]} dy={-6} text={p.labels.d} />
    </Frame>
  );
}

// ---------------------------------------------------------------- limit gauges

export function FixedGaugeSchema({
  feature,
  labels,
  tone = 'dim',
  title,
  txt,
}: {
  feature: 'hole' | 'shaft';
  labels: { go: string; noGo: string; goWord: string; noGoWord: string };
  tone?: Tone;
  title: string;
  txt: Txt;
}) {
  if (feature === 'hole') {
    // plug gauge: GO end long (left), NO-GO end short with a band (right)
    const box = { x0: -60, y0: -26, x1: 60, y1: 26 };
    return (
      <Frame box={box} title={title} noScaleText={txt.noScale} maxHeight={220}>
        <Rect className="sx-piece" x={-54} y={-8} w={34} h={16} />
        <Rect className="sx-handle" x={-20} y={-5} w={44} h={10} />
        <Rect className="sx-piece" x={24} y={-8.3} w={16} h={16.6} />
        <Rect className="sx-nogo" x={34} y={-8.3} w={3} h={16.6} />
        <Label at={[-37, 8]} dy={-8} text={labels.goWord} />
        <Label at={[32, 8.3]} dy={-8} text={labels.noGoWord} />
        <Dim a={[-50, -8]} b={[-50, 8]} off={18} text={labels.go} tone={tone} />
        <Dim a={[36, -8.3]} b={[36, 8.3]} off={-18} text={labels.noGo} tone={tone} />
      </Frame>
    );
  }
  // snap gauge: C frame open to the right; the outer (larger) gap is GO = d_max,
  // the inner (smaller) gap is NO-GO = d_min (Taylor)
  const box = { x0: -40, y0: -34, x1: 74, y1: 34 };
  return (
    <Frame box={box} title={title} noScaleText={txt.noScale} maxHeight={240}>
      <Poly className="sx-piece" pts={[[-30, 30], [44, 30], [44, 14], [12, 14], [12, 10], [-14, 10], [-14, -10], [12, -10], [12, -14], [44, -14], [44, -30], [-30, -30]]} />
      <Rect className="sx-nogo" x={-14} y={-10} w={2} h={20} />
      <Label at={[44, 30]} dx={4} dy={14} anchor="start" text={labels.goWord} />
      <Label at={[-14, 10]} dx={4} dy={-8} anchor="start" text={labels.noGoWord} />
      <Dim a={[34, -14]} b={[34, 14]} off={0.001} text={labels.go} tone={tone} />
      <Dim a={[2, -10]} b={[2, 10]} off={0.001} text={labels.noGo} tone={tone} />
    </Frame>
  );
}

// ---------------------------------------------------------------- temperature

export function TemperatureSchema({ labels, title, txt }: { labels: { L: string; tPart: string; tTool?: string; partWord: string; toolWord: string }; title: string; txt: Txt }) {
  const box = { x0: -10, y0: -22, x1: 110, y1: 30 };
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);
  return (
    <Frame box={box} title={title} noScaleText={txt.noScale} maxHeight={220}>
      <Rect className="sx-piece" x={0} y={4} w={100} h={10} />
      <Label at={[50, 14]} dy={-34} text={`${labels.partWord}: ${labels.tPart}`} />
      <Rect className="sx-scale" x={-4} y={-12} w={108} h={8} />
      {ticks.map((x) => (
        <Seg key={x} className="sx-tick" a={[x, -4]} b={[x, x % 10 === 0 ? -8 : -6]} />
      ))}
      {labels.tTool && <Label at={[50, -12]} dy={16} text={`${labels.toolWord}: ${labels.tTool}`} />}
      <Dim a={[0, 14]} b={[100, 14]} off={0.001} text={labels.L} />
      <Seg className="sx-ext" a={[0, -4]} b={[0, 4]} />
      <Seg className="sx-ext" a={[100, -4]} b={[100, 4]} />
    </Frame>
  );
}
