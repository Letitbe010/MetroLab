/**
 * Generator templates (spec §10.2). Reverse design: start from a "nice" result (a taper from
 * the table, a round angle, a standard thread...), build the measurements, round them to µm as
 * a real measurement would be shown, and let solve.ts recompute every answer from the rounded
 * data. Filters live in verify.ts.
 */
import { classicStack, getSet } from '../gaugeBlocks';
import type { Ask, Exercise, Setup } from '../model';
import { overRollersA, TAPERS } from '../taper';
import { METRIC_THREADS, bestWireA, overWiresA } from '../threads';
import * as R from '../rational';
import type { Rng } from './rng';

export class Reject extends Error {}

export const TEMPLATES = [
  'vernier',
  'micrometer',
  'gaugeStack',
  'sineBar',
  'taperRollers',
  'trapezoid',
  'taperBalls',
  'threeWire',
  'spline',
  'dovetail',
  'temperature',
  'fixedGauge',
  'error',
] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export const LEVELS: Record<TemplateId, (1 | 2 | 3)[]> = {
  vernier: [1],
  micrometer: [1, 2],
  gaugeStack: [1, 2],
  sineBar: [1, 2],
  taperRollers: [2, 3],
  trapezoid: [3],
  taperBalls: [3],
  threeWire: [2],
  spline: [3],
  dovetail: [3],
  temperature: [1, 2],
  fixedGauge: [1, 2],
  error: [1],
};

export type Draft = Pick<Exercise, 'difficulty' | 'setup' | 'asks' | 'weights' | 'text'>;

// ------------------------------------------------------------------ helpers

/** Number as an exact decimal string with `d` decimals (the datum shown to the user). */
const dec = (x: number, d = 3): string => {
  const s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
  return s === '-0' || /^-0\.0*$/.test(s) ? s.slice(1) : s;
};
/** Trim trailing zeros for statements: "25.500" → "25.5". */
const trim = (s: string): string => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
/** Decimal comma for statements. */
const c = (s: string): string => trim(s).replace('.', ',').replace('-', '−');

function draft(difficulty: 1 | 2 | 3, setup: Setup, asks: Ask[], text: { eu: string; es: string }, weights?: Record<string, number>): Draft {
  return { difficulty, setup, asks, weights: weights ?? Object.fromEntries(asks.map((a) => [a.id, 1])), text };
}

const SET_NAME: Record<string, { eu: string; es: string }> = {
  '87': { eu: '87 blokeko multzoa (1,001–1,009; 1,01–1,49; 0,5–9,5; 10–100)', es: 'juego de 87 bloques (1,001–1,009; 1,01–1,49; 0,5–9,5; 10–100)' },
  '112': { eu: '112 blokeko multzoa (1,0005; 1,001–1,009; 1,01–1,49; 0,5–24,5; 25–100)', es: 'juego de 112 bloques (1,0005; 1,001–1,009; 1,01–1,49; 0,5–24,5; 25–100)' },
};

// ------------------------------------------------------------------ instrument readings

function vernier(r: Rng): Draft {
  const n = r.pick([10, 20, 50]);
  const modulus: 1 | 2 = n === 20 && r.next() < 0.5 ? 2 : 1;
  const k = r.int(5 * n, 150 * n);
  const value = R.toFixed(R.q(k, n), n === 10 ? 1 : 2);
  const asks: Ask[] = [{ id: 'reading', kind: 'reading' }];
  if (r.next() < 0.5) asks.unshift({ id: 'appr', kind: 'appreciation' });
  return draft(1, { kind: 'vernier', s: '1', n, modulus, value }, asks, {
    eu: `Irudiko kalibre noniodunak ${n} zatiketako nonioa du (eskala nagusia milimetrotan)${modulus === 2 ? ', nonio luzatua' : ''}. ${asks.length > 1 ? 'Kalkulatu tresnaren apreziazioa eta idatzi' : 'Idatzi'} irakurketa, milimetrotan.`,
    es: `El calibre de la figura tiene un nonio de ${n} divisiones (escala principal en milímetros)${modulus === 2 ? ', nonio alargado' : ''}. ${asks.length > 1 ? 'Calcula la apreciación del instrumento y escribe' : 'Escribe'} la lectura, en milímetros.`,
  });
}

