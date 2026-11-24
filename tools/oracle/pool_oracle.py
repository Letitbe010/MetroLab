"""Phase 4 oracle: re-solves every ask of the whole pool (src/data/pool.json) independently.

Geometry is set up as tangency equations in sympy, exact arithmetic with fractions, minimum
stacks by meet-in-the-middle (oracle.MinStack). Output: one row per ask with the value
(float) or the exact value (fraction string); tests/oracle4.test.ts compares with solve.ts.
"""

from __future__ import annotations

import json
from fractions import Fraction
from pathlib import Path

import sympy as sp

from geometry_oracle import R, ball_taper_case, limits_case, num, three_wire_case

ROOT = Path(__file__).resolve().parents[2]


def F(s) -> Fraction:
    return Fraction(str(s))


def fs(x: Fraction) -> str:
    return f"{x.numerator}/{x.denominator}" if x.denominator != 1 else str(x.numerator)


def roller_line(dr, h1, h2, M1, M2):
    """Right flank x = a + b*y tangent to both (outside) rollers; returns (a, b) exact."""
    a, b = sp.symbols("a b", real=True)
    r = R(dr) / 2
    eqs = []
    for h, M in ((h1, M1), (h2, M2)):
        xc, yc = R(M) / 2 - r, R(h) + r
        eqs.append(sp.Eq((xc - a - b * yc) / sp.sqrt(1 + b**2), r))
    (sol,) = sp.solve(eqs, [a, b], dict=True)
    return sol[a], sol[b]


def spline_M(dr, theta, ra):
    yc = sp.symbols("yc", real=True)
    r = R(dr) / 2
    h = sp.pi * R(theta) / 360
    apex = sp.Point(0, R(ra))
    flank = sp.Line(apex, apex + sp.Point(sp.sin(h), sp.cos(h)))
    (sol,) = [s for s in sp.solve(sp.Eq(flank.distance(sp.Point(0, yc)) ** 2, r**2), yc) if s > R(ra)]
    return num(2 * (sol + r))


def dovetail_X(kind, dr, alpha, width=None, X=None):
    """Roller tangent to the plate (y = 0) and to the flank through the corner (w/2, 0)."""
    x, w = sp.symbols("x w", real=True)
    r = R(dr) / 2
    a = sp.pi * R(alpha) / 180
    corner = sp.Point(w / 2, 0)
    direction = sp.Point(sp.cos(a), sp.sin(a)) if kind == "male" else sp.Point(-sp.cos(a), sp.sin(a))
    flank = sp.Line(corner, corner + direction)
    eq = sp.Eq(flank.distance(sp.Point(x, r)) ** 2, r**2)
    meas = 2 * (x + r) if kind == "male" else 2 * (x - r)
    if width is not None:
        sols = sp.solve(eq.subs(w, R(width)), x)
        # the roller is outside the tongue (male) / under the overhang inside the slot (female)
        good = [s for s in sols if (s > R(width) / 2 if kind == "male" else s < R(width) / 2)]
        return num(meas.subs(x, good[0]))
    # X given: unknown width
    xs = sp.solve(sp.Eq(meas, R(X)), x)[0]
    sols = sp.solve(eq.subs(x, xs), w)
    good = [s for s in sols if (xs.subs(w, s) > s / 2 if kind == "male" else xs.subs(w, s) < s / 2) and s > 0]
    return num(good[0])


