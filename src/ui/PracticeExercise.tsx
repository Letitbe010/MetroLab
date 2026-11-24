/**
 * Practice exercise screen (spec §13.1): ① statement → ② solve → ③ grading → ④ solution.
 * Statement and schema on top, answer form below. After grading the schema shows the computed
 * dimensions (orange) and the step-by-step solution can be opened.
 */
import { useMemo, useState } from 'react';
import { generate, LEVELS, TEMPLATES, type TemplateId } from '../core/generator';
import { type Answer, type GradeResult, gradeExercise } from '../core/grader';
import type { Exercise, Setup } from '../core/model';
import * as R from '../core/rational';
import { solveExercise } from '../core/solve';
import { poolById } from '../data/pool';
import { useT } from '../i18n';
import { AnswerForm } from './AnswerForm';
import { askLabel, exerciseTitle, letter } from './describe';
import { fmt } from './format';
import { hrefOf, randomSeed } from './router';
import { SetupSchema } from './SetupSchema';
import { solutionLines } from './solution';
import { loadAnswers, saveAnswers } from './store';

export type ExerciseSource = { kind: 'generated'; template: string; level: number; seed: number } | { kind: 'pool'; id: string };

type Loaded = { ok: true; ex: Exercise } | { ok: false; reason: 'notFound' | 'error' };

function load(src: ExerciseSource): Loaded {
  try {
    if (src.kind === 'pool') {
      const ex = poolById(src.id);
      return ex ? { ok: true, ex } : { ok: false, reason: 'notFound' };
    }
    const tpl = src.template as TemplateId;
    if (!TEMPLATES.includes(tpl) || !(LEVELS[tpl] as number[]).includes(src.level)) return { ok: false, reason: 'notFound' };
    return { ok: true, ex: generate(tpl, src.seed, src.level as 1 | 2 | 3).exercise };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

const STEPS = ['steps.statement', 'steps.solve', 'steps.grade', 'steps.solution'] as const;

/** Data of the setup as a list (accessible alternative to the figure, spec §13.2). */
function DataList({ setup }: { setup: Setup }) {
  const { t } = useT();
  const rows = Object.entries(setup).filter(([k, v]) => !['kind', 'plane', 'given', 'material', 'thread', 'feature', 'dovetail', 'set'].includes(k) && v !== undefined);
  const show = (v: unknown): string => {
    if (Array.isArray(v)) return v.map(show).join('; ');
    if (typeof v === 'number') return String(v);
    const s = String(v);
    try {
      return /^[0-9.e/-]+$/.test(s) ? fmt(R.toNumber(R.parse(s)), 6) : s;
    } catch {
      return s;
    }
  };
  if (setup.kind === 'vernier' || setup.kind === 'micrometer') return null;
  return (
    <dl className="datalist">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{t(`data.${k}`)}</dt>
          <dd>{show(v)}</dd>
        </div>
      ))}
      {'set' in setup && setup.set && (
        <div>
          <dt>{t('data.set')}</dt>
          <dd>{t(`set.${setup.set}`)}</dd>
        </div>
      )}
    </dl>
  );
}

