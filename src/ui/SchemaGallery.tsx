/**
 * Phase 3 review screen (#/eskemak): every schema type and both instruments with demo data,
 * in "statement" mode (unknowns as ?) or "solution" mode (computed values in orange).
 */
import { useState, type ReactNode } from 'react';
import type { Lang } from '../i18n';
import { limitsFromDesignation, gaugeSizesA } from '../core/fixedGauges';
import { parse, q, toFixed } from '../core/rational';
import { STANDARD_MICROMETER, VERNIER_MICROMETER } from '../core/reading';
import { sineHeightA } from '../core/sineBar';
import { ballTaperA, rollerTaperA } from '../core/taper';
import { bestWireA, pitchDiameterA } from '../core/threads';
import { dovetailA, overSplineRollersA } from '../core/profiles';
import { deg, fmt, mm } from './format';
import { MicrometerScale, VernierScale, type InstrumentTxt } from './Instrument';
import { GaugeStackSchema, SineBarSchema, TaperBallsSchema, TaperRollersSchema } from './schema/schemasA';
import { DovetailSchema, FixedGaugeSchema, SplineSchema, TemperatureSchema, ThreeWireSchema } from './schema/schemasB';
import { Legend } from './schema/svg';

type T = { eu: string; es: string };
const L = (lang: Lang, t: T) => t[lang];

interface Demo {
  id: string;
  title: T;
  render: (lang: Lang, solved: boolean) => ReactNode;
}

const NO_SCALE: T = { eu: 'eskalarik gabe (angelua handituta)', es: 'sin escala (ángulo ampliado)' };
const Q = '?';

const INSTR: Record<Lang, InstrumentTxt> = {
  eu: { zoomOut: 'Txikiagotu', zoomIn: 'Handitu', zoom: 'Zooma', mainScale: 'eskala nagusia (mm)', vernier: 'nonioa', sleeve: 'zorroa', thimble: 'danborra' },
  es: { zoomOut: 'Reducir', zoomIn: 'Ampliar', zoom: 'Zoom', mainScale: 'escala principal (mm)', vernier: 'nonio', sleeve: 'casquillo', thimble: 'tambor' },
};

function rollerDemo(id: string, title: T, d: { rollerD: number; h1: number; h2: number; M1: number; M2: number }, plane = false): Demo {
  return {
    id,
    title,
    render: (lang, solved) => {
      const s = rollerTaperA(d);
      const half = plane ? 90 + s.halfAngleDeg : s.halfAngleDeg;
      return (
        <TaperRollersSchema
          {...d}
          plane={plane}
          title={L(lang, title)}
          txt={{ noScale: L(lang, NO_SCALE) }}
          labels={{
            M1: fmt(d.M1),
            M2: fmt(d.M2),
            h1: fmt(d.h1),
            h2: fmt(d.h2),
            d: `Ø${fmt(d.rollerD)}`,
            half: solved ? `${plane ? 'a' : 'α/2'} = ${deg(half, 2)}` : plane ? 'a' : 'α/2',
          }}
          halfTone={solved ? 'calc' : 'dim'}
        />
      );
    },
  };
}