function micrometer(r: Rng, level: 1 | 2 | 3): Draft {
  const v = level >= 2;
  const value = v ? R.toFixed(R.q(r.int(1000, 25000), 1000), 3) : R.toFixed(R.q(r.int(100, 2500), 100), 2);
  return draft(level, { kind: 'micrometer', vernierDivs: v ? 10 : 0, value }, [{ id: 'reading', kind: 'reading' }], {
    eu: `Irudiko mikrometroak 0,5 mm-ko pausoa eta 50 zatiketako danborra ditu${v ? ', eta 0,001 mm-ko nonioa zorroan' : ''}. Idatzi irakurketa, milimetrotan.`,
    es: `El micrómetro de la figura tiene paso de 0,5 mm y tambor de 50 divisiones${v ? ', y nonio de 0,001 mm en el casquillo' : ''}. Escribe la lectura, en milímetros.`,
  });
}

// ------------------------------------------------------------------ gauge blocks and sine bar

function randomStackTarget(r: Rng, setId: string, count: number): R.Rational {
  const set = getSet(setId);
  const fine = set.blocks.filter((b) => R.toNumber(b) > 1 && R.toNumber(b) < 1.01);
  const mid = set.blocks.filter((b) => R.toNumber(b) >= 1.01 && R.toNumber(b) < 1.5);
  const big = set.blocks.filter((b) => R.toNumber(b) >= 0.5 && !(R.toNumber(b) > 1 && R.toNumber(b) < 1.5));
  const chosen = [r.pick(fine), r.pick(mid), ...r.shuffle([...big]).slice(0, count - 2)];
  return R.sum(chosen);
}

function gaugeStack(r: Rng, level: 1 | 2 | 3): Draft {
  const setId = level === 1 ? '87' : r.pick(['87', '112']);
  const target = randomStackTarget(r, setId, level === 1 ? r.int(3, 4) : r.int(4, 5));
  if (!classicStack(target, getSet(setId))) throw new Reject('classic method fails');
  const t = R.toFixed(target, setId === '112' ? 4 : 3);
  const minimal = level >= 2;
  return draft(level, { kind: 'gaugeStack', target: t, set: setId }, [{ id: 'stack', kind: 'gaugeStack', minimal }], {
    eu: `${c(t)} mm-ko neurria osatu behar da galga-blokeekin. Erabilgarri dagoena: ${SET_NAME[setId]!.eu}. Osatu pila${minimal ? ', ahalik eta bloke gutxienekin' : ''}.`,
    es: `Hay que componer la medida ${c(t)} mm con bloques patrón. Disponible: ${SET_NAME[setId]!.es}. Compón la pila${minimal ? ' con el menor número posible de bloques' : ''}.`,
  });
}

const NICE_ANGLES = ['5', '7.5', '10', '12', '12.5', '15', '18', '20', '22.5', '25', '30', '35', '40'];

