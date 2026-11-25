import { useEffect, useState } from 'react';
import { type Lang, LangContext, translate } from '../i18n';
import { PracticeExercise } from './PracticeExercise';
import { PracticeHome } from './PracticeHome';
import { type Route, useRoute } from './router';
import { SchemaGallery } from './SchemaGallery';
import { loadLang, saveLang } from './store';
import { WorkedList, WorkedView } from './WorkedView';

type Section = 'home' | 'teoria' | 'ebatziak' | 'praktika' | 'aurrerapena' | 'eskemak';

const NAV: { key: string; section: Exclude<Section, 'home' | 'eskemak'>; icon: string }[] = [
  { key: 'nav.theory', section: 'teoria', icon: 'T' },
  { key: 'nav.worked', section: 'ebatziak', icon: 'E' },
  { key: 'nav.practice', section: 'praktika', icon: 'P' },
  { key: 'nav.progress', section: 'aurrerapena', icon: 'A' },
];

const TOPICS = ['reading', 'gauges', 'angles', 'tapers', 'threads', 'rollers', 'temperature', 'limits'] as const;
const STEPS = ['theory', 'worked', 'practice', 'exam'] as const;

const sectionOf = (r: Route): Section =>
  r.name === 'start' ? 'home' : r.name === 'soon' ? r.section : r.name === 'schemas' ? 'eskemak' : r.name === 'workedList' || r.name === 'worked' ? 'ebatziak' : 'praktika';

const COMMIT = (import.meta.env.VITE_COMMIT as string | undefined)?.slice(0, 7) ?? 'dev';
const VERSION = 'v0.6.0';

export function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const route = useRoute();
  const section = sectionOf(route);
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

  let page;
  switch (route.name) {
    case 'schemas':
      page = <SchemaGallery lang={lang} />;
      break;
    case 'practice':
      page = <PracticeHome />;
      break;
    case 'workedList':
      page = <WorkedList />;
      break;
    case 'worked':
      page = <WorkedView key={route.id} id={route.id} />;
      break;
    case 'generated':
      page = <PracticeExercise key={`${route.template}/${route.level}/${route.seed}`} source={{ kind: 'generated', template: route.template, level: route.level, seed: route.seed }} />;
      break;
    case 'pool':
      page = <PracticeExercise key={route.id} source={{ kind: 'pool', id: route.id }} />;
      break;
    case 'soon':
      page = (
        <section className="card">
          <h1>{t(NAV.find((n) => n.section === route.section)!.key)}</h1>
          <p className="note">{t('nav.soon')}</p>
        </section>
      );
      break;
    default:
      page = (
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
      );
  }

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
          <main>{page}</main>
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
