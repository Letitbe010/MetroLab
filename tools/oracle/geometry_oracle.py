"""Phase 2 oracle cases: sine bar, tapers (rollers, balls), three wires, temperature, limit gauges.

Everything is set up as tangency equations and solved with sympy (exact rationals where the
data are rational), then evaluated to 15 significant digits. Independent of the TypeScript
closed forms (solver A) and of its float geometry (solver B).
"""

from __future__ import annotations

import json
import random
from fractions import Fraction
from pathlib import Path

import sympy as sp

ROOT = Path(__file__).resolve().parents[2]
N = 15  # significant digits when evaluating


def R(x) -> sp.Rational:
    return sp.Rational(str(x))


def num(e) -> float:
    return float(sp.N(e, N + 5))


# ------------------------------------------------------------------ sine bar

def sine_case(L, deg):
    h = R(L) * sp.sin(sp.pi * R(deg) / 180)
    return {"L": str(L), "angleDeg": str(deg), "h": num(h)}


# ------------------------------------------------------------------ external taper over rollers

def roller_taper_case(dr, h1, h2, M1, M2):
    """Right flank x = a + b*y; each roller (centre outside the cone) at distance r from it."""
    a, b = sp.symbols("a b", real=True)
    r = R(dr) / 2
    eqs = []
    for h, M in ((h1, M1), (h2, M2)):
        xc, yc = R(M) / 2 - r, R(h) + r
        # signed distance from the line x - a - b*y = 0, positive on the outside (+x)
        eqs.append(sp.Eq((xc - a - b * yc) / sp.sqrt(1 + b**2), r))
    sol = sp.solve(eqs, [a, b], dict=True)
    assert len(sol) == 1, sol
    av, bv = sol[0][a], sol[0][b]
    half = sp.atan(sp.Abs(bv))
    return {"rollerD": str(dr), "h1": str(h1), "h2": str(h2), "M1": str(M1), "M2": str(M2),
            "C": num(2 * sp.Abs(bv)), "halfAngleDeg": num(half * 180 / sp.pi), "D0": num(2 * av)}


# ------------------------------------------------------------------ internal taper with balls

def ball_taper_case(d1, d2, depth1, depth2):
    """Right flank x = a + b*y (y up, top face y = 0); ball centres on the axis, inside the hole.
    Tangency of both balls, solved numerically with sympy.nsolve at 30 digits (the symbolic
    solve of this system is far too slow)."""
    a, b = sp.symbols("a b", real=True)
    eqs = []
    for d, dep in ((d1, depth1), (d2, depth2)):
        r = R(d) / 2
        yc = -(R(dep) + r)
        eqs.append((a + b * yc) / sp.sqrt(1 + b**2) - r)
    guess = (R(d2), sp.Rational(1, 10))
    av, bv = sp.nsolve(eqs, [a, b], guess, prec=30)
    assert bv > 0 and av > 0, (av, bv)
    half = sp.atan(bv)
    return {"d1": str(d1), "d2": str(d2), "depth1": str(depth1), "depth2": str(depth2),
            "halfAngleDeg": num(half * 180 / sp.pi), "C": num(2 * bv), "Dtop": num(2 * av)}


# ------------------------------------------------------------------ three wires

def three_wire_case(P, angle_deg, dw, M):
    """Wire centre on the groove axis at height yc, tangent to the flank through (P/4, d2/2)."""
    d2, yc = sp.symbols("d2 yc", real=True)
    # half flank angle; 60° stays exact, other angles are evaluated to 50 digits (exact
    # trig of e.g. 11π/72 makes sympy's simplifier hang)
    t = sp.pi * R(angle_deg) / 360
    if R(angle_deg) != 60:
        t = sp.Float(sp.N(t, 50), 50)
    r = R(dw) / 2
    # right flank: points (P/4 + s*sin t, d2/2 + s*cos t); distance from (0, yc) to it = r
    # line: cos t * (x - P/4) - sin t * (y - d2/2) = 0, wire on the side x < flank
    dist = -(sp.cos(t) * (0 - R(P) / 4) - sp.sin(t) * (yc - d2 / 2))
    # both conditions are linear in (d2, yc): linsolve keeps the trig constants exact
    (sol,) = sp.linsolve([dist - r, 2 * (yc + r) - R(M)], [d2, yc])
    best = R(P) / (2 * sp.cos(t))
    return {"P": str(P), "flankAngleDeg": str(angle_deg), "dw": str(dw), "M": str(M),
            "d2": num(sol[0]), "bestWire": num(best)}


# ------------------------------------------------------------------ temperature (linear convention)

