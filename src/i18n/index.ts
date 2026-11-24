/** Bilingual UI strings (eu default, es). Missing keys fall back to Basque, then to the key. */
import { createContext, useContext } from 'react';
import es from './es.json';
import eu from './eu.json';

export type Lang = 'eu' | 'es';
const DICT: Record<Lang, Record<string, string>> = { eu, es };

export function translate(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const raw = DICT[lang][key] ?? DICT.eu[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const LangContext = createContext<Lang>('eu');
export function useT() {
  const lang = useContext(LangContext);
  return { lang, t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars) };
}

export { DICT };
