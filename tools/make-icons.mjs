// Renders public/icon.svg into the PNG icons of the PWA manifest.
// Usage: node tools/make-icons.mjs   (needs Edge or Chrome)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage();
for (const [size, file, pad] of [
  [192, 'public/icon-192.png', 0],
  [512, 'public/icon-512.png', 0],
  [512, 'public/icon-512-maskable.png', 0.12], // safe zone for maskable icons
]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - 2 * pad));
  await page.setContent(
    `<html><body style="margin:0;background:#0f1b2d;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: false });
  console.log('wrote', file);
}
await browser.close();