const DEMOS: Demo[] = [
  rollerDemo('mg3', { eu: 'Konoa arrabolekin (MG3)', es: 'Cono con rodillos (MG3)' }, { rollerD: 10, h1: 0, h2: 60, M1: 40, M2: 46 }),
  rollerDemo('eus2020', { eu: 'Konoa arrabolekin (Euskadi 2020-2, nire irakurketa)', es: 'Cono con rodillos (Euskadi 2020-2, mi lectura)' }, { rollerD: 10, h1: 10, h2: 100, M1: 73, M2: 100 }),
  rollerDemo('eus2022', { eu: 'Trapezioa arrabolekin (Euskadi 2022-B, nire irakurketa)', es: 'Trapecio con rodillos (Euskadi 2022-B, mi lectura)' }, { rollerD: 10, h1: 0, h2: 20, M1: 74.3, M2: 88.9 }, true),
  {
    id: 'balls',
    title: { eu: 'Barneko konoa bi bolarekin', es: 'Cono interior con dos bolas' },
    render: (lang, solved) => {
      const b = { d1: 10, d2: 20, depth1: 40, depth2: 5 };
      const s = ballTaperA(b);
      return (
        <TaperBallsSchema
          {...b}
          halfAngleDeg={s.halfAngleDeg}
          Dtop={s.Dtop}
          title={L(lang, { eu: 'Barneko konoa bi bolarekin', es: 'Cono interior con dos bolas' })}
          txt={{ noScale: L(lang, NO_SCALE) }}
          labels={{ d1: 'Ø10', d2: 'Ø20', depth1: fmt(40), depth2: fmt(5), Dtop: solved ? `D = ${mm(s.Dtop)}` : `D = ${Q}`, half: solved ? `α/2 = ${deg(s.halfAngleDeg, 2)}` : 'α/2' }}
          tones={{ Dtop: solved ? 'calc' : 'dim', half: solved ? 'calc' : 'dim' }}
        />
      );
    },
  },
  {
    id: 'sine',
    title: { eu: 'Sinu-erregela + pila (MG1)', es: 'Regla de senos + pila (MG1)' },
    render: (lang, solved) => {
      const h = sineHeightA(100, 15);
      const stack = [20, 3.5, 1.38, 1.002];
      return (
        <SineBarSchema
          L={100}
          angleDeg={15}
          stack={stack}
          title={L(lang, { eu: 'Sinu-erregela', es: 'Regla de senos' })}
          txt={{ noScale: L(lang, NO_SCALE) }}
          labels={{ L: 'L = 100', h: solved ? `h = ${fmt(h, 3)}` : `h = ${Q}`, angle: 'α = 15°' }}
          tones={{ h: solved ? 'calc' : 'dim' }}
        />
      );
    },
  },
  {
    id: 'stack',
    title: { eu: 'Galga-bloke pila (MG1)', es: 'Pila de bloques patrón (MG1)' },
    render: (lang) => (
      <GaugeStackSchema
        blocks={[20, 3.5, 1.38, 1.002]}
        labels={['20', '3,5', '1,38', '1,002']}
        total="25,882"
        title={L(lang, { eu: 'Galga-bloke pila', es: 'Pila de bloques patrón' })}
        txt={{ noScale: L(lang, { eu: 'eskalarik gabe', es: 'sin escala' }) }}
      />
    ),
  },
  {
    id: 'wires',
    title: { eu: 'Hiru hariak, M10 × 1,5 (MG2)', es: 'Tres alambres, M10 × 1,5 (MG2)' },
    render: (lang, solved) => {
      const d2 = pitchDiameterA(10.325, 0.866, 1.5, 60);
      return (
        <ThreeWireSchema
          P={1.5}
          flankAngleDeg={60}
          d2={d2}
          dw={0.866}
          title={L(lang, { eu: 'Hiru harien metodoa', es: 'Método de los tres alambres' })}
          txt={{ noScale: '' }}
          labels={{ M: 'M = 10,325', P: 'P = 1,5', dw: `dw = ${fmt(bestWireA(1.5, 60), 3)}`, angle: '60°', d2: solved ? `d₂ = ${fmt(d2, 3)}` : `d₂ = ${Q}` }}
          tones={{ d2: solved ? 'calc' : 'dim' }}
        />
      );
    },
  },
  {
    id: 'spline',
    title: { eu: 'Ildaskatua arrabolekin (Madril 2025-4)', es: 'Estriado con rodillos (Madrid 2025-4)' },
    render: (lang, solved) => {
      const s = { rollerD: 3, vAngleDeg: 70, apexRadius: 10.88 };
      return (
        <SplineSchema
          {...s}
          title={L(lang, { eu: 'Ildaskatua arrabolekin', es: 'Estriado con rodillos' })}
          txt={{ noScale: '' }}
          labels={{ M: solved ? `M = ${fmt(overSplineRollersA(s), 3)}` : `M = ${Q}`, d: 'Ø3', angle: '70°', Ra: '10,88' }}
          tones={{ M: solved ? 'calc' : 'dim' }}
        />
      );
    },
  },
  ...(['male', 'female'] as const).map(
    (kind): Demo => ({
      id: `dove-${kind}`,
      title: kind === 'male' ? { eu: 'Buztan-enara arra', es: 'Cola de milano macho' } : { eu: 'Buztan-enara emea', es: 'Cola de milano hembra' },
      render: (lang, solved) => {
        const t = { kind, rollerD: 10, alphaDeg: 60, width: kind === 'male' ? 50 : 80 };
        return (
          <DovetailSchema
            {...t}
            title={L(lang, kind === 'male' ? { eu: 'Buztan-enara arra', es: 'Cola de milano macho' } : { eu: 'Buztan-enara emea', es: 'Cola de milano hembra' })}
            txt={{ noScale: '' }}
            labels={{ X: solved ? `X = ${fmt(dovetailA(t), 3)}` : `X = ${Q}`, width: kind === 'male' ? 'b = 50' : 'B = 80', d: 'Ø10', alpha: '60°' }}
            tones={{ X: solved ? 'calc' : 'dim' }}
          />
        );
      },
    }),
  ),
  ...(['40H7', '23f6'] as const).map(
    (des): Demo => ({
      id: `gauge-${des}`,
      title: { eu: `Kalibre finkoa: ${des}`, es: `Calibre fijo: ${des}` },
      render: (lang, solved) => {
        const l = limitsFromDesignation(des);
        const g = gaugeSizesA(l.feature, l.max, l.min);
        return (
          <FixedGaugeSchema
            feature={l.feature}
            tone={solved ? 'calc' : 'dim'}
            title={L(lang, { eu: `Kalibre finkoa ${des}`, es: `Calibre fijo ${des}` })}
            txt={{ noScale: '' }}
            labels={{
              go: solved ? toFixed(g.go, 3).replace('.', ',') : Q,
              noGo: solved ? toFixed(g.noGo, 3).replace('.', ',') : Q,
              goWord: L(lang, { eu: 'PASA', es: 'PASA' }),
              noGoWord: L(lang, { eu: 'EZ PASA', es: 'NO PASA' }),
            }}
          />
        );
      },
    }),
  ),
  {
    id: 'temp',
    title: { eu: 'Tenperatura (MG4)', es: 'Temperatura (MG4)' },
    render: (lang) => (
      <TemperatureSchema
        title={L(lang, { eu: 'Tenperatura-zuzenketa', es: 'Corrección por temperatura' })}
        txt={{ noScale: '' }}
        labels={{ L: 'L = 200', tPart: '25 °C', tTool: '20 °C', partWord: L(lang, { eu: 'pieza (altzairua)', es: 'pieza (acero)' }), toolWord: L(lang, { eu: 'tresna', es: 'instrumento' }) }}
      />
    ),
  },
  {
    id: 'vernier50',
    title: { eu: 'Kalibre nonioduna 0,02 (MG5: 23,34)', es: 'Calibre con nonio 0,02 (MG5: 23,34)' },
    render: (lang, solved) => (
      <VernierScale spec={{ s: q(1), n: 50, modulus: 1 }} value={parse('23.34')} showCoincidence={solved} title={L(lang, { eu: 'Kalibre nonioduna', es: 'Calibre con nonio' })} txt={INSTR[lang]} />
    ),
  },
  {
    id: 'vernier20',
    title: { eu: 'Kalibre nonioduna 0,05, nonio luzatua (41,65)', es: 'Calibre con nonio 0,05, nonio alargado (41,65)' },
    render: (lang, solved) => (
      <VernierScale spec={{ s: q(1), n: 20, modulus: 2 }} value={parse('41.65')} showCoincidence={solved} title={L(lang, { eu: 'Kalibre nonioduna', es: 'Calibre con nonio' })} txt={INSTR[lang]} />
    ),
  },
  {
    id: 'micro',
    title: { eu: 'Mikrometroa (MG6: 12,87)', es: 'Micrómetro (MG6: 12,87)' },
    render: (lang, solved) => (
      <MicrometerScale spec={STANDARD_MICROMETER} value={parse('12.87')} showCoincidence={solved} title={L(lang, { eu: 'Mikrometroa', es: 'Micrómetro' })} txt={INSTR[lang]} />
    ),
  },
  {
    id: 'microv',
    title: { eu: 'Mikrometro nonioduna (12,873)', es: 'Micrómetro con nonio (12,873)' },
    render: (lang, solved) => (
      <MicrometerScale spec={VERNIER_MICROMETER} value={parse('12.873')} showCoincidence={solved} title={L(lang, { eu: 'Mikrometro nonioduna', es: 'Micrómetro con nonio' })} txt={INSTR[lang]} />
    ),
  },
];

