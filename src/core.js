// 积木塔 · 核心逻辑（纯 JS，无 DOM / three.js，可在 node 里直接测试）
// 关卡数据、积木塔布局、静力稳定性判定（决定是否倒塌，保证确定性）、木箱队列 / 托盘规则、求解器
export const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// 颜色 → 符号（参考视频：红圆点 / 黄圆环 / 蓝菱形 / 绿方块 / 橙十字 / 紫星）
export const PALETTE = {
  red: { name: '红', sym: 'dot', main: '#ef4a55', light: '#ff7782', dark: '#b8333d', sc: '#7d1d2a' },
  yellow: { name: '黄', sym: 'ring', main: '#f3dc4a', light: '#fff176', dark: '#cdb432', sc: '#8a6a12' },
  blue: { name: '蓝', sym: 'diamond', main: '#4a8fe2', light: '#79b3f5', dark: '#2f6bc0', sc: '#173d78' },
  green: { name: '绿', sym: 'square', main: '#5fd45a', light: '#8cf07f', dark: '#3ba63a', sc: '#1d6b25' },
  orange: { name: '橙', sym: 'plus', main: '#f59a3a', light: '#ffbe6a', dark: '#d1721e', sc: '#8d4710' },
  purple: { name: '紫', sym: 'star', main: '#7c4fd6', light: '#a37af0', dark: '#5632a8', sc: '#2f1773' },
};
export const COLOR_KEYS = Object.keys(PALETTE);

// 五个关卡（参考视频）：层数 / 每层块数 / 木箱队列（颜色顺序）/ 提示语
// style: jenga = 每层 N 块并排、奇偶层垂直；twist = 每层再扭转一个角度（第 4 关十字交错）
export const LEVELS = [
  { id: 1, layers: 4, per: 3, style: 'jenga', crates: ['red', 'yellow', 'blue', 'red', 'red', 'yellow', 'blue', 'red'].slice(0, 4), counts: { red: 6, yellow: 3, blue: 3 }, hint: 'Pull a plank into its crate!', undoUnlock: false },
  { id: 2, layers: 6, per: 3, style: 'jenga', crates: ['blue', 'green', 'green', 'blue', 'red', 'red'], hint: 'Some planks hold the tower: pull with care!' },
  { id: 3, layers: 10, per: 3, style: 'jenga', crates: ['orange', 'orange', 'orange', 'orange', 'green', 'green', 'orange', 'green', 'green', 'green'], hint: 'This plank holds the tower!' },
  { id: 4, layers: 8, per: 3, style: 'twist', crates: ['green', 'green', 'green', 'purple', 'red', 'purple', 'red', 'purple'], hint: "Mixed floors: keep the tower's center supported!" },
  { id: 5, layers: 13, per: 3, style: 'jenga', crates: ['green', 'green', 'orange', 'orange', 'blue', 'green', 'orange', 'blue', 'green', 'orange', 'blue', 'blue', 'orange'], hint: 'Spread two fingers to zoom in' },
];
LEVELS[0].crates = ['red', 'yellow', 'blue', 'red'];
// 参考视频逐层读色（自下而上；偶数层沿 z 排列、奇数层沿 x 排列）
LEVELS[0].layout = [['red', 'yellow', 'red'], ['blue', 'red', 'red'], ['red', 'yellow', 'blue'], ['red', 'blue', 'yellow']];
LEVELS[1].layout = [['blue', 'green', 'blue'], ['blue', 'green', 'blue'], ['red', 'red', 'green'], ['green', 'red', 'green'], ['red', 'red', 'blue'], ['blue', 'red', 'green']];

export const DIM = { len: 3.0, wid: 0.98, hgt: 0.62, pitch: 1.0, stumpR: 2.35 };

// ---------- 几何 ----------
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
export function rectPoly(b) {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw), hl = b.len / 2, hw = b.wid / 2;
  // 长度方向 = (cos, -sin)（与 three.js 绕 Y 轴旋转 yaw 后的局部 +x 一致）
  const ux = c, uz = -s, vx = s, vz = c;
  return [[b.x - ux * hl - vx * hw, b.z - uz * hl - vz * hw], [b.x + ux * hl - vx * hw, b.z + uz * hl - vz * hw], [b.x + ux * hl + vx * hw, b.z + uz * hl + vz * hw], [b.x - ux * hl + vx * hw, b.z - uz * hl + vz * hw]];
}
function clip(subject, clipper) {
  let out = subject;
  for (let i = 0; i < clipper.length; i++) {
    const A = clipper[i], B = clipper[(i + 1) % clipper.length], inp = out; out = [];
    if (!inp.length) break;
    const inside = p => cross(A, B, p) >= -1e-9;
    for (let j = 0; j < inp.length; j++) {
      const P = inp[j], Q = inp[(j + 1) % inp.length], pin = inside(P), qin = inside(Q);
      if (pin !== qin) {
        const d1 = cross(A, B, P), d2 = cross(A, B, Q), t = d1 / (d1 - d2);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
      if (qin) out.push(Q);
    }
  }
  return out;
}
const polyArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
export function hull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P.length < 3) return P;
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
  lo.pop(); up.pop(); return lo.concat(up);
}
// 点到凸包的“内部余量”：>0 在内部（到最近边的距离），<=0 在外部或边上
function insideMargin(h, p) {
  if (h.length < 3) return -1;
  let m = 1e9;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    m = Math.min(m, cross(a, b, p) / L);
  }
  return m;
}

