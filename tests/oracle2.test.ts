/** Phase 2: solvers A and B against the sympy oracle (tools/oracle/geometry_oracle.py). */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gaugeSizesA, gaugeSizesB, limitsFromDesignation } from '../src/core/fixedGauges';
import { eq, parse, toNumber } from '../src/core/rational';
import { sineHeightA, sineHeightB } from '../src/core/sineBar';
import { ballTaperA, ballTaperB, rollerTaperA, rollerTaperB } from '../src/core/taper';
import { deltaLA } from '../src/core/temperature';
import { bestWireA, bestWireB, pitchDiameterA, pitchDiameterB } from '../src/core/threads';

const OUT = 'tools/oracle/out/oracle.json';
const required = process.env.ORACLE_REQUIRED === '1';
const present = existsSync(OUT);
const TOL = 1e-9;
type Row = Record<string, string | number>;
/** Oracle values are numbers or exact strings such as "129/100". */
const n = (x: string | number | undefined) => (typeof x === 'number' ? x : toNumber(parse(String(x))));

describe.skipIf(!present && !required)('sympy oracle — phase 2', () => {
  const d = present ? (JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, Row[]>) : {};
  const rows = (k: string): Row[] => d[k] ?? [];

  it('has every group', () => {
    for (const k of ['sine', 'rollers', 'balls', 'wires', 'temperature', 'limits']) expect(rows(k).length, k).toBeGreaterThan(10);
  });

  it('sine bar', () => {
    for (const r of rows('sine')) {
      expect(Math.abs(sineHeightA(n(r.L), n(r.angleDeg)) - n(r.h))).toBeLessThan(TOL);
      expect(Math.abs(sineHeightB(n(r.L), n(r.angleDeg)) - n(r.h))).toBeLessThan(TOL);
    }
  });

  it('external cone over rollers (incl. MG3 and Euskadi 2020-2)', () => {
    for (const r of rows('rollers')) {
      const data = { rollerD: n(r.rollerD), h1: n(r.h1), h2: n(r.h2), M1: n(r.M1), M2: n(r.M2) };
      for (const s of [rollerTaperA(data), rollerTaperB(data)]) {
        expect(Math.abs(s.C - n(r.C)), JSON.stringify(r)).toBeLessThan(TOL);
        expect(Math.abs(s.halfAngleDeg - n(r.halfAngleDeg))).toBeLessThan(TOL);
        expect(Math.abs(s.diameterAt(0) - n(r.D0))).toBeLessThan(TOL);
      }
    }
  });

  it('internal cone with balls', () => {
    for (const r of rows('balls')) {
      const data = { d1: n(r.d1), d2: n(r.d2), depth1: n(r.depth1), depth2: n(r.depth2) };
      for (const s of [ballTaperA(data), ballTaperB(data)]) {
        expect(Math.abs(s.halfAngleDeg - n(r.halfAngleDeg)), JSON.stringify(r)).toBeLessThan(TOL);
        expect(Math.abs(s.Dtop - n(r.Dtop))).toBeLessThan(TOL);
      }
    }
  });

  it('three wires (incl. MG2)', () => {
    for (const r of rows('wires')) {
      const a = [n(r.M), n(r.dw), n(r.P), n(r.flankAngleDeg)] as const;
      expect(Math.abs(pitchDiameterA(...a) - n(r.d2)), JSON.stringify(r)).toBeLessThan(TOL);
      expect(Math.abs(pitchDiameterB(...a) - n(r.d2))).toBeLessThan(TOL);
      expect(Math.abs(bestWireA(n(r.P), n(r.flankAngleDeg)) - n(r.bestWire))).toBeLessThan(TOL);
      expect(Math.abs(bestWireB(n(r.P), n(r.flankAngleDeg)) - n(r.bestWire))).toBeLessThan(TOL);
    }
  });

  it('temperature (exact)', () => {
    for (const r of rows('temperature')) {
      const t = { L: parse(String(r.L)), alphaPart: parse(String(r.alphaPart)), tPart: parse(String(r.tPart)), alphaTool: parse(String(r.alphaTool)), tTool: parse(String(r.tTool)) };
      expect(eq(deltaLA(t), parse(String(r.dL))), JSON.stringify(r)).toBe(true);
    }
  });

  it('limit gauges (exact)', () => {
    for (const r of rows('limits')) {
      const l = limitsFromDesignation(String(r.designation));
      expect([eq(l.min, parse(String(r.min))), eq(l.max, parse(String(r.max)))], String(r.designation)).toEqual([true, true]);
      for (const g of [gaugeSizesA(l.feature, l.max, l.min), gaugeSizesB(l.feature, l.max, l.min)]) {
        expect([eq(g.go, parse(String(r.go))), eq(g.noGo, parse(String(r.noGo)))], String(r.designation)).toEqual([true, true]);
      }
    }
  });
});
