// 自动通关全 5 关（本地 index.html，或 URL=... 指向在线页）
import { launch, stageShot, root } from './lib.mjs';
const url = process.env.URL;
const { browser, page, errors } = await launch({ wait: 1200, url });
await page.evaluate(() => { __app.setSetting('autoSpeed', 8); __app.setSetting('introMs', 300); });
let ok = true; const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) ok = false; };
const t0 = Date.now(); const per = {};
await page.click('#btnAuto');
let lastN = 1, tl = Date.now(), guard = 0;
while (guard++ < 600) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => ({ n: __app.G.n, panel: __app.G.panel, auto: __app.AUTO.running, cleared: __app.ST.cleared, tot: __app.LV.blocks.length }));
  if (st.n !== lastN) { per[lastN] = (Date.now() - tl) / 1000; tl = Date.now(); lastN = st.n; }
  if (st.panel === 'end') { per[st.n] = (Date.now() - tl) / 1000; break; }
  if (!st.auto) { console.log('auto stopped', JSON.stringify(st)); break; }
}
const fin = await page.evaluate(() => ({ n: __app.G.n, panel: __app.G.panel }));
await stageShot(page, root + '/shots/run_end.png');
check(fin.n === 5 && fin.panel === 'end', `auto-solve completes L1-L5 and shows end card (${JSON.stringify(fin)}) per-level s=${JSON.stringify(per)} total=${((Date.now() - t0) / 1000).toFixed(0)}s`);
check(errors.length === 0, 'no console errors ' + errors.slice(0, 3).join('|'));
await browser.close(); process.exit(ok ? 0 : 1);
