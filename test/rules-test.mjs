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
if (info.length >= 1) { await tap(info[0]); await page.waitForFunction(() => __app.G.panel === "tray", null, { timeout: 8000 }).catch(() => {}); }
r = await page.evaluate(() => ({ over: __app.G.over, panel: __app.G.panel }));
check(r.over === 'trayfull' && r.panel === 'tray', `托盘满且无匹配 → 失败面板 (${JSON.stringify(r)} cap=${info2.cap} crates=${info2.vis})`);
await page.evaluate(() => { __app.doUndo(); }); await page.waitForTimeout(600);
r = await page.evaluate(() => ({ over: __app.G.over, panel: __app.G.panel, tray: __app.ST.tray.filter(x => x >= 0).length }));
check(!r.over && !r.panel && r.tray === 0, `撤销回到失败前 (${JSON.stringify(r)})`);
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
// 7. 木箱补位：只在还需要时补；全部装满后不再补；任何时刻木箱需求 = 剩余块（按颜色）
await page.evaluate(() => { __app.resetSettings && 0; __app.setSetting('trayCap', 5); __app.setSetting('introMs', 100); });
for (let n = 1; n <= 5; n++) {
  await newGame(n); let bad = 0, k = 0, maxVis = 0;
  while (k++ < 60) {
    if (await page.evaluate(() => __app.ST.present.every(x => !x))) break;
    p = await plan(); await tap(p[0]); await idle();
    const r = await page.evaluate(() => { const A = __app, ST = A.ST, LV = A.LV, need = {}, rem = {};
      for (const c of ST.crateQ) need[c.color] = (need[c.color] || 0) + (LV.opt.cap - (c.items || []).length);
      for (const b of LV.blocks) if (ST.present[b.id] || ST.tray.includes(b.id)) rem[b.color] = (rem[b.color] || 0) + 1;
      const q = new Set(ST.crateQ.map(c => c.cid)), vis = A.G.view.vq.filter(c => !A.G.crateDone.has(c));
      return { eq: JSON.stringify(Object.entries(need).sort()) === JSON.stringify(Object.entries(rem).sort()), stale: vis.filter(c => !q.has(c)).length, n: vis.length, over: vis.length > Math.min(A.S.visibleCrates, ST.crateQ.length) }; });
    if (!r.eq || r.stale || r.over) bad++; maxVis = Math.max(maxVis, r.n);
  }
  await page.waitForTimeout(1200);
  const e = await page.evaluate(() => ({ vq: __app.G.view.vq.length, live: [...__app.G.view.crates.values()].filter(v => !v.leaving).length, q: __app.ST.crateQ.length, won: __app.G.cleared }));
  check(bad === 0 && e.vq === 0 && e.live === 0 && e.q === 0 && e.won, `L${n} 木箱补位：每步需求=剩余块、无多余/过期木箱（最多同屏 ${maxVis}）；清空后队列为空、不再补新箱 ${JSON.stringify(e)} bad=${bad}`);
}
// 8. 整塔倒塌 + 撤销精确还原（L3 / L5）
await page.evaluate(() => { __app.setSetting('trayCap', 5); __app.setSetting('collapseGraceMs', 6000); });
for (const n of [3, 5]) {
  await newGame(n);
  const getCrit = () => page.evaluate(() => { const A = __app, c = []; for (const b of A.LV.blocks) if (A.ST.present[b.id] && !A.core.pullOutcome(A.LV, A.ST, b.id, A.S.stabMargin).ok) c.push([b.id, b.y]); c.sort((a, b) => a[1] - b[1]); return c; });
  const want = n === 3 ? 8 : 10;
  for (let i = 0; i < 40; i++) { const st = await page.evaluate(() => __app.ST.cleared); const c = await getCrit(); if (st >= want && c.length) break; p = await plan(); await tap(p[0]); await idle(); }
  const crit = await getCrit(), pick = crit[0];
  const pre = await page.evaluate(() => ({ present: __app.ST.present.slice(), tray: __app.ST.tray.slice(), moves: __app.ST.moves }));
  const pickInfo = await page.evaluate(id => { const b = __app.LV.blocks[id]; return { y: b.y, wid: b.wid }; }, pick[0]);
  await tap(pick[0]);
  await page.waitForFunction(() => { const c = __app.SC.collapse; if (c && ((c.t > 2.6 && __app.SC.collapseSettled()) || c.t > 6)) { window.__ts = c.t; return true; } return false; }, null, { timeout: 60000, polling: 100 });
  const tSettle = await page.evaluate(() => window.__ts);
  const r = await page.evaluate(({ present, y0, w }) => { const A = __app; let tot = 0, moved = 0, bad = 0;
    for (const b of A.LV.blocks) { if (!present[b.id] || b.y < y0 - 0.01 || b.id === A.G.ghostId) continue; tot++; const m = A.SC.meshes[b.id]; const d = Math.hypot(m.position.x - b.x, m.position.y - b.y, m.position.z - b.z); if (!isFinite(d) || Math.abs(m.position.y) > 40) bad++; if (d > w) moved++; }
    return { tot, moved, bad, settled: A.SC.collapseSettled(), over: A.G.over, colK: A.G.colK }; }, { present: pre.present, y0: pickInfo.y - 0.9, w: pickInfo.wid });
  check(r.over === 'fell' && r.tot > 3 && r.moved / r.tot >= 0.5 && r.bad === 0 && r.settled && tSettle <= 6, `L${n} 拔承重块 → 整塔倒塌：${r.moved}/${r.tot} 块位移>1 块宽，在 ${tSettle.toFixed(1)}s(物理时间)内全部静止(≤6s)，无飞出 (${JSON.stringify(r)})`);
  check(r.colK < 0.95, `L${n} 倒塌时镜头拉远 (colK=${(+r.colK).toFixed(2)})`);
  await page.waitForFunction(() => __app.G.panel === 'fail', null, { timeout: 15000 });
  await page.evaluate(() => { __app.doUndo(); }); await page.waitForFunction(() => !__app.G.rewinding && !__app.SC.collapse, null, { timeout: 15000 }); await page.waitForTimeout(400);
  const u = await page.evaluate(({ present }) => { const A = __app; let worst = 0, vis = 0;
    for (const b of A.LV.blocks) { const m = A.SC.meshes[b.id]; if (!A.ST.present[b.id]) continue; const q = new A.THREE.Quaternion().setFromEuler(new A.THREE.Euler(0, b.yaw, 0)); const dq = 1 - Math.abs(q.dot(m.quaternion)); worst = Math.max(worst, Math.hypot(m.position.x - b.x, m.position.y - b.y, m.position.z - b.z), dq * 10); if (m.visible) vis++; }
    return { worst, vis, present: A.ST.present.filter(x => x).length, over: A.G.over, panel: A.G.panel }; }, { present: pre.present });
  check(u.worst < 1e-3 && u.vis === u.present && !u.over && !u.panel && u.present === pre.present.filter(x => x).length, `L${n} 撤销：所有方块位置/姿态精确还原（最大偏差 ${u.worst.toExponential(1)}），回到倒塌前 ${JSON.stringify(u)}`);
}

