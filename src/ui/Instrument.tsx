/**
 * Instrument scales for reading exercises (spec §6): vernier caliper and micrometer, drawn from
 * the same exact mark positions as solver B (core/reading.ts), with zoom and horizontal scroll.
 */
import { useEffect, useRef, useState } from 'react';
import { simulateMicrometer, simulateVernier, type MicrometerSpec, type VernierSpec } from '../core/reading';
import { toNumber, type Rational } from '../core/rational';

const ZOOMS = [10, 16, 26];

/** Integers a..b inclusive (kept out of the components: loops confuse the hooks lint rule). */
const range = (a: number, b: number): number[] => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

function ZoomBar({ zoom, setZoom, labels }: { zoom: number; setZoom: (z: number) => void; labels: { out: string; in: string; title: string } }) {
  return (
    <div className="zoombar" role="group" aria-label={labels.title}>
      <button className="small" aria-label={labels.out} disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}>
        −
      </button>
      <span className="zoomval">{`${zoom + 1}/${ZOOMS.length}`}</span>
      <button className="small" aria-label={labels.in} disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(zoom + 1)}>
        +
      </button>
    </div>
  );
}

export interface InstrumentTxt {
  zoomOut: string;
  zoomIn: string;
  zoom: string;
  mainScale: string;
  vernier: string;
  sleeve: string;
  thimble: string;
}

// ---------------------------------------------------------------- vernier caliper

