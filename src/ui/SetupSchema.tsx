/**
 * The measurement schema of an exercise (spec §6): the statement shows the data and "?" for the
 * unknowns; the solution shows the computed dimensions in orange. Geometry always comes from
 * core/ solvers on the exercise's data.
 */
import { limitsFromDesignation } from '../core/fixedGauges';
import type { Exercise } from '../core/model';
import { dovetailWidthA } from '../core/profiles';
import * as R from '../core/rational';
import { STANDARD_MICROMETER, VERNIER_MICROMETER } from '../core/reading';
import { sineBarAngle, type AnswerKey } from '../core/solve';
import { ballTaperA } from '../core/taper';
import { pitchDiameterA } from '../core/threads';
import { useT } from '../i18n';
import { exactText } from './describe';
import { deg, fmt, mm } from './format';
import { MicrometerScale, VernierScale, type InstrumentTxt } from './Instrument';
import { GaugeStackSchema, SineBarSchema, TaperBallsSchema, TaperRollersSchema } from './schema/schemasA';
import { DovetailSchema, FixedGaugeSchema, SplineSchema, TemperatureSchema, ThreeWireSchema } from './schema/schemasB';
import { Legend, type Tone } from './schema/svg';

const n = (s: string | undefined): number => R.toNumber(R.parse(s ?? '0'));
const c = (s: string): string => fmt(n(s), 4);

