/**
 * Step-by-step solution (spec §8.4): data → formula → numbers substituted → result with units
 * → checks. Every number comes from the solvers on the exercise's data; texts are keys.
 */
import { toDeg } from '../core/angles';
import { limitsFromDesignation } from '../core/fixedGauges';
import type { Ask, Exercise } from '../core/model';
import * as R from '../core/rational';
import { simulateMicrometer, simulateVernier, VERNIER_MICROMETER, STANDARD_MICROMETER } from '../core/reading';
import { sineBarAngle, type AnswerKey } from '../core/solve';
import { ballTaperA, rollerTaperA } from '../core/taper';
import type { T } from './describe';
import { exactText } from './describe';
import { dms, fmt } from './format';

export type LineKind = 'text' | 'formula' | 'result' | 'warn';
export interface Line {
  kind: LineKind;
  text: string;
}
export interface AskSolution {
  askId: string;
  lines: Line[];
}

const n = (s: string | undefined): number => R.toNumber(R.parse(s ?? '0'));
const f = (x: number, d = 4) => fmt(x, d);
const F = (text: string): Line => ({ kind: 'formula', text });
const X = (text: string): Line => ({ kind: 'text', text });
const W = (text: string): Line => ({ kind: 'warn', text });
const Res = (text: string): Line => ({ kind: 'result', text });

