/**
 * Per-viewer conveniences in localStorage (spec §1: always inside try/catch): language and
 * unfinished answers per exercise (spec §13.1: leaving an exercise keeps the answers).
 */
import type { Answer } from '../core/grader';
import type { Lang } from '../i18n';

const K = 'metrolab.';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(K + key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(K + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: kept only for this visit */
  }
}

export const loadLang = (): Lang => (read<string>('lang', 'eu') === 'es' ? 'es' : 'eu');
export const saveLang = (l: Lang): void => write('lang', l);

export const loadAnswers = (exerciseId: string): Record<string, Answer> => read(`answers.${exerciseId}`, {});
export const saveAnswers = (exerciseId: string, a: Record<string, Answer>): void => write(`answers.${exerciseId}`, a);
