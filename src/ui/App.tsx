import { useEffect, useState } from 'react';
import { type Lang, LangContext, translate } from '../i18n';
import { loadLang, saveLang } from './store';

type Section = 'home' | 'teoria' | 'ebatziak' | 'praktika' | 'aurrerapena';

const NAV: { key: string; section: Exclude<Section, 'home'>; icon: string }[] = [
  { key: 'nav.theory', section: 'teoria', icon: 'T' },
  { key: 'nav.worked', section: 'ebatziak', icon: 'E' },
  { key: 'nav.practice', section: 'praktika', icon: 'P' },
  { key: 'nav.progress', section: 'aurrerapena', icon: 'A' },
];

const TOPICS = ['reading', 'gauges', 'angles', 'tapers', 'threads', 'rollers', 'temperature', 'limits'] as const;
const STEPS = ['theory', 'worked', 'practice', 'exam'] as const;

function parseHash(): Section {
  const s = window.location.hash.replace(/^#\/?/, '').split('/')[0] ?? '';
  return (NAV.find((n) => n.section === s)?.section ?? 'home') as Section;
}

function useSection(): Section {
  const [s, setS] = useState<Section>(parseHash);
  useEffect(() => {
    const on = () => setS(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return s;
}

const COMMIT = (import.meta.env.VITE_COMMIT as string | undefined)?.slice(0, 7) ?? 'dev';
const VERSION = 'v0.1.0';

export function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const section = useSection();
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  useEffect(() => {
    document.documentElement.lang = lang;
    saveLang(lang);
  }, [lang]);

  const link = (n: (typeof NAV)[number]) => {
    const on = n.section === section;
    return (
      <a href={`#/${n.section}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
        <span className="ico" aria-hidden="true">
          {n.icon}
        </span>
        <span>{t(n.key)}</span>
      </a>
    );
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <nav className="side" aria-label={t('nav.home')}>
          <a className="brand" href="#/">
            <small>{t('app.kicker')}</small>
            <b>MetroLab</b>
          </a>
          <ul>
            {NAV.map((n) => (
              <li key={n.key}>{link(n)}</li>
            ))}
          </ul>
          <p className="meta">
            {VERSION} · {COMMIT} · {__BUILD_DATE__}
          </p>
        </nav>
        <div className="main">
          <header className="top">
            <a className="brand mobile-only" href="#/" aria-label={t('nav.home')}>
              <b>MetroLab</b>
            </a>
            <div className="lang" role="group" aria-label="Hizkuntza / Idioma">
              {(['eu', 'es'] as const).map((l) => (
                <button key={l} className={l === lang ? 'sel' : ''} aria-pressed={l === lang} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </header>
          <main>
            {section === 'home' ? (
              <section className="card">
                <h1>{t('home.title')}</h1>
                <p className="lead">{t('home.lead')}</p>
                <h2 className="sec">{t('home.path')}</h2>
                <ol className="path">
                  {STEPS.map((s) => (
                    <li key={s}>{t(`home.step.${s}`)}</li>
                  ))}
                </ol>
                <h2 className="sec">{t('home.topics')}</h2>
                <div className="topics">
                  {TOPICS.map((k) => (
                    <div key={k} className="topic">
                      <h3>{t(`topic.${k}`)}</h3>
                      <p>{t(`topic.${k}.d`)}</p>
                    </div>
                  ))}
                </div>
                <p className="note warn">{t('status.wip')}</p>
              </section>
            ) : (
              <section className="card">
                <h1>{t(NAV.find((n) => n.section === section)!.key)}</h1>
                <p className="note">{t('nav.soon')}</p>
              </section>
            )}
          </main>
        </div>
        <nav className="bottom" aria-label={t('nav.home')}>
          {NAV.map((n) => (
            <span key={n.key} className="bottom-item">
              {link(n)}
            </span>
          ))}
        </nav>
      </div>
    </LangContext.Provider>
  );
}
