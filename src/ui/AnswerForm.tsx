/**
 * Answer form (spec §13.1–13.2): one field per ask with a unit selector; gauge stacks as a
 * list of blocks. After grading every ask shows correct / wrong / missing with a symbol (never
 * colour alone), the right value, the user's value and, when found, the diagnosis.
 */
import type { Answer, AskResult } from '../core/grader';
import type { Exercise } from '../core/model';
import type { AnswerKey } from '../core/solve';
import { useT } from '../i18n';
import { askLabel, expectedText, givenText, letter, unitsFor } from './describe';

const SYMBOL: Record<string, string> = { correct: '✓', wrong: '✗', missing: '!', invalid: '!', partial: '½' };

function Feedback({ r }: { r: AskResult }) {
  const { t } = useT();
  return (
    <div className="feedback">
      {r.status !== 'correct' && (
        <p>
          {t('fb.expected')}: <b>{expectedText(r.expected, t)}</b>
          {r.given !== undefined && r.status !== 'partial' && (
            <>
              {' · '}
              {t('fb.given')}: {givenText(r.expected, r.given)}
            </>
          )}
        </p>
      )}
      {r.status === 'invalid' && <p>{t('fb.invalid')}</p>}
      {r.diagnosis && (
        <div className="diag">
          <b>{t('fb.seems')}</b> {t(`diag.${r.diagnosis}`, { detail: r.detail ?? '' })}
        </div>
      )}
      {r.notes.map((n) => (
        <p key={n} className="note">
          {t(`note.${n}`)}
        </p>
      ))}
    </div>
  );
}

export function AnswerForm({
  ex,
  answerKey,
  answers,
  onChange,
  results,
  disabled,
}: {
  ex: Exercise;
  answerKey: AnswerKey;
  answers: Record<string, Answer>;
  onChange: (askId: string, patch: Partial<Answer>) => void;
  results?: AskResult[];
  disabled?: boolean;
}) {
  const { t } = useT();
  return (
    <div className="asks">
      {ex.asks.map((a, i) => {
        const e = answerKey[a.id]!;
        const ans = answers[a.id] ?? {};
        const r = results?.find((x) => x.id === a.id);
        const units = unitsFor(e);
        const unit = ans.unit ?? units[0];
        const cls = r ? r.status : '';
        const fieldId = `ans-${a.id}`;
        return (
          <fieldset key={a.id} className={`ask ${cls}`}>
            <legend className="ask-head">
              <span>
                {letter(i)} {askLabel(a, t)}
              </span>
              {r && (
                <span className={`chip ${r.status}`}>
                  <span aria-hidden="true">{SYMBOL[r.status]}</span> {t(`status.${r.status}`)}
                </span>
              )}
            </legend>
            {e.q === 'stack' ? (
              <div className="stack-in">
                {(ans.blocks && ans.blocks.length ? ans.blocks : ['']).map((b, j, all) => (
                  <span key={j} className="block-in">
                    <input
                      aria-label={t('stack.block', { n: j + 1 })}
                      inputMode="decimal"
                      value={b}
                      disabled={disabled}
                      onChange={(ev) => onChange(a.id, { blocks: all.map((x, k) => (k === j ? ev.target.value : x)) })}
                    />
                    {all.length > 1 && !disabled && (
                      <button className="small" aria-label={t('stack.remove', { n: j + 1 })} onClick={() => onChange(a.id, { blocks: all.filter((_, k) => k !== j) })}>
                        ×
                      </button>
                    )}
                    {j < all.length - 1 && <span className="op">+</span>}
                  </span>
                ))}
                {!disabled && (
                  <button className="small" onClick={() => onChange(a.id, { blocks: [...(ans.blocks && ans.blocks.length ? ans.blocks : ['']), ''] })}>
                    {t('stack.add')}
                  </button>
                )}
              </div>
            ) : (
              <div className="row">
                <label className="fld w8" htmlFor={fieldId}>
                  <span className="sr-only">{askLabel(a, t)}</span>
                  <input
                    id={fieldId}
                    inputMode={e.q === 'angle' && unit === 'dms' ? 'text' : 'decimal'}
                    autoComplete="off"
                    value={ans.value ?? ''}
                    disabled={disabled}
                    placeholder={e.q === 'angle' && unit === 'dms' ? '8°31′51″' : e.q === 'taper' && unit === 'ratio' ? '0,1 · 1:10' : ''}
                    onChange={(ev) => onChange(a.id, { value: ev.target.value, unit })}
                  />
                </label>
                {units.length > 1 ? (
                  <div className="choice" role="group" aria-label={t('unit.label')}>
                    {units.map((u) => (
                      <button key={u} className={u === unit ? 'small sel' : 'small'} aria-pressed={u === unit} disabled={disabled} onClick={() => onChange(a.id, { unit: u })}>
                        {t(`unit.${u}`)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="unit">{t(`unit.${units[0]}`)}</span>
                )}
              </div>
            )}
            {r && <Feedback r={r} />}
          </fieldset>
        );
      })}
    </div>
  );
}