// ---------- 布局 ----------
// 返回无颜色的积木位姿列表：{layer, x, z, yaw, len, wid, hgt, y}
export function layoutShapes(def) {
  const out = [], D = DIM, per = def.per, hg = D.hgt, wid = per === 3 ? D.wid : (3 * D.pitch) / per - 0.02;
  for (let L = 0; L < def.layers; L++) {
    const odd = L % 2 === 1;
    const twist = def.style === 'twist' ? [0, 0.1, -0.06, 0.2, -0.1, 0.16, -0.22, 0.08][L % 8] : 0;
    for (let i = 0; i < per; i++) {
      const off = (i - (per - 1) / 2) * (per === 3 ? D.pitch : wid + 0.02);
      // 未旋转时：偶数层长边沿 x、块沿 z 排列；奇数层相反
      let x = odd ? off : 0, z = odd ? 0 : off;
      const yaw0 = odd ? Math.PI / 2 : 0, yaw = yaw0 + twist;
      if (twist) { const c = Math.cos(twist), s = Math.sin(twist); const nx = x * c + z * s, nz = -x * s + z * c; x = nx; z = nz; }
      out.push({ layer: L, x, z, yaw, len: D.len, wid, hgt: hg, y: L * hg + hg / 2 });
    }
  }
  return out;
}

// ---------- 稳定性（静力） ----------
export const STAB = { margin: 0.035 };
function comOf(bs) { let m = 0, x = 0, z = 0; for (const b of bs) { const w = b.len * b.wid * b.hgt; m += w; x += w * b.x; z += w * b.z; } return m ? [x / m, z / m] : [0, 0]; }
// blocks: 全部积木数组；present: 布尔数组（是否仍在塔上）。返回 {ok, why}
export function stability(blocks, present, margin = STAB.margin) {
  const byLayer = new Map(); let maxL = -1;
  for (const b of blocks) if (present[b.id]) { if (!byLayer.has(b.layer)) byLayer.set(b.layer, []); byLayer.get(b.layer).push(b); if (b.layer > maxL) maxL = b.layer; }
  if (maxL < 0) return { ok: true };
  const layers = []; for (let k = 0; k <= maxL; k++) layers.push(byLayer.get(k) || []);
  const polys = new Map(); const P = b => { let p = polys.get(b.id); if (!p) polys.set(b.id, p = rectPoly(b)); return p; };
  // 第 0 层之上不允许有空层
  for (let k = 0; k <= maxL; k++) if (!layers[k].length) return { ok: false, why: 'gap', layer: k };
  const R = DIM.stumpR;
  for (const b of layers[0]) for (const q of P(b)) if (Math.hypot(q[0], q[1]) > R + 0.6) return { ok: false, why: 'off-stump', block: b.id };
  for (let k = 0; k < maxL; k++) {
    const above = []; for (let j = k + 1; j <= maxL; j++) above.push(...layers[j]);
    const pts = [];
    for (const b of layers[k + 1]) {
      const bp = []; 
      for (const c of layers[k]) { const it = clip(P(b), P(c)); if (it.length >= 3 && polyArea(it) > 1e-3) bp.push(...it); }
      if (!bp.length) return { ok: false, why: 'unsupported', block: b.id, layer: k + 1 };
      pts.push(...bp);
      // 顶部无负载的单块：自身重心必须在自己的接触区内
      const loaded = layers[k + 2] && layers[k + 2].some(u => { const it = clip(P(u), P(b)); return it.length >= 3 && polyArea(it) > 1e-3; });
      if (!loaded) { const h = hull(bp); if (insideMargin(h, [b.x, b.z]) < margin * 0.6) return { ok: false, why: 'tip', block: b.id, layer: k + 1 }; }
    }
    const h = hull(pts), c = comOf(above);
    if (insideMargin(h, c) < margin) return { ok: false, why: 'com', layer: k + 1, margin: insideMargin(h, c) };
  }
  return { ok: true };
}
// 哪些积木拔出会导致倒塌（承重块）
export function criticalSet(blocks, present, margin) {
  const crit = new Set();
  for (const b of blocks) if (present[b.id]) { present[b.id] = false; if (!stability(blocks, present, margin).ok) crit.add(b.id); present[b.id] = true; }
  return crit;
}