def build(pool, solvers, sets):
    rows = []

    def put(ex, ask, value=None, exact=None, minimum=None):
        rows.append({"id": ex["id"], "ask": ask["id"], "value": value, "exact": exact, "min": minimum})

    for ex in pool:
        s = ex["setup"]
        k = s["kind"]
        for ask in ex["asks"]:
            q = ask["kind"]
            if k == "vernier":
                put(ex, ask, exact=fs(F(s["s"]) / s["n"]) if q == "appreciation" else fs(F(s["value"])))
            elif k == "micrometer":
                put(ex, ask, exact=fs(F(s["value"])))
            elif k == "gaugeStack":
                m, _ = solvers[s["set"]].solve(F(s["target"]))
                put(ex, ask, minimum=m)
            elif k == "sineBar":
                L = R(s["L"])
                if "angleDeg" in s:
                    al = sp.pi * R(s["angleDeg"]) / 180
                elif "taperC" in s:
                    al = sp.atan(R(s["taperC"]) / 2)
                else:
                    al = sp.asin(R(s["h"]) / L)
                h = L * sp.sin(al)
                if q == "sineHeight":
                    put(ex, ask, value=num(h))
                elif q == "sineAngle":
                    put(ex, ask, value=num(al * 180 / sp.pi))
                else:
                    sid = s.get("set", "87")
                    if ask.get("nearestFeasible") or q == "selectionError":
                        # nearest multiple of the set's unit that the set can build
                        unit = Fraction(1, 1000) if sid != "madrid2023" else Fraction(5, 1000)
                        hv = Fraction(str(sp.N(h, 30)))
                        k0 = round(hv / unit)
                        cands = sorted({k0 + d for d in range(-40, 41)}, key=lambda kk: abs(kk * unit - hv))
                        target = next(kk * unit for kk in cands if solvers[sid].solve(kk * unit)[0] is not None)
                    else:
                        target = Fraction(str(round(float(sp.N(h, 30)), 3)))
                    if q == "gaugeStack":
                        put(ex, ask, minimum=solvers[sid].solve(target)[0])
                    else:
                        Lc = R(s.get("checkLength", s["L"]))
                        put(ex, ask, value=num(Lc * sp.tan(sp.asin(sp.Rational(target.numerator, target.denominator) / L) - al)))
            elif k == "taperRollers":
                a, b = roller_line(s["rollerD"], s["h1"], s["h2"], s["M1"], s["M2"])
                half = sp.atan(sp.Abs(b)) * 180 / sp.pi
                if q == "taperC":
                    put(ex, ask, value=num(2 * sp.Abs(b)))
                elif q == "halfAngle":
                    put(ex, ask, value=num(half))
                elif q == "fullAngle":
                    put(ex, ask, value=num(2 * half))
                elif q == "planeAngle":
                    put(ex, ask, value=num(90 + half))
                elif q == "diameter":
                    y = R(s["coneLength"]) if ask.get("at") == "top" else 0
                    put(ex, ask, value=num(2 * (a + b * y)))
            elif k == "taperBalls":
                c = ball_taper_case(s["d1"], s["d2"], s["depth1"], s["depth2"])
                key = {"halfAngle": c["halfAngleDeg"], "fullAngle": 2 * c["halfAngleDeg"], "taperC": c["C"], "diameter": c["Dtop"]}[q]
                put(ex, ask, value=key)
            elif k == "threeWire":
                if q == "bestWire":
                    put(ex, ask, value=num(R(s["P"]) / (2 * sp.cos(sp.pi * R(s["flankAngleDeg"]) / 360))))
                elif q == "pitchDiameter":
                    put(ex, ask, value=three_wire_case(s["P"], s["flankAngleDeg"], s["wireD"], s["M"])["d2"])
                else:  # measure from d2: M solves d2(M) = d2 (linear) — use two evaluations
                    d0 = three_wire_case(s["P"], s["flankAngleDeg"], s["wireD"], "0")["d2"]
                    put(ex, ask, value=float(F(s["d2"])) - d0)
            elif k == "spline":
                put(ex, ask, value=spline_M(s["rollerD"], s["vAngleDeg"], s["apexRadius"]))
            elif k == "dovetail":
                if q == "measure":
                    put(ex, ask, value=dovetail_X(s["dovetail"], s["rollerD"], s["alphaDeg"], width=s["width"]))
                else:
                    put(ex, ask, value=dovetail_X(s["dovetail"], s["rollerD"], s["alphaDeg"], X=s["X"]))
            elif k == "temperature":
                L, ap, tp = F(s["L"]), F(s["alphaPart"]), F(s["tPart"])
                if s["given"] == "measured":
                    tool = F(s["alphaTool"]) * (F(s["tTool"]) - 20) if "alphaTool" in s else Fraction(0)
                    dL = L * ap * (tp - 20) - L * tool
                    put(ex, ask, exact=fs(dL if q == "tempDelta" else L - dL))
                else:
                    dL = L * ap * (tp - 20)
                    put(ex, ask, exact=fs(dL if q == "tempDelta" else L + dL))
            elif k == "fixedGauge":
                if "designation" in s:
                    c = limits_case(s["designation"], json.loads((ROOT / "src/data/iso286_subset.json").read_text(encoding="utf-8")))
                    go, nogo = Fraction(c["go"]), Fraction(c["noGo"])
                else:
                    mx, mn = F(s["max"]), F(s["min"])
                    go, nogo = (mn, mx) if s["feature"] == "hole" else (mx, mn)
                put(ex, ask, exact=fs(go if q == "gaugeGo" else nogo))
            elif k == "error":
                xs = [F(x) for x in s["measured"]]
                mean = sum(xs) / len(xs)
                t = F(s["trueValue"])
                put(ex, ask, exact=fs(mean - t if q == "errorAbs" else 100 * (mean - t) / t))
            else:
                raise ValueError(k)
    return rows


def run(solvers, sets):
    pool = json.loads((ROOT / "src/data/pool.json").read_text(encoding="utf-8"))
    return build(pool, solvers, sets)

