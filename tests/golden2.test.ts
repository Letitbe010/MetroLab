import { describe, expect, it } from 'vitest';
import golden from './golden/golden.json';
import { checkStack, classicStack, getSet, minStack } from '../src/core/gaugeBlocks';
import { parse, round, toFixed, toNumber } from '../src/core/rational';
import { sineHeightA, sineHeightB } from '../src/core/sineBar';
import { bestWireA, bestWireB, pitchDiameterA, pitchDiameterB } from '../src/core/threads';
import { rollerTaperA, rollerTaperB, rollerTaperCExact } from '../src/core/taper';
import { deltaLA, deltaLB } from '../src/core/temperature';

type Case = { id: string; data: Record<string, string | number>; expected: Record<string, unknown> };
const byId = (id: string): Case => (golden.cases as unknown as Case[]).find((c) => c.id === id)!;
const s = (x: unknown) => x as string;
const n = (x: unknown) => Number(x as string);

describe('golden — phase 2', () => {
  it('MG1: L = 100, α = 15° → h = 25.8819 (µm: 25.882); stack 1.002 + 1.38 + 3.5 + 20', () => {
    const c = byId('MG1');
    const hA = sineHeightA(n(c.data.L), n(c.data.angleDeg));
    const hB = sineHeightB(n(c.data.L), n(c.data.angleDeg));
    expect(hA.toFixed(4)).toBe(c.expected.h);
    expect(Math.abs(hA - hB)).toBeLessThan(1e-9);
    const hMicron = hA.toFixed(3);
    expect(hMicron).toBe(c.expected.hMicron);
    const set = getSet(s(c.data.set));
    const a = classicStack(parse(hMicron), set)!;
    expect(a.map((b) => toFixed(b, 3))).toEqual((c.expected.stack as string[]).map((b) => toFixed(parse(b), 3)));
    expect(minStack(parse(hMicron), set)!.count).toBe(c.expected.minBlocks);
    expect(checkStack(a, parse(hMicron), set).ok).toBe(true);
  });

  it('MG2: M10 × 1.5, best wire 0.866, M = 10.325 → d2 = 9.026', () => {
    const c = byId('MG2');
    const P = n(c.data.P);
    const ang = n(c.data.flankAngleDeg);
    expect(bestWireA(P, ang).toFixed(3)).toBe(c.expected.bestWire);
    expect(Math.abs(bestWireA(P, ang) - bestWireB(P, ang))).toBeLessThan(1e-9);
    const dA = pitchDiameterA(n(c.data.M), n(c.data.wireD), P, ang);
    const dB = pitchDiameterB(n(c.data.M), n(c.data.wireD), P, ang);
    expect(dA.toFixed(3)).toBe(c.expected.d2);
    expect(Math.abs(dA - dB)).toBeLessThan(1e-9);
    // the spec's metric shortcut d2 = M − 3·dw + 0.866025·P
    expect(Math.abs(dA - (10.325 - 3 * 0.866 + 0.866025 * 1.5))).toBeLessThan(1e-6);
  });

  it('MG3: h1 = 0, M1 = 40, h2 = 60, M2 = 46 → C = 1:10, α/2 = 2.8624°, α = 5.7248°', () => {
    const c = byId('MG3');
    const C = rollerTaperCExact(parse(s(c.data.M1)), parse(s(c.data.M2)), parse(s(c.data.h1)), parse(s(c.data.h2)));
    expect(toNumber(C)).toBe(n(c.expected.C));
    const data = { rollerD: 10, h1: n(c.data.h1), h2: n(c.data.h2), M1: n(c.data.M1), M2: n(c.data.M2) };
    const a = rollerTaperA(data);
    const b = rollerTaperB(data);
    expect(a.halfAngleDeg.toFixed(4)).toBe(c.expected.halfAngleDeg);
    expect(a.angleDeg.toFixed(4)).toBe(c.expected.angleDeg);
    expect(Math.abs(a.halfAngleDeg - b.halfAngleDeg)).toBeLessThan(1e-9);
    expect(Math.abs(a.C - b.C)).toBeLessThan(1e-12);
  });

  it('MG4: steel, L = 200 at 25 °C, tool at 20 °C → ΔL = 0.0115 mm', () => {
    const c = byId('MG4');
    const t = { L: parse(s(c.data.L)), alphaPart: parse(s(c.data.alphaPart)), tPart: parse(s(c.data.tPart)) };
    expect(toFixed(deltaLA(t), 4)).toBe(c.expected.dL);
    expect(toFixed(round(deltaLB(t), 4), 4)).toBe(c.expected.dL);
  });
});
