/**
 * Worked exercises screens (spec §15.2): the list, and one exercise revealed step by step
 * ("next step" or "show all"), each step with what / why / careful; at the end "now you"
 * generates an exercise of the same template with new data.
 */
import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { askLabel, exerciseTitle } from './describe';
import { hrefOf, randomSeed } from './router';
import { SetupSchema } from './SetupSchema';
import { solveExercise } from '../core/solve';
import { WORKED, workedExercise, workedSteps } from './worked';

export function WorkedList() {
  const { t } = useT();
  return (
    <section className="card">
      <h1>{t('worked.title')}</h1>
      <p className="lead">{t('worked.lead')}</p>
      <div className="tiles">
        {WORKED.map((w, i) => (
          <a key={w.id} className="tile" href={hrefOf({ name: 'worked', id: w.id })}>
            <span className="tags">
              <span className="tag">{i + 1}</span>
              {w.status === 'draft' && <span className="tag warn">{t('worked.draft')}</span>}
            </span>
            <b>{t(`wk.${w.id}.title`)}</b>
          </a>
        ))}
      </div>
    </section>
  );
}

export function WorkedView({ id }: { id: string }) {
  const { t, lang } = useT();
  const w = WORKED.find((x) => x.id === id);
  const [shown, setShown] = useState(1);
  const steps = useMemo(() => (w ? workedSteps(w, t) : []), [w, t]);
  if (!w)
    return (
      <section className="card">
        <a href={hrefOf({ name: 'workedList' })}>{t('worked.back')}</a>
        <p className="note warn">{t('ex.notFound')}</p>
      </section>
    );
  const ex = workedExercise(w);
  const key = solveExercise(ex);
  const done = shown >= steps.length;
  const now = () => {
    window.location.hash = hrefOf({ name: 'generated', template: w.now.template, level: w.now.level, seed: randomSeed() });
  };
  return (
    <section className="card exercise worked">
      <div className="ex-top">
        <a href={hrefOf({ name: 'workedList' })}>{t('worked.back')}</a>
        <span className="tags">{w.status === 'draft' && <span className="tag warn">{t('worked.draft')}</span>}</span>
      </div>
      <h1>{t(`wk.${w.id}.title`)}</h1>
      <p className="source">
        {t('worked.base')}: <a href={hrefOf({ name: 'pool', id: ex.id })}>{exerciseTitle(ex, t)}</a>
      </p>
      <p className="statement">{ex.text[lang]}</p>
      <SetupSchema ex={ex} answerKey={key} solved={done} />

      <ol className="wsteps">
        {steps.slice(0, shown).map((s, i) => (
          <li key={i} className="wstep">
            <h3>
              <span className="num">{i + 1}</span> {s.kind === 'intro' ? t('worked.intro') : askLabel(ex.asks.find((a) => a.id === s.askId)!, t)}
            </h3>
            {s.what.length > 0 && (
              <div className="layer what">
                <h4>{t('worked.what')}</h4>
                {s.what.map((l, j) =>
                  l.kind === 'text' ? (
                    <p key={j}>{l.text}</p>
                  ) : (
                    <p key={j} className={`formula ${l.kind}`}>
                      {l.text}
                    </p>
                  ),
                )}
              </div>
            )}
            <div className="layer why">
              {s.kind !== 'intro' && <h4>{t('worked.why')}</h4>}
              <p>{s.why}</p>
            </div>
            {s.careful.map((c, j) => (
              <p key={j} className="note warn">
                <b>{t('sol.careful')}</b> {c}
              </p>
            ))}
          </li>
        ))}
      </ol>

      <div className="actions">
        {!done ? (
          <>
            <span className="muted" role="status">
              {t('worked.stepOf', { i: shown, n: steps.length })}
            </span>
            <button className="primary" onClick={() => setShown(shown + 1)}>
              {t('worked.next')}
            </button>
            <button onClick={() => setShown(steps.length)}>{t('worked.all')}</button>
          </>
        ) : (
          <>
            <span role="status">{t('worked.done')}</span>
            <button className="primary" onClick={now}>
              {t('worked.nowYou')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
