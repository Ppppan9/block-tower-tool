import { launch, stageShot, root } from './lib.mjs';
const { browser, page, errors } = await launch({ wait: 2500 });
await stageShot(page, root + '/shots/smoke1.png');
console.log(await page.evaluate(() => ({ n: __app.G.n, blocks: __app.LV.blocks.length, crates: __app.LV.crates.length })));
console.log('errors', errors);
await browser.close();