// 等待位：第 4 个可见木箱只是预览，永远不收积木（逻辑 + 画面），托盘里同色块要等它补进收集行才飞入
{ let shot = false;
  for (const n of [1, 2, 3, 5]) {
    await newGame(n); const pl = await plan(); let bad = 0, viewBad = 0, trayWait = 0, steps = 0;
    for (const id of pl) {
      if (await page.evaluate(() => !!__app.ST.over)) break;
      await tap(id); await idle(); steps++;
      const q = await page.evaluate(() => { const A = __app, w = A.ST.crateQ[3], vw = A.G.view.vq[3] != null ? A.G.view.crates.get(A.G.view.vq[3]) : null;
        return { act: A.core.activeCount(A.LV), w: w ? w.items.length : 0, vw: vw ? vw.items.filter(x => x != null).length : 0, trayWait: w ? A.ST.tray.filter(t => t >= 0 && A.LV.blocks[t].color === w.color).length : 0,
          inActive: w ? A.ST.crateQ.slice(0, 3).some(c => c.color === w.color && c.items.length < A.LV.opt.cap) : false }; });
      if (q.w) bad++; if (q.vw) viewBad++;
      if (q.trayWait && !q.inActive) { trayWait++; if (!shot && process.env.SHOT) { shot = true; await page.locator('#stage').screenshot({ path: process.env.SHOT }); } }
    }
    check(bad === 0 && viewBad === 0, `L${n} 等待位木箱全程 0 积木（逻辑 ${bad} / 画面 ${viewBad}，${steps} 步，托盘里等待同色块 ${trayWait} 步）`);
    check(await page.evaluate(() => __app.ST.over === 'win' || __app.G.cleared), `L${n} 按新规则仍可通关`);
  }
}
check(errors.length === 0, 'no console errors ' + errors.slice(0, 3).join('|'));
console.log(`rules: ${pass} passed, ${fail} failed`);
await browser.close(); process.exit(fail ? 1 : 0);