function sineBar(r: Rng, level: 1 | 2 | 3): Draft {
  const L = r.pick(['100', '200']);
  if (level === 1) {
    const a = r.pick(NICE_ANGLES);
    return draft(
      1,
      { kind: 'sineBar', L, angleDeg: a, set: '87' },
      [
        { id: 'h', kind: 'sineHeight' },
        { id: 'stack', kind: 'gaugeStack' },
      ],
      {
        eu: `${L} mm-ko sinu-erregela bat ${c(a)}°-ko angelua egiaztatzeko jarri behar da. Kalkulatu galga-blokeen pilaren altuera h (µm-ra) eta osatu pila ${SET_NAME['87']!.eu} erabiliz.`,
        es: `Hay que montar una regla de senos de ${L} mm para verificar un ángulo de ${c(a)}°. Calcula la altura h de la pila de bloques patrón (a la micra) y compón la pila con el ${SET_NAME['87']!.es}.`,
      },
    );
  }
  if (r.next() < 0.5) {
    // check a cone of a standard taper: the bar is set at the half-angle α/2
    const t = r.pick(TAPERS.filter((x) => R.toNumber(x.C) >= 0.04));
    const taperC = R.toString(t.C);
    const shown = `1:${c(trim(R.toFixed(R.inv(t.C), 3)))}`;
    return draft(
      2,
      { kind: 'sineBar', L, taperC, set: '87' },
      [
        { id: 'h', kind: 'sineHeight' },
        { id: 'stack', kind: 'gaugeStack', minimal: true },
      ],
      {
        eu: `${t.name} konoaren (C = ${shown}) sortzailea egiaztatzeko, konoa ${L} mm-ko sinu-erregela baten gainean jartzen da, erdi-angeluan (α/2) inklinatuta. Kalkulatu pilaren altuera h (µm-ra) eta osatu pila ${SET_NAME['87']!.eu} erabiliz, bloke gutxienekin.`,
        es: `Para verificar la generatriz del cono ${t.name} (C = ${shown}), el cono se coloca sobre una regla de senos de ${L} mm inclinada su semiángulo (α/2). Calcula la altura h de la pila (a la micra) y compón la pila con el ${SET_NAME['87']!.es}, con el mínimo de bloques.`,
      },
    );
  }
  // the stack is given: find the angle
  const h = randomStackTarget(r, '87', 3);
  if (R.toNumber(h) >= Number(L) * Math.sin(Math.PI / 4)) throw new Reject('angle above 45°');
  const hs = R.toFixed(h, 3);
  return draft(2, { kind: 'sineBar', L, h: hs }, [{ id: 'a', kind: 'sineAngle' }], {
    eu: `${L} mm-ko sinu-erregela bat ${c(hs)} mm-ko galga-bloke pila baten gainean dago. Kalkulatu erregelaren angelua α, gradu hamartarretan (edo ° ′ ″).`,
    es: `Una regla de senos de ${L} mm está apoyada sobre una pila de bloques patrón de ${c(hs)} mm. Calcula el ángulo α de la regla, en grados decimales (o ° ′ ″).`,
  });
}

// ------------------------------------------------------------------ tapers

function taperRollers(r: Rng, level: 1 | 2 | 3): Draft {
  const t = r.pick(TAPERS.filter((x) => R.toNumber(x.C) <= 0.35));
  const C = R.toNumber(t.C) * (r.next() < 0.5 ? 1 : -1);
  const d = r.pick([5, 6, 8, 10, 12]);
  const h1 = r.pick([0, 0, 10, 20]);
  const h2 = h1 + r.pick([25, 30, 40, 50, 60, 75, 100]);
  const D0 = r.int(200, 600) / 10;
  const top = D0 + C * (h2 + d * 2);
  if (top < 8) throw new Reject('cone too thin');
  const M1 = dec(overRollersA(D0, C, d, h1));
  const M2 = dec(overRollersA(D0, C, d, h2));
  const asks: Ask[] = [
    { id: 'C', kind: 'taperC' },
    { id: 'half', kind: 'halfAngle' },
  ];
  let coneLength: string | undefined;
  if (level === 3) {
    coneLength = String(h2 + d + r.int(5, 30));
    asks.push({ id: 'D0', kind: 'diameter', at: 'plate' }, { id: 'D1', kind: 'diameter', at: 'top' });
  }
  const blocks = (h: number, eu: boolean) => (h === 0 ? (eu ? 'mahai-planoaren gainean' : 'sobre el mármol') : eu ? `${h} mm-ko galga-blokeen gainean` : `sobre bloques patrón de ${h} mm`);
  const setup: Setup = { kind: 'taperRollers', rollerD: String(d), h1: String(h1), h2: String(h2), M1, M2, ...(coneLength ? { coneLength } : {}) };
  return draft(level, setup, asks, {
    eu: `Mahai-planoaren gainean dagoen kanpoko kono bat Ø${d} mm-ko bi arrabolekin neurtzen da. Arrabolak ${blocks(h1, true)} daudela, arrabolen gaineko neurria M₁ = ${c(M1)} mm da; ${blocks(h2, true)}, M₂ = ${c(M2)} mm. Kalkulatu konikotasuna C eta erdi-angelua α/2.${level === 3 ? ` Konoaren altuera ${coneLength} mm da: kalkulatu mahai-planoko diametroa eta goiko muturreko diametroa.` : ''}`,
    es: `Un cono exterior apoyado en el mármol se mide con dos rodillos de Ø${d} mm. Con los rodillos ${blocks(h1, false)}, la medida sobre rodillos es M₁ = ${c(M1)} mm; ${blocks(h2, false)}, M₂ = ${c(M2)} mm. Calcula la conicidad C y el semiángulo α/2.${level === 3 ? ` La altura del cono es ${coneLength} mm: calcula el diámetro en el mármol y el diámetro del extremo superior.` : ''}`,
  });
}

