// End-to-end check of the worked exercises (spec §15): list, step by step, "show all",
// "now you" → a generated exercise of the same template. Needs the dev server.
//   node tools/e2e-worked.mjs [baseUrl] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5193/MetroLab/';
const out = process.argv[3] ?? 'screenshots/worked';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
const errors = [];
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

for (const [lang, width] of [
  ['eu', 375],
  ['es', 1280],
]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: width < 600 ? 2 : 1 });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((l) => localStorage.setItem('metrolab.lang', JSON.stringify(l)), lang);
  await page.goto(`${base}#/ebatziak`);
  await page.waitForSelector('.tiles');
  ok((await page.locator('.tiles .tile').count()) >= 10, `${lang}: at least 10 worked exercises listed`);
  await page.screenshot({ path: `${out}/list-${lang}-${width}.png`, fullPage: true });
  await page.goto(`${base}#/ebatziak/w07-three-wire`);
  await page.waitForSelector('.wsteps');
  ok((await page.locator('.wstep').count()) === 1, `${lang}: starts with one step`);
  await page.locator('.actions button.primary').click();
  ok((await page.locator('.wstep').count()) === 2, `${lang}: next step reveals one more`);
  await page.locator('.actions button:not(.primary)').click();
  ok((await page.locator('.wstep').count()) === 3, `${lang}: show all reveals every step`);
  await page.addStyleTag({ content: '.bottom { display: none !important; }' });
  await page.screenshot({ path: `${out}/three-wire-${lang}-${width}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!overflow, `${lang}: no horizontal page scroll at ${width} px`);
  await page.locator('.actions button.primary').click();
  await page.waitForURL(/#\/praktika\/threeWire\/2\/seed\/\d+/);
  ok(true, `${lang}: "now you" opens a new threeWire exercise`);
  await page.close();
}
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
process.exit(failures ? 1 : 0);