export function SetupSchema({ ex, answerKey, solved }: { ex: Exercise; answerKey: AnswerKey; solved: boolean }) {
  const { t } = useT();
  const s = ex.setup;
  const txt = { noScale: t('schema.noScale') };
  const title = t('schema.title');
  const tone: Tone = solved ? 'calc' : 'dim';
  const Q = '?';
  const has = (kind: string, at?: string) => ex.asks.find((a) => a.kind === kind && (at === undefined || a.at === at));
  const val = (kind: string, f: (v: number) => string, at?: string): string => {
    const a = has(kind, at);
    if (!a) return '';
    return solved ? f(answerKey[a.id]!.value) : Q;
  };
  const instr: InstrumentTxt = {
    zoomOut: t('instr.zoomOut'),
    zoomIn: t('instr.zoomIn'),
    zoom: t('instr.zoom'),
    mainScale: t('instr.mainScale'),
    vernier: t('instr.vernier'),
    sleeve: t('instr.sleeve'),
    thimble: t('instr.thimble'),
  };
  let fig: JSX.Element | null = null;
  switch (s.kind) {
    case 'vernier':
      fig = <VernierScale spec={{ s: R.parse(s.s), n: s.n, modulus: s.modulus }} value={R.parse(s.value)} showCoincidence={solved} title={t('instr.vernierTitle')} txt={instr} />;
      break;
    case 'micrometer':
      fig = <MicrometerScale spec={s.vernierDivs ? VERNIER_MICROMETER : STANDARD_MICROMETER} value={R.parse(s.value)} showCoincidence={solved} title={t('instr.microTitle')} txt={instr} />;
      break;
    case 'gaugeStack': {
      const a = ex.asks[0]!;
      const k = answerKey[a.id]!.stack!;
      fig = solved ? (
        <GaugeStackSchema blocks={k.reference.map(R.toNumber)} labels={k.reference.map(exactText)} total={exactText(k.target)} title={title} txt={{ noScale: t('schema.noScaleShort') }} tone="calc" />
      ) : null;
      break;
    }
    case 'sineBar': {
      const angle = sineBarAngle(s);
      const stackAsk = has('gaugeStack');
      const stack = solved && stackAsk ? answerKey[stackAsk.id]!.stack!.reference.map(R.toNumber).sort((x, y) => y - x) : undefined;
      fig = (
        <SineBarSchema
          L={n(s.L)}
          angleDeg={angle}
          stack={stack}
          title={title}
          txt={txt}
          labels={{
            L: `L = ${c(s.L)}`,
            h: s.h ? `h = ${c(s.h)}` : `h = ${val('sineHeight', (v) => fmt(v, 3)) || Q}`,
            angle: s.angleDeg ? `α = ${c(s.angleDeg)}°` : s.taperC ? `α/2${solved ? ` = ${deg(angle, 4)}` : ''}` : `α = ${val('sineAngle', (v) => deg(v, 4))}`,
          }}
          tones={{ h: s.h ? 'dim' : tone, angle: s.angleDeg ? 'dim' : tone }}
        />
      );
      break;
    }
    case 'taperRollers': {
      const plane = !!s.plane;
      const halfAsk = plane ? 'planeAngle' : has('halfAngle') ? 'halfAngle' : has('fullAngle') ? 'fullAngle' : 'taperC';
      const halfLabel = plane ? `a${solved ? ` = ${val('planeAngle', (v) => deg(v, 2))}` : ''}` : halfAsk === 'halfAngle' ? `α/2${solved ? ` = ${val('halfAngle', (v) => deg(v, 4))}` : ''}` : 'α/2';
      fig = (
        <TaperRollersSchema
          rollerD={n(s.rollerD)}
          h1={n(s.h1)}
          h2={n(s.h2)}
          M1={n(s.M1)}
          M2={n(s.M2)}
          plane={plane}
          title={title}
          txt={txt}
          labels={{ M1: c(s.M1), M2: c(s.M2), h1: c(s.h1), h2: c(s.h2), d: `Ø${c(s.rollerD)}`, half: halfLabel }}
          halfTone={tone}
        />
      );
      break;
    }
    case 'taperBalls': {
      const b = { d1: n(s.d1), d2: n(s.d2), depth1: n(s.depth1), depth2: n(s.depth2) };
      const A = ballTaperA(b);
      fig = (
        <TaperBallsSchema
          {...b}
          halfAngleDeg={A.halfAngleDeg}
          Dtop={A.Dtop}
          title={title}
          txt={txt}
          labels={{ d1: `Ø${c(s.d1)}`, d2: `Ø${c(s.d2)}`, depth1: c(s.depth1), depth2: c(s.depth2), Dtop: `D = ${solved ? mm(A.Dtop) : Q}`, half: solved ? `α/2 = ${deg(A.halfAngleDeg, 4)}` : 'α/2' }}
          tones={{ Dtop: tone, half: tone }}
        />
      );
      break;
    }
    case 'threeWire': {
      const P = n(s.P);
      const a = n(s.flankAngleDeg);
      const d2 = s.d2 ? n(s.d2) : pitchDiameterA(n(s.M), n(s.wireD), P, a);
      fig = (
        <ThreeWireSchema
          P={P}
          flankAngleDeg={a}
          d2={d2}
          dw={n(s.wireD)}
          title={title}
          txt={txt}
          labels={{
            M: s.M ? `M = ${c(s.M)}` : `M = ${val('measure', (v) => fmt(v, 3))}`,
            P: `P = ${c(s.P)}`,
            dw: `dw = ${c(s.wireD)}`,
            angle: `${c(s.flankAngleDeg)}°`,
            d2: s.d2 ? `d₂ = ${c(s.d2)}` : `d₂ = ${val('pitchDiameter', (v) => fmt(v, 3))}`,
          }}
          tones={{ M: s.M ? 'dim' : tone, d2: s.d2 ? 'dim' : tone }}
        />
      );
      break;
    }
    case 'spline':
      fig = (
        <SplineSchema
          rollerD={n(s.rollerD)}
          vAngleDeg={n(s.vAngleDeg)}
          apexRadius={n(s.apexRadius)}
          title={title}
          txt={txt}
          labels={{ M: `M = ${val('measure', (v) => fmt(v, 3))}`, d: `Ø${c(s.rollerD)}`, angle: `${c(s.vAngleDeg)}°`, Ra: c(s.apexRadius) }}
          tones={{ M: tone }}
        />
      );
      break;
    case 'dovetail': {
      const width = s.width ? n(s.width) : dovetailWidthA(s.dovetail, n(s.rollerD), n(s.alphaDeg), n(s.X));
      const wl = s.dovetail === 'male' ? 'b' : 'B';
      fig = (
        <DovetailSchema
          kind={s.dovetail}
          rollerD={n(s.rollerD)}
          alphaDeg={n(s.alphaDeg)}
          width={width}
          title={title}
          txt={txt}
          labels={{
            X: s.X ? `X = ${c(s.X)}` : `X = ${val('measure', (v) => fmt(v, 3))}`,
            width: s.width ? `${wl} = ${c(s.width)}` : `${wl} = ${val('width', (v) => fmt(v, 3))}`,
            d: `Ø${c(s.rollerD)}`,
            alpha: `${c(s.alphaDeg)}°`,
          }}
          tones={{ X: s.X ? 'dim' : tone, width: s.width ? 'dim' : tone }}
        />
      );
      break;
    }
    case 'temperature':
      fig = (
        <TemperatureSchema
          title={title}
          txt={txt}
          labels={{
            L: `L = ${c(s.L)}`,
            tPart: `${c(s.tPart)} °C`,
            tTool: s.given === 'measured' ? `${s.tTool ? c(s.tTool) : '20'} °C` : undefined,
            partWord: t(`material.${s.material ?? 'steel'}`),
            toolWord: t('schema.tool'),
          }}
        />
      );
      break;
    case 'fixedGauge': {
      const feature = s.designation ? limitsFromDesignation(s.designation).feature : s.feature;
      fig = (
        <FixedGaugeSchema
          feature={feature}
          tone={tone}
          title={title}
          txt={txt}
          labels={{ go: val('gaugeGo', (v) => fmt(v, 3)) || Q, noGo: val('gaugeNoGo', (v) => fmt(v, 3)) || Q, goWord: t('gauge.go'), noGoWord: t('gauge.noGo') }}
        />
      );
      break;
    }
    case 'error':
      fig = null;
      break;
  }
  if (!fig) return null;
  const isInstrument = s.kind === 'vernier' || s.kind === 'micrometer';
  return (
    <div className="schema-wrap">
      {fig}
      {!isInstrument && (
        <Legend
          items={[
            { cls: 'piece', text: t('legend.piece') },
            { cls: 'roller', text: t('legend.roller') },
            { cls: 'block', text: t('legend.block') },
            ...(solved ? [{ cls: 'calc', text: t('legend.calc') }] : []),
          ]}
        />
      )}
    </div>
  );
}
