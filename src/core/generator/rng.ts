/** Seeded PRNG (mulberry32) and small sampling helpers: same seed → same exercise (spec §10.3). Copied from EkoizpenLab (originally KalitateLab). */
export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(xs: readonly T[]): T;
  normal(mu?: number, sigma?: number): number;
  shuffle<T>(xs: T[]): T[];
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  const r: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)]!,
    normal: (mu = 0, sigma = 1) => {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return mu + sigma * s;
      }
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      const m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      return mu + sigma * m * Math.cos(2 * Math.PI * v);
    },
    shuffle: (xs) => {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [xs[i], xs[j]] = [xs[j]!, xs[i]!];
      }
      return xs;
    },
  };
  return r;
}
