/** Phase 4: the answer key of the whole pool against the Python oracle (tools/oracle/pool_oracle.py). */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as R from '../src/core/rational';
import { solveExercise } from '../src/core/solve';
import { POOL } from '../src/data/pool';

const OUT = 'tools/oracle/out/oracle.json';
const required = process.env.ORACLE_REQUIRED === '1';
const present = existsSync(OUT);

interface Row {
  id: string;
  ask: string;
  value: number | null;
  exact: string | null;
  min: number | null;
}

describe.skipIf(!present && !required)('oracle — whole pool', () => {
  const rows = present ? ((JSON.parse(readFileSync(OUT, 'utf8')) as { pool?: Row[] }).pool ?? []) : [];

  it('covers every ask of the pool', () => {
    expect(rows.length).toBe(POOL.reduce((s, e) => s + e.asks.length, 0));
  });

  it('every ask agrees with solve.ts (1e-9 for floats, exactly for exact values, same minimum stack)', () => {
    for (const row of rows) {
      const ex = POOL.find((e) => e.id === row.id)!;
      const e = solveExercise(ex)[row.ask]!;
      const label = `${row.id}.${row.ask}`;
      if (row.min !== null) expect(e.stack?.minCount, label).toBe(row.min);
      else if (row.exact !== null) expect(R.eq(e.exact ?? R.parse(String(e.value)), R.parse(row.exact)), label).toBe(true);
      else expect(Math.abs(e.value - row.value!), label).toBeLessThan(1e-9);
    }
  });
});
