// 核心逻辑测试（纯 Node）：生成 / 稳定性 / 求解器 / 规则
import { LEVELS, makeLevel, newState, cloneState, applyPull, pullOutcome, criticalSet, solve, visibleCrates, matchCrate, activeCrates, activeCount } from '../src/core.js';
import { DEFAULTS } from '../src/settings.js';
let pass = 0, fail = 0; const check = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else pass++; };
const t0 = Date.now();
// 等待位规则：只有前 activeCrates 个可见木箱收积木
{ const lv = { opt: { vis: 4, active: 3, cap: 3, trayCap: 5 }, blocks: [] }; const st = { crateQ: ['red', 'yellow', 'blue', 'green', 'green'].map((c, i) => ({ color: c, cid: i, items: [] })) };
  check(matchCrate(lv, st, { color: 'green' }) === -1, '绿色块不进第 4 格等待位（应进托盘）');
  check(matchCrate(lv, st, { color: 'blue' }) === 2, '蓝色块进第 3 格');
  check(activeCrates(lv, st).length === 3 && visibleCrates(lv, st).length === 4, '收集中 3 个 / 可见 4 个');
  st.crateQ.splice(0, 1); check(matchCrate(lv, st, { color: 'green' }) === 2, '前面木箱装满离开后，等待位补进收集行即可收积木'); }

const want = [[12, 4], [18, 6], [30, 10], [24, 8], [39, 13]];
for (let n = 1; n <= 5; n++) {
  const lv = makeLevel(DEFAULTS, n), st = newState(lv);
  check(lv.blocks.length === want[n - 1][0], `L${n} 块数 ${lv.blocks.length}`);
  check(lv.crates.length === want[n - 1][1], `L${n} 木箱数 ${lv.crates.length}`);
  check(visibleCrates(lv, st).length === DEFAULTS.visibleCrates, `L${n} 可见木箱 ${DEFAULTS.visibleCrates}`);
  const colorCount = {}; for (const b of lv.blocks) colorCount[b.color] = (colorCount[b.color] || 0) + 1;
  const crateCount = {}; for (const c of lv.crates) crateCount[c.color] = (crateCount[c.color] || 0) + lv.opt.cap;
  check(JSON.stringify(Object.entries(colorCount).sort()) === JSON.stringify(Object.entries(crateCount).sort()), `L${n} 块颜色数量 = 木箱容量 ${JSON.stringify(colorCount)}`);
  const plan = solve(lv, 100000, st, 'safe', 1);
  check(plan && plan.length === lv.blocks.length, `L${n} 求解器给出完整解 (${plan && plan.length})`);
  // 沿解法逐块执行：全部安全、最终清空、木箱全满、托盘空、每一步事件合法
  let s = cloneState(st), safe = true, win = false, trayMax = 0;
  for (const id of plan) { const o = pullOutcome(lv, s, id, DEFAULTS.stabMargin); if (!o.ok) safe = false; const ev = applyPull(lv, s, id); if (ev.some(e => e.t === 'win')) win = true; trayMax = Math.max(trayMax, s.tray.filter(x => x >= 0).length); }
  // 等待位（第 4 个可见木箱）永远不收积木：沿解法逐步检查
  { let s2 = cloneState(st), bad = 0; for (const id of plan) { applyPull(lv, s2, id); s2.crateQ.slice(activeCount(lv), lv.opt.vis).forEach(c => { if (c.items.length) bad++; }); }
    check(activeCount(lv) === 3 && lv.opt.vis === 4 && bad === 0, `L${n} 等待位木箱从未收到积木（收集中 ${activeCount(lv)} / 可见 ${lv.opt.vis}）`);
    const s3 = newState(lv), w = s3.crateQ[3]; check(!w || matchCrate(lv, s3, { color: w.color }) !== 3, `L${n} matchCrate 不会返回等待位`); }
  check(safe && win && s.tray.every(x => x < 0) && s.crateQ.length === 0, `L${n} 沿解法全程安全并胜利（托盘峰值 ${trayMax}/${DEFAULTS.trayCap}）`);
  // 承重块：被标记的块拔出后 pullOutcome.ok=false；非承重块 ok=true
  const crit = criticalSet(lv.blocks, st.present, DEFAULTS.stabMargin);
  let consistent = true; for (const b of lv.blocks) { const o = pullOutcome(lv, st, b.id, DEFAULTS.stabMargin); if (o.ok === crit.has(b.id)) consistent = false; }
  check(consistent, `L${n} criticalSet 与 pullOutcome 一致（承重块 ${crit.size}）`);
  // 起始状态至少有 1 个非承重块可拔
  check(lv.blocks.some(b => !crit.has(b.id)), `L${n} 起始至少有一个安全块`);
}
// 确定性 + 多种子都可解
for (let seed = 1; seed <= 30; seed++) for (let n = 1; n <= 5; n++) {
  const S = { ...DEFAULTS, seed }, a = makeLevel(S, n), b = makeLevel(S, n);
  check(JSON.stringify(a.blocks) === JSON.stringify(b.blocks) && JSON.stringify(a.crates) === JSON.stringify(b.crates), `确定性 seed${seed} L${n}`);
  const plan = solve(a, 60000, newState(a), 'safe', 1); check(plan && plan.length === a.blocks.length, `seed${seed} L${n} 可解`);
}
// 规则：直接入箱 / 入托盘 / 满箱 / 托盘满
{
  const lv = makeLevel(DEFAULTS, 3), st = newState(lv);
  const vis = visibleCrates(lv, st).map(c => c.color);
  const nonMatch = lv.blocks.find(b => !vis.includes(b.color) && pullOutcome(lv, st, b.id, DEFAULTS.stabMargin).ok);
  const ev = applyPull(lv, st, nonMatch.id); check(ev[0].t === 'tray' && ev[0].slot === 0, '无匹配木箱 → 托盘最左格');
  const m = lv.blocks.find(b => st.present[b.id] && vis.includes(b.color) && pullOutcome(lv, st, b.id, DEFAULTS.stabMargin).ok);
  const ev2 = applyPull(lv, st, m.id); check(ev2[0].t === 'crate', '有匹配木箱 → 直接入箱');
}
console.log(`logic: ${pass} passed, ${fail} failed, ${Date.now() - t0}ms`);
process.exit(fail ? 1 : 0);