// ---------- 关卡生成 ----------
// 从关卡定义 + 种子生成带颜色的积木列表（保证有解：求解器验证，不行就换排布）
export function buildLevel(def, seed = 1, opt = {}) {
  const cap = opt.crateCap || 3, trayCap = opt.trayCap || 5, vis = opt.visible || 4;
  let shapes = layoutShapes(def);
  // 木箱队列
  let crates = def.crates.slice();
  const total = crates.length * cap;
  if (shapes.length > total) shapes = shapes.slice(0, total); // 去掉最上层多余块
  if (shapes.length < total) { const need = Math.ceil(shapes.length / cap); crates = crates.slice(0, need); shapes = shapes.slice(0, crates.length * cap); }
  const colorList = []; for (const c of crates) for (let i = 0; i < cap; i++) colorList.push(c);
  for (let attempt = 0; attempt < 400; attempt++) {
    const rnd = mulberry((seed * 7919 + attempt * 104729) >>> 0);
    const cols = colorList.slice();
    const fixed = def.layout && def.layout.flat().length === shapes.length ? def.layout.flat() : null;
    if (fixed) { cols.length = 0; cols.push(...fixed); } else for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
    const blocks = shapes.map((s, i) => ({ ...s, id: i, color: cols[i], sym: PALETTE[cols[i]].sym }));
    const lv = { def, seed, attempt, blocks, crates: crates.map(c => ({ color: c, sym: PALETTE[c].sym })), opt: { cap, trayCap, vis } };
    if (!blocks.every(b => b.layer === 0 || true)) continue;
    if (!stability(blocks, blocks.map(() => true)).ok) continue; // 初始塔必须稳
    const sol = solve(lv, opt.solveNodes || 40000);
    if (sol) { lv.solution = sol; return lv; }
  }
  throw new Error('无法生成可解关卡');
}

// ---------- 对局状态 / 规则 ----------
export function newState(lv) {
  return { present: lv.blocks.map(() => true), crateQ: lv.crates.map((c, i) => ({ ...c, cid: i, n: 0, items: [] })), tray: Array(lv.opt.trayCap).fill(-1), cleared: 0, moves: 0, over: null, crateSlots: [] };
}
export const cloneState = s => ({ present: s.present.slice(), crateQ: s.crateQ.map(c => ({ ...c, items: c.items ? c.items.slice() : [] })), tray: s.tray.slice(), cleared: s.cleared, moves: s.moves, over: s.over });
export function visibleCrates(lv, st) { return st.crateQ.slice(0, lv.opt.vis); }
// 找可接收该块的可见木箱（队列最靠前、颜色相同、未满）
export function matchCrate(lv, st, b) {
  const v = visibleCrates(lv, st);
  for (let i = 0; i < v.length; i++) if (v[i].color === b.color && (v[i].items ? v[i].items.length : v[i].n) < lv.opt.cap) return i;
  return -1;
}
// 执行一次“拔出”：返回事件列表。不检查稳定性——由调用方先判定（见 pullOutcome）
export function pullOutcome(lv, st, id, margin) {
  const pres = st.present.slice(); pres[id] = false;
  return stability(lv.blocks, pres, margin);
}
// 应用拔出后的规则（假定不倒塌）。事件：{t:'crate',b,ci,slot}|{t:'tray',b,slot}|{t:'full',ci}|{t:'shift'}|{t:'t2c',b,from,ci,slot}|{t:'win'}|{t:'trayfull'}
export function applyPull(lv, st, id) {
  const ev = [], b = lv.blocks[id], cap = lv.opt.cap;
  st.present[id] = false; st.moves++;
  for (const c of st.crateQ) if (!c.items) c.items = [];
  const place = (blockId, from) => {
    const bb = lv.blocks[blockId], ci = matchCrate(lv, st, bb);
    if (ci < 0) return false;
    const c = st.crateQ[ci]; const slot = c.items.length; c.items.push(blockId); st.cleared++;
    ev.push(from < 0 ? { t: 'crate', b: blockId, ci, cid: c.cid, slot } : { t: 't2c', b: blockId, from, ci, cid: c.cid, slot });
    return true;
  };
  const completeCrates = () => {
    let any = false;
    for (;;) {
      const v = visibleCrates(lv, st); const i = v.findIndex(c => c.items.length >= cap); if (i < 0) break;
      ev.push({ t: 'full', ci: i, cid: v[i].cid, color: v[i].color, items: v[i].items.slice() }); st.crateQ.splice(i, 1); ev.push({ t: 'shift', from: i }); any = true;
      // 托盘里的块飞入新的可见木箱
      for (let s = 0; s < st.tray.length; s++) { const tb = st.tray[s]; if (tb >= 0 && matchCrate(lv, st, lv.blocks[tb]) >= 0) { st.tray[s] = -1; place(tb, s); } }
    }
    return any;
  };
  if (!place(id, -1)) {
    const slot = st.tray.indexOf(-1);
    if (slot < 0) { st.over = 'trayfull'; ev.push({ t: 'trayfull' }); return ev; }
    st.tray[slot] = id; ev.push({ t: 'tray', b: id, slot });
  }
  completeCrates();
  // 托盘已满且无可入箱 → 失败
  if (!st.crateQ.length && st.cleared >= lv.blocks.length) { st.over = 'win'; ev.push({ t: 'win' }); }
  else if (st.tray.every(x => x >= 0) && !st.tray.some(tb => matchCrate(lv, st, lv.blocks[tb]) >= 0)) { st.over = 'trayfull'; ev.push({ t: 'trayfull' }); }
  return ev;
}
export const remainingBlocks = (lv, st) => lv.blocks.filter(b => st.present[b.id]);

