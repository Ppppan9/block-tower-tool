// 生成参考视频 vs 我们的并排对照图 → /workspace/out/blocks-compare-*.png
import { launch, root } from './lib.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
const REF = process.env.REF || '/workspace/blocks/ref.mp4', OUT = process.env.OUT || '/workspace/out';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync('/tmp/cmp', { recursive: true });
const refFrame = (t, name) => { const f = `/tmp/cmp/${name}.png`; execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', REF, '-frames:v', '1', f]); return f; };
const { browser, page, errors } = await launch({ wait: 800, viewport: { width: 900, height: 1000 } });
const idle = () => page.waitForFunction(() => __app.idle(), null, { timeout: 15000, polling: 40 });
const newGame = async (n, wait = 1500) => { await page.evaluate(n => { __app.AUTO.running && __app.stopAuto(true); __app.newGame(true, n); }, n); await page.waitForTimeout(wait); };
const plan = () => page.evaluate(() => __app.core.solve(__app.LV, 60000, __app.ST, 'safe', __app.ST.moves + 1));
const ours = async name => { const f = `/tmp/cmp/${name}_o.png`; await page.locator('#stage').screenshot({ path: f }); return f; };
const pairs = [];
async function pair(name, refT, oursFile, label) {
  const rf = refFrame(refT, name + '_r');
  const py = `
from PIL import Image, ImageDraw
a=Image.open('${rf}').convert('RGB'); b=Image.open('${oursFile}').convert('RGB')
h=1000; a=a.resize((int(a.width*h/a.height),h)); b=b.resize((int(b.width*h/b.height),h))
im=Image.new('RGB',(a.width+b.width+10,h+26),(30,30,30)); im.paste(a,(0,26)); im.paste(b,(a.width+10,26))
d=ImageDraw.Draw(im); d.text((6,6),'REF ${refT}s  ${label}',fill=(255,255,0)); d.text((a.width+16,6),'OURS',fill=(120,255,120))
im.save('${OUT}/blocks-compare-${name}.png')`;
  execFileSync('python3', ['-c', py]); pairs.push(`${OUT}/blocks-compare-${name}.png`);
}
await page.evaluate(() => { __app.setSetting('introMs', 100); });
// 各关开局
const refStart = { 1: 6, 2: 34, 3: 66, 4: 126, 5: 166 };
for (let n = 1; n <= 5; n++) { await newGame(n); await pair('L' + n, refStart[n], await ours('L' + n), `Level ${n} start`); }
// 抽出飞行（取飞行中一帧）
await newGame(1, 800);
let p = await plan(); await page.evaluate(id => __app.tapBlock(id), p[0]);
for (let i = 0; i < 60; i++) { const f = await page.evaluate(() => __app.G.flights.length); if (f) break; await page.waitForTimeout(15); }
await pair('pull-fly', 8, await ours('fly'), 'block flying to crate');
await idle();
// 木箱装满 Crate Full!
await newGame(1, 600);
for (let g = 0; g < 12; g++) { p = await plan(); await page.evaluate(id => __app.tapBlock(id), p[0]); await idle(); const f = await page.evaluate(() => (__app.G.floaters || []).some(x => /Full/.test(x.text || '')) || (__app.G.fullCount || 0) > 0); if (f) break; }
await page.waitForTimeout(200);
await pair('crate-full', 52, await ours('full'), 'Crate Full!');
// 托盘有块（L3，绿块进托盘）
await newGame(3, 600);
const greens = await page.evaluate(() => { const A = __app, o = []; for (const b of A.LV.blocks) if (A.ST.present[b.id] && b.color === 'green' && A.core.pullOutcome(A.LV, A.ST, b.id, A.S.stabMargin).ok) o.push(b.id); return o; });
for (const id of greens.slice(0, 2)) { await page.evaluate(id => __app.tapBlock(id), id); await idle(); }
await page.waitForTimeout(300);
await pair('tray', 76, await ours('tray'), 'blocks waiting on tray + tooltip');
// 倒塌
await newGame(2, 600);
const crit = await page.evaluate(() => [...__app.critNow()].filter(x => __app.ST.present[x]));
await page.evaluate(id => __app.tapBlock(id), crit[0]); await page.waitForTimeout(1100);
await pair('tower-fell', 41, await ours('fell'), 'tower collapsing');
await page.waitForFunction(() => __app.G.panel === 'fail', null, { timeout: 12000 }); await page.waitForTimeout(500);
await pair('fell-panel', 56, await ours('fellp'), 'Tower Fell panel');
// 通关面板
await newGame(1, 400);
for (let g = 0; g < 14; g++) { p = await plan(); if (!p.length) break; await page.evaluate(id => __app.tapBlock(id), p[0]); await idle(); }
await page.waitForFunction(() => __app.G.panel === 'win', null, { timeout: 8000 }); await page.waitForTimeout(500);
await pair('win-panel', 28, await ours('win'), 'Level Complete panel');
console.log(pairs.join('\n')); console.log('errors', errors);
await browser.close();
