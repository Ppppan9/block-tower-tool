// 规则测试（Playwright，通过 window.__app 驱动）
import { launch, root } from './lib.mjs';
const { browser, page, errors } = await launch({ wait: 800, url: process.env.URL });
let pass = 0, fail = 0; const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); c ? pass++ : fail++; };
const idle = () => page.waitForFunction(() => __app.idle(), null, { timeout: 15000, polling: 50 });
const newGame = async n => { await page.evaluate(n => { __app.AUTO.running && __app.stopAuto(true); __app.newGame(true, n); }, n); await page.waitForTimeout(150); };
const plan = () => page.evaluate(() => __app.core.solve(__app.LV, 60000, __app.ST, 'safe', __app.ST.moves + 1));
const tap = async id => { const r = await page.evaluate(id => __app.tapBlock(id), id); return r; };
await page.evaluate(() => { __app.setSetting('introMs', 100); });

// 1. 点击 → 直接进匹配的可见木箱（L1：红/黄/蓝/红 都可见）
await newGame(1);
let p = await plan(); await tap(p[0]); await idle();
let r = await page.evaluate(() => ({ tray: __app.ST.tray.filter(x => x >= 0).length, filled: [...__app.G.view.crates.values()].reduce((s, v) => s + v.items.filter(x => x != null).length, 0), crateFill: __app.ST.crateQ.reduce((s, c) => s + (c.items || []).length, 0) }));
check(r.tray === 0 && r.filled === 1, `L1 点击直接进木箱（托盘空，木箱视图 ${r.filled} 个）`);

// 2. 无匹配木箱 → 进托盘最左空格（L3 前 4 个木箱都是橙色，绿色块进托盘）
await newGame(3);
let info = await page.evaluate(() => { const A = __app, out = []; for (const b of A.LV.blocks) if (A.ST.present[b.id] && b.color === 'green' && A.core.pullOutcome(A.LV, A.ST, b.id, A.S.stabMargin).ok) out.push(b.id); return { ids: out, vis: A.core.matchCrate ? 1 : 0 }; });
check(info.ids.length >= 2, `L3 找到 ≥2 个可安全抽出的绿色块 (${info.ids.length})`);
await tap(info.ids[0]); await idle();
r = await page.evaluate(id => ({ tray: __app.ST.tray.slice(), view: __app.G.view.tray.slice(), id }), info.ids[0]);
check(r.tray[0] === info.ids[0] && r.view[0] === info.ids[0] && r.tray.slice(1).every(x => x < 0), `无匹配木箱 → 托盘最左格 (${r.tray})`);
await tap(info.ids[1]); await idle();
r = await page.evaluate(() => __app.ST.tray.slice());
check(r[1] >= 0 && r[0] >= 0, `第二块 → 托盘第 2 格 (${r})`);

// 3. 木箱装满：弹出 + 队列左滑 + 右侧补入新木箱（L1 按解法一直点到第一个木箱装满）
await newGame(2);
let before = await page.evaluate(() => ({ vq: __app.G.view.vq.slice(), full: __app.G.fullCount || 0 }));
let guard = 0;
while (guard++ < 18) { p = await plan(); await tap(p[0]); await idle(); const f = await page.evaluate(() => __app.G.fullCount || 0); if (f >= 1) break; }
await page.waitForTimeout(900);
let after = await page.evaluate(() => ({ vq: __app.G.view.vq.slice(), full: __app.G.fullCount || 0, leaving: [...__app.G.view.crates.values()].filter(v => v.leaving).length, qlen: __app.ST.crateQ.length }));
check(after.full >= 1 && after.vq.length === before.vq.length && Math.max(...after.vq) > Math.max(...before.vq) && before.vq.some(c => !after.vq.includes(c)), `木箱装满 → 满箱离队、队列左移、右侧补入新木箱 (${before.vq} → ${after.vq}，fullCount=${after.full})`);