// ---------- 求解器 ----------
export function solve(lv, maxNodes = 40000, from = null, order = 'safe', seed = 1) {
  const st0 = from ? cloneState(from) : newState(lv); st0.crateQ.forEach(c => { if (!c.items) c.items = []; });
  const rnd = mulberry(seed * 13 + 5);
  let nodes = 0; const seen = new Set();
  const key = st => st.present.map(x => x ? 1 : 0).join('') + '|' + st.tray.slice().sort().join(',') + '|' + st.crateQ.slice(0, lv.opt.vis).map(c => c.items.length).join('') + st.crateQ.length;
  function moves(st) {
    const out = [];
    for (const b of lv.blocks) {
      if (!st.present[b.id]) continue;
      if (!pullOutcome(lv, st, b.id).ok) continue;
      const ci = matchCrate(lv, st, b);
      const comp = ci >= 0 && st.crateQ[ci].items.length === lv.opt.cap - 1 ? 1 : 0;
      // 到托盘的块：优先颜色在后续队列里出现得早的
      let nextIdx = 99; if (ci < 0) { nextIdx = st.crateQ.findIndex(c => c.color === b.color); if (nextIdx < 0) nextIdx = 99; }
      let sc = ci >= 0 ? 100 + comp * 50 : 50 - nextIdx * 3 - (st.tray.filter(x => x < 0).length <= 1 ? 40 : 0);
      if (order === 'top') sc += b.layer * 0.5; else if (order === 'random') sc += rnd() * 8; else sc += b.layer * 0.01;
      out.push({ id: b.id, score: sc });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  const path = [];
  function dfs(st) {
    if (st.over === 'win') return true;
    if (st.over) return false;
    if (++nodes > maxNodes) return false;
    const k = key(st); if (seen.has(k)) return false; seen.add(k);
    for (const m of moves(st)) {
      const s2 = cloneState(st); applyPull(lv, s2, m.id); path.push(m.id);
      if (dfs(s2)) return true; path.pop();
      if (nodes > maxNodes) return false;
    }
    return false;
  }
  return dfs(st0) ? path.slice() : null;
}

// ---------- 设置 → 关卡 ----------
export function levelDef(S, n) {
  if (!S.customLevel) { const d = LEVELS[(n - 1) % LEVELS.length]; return { ...d, id: n }; }
  const cols = String(S.customColors || 'red,yellow,blue').split(',').map(x => x.trim()).filter(x => PALETTE[x]); if (!cols.length) cols.push('red', 'blue');
  const cap = S.crateCap || 3, per = S.customPer || 3, layers = S.customLayers || 8;
  let total = Math.floor(layers * per / cap), crates = String(S.customCrates || '').split(',').map(x => x.trim()).filter(x => PALETTE[x]);
  if (!crates.length) { crates = []; for (let i = 0; i < total; i++) crates.push(cols[i % cols.length]); }
  return { id: n, layers, per, style: S.customStyle || 'jenga', crates, hint: '' };
}
export function makeLevel(S, n) {
  const def = levelDef(S, n);
  const ks = String(S.blockScales || '').split(',').map(x => parseFloat(x)), k = (isFinite(ks[n - 1]) && ks[n - 1] > 0 ? ks[n - 1] : (S.blockScaleDefault || 1));
  DIM.len = S.blockLen * k; DIM.wid = S.blockWid * k; const hs = String(S.hgtScales || '').split(',').map(x => parseFloat(x)), hk = isFinite(hs[n - 1]) && hs[n - 1] > 0 ? hs[n - 1] : 1; DIM.hgt = S.blockHgt * k * hk; DIM.stumpR = S.stumpR; DIM.pitch = DIM.wid + 0.02 * k;
  return buildLevel(def, (S.seed || 1) + n * 17, { crateCap: S.crateCap, trayCap: S.trayCap, visible: S.visibleCrates });
}