function trapezoid(r: Rng): Draft {
  const d = 10;
  const h2 = r.pick([15, 20, 25, 30]);
  const phi = r.int(80, 350) / 10; // flank from the vertical, degrees
  const b = r.int(40, 90);
  const C = 2 * Math.tan((phi * Math.PI) / 180);
  const M1 = dec(overRollersA(b, C, d, 0));
  const M2 = dec(overRollersA(b, C, d, h2));
  return draft(3, { kind: 'taperRollers', rollerD: String(d), h1: '0', h2: String(h2), M1, M2, plane: true }, [{ id: 'a', kind: 'planeAngle' }], {
    eu: `Trapezio-formako pieza baten alboen angelua egiaztatzeko, Ø${d} mm-ko arrabolak erabiltzen dira: mahai-planoaren gainean, arrabolen gaineko neurria ${c(M1)} mm da; ${h2} mm-ko galga-blokeen gainean, ${c(M2)} mm. Kalkulatu oinarriaren eta alboaren arteko angelua a (piezaren barrualdean).`,
    es: `Para verificar el ángulo de los flancos de una pieza trapecial se usan rodillos de Ø${d} mm: sobre el mármol, la medida sobre rodillos es ${c(M1)} mm; sobre bloques patrón de ${h2} mm, ${c(M2)} mm. Calcula el ángulo a entre la base y el flanco (por el interior de la pieza).`,
  });
}

function taperBalls(r: Rng): Draft {
  const half = r.pick([5, 6, 7, 8, 10, 12, 15]);
  const tb = Math.tan((half * Math.PI) / 180);
  const cb = Math.cos((half * Math.PI) / 180);
  const Dtop = r.int(300, 600) / 10;
  const d1 = r.pick([6, 8, 10, 12]);
  const d2 = d1 + r.pick([4, 6, 8, 10]);
  if (d2 > 0.8 * Dtop) throw new Reject('ball too large');
  const zc = (rad: number) => (Dtop / 2 - rad / cb) / tb;
  const dep1 = dec(zc(d1 / 2) - d1 / 2);
  const dep2 = dec(zc(d2 / 2) - d2 / 2);
  if (zc(d2 / 2) + (d2 / 2) * Math.sin((half * Math.PI) / 180) < 0) throw new Reject('ball 2 outside the hole');
  if (Number(dep1) > 120) throw new Reject('too deep');
  return draft(
    3,
    { kind: 'taperBalls', d1: String(d1), d2: String(d2), depth1: dep1, depth2: dep2 },
    [
      { id: 'half', kind: 'halfAngle' },
      { id: 'D', kind: 'diameter', at: 'top' },
    ],
    {
      eu: `Barneko kono bat bi bolarekin egiaztatzen da. Ø${d1} mm-ko bola sartuta, haren goiko puntua goiko aurpegitik ${c(dep1)} mm-ra dago (behera); Ø${d2} mm-ko bolarekin, ${c(dep2)} mm-ra${Number(dep2) < 0 ? ' (balio negatiboa: bola aurpegitik kanpo ateratzen da)' : ''}. Kalkulatu erdi-angelua α/2 eta goiko aurpegiko diametroa D.`,
      es: `Un cono interior se verifica con dos bolas. Con la bola de Ø${d1} mm, su punto superior queda a ${c(dep1)} mm por debajo de la cara superior; con la de Ø${d2} mm, a ${c(dep2)} mm${Number(dep2) < 0 ? ' (valor negativo: la bola sobresale de la cara)' : ''}. Calcula el semiángulo α/2 y el diámetro D en la cara superior.`,
    },
  );
}

// ------------------------------------------------------------------ threads and profiles

