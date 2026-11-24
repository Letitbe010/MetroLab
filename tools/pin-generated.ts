/**
 * Writes src/data/pool.json = hand-modelled OPE/adapted exercises (src/data/pool-ope.json)
 * + one pinned generated exercise per template and level (seed 1, status review-needed).
 * Usage: npx vite-node tools/pin-generated.ts
 * tests/pool.test.ts checks that the pinned entries still equal what the generator builds.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { generate, LEVELS, TEMPLATES } from '../src/core/generator';
import type { Exercise } from '../src/core/model';

const ope = JSON.parse(readFileSync('src/data/pool-ope.json', 'utf8')) as Exercise[];
const pinned: Exercise[] = [];
for (const t of TEMPLATES) {
  for (const lv of LEVELS[t]) {
    const g = generate(t, 1, lv).exercise;
    pinned.push({ ...g, status: 'review-needed' });
  }
}
writeFileSync('src/data/pool.json', JSON.stringify([...ope, ...pinned], null, 1) + '\n');
console.log(`pool: ${ope.length} OPE/adapted + ${pinned.length} pinned generated`);
