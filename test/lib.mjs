import { chromium } from 'playwright-core';
import path from 'path';
export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export async function launch(opt = {}) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: opt.viewport || { width: 1100, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(opt.url || ('file://' + path.join(root, 'index.html')));
  await page.waitForFunction(() => window.__app && window.__app.G, null, { timeout: 20000 });
  await page.waitForTimeout(opt.wait ?? 600);
  return { browser, page, errors };
}
export const stageShot = (page, file) => page.locator('#stage').screenshot({ path: file });