export function VernierScale({ spec, value, showCoincidence, title, txt }: { spec: VernierSpec; value: Rational; showCoincidence?: boolean; title: string; txt: InstrumentTxt }) {
  const [zoom, setZoom] = useState(1);
  const k = ZOOMS[zoom]!; // px per mm
  const view = simulateVernier(spec, value);
  const s = toNumber(spec.s);
  const x = toNumber(value);
  const g = ((spec.modulus * spec.n - 1) * s) / spec.n; // vernier spacing, mm
  const vlen = spec.n * g;
  const from = Math.max(0, Math.floor(x / 10) * 10 - 10);
  const to = x + vlen + 8;
  const W = (to - from) * k;
  const X = (mm: number) => (mm - from) * k;
  const beamTop = 18;
  const beamBot = 66;
  const vTop = beamBot;
  const vBot = 116;
  const mainTicks = range(Math.ceil(from / s), Math.floor(to / s)).map((i) => i * s);
  const labelStep = spec.n / 10;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = Math.max(0, X(x) - 60);
  });
  return (
    <figure className="instrument">
      <ZoomBar zoom={zoom} setZoom={setZoom} labels={{ out: txt.zoomOut, in: txt.zoomIn, title: txt.zoom }} />
      <div className="scroll" ref={ref}>
        <svg width={W} height={130} viewBox={`0 0 ${W} 130`} role="img" aria-label={title}>
          <title>{title}</title>
          <rect className="in-beam" x={0} y={beamTop} width={W} height={beamBot - beamTop} />
          <text className="in-cap" x={6} y={beamTop + 14}>
            {txt.mainScale}
          </text>
          {mainTicks.map((m) => {
            const long = Math.abs(m % 10) < 1e-9;
            const mid = Math.abs(m % 5) < 1e-9;
            const len = long ? 20 : mid ? 14 : 9;
            return (
              <g key={m}>
                <line className="in-tick" x1={X(m)} y1={beamBot} x2={X(m)} y2={beamBot - len} />
                {long && (
                  <text className="in-num" x={X(m)} y={beamBot - 24} textAnchor="middle">
                    {m / 10}
                  </text>
                )}
              </g>
            );
          })}
          <rect className="in-vernier" x={X(x) - 10} y={vTop} width={vlen * k + 20} height={vBot - vTop} />
          <text className="in-cap" x={X(x) + vlen * k + 14} y={vBot - 6}>
            {txt.vernier}
          </text>
          {Array.from({ length: spec.n + 1 }, (_, j) => {
            const pos = x + j * g;
            const labelled = j % labelStep === 0;
            const hit = showCoincidence && j === view.line;
            return (
              <g key={j}>
                <line className={`in-tick${hit ? ' hit' : ''}`} x1={X(pos)} y1={vTop} x2={X(pos)} y2={vTop + (labelled ? 18 : 11)} />
                {labelled && (
                  <text className={`in-num${hit ? ' hit' : ''}`} x={X(pos)} y={vTop + 32} textAnchor="middle">
                    {j / labelStep}
                  </text>
                )}
              </g>
            );
          })}
          {showCoincidence && <line className="in-hitline" x1={X(toNumber(view.coincidentMark))} y1={beamBot - 26} x2={X(toNumber(view.coincidentMark))} y2={vTop + 36} />}
        </svg>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------- micrometer

export function MicrometerScale({ spec, value, showCoincidence, title, txt }: { spec: MicrometerSpec; value: Rational; showCoincidence?: boolean; title: string; txt: InstrumentTxt }) {
  const [zoom, setZoom] = useState(1);
  const k = ZOOMS[zoom]! * 2.2; // px per mm on the sleeve
  const view = simulateMicrometer(spec, value);
  const x = toNumber(value);
  const pitch = toNumber(spec.pitch);
  const N = spec.thimbleDivs;
  const frac = ((x - toNumber(view.sleeve)) / pitch) * N; // thimble position in divisions
  const from = Math.max(0, Math.floor(x) - 6);
  const sleeveW = (x - from) * k;
  const thimbleW = 120;
  const W = sleeveW + thimbleW + 20;
  const mid = spec.vernierDivs > 0 ? 140 : 90;
  const R = spec.vernierDivs > 0 ? 120 : 70; // projected thimble radius, px (larger with a vernier)
  const X = (mm: number) => (mm - from) * k;
  const ticks = range(Math.ceil(from * 2), Math.floor(x * 2 + 1e-9)).map((h) => h / 2);
  const proj = (divs: number) => mid - R * Math.sin((divs / N) * 2 * Math.PI);
  const visible = (divs: number) => Math.abs((divs / N) * 2 * Math.PI) < (75 * Math.PI) / 180;
  const thimbleLines = range(Math.floor(frac) - 12, Math.ceil(frac) + 12);
  const V = spec.vernierDivs;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  });
  return (
    <figure className="instrument">
      <ZoomBar zoom={zoom} setZoom={setZoom} labels={{ out: txt.zoomOut, in: txt.zoomIn, title: txt.zoom }} />
      <div className="scroll" ref={ref}>
        <svg width={W} height={2 * mid} viewBox={`0 0 ${W} ${2 * mid}`} role="img" aria-label={title}>
          <title>{title}</title>
          <rect className="in-beam" x={0} y={mid - 34} width={sleeveW + 4} height={68} />
          <text className="in-cap" x={6} y={mid + 30}>
            {txt.sleeve}
          </text>
          <line className="in-ref" x1={0} y1={mid} x2={sleeveW} y2={mid} />
          {ticks.map((t) => {
            const whole = Math.abs(t - Math.round(t)) < 1e-9;
            return (
              <g key={t}>
                {whole ? (
                  <line className="in-tick" x1={X(t)} y1={mid} x2={X(t)} y2={mid - (t % 5 === 0 ? 16 : 11)} />
                ) : (
                  <line className="in-tick" x1={X(t)} y1={mid} x2={X(t)} y2={mid + 11} />
                )}
                {whole && t % 5 === 0 && (
                  <text className="in-num" x={X(t)} y={mid - 20} textAnchor="middle">
                    {t}
                  </text>
                )}
              </g>
            );
          })}
          {V > 0 &&
            Array.from({ length: V + 1 }, (_, j) => {
              // vernier lines on the sleeve: 10 divisions span 9 thimble divisions
              const y = proj((j * (V - 1)) / V); // same cylinder projection as the thimble lines
              const hit = showCoincidence && j === view.vernier;
              return (
                <g key={`v${j}`}>
                  <line className={`in-tick${hit ? ' hit' : ''}`} x1={sleeveW - 30} y1={y} x2={sleeveW} y2={y} />
                  {j % 2 === 0 && (
                    <text className={`in-num small${hit ? ' hit' : ''}`} x={sleeveW - 34} y={y + 4} textAnchor="end">
                      {j}
                    </text>
                  )}
                </g>
              );
            })}
          <rect className="in-thimble" x={sleeveW} y={mid - R - 6} width={thimbleW} height={2 * R + 12} rx={6} />
          <text className="in-cap" x={sleeveW + thimbleW - 6} y={mid + R} textAnchor="end">
            {txt.thimble}
          </text>
          {thimbleLines.map((d) => {
            const rel = d - frac; // divisions above the reference line (higher numbers above)
            if (!visible(rel)) return null;
            const y = proj(rel);
            const n = ((d % N) + N) % N;
            const labelled = n % 5 === 0;
            const hit = showCoincidence && n === view.thimble;
            return (
              <g key={d}>
                <line className={`in-tick${hit ? ' hit' : ''}`} x1={sleeveW} y1={y} x2={sleeveW + (labelled ? 22 : 14)} y2={y} />
                {labelled && (
                  <text className={`in-num${hit ? ' hit' : ''}`} x={sleeveW + 28} y={y + 5}>
                    {n}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