function threeWire(r: Rng): Draft {
  const th = r.pick(METRIC_THREADS.filter((t) => t.d >= 5 && t.d <= 30));
  const dw = dec(bestWireA(th.P, 60));
  if (r.next() < 0.65) {
    const dev = -r.int(0, 45) / 1000;
    const M = dec(overWiresA(th.d2 + dev, Number(dw), th.P, 60));
    const withBest = r.next() < 0.5;
    const asks: Ask[] = [{ id: 'd2', kind: 'pitchDiameter' }];
    if (withBest) asks.unshift({ id: 'dw', kind: 'bestWire' });
    return draft(2, { kind: 'threeWire', thread: th.name, P: th.PText, flankAngleDeg: '60', wireD: dw, M }, asks, {
      eu: `${th.name} × ${c(th.PText)} hari metriko baten (α = 60°) diametro eraginkorra hiru harien metodoarekin egiaztatzen da, Ø${c(dw)} mm-ko hariekin. Harien gaineko neurria M = ${c(M)} mm da. ${withBest ? 'Kalkulatu hari optimoaren diametroa eta' : 'Kalkulatu'} diametro eraginkorra d₂.`,
      es: `El diámetro medio de una rosca métrica ${th.name} × ${c(th.PText)} (α = 60°) se verifica por el método de los tres alambres, con alambres de Ø${c(dw)} mm. La medida sobre alambres es M = ${c(M)} mm. ${withBest ? 'Calcula el diámetro del alambre óptimo y' : 'Calcula'} el diámetro medio d₂.`,
    });
  }
  return draft(2, { kind: 'threeWire', thread: th.name, P: th.PText, flankAngleDeg: '60', wireD: dw, d2: th.d2Text }, [{ id: 'M', kind: 'measure' }], {
    eu: `${th.name} × ${c(th.PText)} hariaren diametro eraginkor nominala d₂ = ${c(th.d2Text)} mm da (ISO 724). Ø${c(dw)} mm-ko hiru harirekin, zer neurri M irakurri beharko litzateke mikrometroan haria nominala bada?`,
    es: `El diámetro medio nominal de la rosca ${th.name} × ${c(th.PText)} es d₂ = ${c(th.d2Text)} mm (ISO 724). Con tres alambres de Ø${c(dw)} mm, ¿qué medida M debería leerse en el micrómetro si la rosca es nominal?`,
  });
}

function spline(r: Rng): Draft {
  const d = r.pick(['2', '2.5', '3', '3.5', '4', '5']);
  const th = r.pick(['60', '70', '80', '90']);
  const Ra = dec(r.int(800, 3000) / 100, 2);
  return draft(3, { kind: 'spline', rollerD: d, vAngleDeg: th, apexRadius: Ra }, [{ id: 'M', kind: 'measure' }], {
    eu: `Hortz kopuru bikoitiko ardatz ildaskatu bat egiaztatzeko, Ø${c(d)} mm-ko bi arrabol jartzen dira diametralki aurkako hutsuneetan. Ukipen-puntuetako ukitzaileek ${th}°-ko angelua osatzen dute, eta ardatzaren zentrotik ukitzaileen ebakidura-puntura ${c(Ra)} mm daude. Zer neurri M irakurriko da mikrometroan?`,
    es: `Para verificar un eje estriado de número par de dientes se colocan dos rodillos de Ø${c(d)} mm en huecos diametralmente opuestos. Las tangentes en los puntos de contacto forman ${th}°, y la distancia del centro del eje al punto de intersección de las tangentes es ${c(Ra)} mm. ¿Qué medida M se leerá en el micrómetro?`,
  });
}

function dovetail(r: Rng): Draft {
  const kind = r.pick(['male', 'female'] as const);
  const a = r.pick(['45', '55', '60']);
  const d = r.pick([6, 8, 10, 12]);
  const male = kind === 'male';
  const wName = male ? { eu: 'oinarri estua b', es: 'base estrecha b' } : { eu: 'oinarri zabala B', es: 'base ancha B' };
  const what = male ? { eu: 'buztan-enara arra', es: 'cola de milano macho' } : { eu: 'buztan-enara emea', es: 'cola de milano hembra' };
  const k = d * (1 + 1 / Math.tan((Number(a) * Math.PI) / 360));
  if (r.next() < 0.5) {
    const w = String(r.int(male ? 30 : 60, male ? 90 : 140));
    return draft(3, { kind: 'dovetail', dovetail: kind, rollerD: String(d), alphaDeg: a, width: w }, [{ id: 'X', kind: 'measure' }], {
      eu: `${what.eu} bat (${a}°-ko angelua alboaren eta oinarriaren artean) Ø${d} mm-ko bi arrabolekin egiaztatzen da. ${wName.eu} = ${w} mm. Kalkulatu arrabolen ${male ? 'gaineko' : 'arteko'} neurria X.`,
      es: `Una ${what.es} (ángulo de ${a}° entre flanco y base) se verifica con dos rodillos de Ø${d} mm. ${wName.es} = ${w} mm. Calcula la medida X ${male ? 'sobre' : 'entre'} rodillos.`,
    });
  }
  const w = r.int(male ? 30 : 60, male ? 90 : 140) + r.pick([0, 0.5]);
  const X = dec(male ? w + k : w - k);
  return draft(3, { kind: 'dovetail', dovetail: kind, rollerD: String(d), alphaDeg: a, X }, [{ id: 'w', kind: 'width' }], {
    eu: `${what.eu} bat (${a}°) Ø${d} mm-ko bi arrabolekin neurtu da: arrabolen ${male ? 'gaineko' : 'arteko'} neurria X = ${c(X)} mm. Kalkulatu ${wName.eu}.`,
    es: `Una ${what.es} (${a}°) se ha medido con dos rodillos de Ø${d} mm: la medida ${male ? 'sobre' : 'entre'} rodillos es X = ${c(X)} mm. Calcula la ${wName.es}.`,
  });
}

