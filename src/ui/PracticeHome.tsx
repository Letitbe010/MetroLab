import { LEVELS, TEMPLATES } from '../core/generator';
import { POOL } from '../data/pool';
import { useT } from '../i18n';
import { exerciseTitle } from './describe';
import { hrefOf, randomSeed } from './router';

export function PracticeHome() {
  const { t } = useT();
  const levels = [1, 2, 3] as const;
  const ope = POOL.filter((e) => e.origin !== 'generated');
  return (
    <section className="card">
      <h1>{t('practice.title')}</h1>
      <p className="lead">{t('practice.lead')}</p>

      <h2 className="sec">{t('practice.pool')}</h2>
      <div className="tiles">
        {ope.map((ex) => (
          <a key={ex.id} className="tile" href={hrefOf({ name: 'pool', id: ex.id })}>
            <span className="tags">
              <span className={`tag origin-${ex.origin}`}>{t(`origin.${ex.origin}`)}</span>
              <span className="tag">{t('practice.level', { n: ex.difficulty })}</span>
              {ex.status !== 'approved' && <span className="tag warn">{t('practice.review')}</span>}
            </span>
            <b>{exerciseTitle(ex, t)}</b>
          </a>
        ))}
      </div>

      <h2 className="sec">{t('practice.generated')}</h2>
      {levels.map((lv) => (
        <div key={lv} className="level">
          <h3>{t('practice.level', { n: lv })}</h3>
          <div className="tiles">
            {TEMPLATES.filter((tp) => LEVELS[tp].includes(lv)).map((tp) => (
              <a
                key={tp}
                className="tile"
                href={hrefOf({ name: 'generated', template: tp, level: lv, seed: 1 })}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = hrefOf({ name: 'generated', template: tp, level: lv, seed: randomSeed() });
                }}
              >
                <b>{t(`tpl.${tp}`)}</b>
                <span className="go">{t('practice.new')} →</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