def temperature_case(L, ap, tp, at, tt):
    L, ap, tp, at, tt = (Fraction(str(x)) for x in (L, ap, tp, at, tt))
    dL = L * ap * (tp - 20) - L * at * (tt - 20)
    return {"L": str(L), "alphaPart": str(ap), "tPart": str(tp), "alphaTool": str(at), "tTool": str(tt),
            "dL": f"{dL.numerator}/{dL.denominator}"}


# ------------------------------------------------------------------ limit gauges

def limits_case(designation, iso):
    import re
    m = re.fullmatch(r"(\d+(?:\.\d+)?)([A-Za-z])(\d+)", designation)
    nominal, letter, grade = Fraction(m.group(1)), m.group(2), int(m.group(3))
    idx = next(i for i, up in enumerate(iso["ranges"]) if nominal <= up)
    IT = iso["IT"][str(grade)][idx]
    lo = letter.lower()
    if lo in iso["shaftUpper"]:
        es = iso["shaftUpper"][lo][idx]
        ei = es - IT
    else:
        ei = iso["shaftLower"][lo][idx] if not (lo == "k" and not 4 <= grade <= 7) else 0
        es = ei + IT
    if letter.isupper():  # hole, EI = -es of the same letter (D..H)
        lower, upper = -es, -es + IT
        go, nogo = lower, upper
    else:
        lower, upper = ei, es
        go, nogo = upper, lower
    um = lambda x: str(nominal + Fraction(x, 1000))
    return {"designation": designation, "min": um(lower), "max": um(upper), "go": um(go), "noGo": um(nogo)}


def build(golden: dict) -> dict:
    rnd = random.Random(2026112402)
    iso = json.loads((ROOT / "src/data/iso286_subset.json").read_text(encoding="utf-8"))
    out = {"sine": [], "rollers": [], "balls": [], "wires": [], "temperature": [], "limits": []}

    g = golden
    out["sine"].append(sine_case(g["MG1"]["data"]["L"], g["MG1"]["data"]["angleDeg"]))
    for _ in range(40):
        out["sine"].append(sine_case(rnd.choice([100, 200, 250]), Fraction(rnd.randint(1, 4500), 100)))

    d = g["MG3"]["data"]
    out["rollers"].append(roller_taper_case(10, d["h1"], d["h2"], d["M1"], d["M2"]))
    out["rollers"].append(roller_taper_case(10, 10, 100, 73, 100))  # Euskadi 2020-2 (my reading)
    for _ in range(40):
        h1 = Fraction(rnd.randint(0, 3000), 100)
        h2 = h1 + Fraction(rnd.randint(1000, 8000), 100)
        M1 = Fraction(rnd.randint(20000, 80000), 1000)
        M2 = M1 + Fraction(rnd.choice([-1, 1]) * rnd.randint(100, 20000), 1000)
        out["rollers"].append(roller_taper_case(rnd.choice([5, 6, 8, 10, 12]), h1, h2, M1, M2))

    for _ in range(30):
        d1 = rnd.choice([8, 10, 12, 15])
        d2_ = d1 + rnd.choice([5, 8, 10, 12, 15])
        depth2 = Fraction(rnd.randint(-300, 2000), 100)
        # sin(α/2) = (r2 − r1)/(z1 − z2) < 1 needs depth1 − depth2 > d2 − d1
        depth1 = depth2 + Fraction(rnd.randint((d2_ - d1 + 5) * 100, 6000), 100)
        out["balls"].append(ball_taper_case(d1, d2_, depth1, depth2))

    d = g["MG2"]["data"]
    out["wires"].append(three_wire_case(d["P"], d["flankAngleDeg"], d["wireD"], d["M"]))
    for _ in range(40):
        P = rnd.choice(["0.5", "0.7", "1", "1.25", "1.5", "1.75", "2", "2.5", "3"])
        ang = rnd.choice([60, 55])
        dw = Fraction(round(float(Fraction(P)) * rnd.uniform(0.5, 0.7) * 1000), 1000)
        M = Fraction(rnd.randint(3000, 40000), 1000)
        out["wires"].append(three_wire_case(P, ang, dw, M))

    d = g["MG4"]["data"]
    out["temperature"].append(temperature_case(d["L"], d["alphaPart"], d["tPart"], 0, 20))
    for _ in range(40):
        out["temperature"].append(temperature_case(rnd.randint(10, 500), rnd.choice(["11.5e-6", "23e-6", "17e-6"]),
                                                   rnd.randint(10, 30), rnd.choice(["11.5e-6", "0"]), rnd.randint(15, 25)))

    for des in ["23f6", "40H7", "30g6", "50k6", "60G7", "62g6", "62H7", "10k8", "12p6", "100e8", "8d9", "25F8", "80m6", "3h7", "120n6"]:
        out["limits"].append(limits_case(des, iso))
    return out