export function SchemaGallery({ lang }: { lang: Lang }) {
  const [id, setId] = useState(DEMOS[0]!.id);
  const [solved, setSolved] = useState(false);
  const demo = DEMOS.find((d) => d.id === id) ?? DEMOS[0]!;
  return (
    <section className="card">
      <h1>{lang === 'eu' ? 'Eskemak eta tresnak (berrikusteko)' : 'Esquemas e instrumentos (para revisar)'}</h1>
      <div className="demo-pick" role="tablist">
        {DEMOS.map((d) => (
          <button key={d.id} role="tab" aria-selected={d.id === demo.id} className={d.id === demo.id ? 'small sel' : 'small'} onClick={() => setId(d.id)}>
            {L(lang, d.title)}
          </button>
        ))}
      </div>
      <div className="actions">
        <button className={solved ? 'small' : 'small sel'} aria-pressed={!solved} onClick={() => setSolved(false)}>
          {lang === 'eu' ? 'Enuntziatua' : 'Enunciado'}
        </button>
        <button className={solved ? 'small sel' : 'small'} aria-pressed={solved} onClick={() => setSolved(true)}>
          {lang === 'eu' ? 'Ebazpena' : 'Solución'}
        </button>
      </div>
      <h2 className="sec">{L(lang, demo.title)}</h2>
      <div className="schema-wrap">{demo.render(lang, solved)}</div>
      <Legend
        items={[
          { cls: 'piece', text: lang === 'eu' ? 'pieza' : 'pieza' },
          { cls: 'roller', text: lang === 'eu' ? 'arrabolak / bolak / hariak' : 'rodillos / bolas / alambres' },
          { cls: 'block', text: lang === 'eu' ? 'galga-blokeak' : 'bloques patrón' },
          { cls: 'calc', text: lang === 'eu' ? 'kalkulatutako dimentsioa' : 'dimensión calculada' },
        ]}
      />
    </section>
  );
}