// ------------------------------------------------------------------ temperature, limit gauges, errors

const MATERIALS = [
  { id: 'steel', a: '11.5e-6', eu: 'altzairuzko', es: 'acero', show: '11,5·10⁻⁶' },
  { id: 'aluminium', a: '23e-6', eu: 'aluminiozko', es: 'aluminio', show: '23·10⁻⁶' },
  { id: 'brass', a: '19e-6', eu: 'letoizko', es: 'latón', show: '19·10⁻⁶' },
  { id: 'castIron', a: '10.5e-6', eu: 'burdinurtuzko', es: 'fundición', show: '10,5·10⁻⁶' },
];

function temperature(r: Rng, level: 1 | 2 | 3): Draft {
  const m = r.pick(MATERIALS);
  if (level === 1 && r.next() < 0.5) {
    const L = String(r.int(10, 200) * 10);
    const T = String(r.pick([40, 50, 60, 80, 100, 120, 150]));
    return draft(1, { kind: 'temperature', given: 'at20', L, material: m.id, alphaPart: m.a, tPart: T }, [
      { id: 'dL', kind: 'tempDelta' },
      { id: 'LT', kind: 'lengthAtT' },
    ], {
      eu: `${L} mm-ko ${m.eu} barra bat (α = ${m.show} K⁻¹) 20 °C-tik ${T} °C-ra berotzen da. Kalkulatu luzapena ΔL eta ${T} °C-ko luzera.`,
      es: `Una barra de ${m.es} de ${L} mm (α = ${m.show} K⁻¹) se calienta de 20 °C a ${T} °C. Calcula el alargamiento ΔL y la longitud a ${T} °C.`,
    });
  }
  const L = dec(r.int(50000, 500000) / 1000);
  const tp = String(r.int(22, 30));
  const withTool = level >= 2;
  const tool = MATERIALS[0]!;
  const tt = withTool ? String(r.int(21, 26)) : undefined;
  const setup: Setup = {
    kind: 'temperature',
    given: 'measured',
    L,
    material: m.id,
    alphaPart: m.a,
    tPart: tp,
    ...(withTool ? { alphaTool: tool.a, tTool: tt } : {}),
  };
  return draft(level, setup, [
    { id: 'dL', kind: 'tempDelta' },
    { id: 'L20', kind: 'length20' },
  ], {
    eu: `${m.eu.charAt(0).toUpperCase() + m.eu.slice(1)} pieza bat (α = ${m.show} K⁻¹) ${tp} °C-tan neurtu da, eta irakurketa L = ${c(L)} mm izan da${withTool ? `; tresna altzairuzkoa da (α = ${tool.show} K⁻¹) eta ${tt} °C-tan dago` : '; tresna 20 °C-tan dago'}. Zeinu-konbentzioa: ΔL = L_neurtua − L₂₀. Kalkulatu ΔL eta piezaren luzera 20 °C-tan.`,
    es: `Una pieza de ${m.es} (α = ${m.show} K⁻¹) se ha medido a ${tp} °C y la lectura ha sido L = ${c(L)} mm${withTool ? `; el instrumento es de acero (α = ${tool.show} K⁻¹) y está a ${tt} °C` : '; el instrumento está a 20 °C'}. Convenio de signos: ΔL = L_medida − L₂₀. Calcula ΔL y la longitud de la pieza a 20 °C.`,
  });
}