// 4. 托盘满且无匹配 → 失败（trayCap=1 的 L3）
await page.evaluate(() => { __app.setSetting('trayCap', 1); });
await page.waitForTimeout(500); await newGame(3);
info = await page.evaluate(() => { const A = __app, out = []; for (const b of A.LV.blocks) if (A.ST.present[b.id] && b.color === 'green' && A.core.pullOutcome(A.LV, A.ST, b.id, A.S.stabMargin).ok) out.push(b.id); return out; });
const info2 = await page.evaluate(() => { const A = __app; return { cap: A.S.trayCap, vis: A.ST.crateQ.slice(0, A.S.visibleCrates).map(c => c.color) }; });
if (info.length >= 2) { await tap(info[0]); await idle(); await tap(info[1]); await page.waitForTimeout(1500); }
r = await page.evaluate(() => ({ over: __app.G.over, panel: __app.G.panel }));
check(r.over === 'trayfull' && r.panel === 'tray', `托盘满且无匹配 → 失败面板 (${JSON.stringify(r)} cap=${info2.cap} crates=${info2.vis})`);
await page.evaluate(() => { __app.doUndo(); }); await page.waitForTimeout(600);
r = await page.evaluate(() => ({ over: __app.G.over, panel: __app.G.panel, tray: __app.ST.tray.filter(x => x >= 0).length }));
check(!r.over && !r.panel && r.tray === 1, `撤销回到失败前 (${JSON.stringify(r)})`);
await page.evaluate(() => { __app.setSetting('trayCap', 5); }); await page.waitForTimeout(500);

// 5. 抽承重块 → 塔倒 → Tower Fell → 撤销回放
await newGame(2);
const crit = await page.evaluate(() => [...__app.critNow()].filter(x => __app.ST.present[x]));
check(crit.length > 0, `L2 存在承重块 (${crit.length})`);
const presentBefore = await page.evaluate(() => __app.ST.present.filter(Boolean).length);
await page.evaluate(() => { __app.setSetting('warnMode', 'pull'); });
const tr = await tap(crit[0]);
await page.waitForFunction(() => __app.G.panel === 'fail', null, { timeout: 12000 }).catch(async () => console.log('DEBUG', tr, JSON.stringify(await page.evaluate(() => ({ over: __app.G.over, panel: __app.G.panel, n: __app.G.n, gen: __app.G.gen, st: __app.ST.over, tray: __app.S.trayCap, mode: __app.S.warnMode, tw: __app.tweenCount, pulling: __app.pulling, col: !!__app.SC.collapse }))), errors));
r = await page.evaluate(() => { const A = __app; let moved = 0; for (const b of A.LV.blocks) { if (!A.ST.present[b.id]) continue; const m = A.SC.meshes[b.id]; if (Math.hypot(m.position.x - b.x, m.position.y - b.y, m.position.z - b.z) > 0.5) moved++; } return { over: A.G.over, moved, panel: A.G.panel }; });
check(r.over === 'fell' && r.moved >= 1, `塔倒塌：${r.moved} 块明显位移，失败面板已弹出`);
await page.evaluate(() => { __app.doUndo(); });
await page.waitForFunction(() => !__app.G.rewinding && !__app.G.panel, null, { timeout: 8000 }); await page.waitForTimeout(200);
r = await page.evaluate(() => { const A = __app; let maxErr = 0; for (const b of A.LV.blocks) { if (!A.ST.present[b.id]) continue; const m = A.SC.meshes[b.id]; maxErr = Math.max(maxErr, Math.hypot(m.position.x - b.x, m.position.y - b.y, m.position.z - b.z)); } return { over: A.G.over, present: A.ST.present.filter(Boolean).length, maxErr, vis: A.LV.blocks.every(b => A.SC.meshes[b.id].visible === !!A.ST.present[b.id]) }; });
check(!r.over && r.present === presentBefore && r.maxErr < 0.02 && r.vis, `撤销：塔回放复原（块数 ${r.present}，最大位移误差 ${r.maxErr.toFixed(4)}）`);

// 6. 各关按求解器逐块抽取直到通关
for (let n = 1; n <= 5; n++) {
  await newGame(n);
  const tot = await page.evaluate(() => __app.LV.blocks.length); let k = 0, ok = true;
  while (k++ < 60) { const done = await page.evaluate(() => __app.ST.present.every(x => !x)); if (done) break; p = await plan(); if (!p || !p.length) { ok = false; break; } const t = await tap(p[0]); if (!t) { await page.waitForTimeout(100); } await idle(); }
  await page.waitForFunction(() => __app.G.cleared, null, { timeout: 8000 }).catch(() => { });
  r = await page.evaluate(() => ({ cleared: __app.G.cleared, tray: __app.ST.tray.filter(x => x >= 0).length, crateLeft: __app.ST.crateQ.length }));
  check(ok && r.cleared && r.tray === 0 && r.crateLeft === 0, `L${n} (${tot} 块) 逐块通关 → 胜利，托盘空，木箱全满 ${JSON.stringify(r)}`);
}
check(errors.length === 0, 'no console errors ' + errors.slice(0, 3).join('|'));
console.log(`rules: ${pass} passed, ${fail} failed`);
await browser.close(); process.exit(fail ? 1 : 0);
