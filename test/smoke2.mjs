import { launch, stageShot, root } from './lib.mjs';
const { browser, page, errors } = await launch({ wait: 1500 });
await page.evaluate(() => { __app.setSetting('autoSpeed', 3); });
await page.click('#btnAuto');
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ n: __app.G.n, cleared: __app.ST.cleared, tot: __app.LV.blocks.length, panel: __app.G.panel, over: __app.G.over, tray: __app.ST.tray.join(',') , auto: __app.AUTO.running}));
  console.log(i, JSON.stringify(st));
  if (i % 3 == 2) await stageShot(page, root + `/shots/smoke2_${i}.png`);
  if (!st.auto) break;
}
console.log('errors', errors);
await browser.close();
