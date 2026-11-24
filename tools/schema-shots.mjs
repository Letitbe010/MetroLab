// Screenshots of every schema / instrument in the review gallery (#/eskemak), statement and
// solution modes, at 1280 px and 390 px. Usage (dev server running on 5193):
//   node tools/schema-shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5193/MetroLab/';
const out = process.argv[3] ?? 'screenshots/schemas';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: width < 600 ? 2 : 1 });
  await page.goto(base + '#/eskemak');
  await page.waitForSelector('.demo-pick');
  // the fixed bottom navigation would cover the figures in element screenshots
  await page.addStyleTag({ content: '.bottom { display: none !important; }' });
  const tabs = await page.locator('.demo-pick button').all();
  for (let i = 0; i < tabs.length; i++) {
    await tabs[i].click();
    for (const mode of ['Enuntziatua', 'Ebazpena']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      const target = page.locator('.schema-wrap');
      const name = `${String(i + 1).padStart(2, '0')}-${mode === 'Ebazpena' ? 'sol' : 'stmt'}-${width}.png`;
      await target.screenshot({ path: `${out}/${name}` });
    }
  }
  await page.close();
}
await browser.close();
console.log('screenshots in', out);