export function PracticeExercise({ source }: { source: ExerciseSource }) {
  const { t, lang } = useT();
  const loaded = useMemo(() => load(source), [source]);
  const exId = loaded.ok ? loaded.ex.id : '';
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => (exId ? loadAnswers(exId) : {}));
  const [result, setResult] = useState<GradeResult | undefined>();
  const key = useMemo(() => (loaded.ok ? solveExercise(loaded.ex) : {}), [loaded]);

  if (!loaded.ok)
    return (
      <section className="card">
        <a href={hrefOf({ name: 'practice' })}>{t('ex.back')}</a>
        <p className="note warn">{t(loaded.reason === 'notFound' ? 'ex.notFound' : 'ex.error')}</p>
      </section>
    );
  const ex = loaded.ex;
  const onChange = (askId: string, patch: Partial<Answer>) =>
    setAnswers((prev) => {
      const next = { ...prev, [askId]: { ...(prev[askId] ?? {}), ...patch } };
      saveAnswers(ex.id, next);
      return next;
    });
  const check = () => {
    setResult(gradeExercise(ex, answers));
    setStep(2);
  };
  const graded = step >= 2 && result;
  const next = () => {
    if (source.kind === 'generated') window.location.hash = hrefOf({ name: 'generated', template: source.template, level: source.level, seed: randomSeed() });
    else window.location.hash = hrefOf({ name: 'practice' });
  };

  return (
    <section className="card exercise">
      <div className="ex-top">
        <a href={hrefOf({ name: 'practice' })}>{t('ex.back')}</a>
        <span className="tags">
          <span className={`tag origin-${ex.origin}`}>{t(`origin.${ex.origin}`)}</span>
          <span className="tag">{t('practice.level', { n: ex.difficulty })}</span>
          {ex.seed !== undefined && ex.origin === 'generated' && <span className="tag">{t('ex.seed', { s: ex.seed })}</span>}
          {ex.status !== 'approved' && ex.origin !== 'generated' && <span className="tag warn">{t('practice.review')}</span>}
        </span>
      </div>
      <h1>{exerciseTitle(ex, t)}</h1>

      <ol className="stepper" aria-label={t('steps.label')}>
        {STEPS.map((k, i) => (
          <li key={k} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="num">{i + 1}</span> <span className="lbl">{t(k)}</span>
          </li>
        ))}
      </ol>

      <p className="statement">{ex.text[lang]}</p>
      {ex.origin !== 'generated' && (
        <p className="source">
          {t(`poolNote.${ex.id}`)}
          {ex.sourceUrl && (
            <>
              {' '}
              <a href={ex.sourceUrl} target="_blank" rel="noreferrer">
                {t('ex.source')}
              </a>
            </>
          )}
        </p>
      )}

      <SetupSchema ex={ex} answerKey={key} solved={!!graded} />
      <DataList setup={ex.setup} />

      <h2 className="sec">{t('ex.asks')}</h2>
      <ol className="ask-list">
        {ex.asks.map((a, i) => (
          <li key={a.id}>
            {letter(i)} {askLabel(a, t)}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="actions">
          <button className="primary" onClick={() => setStep(1)}>
            {t('ex.start')}
          </button>
        </div>
      ) : (
        <>
          <AnswerForm ex={ex} answerKey={key} answers={answers} onChange={onChange} results={graded ? result.asks : undefined} disabled={!!graded} />
          <div className="actions">
            {!graded && (
              <>
                <button className="primary" onClick={check}>
                  {t('ex.check')}
                </button>
                <button onClick={() => setStep(3)}>{t('ex.showSolution')}</button>
              </>
            )}
            {graded && (
              <>
                <span className="score" role="status">
                  {t('ex.score', { s: fmt(result.score10, 2) })}
                </span>
                {step === 2 && (
                  <button className="primary" onClick={() => setStep(3)}>
                    {t('ex.showSolution')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setResult(undefined);
                    setStep(1);
                  }}
                >
                  {t('ex.retry')}
                </button>
                <button onClick={next}>{t(source.kind === 'generated' ? 'ex.another' : 'ex.backList')}</button>
              </>
            )}
          </div>
          {step === 3 && (
            <div className="solution">
              <h2 className="sec">{t('steps.solution')}</h2>
              {!graded && <SetupSchema ex={ex} answerKey={key} solved />}
              {solutionLines(ex, key, t).map((sol, i) => (
                <div key={sol.askId} className="sol-ask">
                  <h3>
                    {letter(i)} {askLabel(ex.asks[i]!, t)}
                  </h3>
                  {sol.lines.map((l, j) =>
                    l.kind === 'warn' ? (
                      <p key={j} className="note warn">
                        <b>{t('sol.careful')}</b> {l.text}
                      </p>
                    ) : l.kind === 'formula' || l.kind === 'result' ? (
                      <p key={j} className={`formula ${l.kind}`}>
                        {l.text}
                      </p>
                    ) : (
                      <p key={j}>{l.text}</p>
                    ),
                  )}
                </div>
              ))}
              {!graded && (
                <div className="actions">
                  <button onClick={next}>{t(source.kind === 'generated' ? 'ex.another' : 'ex.backList')}</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
