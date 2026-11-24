// End-to-end check of the practice screen (spec §12 phase 5): MG3 in Basque and MG2 in Spanish
// at 375 px, solved, graded and with the solution open; plus a 1280 px run. Needs the dev server.
//   node tools/e2e-practice.mjs [baseUrl] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5193/MetroLab/';
const out = process.argv[3] ?? 'screenshots/practice';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
const errors = [];
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

async function run({ id, lang, width, answers, expectScore, expectDiag, name }) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: width < 600 ? 2 : 1 });
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${name}: HTTP ${r.status()} ${r.url()}`));
  await page.addInitScript((l) => localStorage.setItem('metrolab.lang', JSON.stringify(l)), lang);
  await page.goto(`${base}#/praktika/pool/${id}`);
  await page.waitForSelector('.exercise');
  await page.screenshot({ path: `${out}/${name}-1-statement.png`, fullPage: true });
  await page.locator('.actions button.primary').first().click();
  for (const [askId, value, unit] of answers) {
    await page.fill(`#ans-${askId}`, value);
    if (unit) await page.locator(`fieldset:has(#ans-${askId}) .choice button`, { hasText: unit }).click();
  }
  await page.locator('.actions button.primary').first().click();
  await page.waitForSelector('.score');
  const score = await page.locator('.score').innerText();
  ok(score.includes(expectScore), `${name}: score "${score}" contains ${expectScore}`);
  if (expectDiag) ok((await page.locator('.diag').allInnerTexts()).some((x) => x.includes(expectDiag)), `${name}: diagnosis mentions "${expectDiag}"`);
  await page.screenshot({ path: `${out}/${name}-2-graded.png`, fullPage: true });
  await page.locator('.actions button.primary', { hasText: lang === 'eu' ? 'Ebazpena' : 'solución' }).click();
  await page.waitForSelector('.solution');
  ok((await page.locator('.sol-ask').count()) === (await page.locator('fieldset.ask').count()), `${name}: one solution block per ask`);
  await page.screenshot({ path: `${out}/${name}-3-solution.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!overflow, `${name}: no horizontal page scroll at ${width} px`);
  await page.close();
}

await run({
  name: 'mg3-eu-375',
  id: 'spec-mg3',
  lang: 'eu',
  width: 375,
  answers: [
    ['C', '1:10'],
    ['half', '2,8624'],
    ['full', '2,8624'],
  ],
  expectScore: '6,67',
  expectDiag: 'erdi-angelua',
});
await run({
  name: 'mg2-es-375',
  id: 'spec-mg2',
  lang: 'es',
  width: 375,
  answers: [
    ['dw', '0,866'],
    ['d2', '9,227'],
  ],
  expectScore: '5',
  expectDiag: '0,866·P',
});
await run({
  name: 'mg1-eu-1280',
  id: 'spec-mg1',
  lang: 'eu',
  width: 1280,
  answers: [['h', '25,882']],
  expectScore: '5',
});
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
process.exit(failures ? 1 : 0);