function askLines(ex: Exercise, ask: Ask, key: AnswerKey, t: T): Line[] {
  const s = ex.setup;
  const e = key[ask.id]!;
  switch (s.kind) {
    case 'vernier': {
      const a = 1 / s.n;
      if (ask.kind === 'appreciation') return [F(`a = ${t('sol.mainDiv')} / n = ${f(n(s.s), 0)} / ${s.n} = ${f(a, 3)} mm`)];
      const v = simulateVernier({ s: R.parse(s.s), n: s.n, modulus: s.modulus }, R.parse(s.value));
      return [
        X(t('sol.vernierRead', { main: exactText(v.main), k: v.line })),
        F(`L = ${exactText(v.main)} + ${v.line} · ${f(a, 3)} = ${exactText(R.parse(s.value))} mm`),
        W(t('warn.vernier')),
      ];
    }
    case 'micrometer': {
      const m = s.vernierDivs ? VERNIER_MICROMETER : STANDARD_MICROMETER;
      const v = simulateMicrometer(m, R.parse(s.value));
      return [
        X(t(v.halfMark ? 'sol.microHalf' : 'sol.microWhole', { s: exactText(v.sleeve), k: v.thimble })),
        F(`L = ${exactText(v.sleeve)} + ${v.thimble} · 0,01${s.vernierDivs ? ` + ${v.vernier} · 0,001` : ''} = ${exactText(R.parse(s.value))} mm`),
        W(t('warn.micro')),
      ];
    }
    case 'gaugeStack': {
      const k = e.stack!;
      return [X(t(k.classic ? 'sol.stackClassic' : 'sol.stackDp')), F(`${k.reference.map(exactText).join(' + ')} = ${exactText(k.target)} mm`), X(t('sol.stackMin', { n: k.minCount }))];
    }
    case 'sineBar': {
      const L = n(s.L);
      const al = sineBarAngle(s);
      if (ask.kind === 'sineHeight') {
        const pre = s.taperC ? [F(`α/2 = arctan(C/2) = arctan(${f(n(s.taperC), 5)}/2) = ${f(al)}° (${dms(al)})`), W(t('warn.halfFull'))] : [];
        return [...pre, F(`h = L · sin α = ${f(L, 0)} · sin ${f(al)}° = ${f(e.value)} mm`), X(t('sol.round', { v: fmt(e.value, 3) }))];
      }
      if (ask.kind === 'sineAngle') return [F(`sin α = h / L = ${fmt(n(s.h), 3)} / ${f(L, 0)} = ${f(n(s.h) / L, 6)}`), F(`α = arcsin(${f(n(s.h) / L, 6)}) = ${f(e.value)}° (${dms(e.value)})`), W(t('warn.sinTan'))];
      if (ask.kind === 'gaugeStack') {
        const k = e.stack!;
        return [
          ...(ask.nearestFeasible ? [X(t('sol.nearest', { v: exactText(k.target) }))] : []),
          F(`${k.reference.map(exactText).join(' + ')} = ${exactText(k.target)} mm`),
          X(t('sol.stackMin', { n: k.minCount })),
        ];
      }
      if (ask.kind === 'selectionError') {
        const stackAsk = ex.asks.find((a) => a.kind === 'gaugeStack');
        const hs = stackAsk ? R.toNumber(key[stackAsk.id]!.stack!.target) : NaN;
        const aS = toDeg(Math.asin(hs / L));
        const Lc = s.checkLength ? n(s.checkLength) : L;
        return [F(`α′ = arcsin(${fmt(hs, 3)} / ${f(L, 0)}) = ${f(aS, 5)}°`), F(`e = Lc · tan(α′ − α) = ${f(Lc, 0)} · tan(${f(aS - al, 5)}°) = ${f(e.value, 5)} mm`)];
      }
      break;
    }
    case 'taperRollers': {
      const d = { rollerD: n(s.rollerD), h1: n(s.h1), h2: n(s.h2), M1: n(s.M1), M2: n(s.M2) };
      const A = rollerTaperA(d);
      const C = Math.abs(d.M2 - d.M1) / (d.h2 - d.h1);
      const lineC = F(`C = (M₂ − M₁) / (h₂ − h₁) = (${f(d.M2, 3)} − ${f(d.M1, 3)}) / (${f(d.h2, 3)} − ${f(d.h1, 3)}) = ${f(C, 5)}`);
      const lineHalf = F(`α/2 = arctan(C/2) = arctan(${f(C / 2, 5)}) = ${f(A.halfAngleDeg)}° (${dms(A.halfAngleDeg)})`);
      if (ask.kind === 'taperC') return [X(t('sol.taperWhy')), lineC, Res(`C = ${f(C, 5)} = 1:${f(1 / C, 3)} = ${f(100 * C, 3)} %`), W(t('warn.cHalf'))];
      if (ask.kind === 'halfAngle') return [lineC, lineHalf, W(t('warn.halfFull'))];
      if (ask.kind === 'fullAngle') return [lineHalf, F(`α = 2 · α/2 = ${f(2 * A.halfAngleDeg)}° (${dms(2 * A.halfAngleDeg)})`)];
      if (ask.kind === 'planeAngle') return [lineC, X(t('sol.planeFlank')), F(`φ = arctan(C/2) = ${f(A.halfAngleDeg)}°`), F(`a = 90° + φ = ${f(90 + A.halfAngleDeg)}° (${dms(90 + A.halfAngleDeg)})`), W(t('warn.plane'))];
      if (ask.kind === 'diameter') {
        const yc1 = d.h1 + d.rollerD / 2;
        const Dc = A.diameterAt(yc1);
        const y = ask.at === 'top' ? n(s.coneLength) : 0;
        return [
          F(`D(y₁) = M₁ − d·(1 + 1/cos(α/2)) = ${f(d.M1, 3)} − ${f(d.rollerD, 3)}·(1 + 1/cos ${f(A.halfAngleDeg)}°) = ${f(Dc)} mm  (y₁ = h₁ + d/2 = ${f(yc1, 3)} mm)`),
          F(`D(y) = D(y₁) ${A.widensUp > 0 ? '+' : '−'} C·(y − y₁) = ${f(Dc)} ${A.widensUp > 0 ? '+' : '−'} ${f(C, 5)}·(${f(y, 3)} − ${f(yc1, 3)}) = ${f(e.value)} mm`),
          W(t('warn.rollerTerm')),
        ];
      }
      break;
    }
    case 'taperBalls': {
      const b = { d1: n(s.d1), d2: n(s.d2), depth1: n(s.depth1), depth2: n(s.depth2) };
      const A = ballTaperA(b);
      const z1 = b.depth1 + b.d1 / 2;
      const z2 = b.depth2 + b.d2 / 2;
      const base = [
        X(t('sol.ballsDepth')),
        F(`z₁ = H₁ + r₁ = ${f(b.depth1, 3)} + ${f(b.d1 / 2, 3)} = ${f(z1, 3)} mm;  z₂ = H₂ + r₂ = ${f(b.depth2, 3)} + ${f(b.d2 / 2, 3)} = ${f(z2, 3)} mm`),
        F(`sin(α/2) = (r₂ − r₁) / (z₁ − z₂) = ${f(b.d2 / 2 - b.d1 / 2, 3)} / ${f(z1 - z2, 3)} = ${f(Math.sin((A.halfAngleDeg * Math.PI) / 180), 6)}`),
        F(`α/2 = ${f(A.halfAngleDeg)}° (${dms(A.halfAngleDeg)})`),
      ];
      if (ask.kind === 'halfAngle') return [...base, W(t('warn.sinTanBalls'))];
      if (ask.kind === 'fullAngle') return [...base, F(`α = ${f(2 * A.halfAngleDeg)}°`)];
      if (ask.kind === 'taperC') return [...base, F(`C = 2·tan(α/2) = ${f(A.C, 5)}`)];
      if (ask.kind === 'diameter') return [...base, F(`D = 2·(r₂/cos(α/2) + z₂·tan(α/2)) = ${f(A.Dtop)} mm`)];
      break;
    }
    case 'threeWire': {
      const P = n(s.P);
      const a = n(s.flankAngleDeg);
      const half = (a / 2) * (Math.PI / 180);
      const k1 = 1 + 1 / Math.sin(half);
      const k2 = 1 / (2 * Math.tan(half));
      if (ask.kind === 'bestWire') return [X(t('sol.bestWire')), F(`dw = P / (2·cos(α/2)) = ${f(P, 3)} / (2·cos ${f(a / 2, 2)}°) = ${f(e.value)} mm`)];
      if (ask.kind === 'pitchDiameter')
        return [
          F(`d₂ = M − dw·(1 + 1/sin(α/2)) + (P/2)·cot(α/2)`),
          ...(a === 60 ? [F('α = 60°:  d₂ = M − 3·dw + 0,866025·P')] : []),
          F(`d₂ = ${f(n(s.M), 3)} − ${f(k1, 4)}·${f(n(s.wireD), 3)} + ${f(k2, 6)}·${f(P, 3)} = ${f(e.value)} mm`),
          W(t('warn.wire')),
        ];
      if (ask.kind === 'measure') return [F(`M = d₂ + dw·(1 + 1/sin(α/2)) − (P/2)·cot(α/2)`), F(`M = ${f(n(s.d2), 3)} + ${f(k1, 4)}·${f(n(s.wireD), 3)} − ${f(k2, 6)}·${f(P, 3)} = ${f(e.value)} mm`), W(t('warn.wire'))];
      break;
    }
    case 'spline': {
      const r = n(s.rollerD) / 2;
      const h = n(s.vAngleDeg) / 2;
      const oc = r / Math.sin((h * Math.PI) / 180);
      return [
        X(t('sol.spline')),
        F(`OC = r / sin(θ/2) = ${f(r, 3)} / sin ${f(h, 1)}° = ${f(oc)} mm`),
        F(`M = 2·(Ra + OC + r) = 2·(${f(n(s.apexRadius), 3)} + ${f(oc)} + ${f(r, 3)}) = ${f(e.value)} mm`),
        W(t('warn.rollerTerm')),
      ];
    }
    case 'dovetail': {
      const d = n(s.rollerD);
      const a = n(s.alphaDeg);
      const k = d * (1 + 1 / Math.tan((a * Math.PI) / 360));
      const male = s.dovetail === 'male';
      const base = [X(t(male ? 'sol.doveMale' : 'sol.doveFemale')), F(`k = d·(1 + cot(α/2)) = ${f(d, 3)}·(1 + cot ${f(a / 2, 1)}°) = ${f(k)} mm`)];
      if (ask.kind === 'measure') return [...base, F(`X = ${male ? 'b + k' : 'B − k'} = ${f(n(s.width), 3)} ${male ? '+' : '−'} ${f(k)} = ${f(e.value)} mm`)];
      return [...base, F(`${male ? 'b = X − k' : 'B = X + k'} = ${f(n(s.X), 3)} ${male ? '−' : '+'} ${f(k)} = ${f(e.value)} mm`)];
    }
    case 'temperature': {
      const L = n(s.L);
      const ap = n(s.alphaPart);
      const tp = n(s.tPart);
      if (s.given === 'at20') {
        const dL = L * ap * (tp - 20);
        const l1 = F(`ΔL = L·α·ΔT = ${f(L, 3)} · ${ap.toExponential(2)} · (${f(tp, 1)} − 20) = ${f(dL, 5)} mm`);
        return ask.kind === 'tempDelta' ? [l1] : [l1, F(`L_T = L + ΔL = ${f(L + dL, 5)} mm`)];
      }
      const tool = s.alphaTool && s.tTool ? n(s.alphaTool) * (n(s.tTool) - 20) : 0;
      const dL = L * (ap * (tp - 20) - tool);
      const l1 = F(
        s.alphaTool
          ? `ΔL = L·(α_p·ΔT_p − α_t·ΔT_t) = ${f(L, 3)}·(${ap.toExponential(2)}·${f(tp - 20, 1)} − ${n(s.alphaTool).toExponential(2)}·${f(n(s.tTool) - 20, 1)}) = ${f(dL, 5)} mm`
          : `ΔL = L·α·ΔT = ${f(L, 3)} · ${ap.toExponential(2)} · ${f(tp - 20, 1)} = ${f(dL, 5)} mm`,
      );
      const w = W(t('warn.temp'));
      return ask.kind === 'tempDelta' ? [l1, w] : [l1, F(`L₂₀ = L − ΔL = ${f(L, 3)} − ${f(dL, 5)} = ${f(L - dL, 5)} mm`), w];
    }
    case 'fixedGauge': {
      const lines: Line[] = [];
      if (s.designation) {
        const l = limitsFromDesignation(s.designation);
        lines.push(X(t('sol.isoLimits', { d: s.designation, up: l.upperDev, lo: l.lowerDev, it: l.IT })));
        lines.push(F(`${t('sol.max')} = ${exactText(l.max)} mm · ${t('sol.min')} = ${exactText(l.min)} mm`));
      }
      lines.push(X(t(ex.setup.kind === 'fixedGauge' && (s.designation ? limitsFromDesignation(s.designation).feature : s.feature) === 'hole' ? 'sol.taylorHole' : 'sol.taylorShaft')));
      lines.push(Res(`${t(ask.kind === 'gaugeGo' ? 'gauge.go' : 'gauge.noGo')} = ${exactText(e.exact!)} mm`));
      return lines;
    }
    case 'error': {
      const xs = s.measured.map(n);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const t0 = n(s.trueValue);
      const l1 = F(`x̄ = (${xs.map((x) => f(x, 3)).join(' + ')}) / ${xs.length} = ${f(mean, 5)} mm`);
      if (ask.kind === 'errorAbs') return [l1, F(`E = x̄ − x_v = ${f(mean, 5)} − ${f(t0, 3)} = ${f(e.value, 5)} mm`)];
      return [l1, F(`E_r = (x̄ − x_v) / x_v · 100 = ${f(mean - t0, 5)} / ${f(t0, 3)} · 100 = ${f(e.value, 5)} %`)];
    }
  }
  return [];
}

export function solutionLines(ex: Exercise, key: AnswerKey, t: T): AskSolution[] {
  return ex.asks.map((a) => ({ askId: a.id, lines: askLines(ex, a, key, t) }));
}
