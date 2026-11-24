"""MetroLab Python oracle (spec §5.4).

Independent re-implementation with exact fractions:
  * instrument readings (vernier caliper, micrometer) from the golden cases and seeded random cases;
  * minimum gauge-block stacks by meet-in-the-middle over block combinations (not DP),
    for the golden stack and seeded random targets.

Usage:
    python tools/oracle/oracle.py <out.json> tests/golden/golden.json

The TypeScript test tests/oracle.test.ts compares solvers A and B with <out.json>.
"""

from __future__ import annotations

import json
import random
import sys
from fractions import Fraction
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAX_BLOCKS = 6


def F(s) -> Fraction:
    return Fraction(str(s).replace(",", "."))


def fstr(x: Fraction) -> str:
    return f"{x.numerator}/{x.denominator}" if x.denominator != 1 else str(x.numerator)


# ------------------------------------------------------------------ readings

def vernier(s: Fraction, n: int, main: Fraction, line: int) -> Fraction:
    return main + line * s / n


def micrometer(sleeve: Fraction, thimble: int, vern: int = 0, pitch=Fraction(1, 2), divs=50, vdivs=0) -> Fraction:
    c = pitch / divs
    return sleeve + thimble * c + (vern * c / vdivs if vdivs else 0)


# ------------------------------------------------------------------ gauge blocks

def load_sets():
    data = json.loads((ROOT / "src/data/gaugeSets.json").read_text(encoding="utf-8"))
    out = {}
    for s in data["sets"]:
        blocks = []
        for ser in s["series"]:
            v, to, st = F(ser["from"]), F(ser["to"]), F(ser["step"])
            while v <= to:
                blocks.append(v)
                v += st
        assert len(blocks) == s["count"], s["id"]
        out[s["id"]] = sorted(blocks)
    return out


class MinStack:
    """Minimum number of distinct blocks summing exactly to a target (≤ MAX_BLOCKS)."""

    def __init__(self, blocks):
        self.blocks = blocks
        self.by_size = {}
        for k in (1, 2, 3):
            d = {}
            for idx in combinations(range(len(blocks)), k):
                d.setdefault(sum(blocks[i] for i in idx), []).append(idx)
            self.by_size[k] = d

    def solve(self, target: Fraction):
        for k in range(1, MAX_BLOCKS + 1):
            a = k // 2
            b = k - a
            if a == 0:
                hit = self.by_size[1].get(target)
                if hit:
                    return k, [self.blocks[i] for i in hit[0]]
                continue
            da, db = self.by_size[a], self.by_size[b]
            for s1, lst1 in da.items():
                lst2 = db.get(target - s1)
                if not lst2:
                    continue
                for t1 in lst1:
                    for t2 in lst2:
                        if not set(t1) & set(t2):
                            return k, sorted(self.blocks[i] for i in t1 + t2)
        return None, None


def main(out_path: str, golden_path: str) -> None:
    golden = json.loads(Path(golden_path).read_text(encoding="utf-8"))["cases"]
    sets = load_sets()
    solvers = {k: MinStack(v) for k, v in sets.items()}
    out = {"readings": [], "stacks": []}

    g = {c["id"]: c for c in golden}
    d = g["MG5"]["data"]
    out["readings"].append({"id": "MG5", "kind": "vernier", "s": d["s"], "n": d["divisions"], "main": d["main"],
                            "line": d["line"], "value": fstr(vernier(F(d["s"]), d["divisions"], F(d["main"]), d["line"]))})
    d = g["MG6"]["data"]
    out["readings"].append({"id": "MG6", "kind": "micrometer", "sleeve": d["sleeve"], "thimble": d["thimble"], "vernier": 0,
                            "vdivs": 0, "value": fstr(micrometer(F(d["sleeve"]), d["thimble"]))})

    rnd = random.Random(20261124)
    for i in range(300):
        n = rnd.choice([10, 20, 50])
        main_ = rnd.randint(0, 150)
        line = rnd.randrange(n)
        out["readings"].append({"id": f"V{i}", "kind": "vernier", "s": "1", "n": n, "main": str(main_), "line": line,
                                "value": fstr(vernier(Fraction(1), n, Fraction(main_), line))})
    for i in range(300):
        vd = rnd.choice([0, 10])
        sleeve = Fraction(rnd.randint(0, 50), 2)
        th = rnd.randrange(50)
        vv = rnd.randrange(10) if vd else 0
        out["readings"].append({"id": f"M{i}", "kind": "micrometer", "sleeve": fstr(sleeve), "thimble": th, "vernier": vv,
                                "vdivs": vd, "value": fstr(micrometer(sleeve, th, vv, vdivs=vd))})

    # Gauge stacks: the golden target, feasible random targets and arbitrary µm targets.
    targets = [("MG1", "87", F(g["MG1"]["expected"]["hMicron"]))]
    for i in range(120):
        sid = rnd.choice(list(sets))
        bl = sets[sid]
        k = rnd.randint(1, 5)
        targets.append((f"F{i}", sid, sum(rnd.sample(bl, k))))
    for i in range(60):
        sid = rnd.choice(list(sets))
        targets.append((f"R{i}", sid, Fraction(rnd.randint(1000, 150000), 1000)))
    for tid, sid, t in targets:
        k, stack = solvers[sid].solve(t)
        out["stacks"].append({"id": tid, "set": sid, "target": fstr(t), "min": k,
                              "stack": [fstr(b) for b in stack] if stack else None})

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"oracle: {len(out['readings'])} readings, {len(out['stacks'])} stacks -> {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