const DESIGNATIONS = ['12f7', '16g6', '20h7', '23f6', '25k6', '30g6', '36e8', '40h6', '45n6', '50f7', '60m6', '75p6', '90h8', '110d9', '12H7', '18G7', '25H8', '30H7', '40F8', '50H7', '65G6', '80H9', '100H7', '115E8'];

function fixedGauge(r: Rng, level: 1 | 2 | 3): Draft {
  const asks: Ask[] = [
    { id: 'go', kind: 'gaugeGo' },
    { id: 'nogo', kind: 'gaugeNoGo' },
  ];
  if (level >= 2) {
    const des = r.pick(DESIGNATIONS);
    const hole = des !== des.toLowerCase() || /[A-Z]/.test(des);
    return draft(2, { kind: 'fixedGauge', feature: hole ? 'hole' : 'shaft', designation: des }, asks, {
      eu: `Ø${des} ${hole ? 'zuloa tampoi-kalibre' : 'ardatza ahoko-kalibre (galgatxo)'} batekin egiaztatu behar da. ISO 286 tauletatik abiatuta, kalkulatu kalibrearen "pasa" eta "ez pasa" aldeen neurriak.`,
      es: `Hay que verificar ${hole ? 'el agujero' : 'el eje'} Ø${des} con un calibre ${hole ? 'tampón' : 'de herradura'}. A partir de las tablas ISO 286, calcula las medidas de los lados "pasa" y "no pasa" del calibre.`,
    });
  }
  const hole = r.next() < 0.5;
  const nominal = r.int(10, 100);
  const lower = hole ? r.pick([0, 0, 5, 10, 20]) : -r.int(0, 60);
  const width = r.int(9, 54);
  const min = dec(nominal + lower / 1000);
  const max = dec(nominal + (lower + width) / 1000);
  return draft(1, { kind: 'fixedGauge', feature: hole ? 'hole' : 'shaft', nominal: String(nominal), max, min }, asks, {
    eu: `${hole ? 'Zulo' : 'Ardatz'} baten neurri onargarriak ${c(min)} mm eta ${c(max)} mm dira. Kalkulatu ${hole ? 'tampoi-kalibrearen' : 'ahoko-kalibrearen'} "pasa" eta "ez pasa" aldeen neurriak (Taylor printzipioa).`,
    es: `Las medidas admisibles de ${hole ? 'un agujero' : 'un eje'} son ${c(min)} mm y ${c(max)} mm. Calcula las medidas de los lados "pasa" y "no pasa" del calibre ${hole ? 'tampón' : 'de herradura'} (principio de Taylor).`,
  });
}

function errorTemplate(r: Rng): Draft {
  const t = r.pick(['10', '25', '50', '75', '100']);
  const bias = r.int(-6, 6);
  if (bias === 0) throw new Reject('no error');
  const k = r.int(3, 5);
  const xs = Array.from({ length: k }, () => dec(Number(t) + (bias + r.int(-2, 2)) / 1000));
  return draft(1, { kind: 'error', measured: xs, trueValue: t }, [
    { id: 'Ea', kind: 'errorAbs' },
    { id: 'Er', kind: 'errorRel' },
  ], {
    eu: `${t} mm-ko galga-bloke kalibratu bat (egiazko baliotzat hartzen da) mikrometro batekin ${k} aldiz neurtu da: ${xs.map(c).join('; ')} mm. Kalkulatu batez besteko neurketaren errore absolutua (E = x̄ − x_egiazkoa) eta errore erlatiboa (%).`,
    es: `Un bloque patrón calibrado de ${t} mm (se toma como valor verdadero) se ha medido ${k} veces con un micrómetro: ${xs.map(c).join('; ')} mm. Calcula el error absoluto de la media (E = x̄ − x_verdadero) y el error relativo (%).`,
  });
}

export const BUILDERS: Record<TemplateId, (r: Rng, level: 1 | 2 | 3) => Draft> = {
  vernier: (r) => vernier(r),
  micrometer,
  gaugeStack,
  sineBar,
  taperRollers,
  trapezoid: (r) => trapezoid(r),
  taperBalls: (r) => taperBalls(r),
  threeWire: (r) => threeWire(r),
  spline: (r) => spline(r),
  dovetail: (r) => dovetail(r),
  temperature,
  fixedGauge,
  error: (r) => errorTemplate(r),
};
