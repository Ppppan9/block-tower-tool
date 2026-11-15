// 积木塔 · 关卡搭建器（弹窗）：搭塔 / 木箱队列 / 参数 / 校验 / 试玩 / 保存 / 导入导出
import { createScene } from './scene3d.js';
import { PALETTE, COLOR_KEYS, CUSTOM, customBlocks, validateCustom, solveCustom, makeLevel } from './core.js';
import { FONT } from './fonts.js';

const LSK = 'blockTower.customLevels.v1';
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { const v = attrs[k]; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e[k] = v; else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
}
export function loadCustomList() { try { const a = JSON.parse(localStorage.getItem(LSK) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.layers && x.crates) : []; } catch (e) { return []; } }
export function saveCustomList() { try { localStorage.setItem(LSK, JSON.stringify(CUSTOM.list)); } catch (e) { } }
const colName = c => (PALETTE[c] || {}).name || c;
const colHex = c => (PALETTE[c] || { main: '#999' }).main;

export function newDef(name = '我的关卡') {
  const cols = ['red', 'yellow', 'blue'], layers = [];
  for (let i = 0; i < 4; i++) layers.push({ colors: [cols[(i * 2) % 3], cols[(i * 2 + 1) % 3], cols[(i * 2 + 2) % 3]], orient: 'auto', twist: 0 });
  const d = { v: 1, name, layers, crates: [], cap: 3, visible: 4, trayCap: 5, yaw: null, scale: 1, hgtScale: 1 };
  d.crates = balanceCrates(d); return d;
}
// 由积木颜色数量生成木箱队列（容量 cap；不足一箱的颜色向上补 → 提示不匹配）
export function balanceCrates(def, shuffle = false) {
  const cap = def.cap || 3, cnt = {}; for (const l of def.layers) for (const c of l.colors) cnt[c] = (cnt[c] || 0) + 1;
  let q = []; for (const c of COLOR_KEYS) { const n = Math.floor((cnt[c] || 0) / cap); for (let i = 0; i < n; i++) q.push(c); }
  if (shuffle) for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
  return q;
}

const CSS = `
#bt-modal{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;background:rgba(20,40,70,.62);backdrop-filter:blur(3px);font-family:${FONT};color:#4a2a10}
#bt-modal.open{display:flex}
#bt-modal *{box-sizing:border-box}
.bt-win{width:min(1180px,97vw);height:min(800px,95vh);display:flex;flex-direction:column;background:linear-gradient(#fff6dc,#ffe9b8);border:5px solid #8a5426;border-radius:22px;box-shadow:0 14px 0 #5d3615,0 24px 50px rgba(0,0,0,.45);overflow:hidden}
.bt-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(#5db8f2,#8fd3fa);border-bottom:5px solid #8a5426;flex-wrap:wrap}
.bt-title{font-size:22px;font-weight:800;color:#fff;text-shadow:0 2px 0 #2c6ea6,0 0 6px #2c6ea6;white-space:nowrap}
.bt-name{flex:1 1 140px;min-width:100px;font:inherit;font-size:16px;font-weight:700;padding:6px 10px;border-radius:12px;border:3px solid #8a5426;background:#fffaf0;color:#4a2a10}
.bt-btn{font:inherit;font-weight:800;font-size:14px;color:#fff;background:linear-gradient(#b98652,#8a5426);border:3px solid #5d3615;border-bottom-width:5px;border-radius:12px;padding:5px 11px;cursor:pointer;text-shadow:0 1px 0 rgba(0,0,0,.35);white-space:nowrap}
.bt-btn:hover{filter:brightness(1.1)}.bt-btn:active{transform:translateY(2px);border-bottom-width:3px}
.bt-btn.green{background:linear-gradient(#7ee063,#3fa83a);border-color:#256d24}
.bt-btn.blue{background:linear-gradient(#6db8ff,#3a7fd6);border-color:#245a9c}
.bt-btn.red{background:linear-gradient(#ff8080,#d63a3a);border-color:#8f2222}
.bt-btn.small{font-size:12px;padding:2px 7px;border-bottom-width:4px;border-radius:9px}
.bt-btn[disabled]{opacity:.45;pointer-events:none}
.bt-btn.sel{outline:4px solid #ffd02a;outline-offset:1px}
.bt-body{flex:1;min-height:0;display:flex;gap:12px;padding:12px}
.bt-left{flex:0 0 340px;display:flex;flex-direction:column;gap:8px;min-width:0}
.bt-view{position:relative;flex:1;min-height:200px;border-radius:16px;border:4px solid #8a5426;background:linear-gradient(#4fb7ef,#9dd7f6 60%,#e4f5fd);overflow:hidden;touch-action:none}
.bt-view canvas{width:100%;height:100%;display:block}
.bt-view .hint{position:absolute;left:8px;bottom:6px;font-size:11px;color:#2c6ea6;background:rgba(255,255,255,.75);padding:1px 8px;border-radius:9px}
.bt-right{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.bt-tabs{display:flex;gap:6px;flex-wrap:wrap}
.bt-tab{font:inherit;font-weight:800;font-size:15px;color:#7a4a1c;background:#f3d9a4;border:3px solid #8a5426;border-radius:14px 14px 4px 4px;padding:5px 14px;cursor:pointer}
.bt-tab.on{background:#fffaf0;color:#d2691e;box-shadow:0 3px 0 #fffaf0;transform:translateY(2px)}
.bt-pane{flex:1;min-height:0;overflow:auto;background:#fffaf0;border:4px solid #8a5426;border-radius:6px 16px 16px 16px;padding:10px}
.bt-sub{font-size:13px;font-weight:800;color:#9a5a20;margin:6px 0 4px}
.bt-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0}
.bt-pal{display:flex;gap:6px;flex-wrap:wrap}
.bt-sw{width:34px;height:34px;border-radius:11px;border:3px solid #4a2a10;cursor:pointer;box-shadow:inset 0 -5px 0 rgba(0,0,0,.18),0 2px 0 #4a2a10;padding:0}
.bt-sw.sel{outline:4px solid #ffd02a;outline-offset:2px;transform:scale(1.1)}
.bt-sw.mini{width:26px;height:26px;border-radius:8px;border-width:2px}
.bt-layer{display:flex;align-items:center;gap:8px;padding:5px 8px;margin:5px 0;border-radius:14px;background:#fff1cf;border:3px solid #d9b26a;flex-wrap:wrap}
.bt-layer.cur{border-color:#ff9a2a;background:#ffe6b0}
.bt-lno{font-weight:800;min-width:44px;color:#9a5a20}
.bt-planks{display:flex;gap:4px}
.bt-plank{width:46px;height:30px;border-radius:8px;border:3px solid #4a2a10;cursor:pointer;box-shadow:inset 0 -6px 0 rgba(0,0,0,.16);padding:0;position:relative}
.bt-plank:hover{filter:brightness(1.15)}
.bt-sel,.bt-num{font:inherit;font-size:13px;font-weight:700;border-radius:8px;border:2px solid #8a5426;background:#fff;color:#4a2a10;padding:2px 4px}
.bt-num{width:56px}
.bt-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:12px;font-size:13px;font-weight:800;border:2px solid}
.bt-chip.ok{background:#e0f8dc;color:#237a1f;border-color:#6fc766}.bt-chip.warn{background:#fff3cc;color:#8a6200;border-color:#e6b93a}.bt-chip.err{background:#ffe0e0;color:#a12020;border-color:#e07070}
.bt-val{background:#fff;border:3px dashed #d9b26a;border-radius:12px;padding:6px 10px;font-size:13px}
.bt-val div{margin:2px 0}
.bt-crate{position:relative;width:78px;border-radius:12px;border:3px solid #4a2a10;padding:5px 4px 6px;text-align:center;cursor:grab;color:#fff;font-weight:800;text-shadow:0 1px 0 rgba(0,0,0,.4);box-shadow:inset 0 -9px 0 rgba(0,0,0,.2),0 3px 0 #4a2a10;user-select:none}
.bt-crate.drag{opacity:.4}.bt-crate.over{outline:4px dashed #ffd02a}
.bt-crate .pips{display:flex;gap:3px;justify-content:center;margin:3px 0 2px}.bt-crate .pip{width:12px;height:16px;border-radius:4px;background:rgba(0,0,0,.35);border:2px solid rgba(0,0,0,.4)}
.bt-crate .x{position:absolute;top:-9px;right:-9px;width:22px;height:22px;border-radius:50%;background:#d63a3a;color:#fff;border:2px solid #4a2a10;font-size:13px;line-height:15px;cursor:pointer;padding:0}
.bt-crate .mv{display:flex;justify-content:space-between;margin-top:3px}.bt-crate .mv button{font-size:11px;padding:0 6px;border-radius:6px;border:2px solid #4a2a10;background:#fff3d6;color:#4a2a10;cursor:pointer;font-weight:800}
.bt-shelf{display:flex;gap:10px;flex-wrap:wrap;padding:10px;background:linear-gradient(#e9c88a,#d5a95e);border:3px solid #8a5426;border-radius:14px;min-height:72px;align-items:flex-start}
.bt-shelf.show{background:linear-gradient(#cfeaff,#a9d8fa)}
.bt-plus{display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:50%;background:#5a3a1e;color:#fff;font-weight:800;border:3px solid #2a170a;align-self:center}
.bt-cnt{width:100%;border-collapse:collapse;font-size:13px}.bt-cnt td,.bt-cnt th{padding:3px 6px;border-bottom:2px solid #f0dcae;text-align:center}
.bt-lib{display:flex;align-items:center;gap:8px;padding:6px 10px;margin:5px 0;background:#fff1cf;border:3px solid #d9b26a;border-radius:14px;flex-wrap:wrap}
.bt-lib b{flex:1 1 120px}
.bt-foot{display:flex;gap:8px;padding:8px 12px;background:#f3d9a4;border-top:4px solid #8a5426;align-items:center;flex-wrap:wrap}
.bt-foot .st{flex:1;min-width:140px;font-size:13px;font-weight:700;display:flex;gap:6px;flex-wrap:wrap}
.bt-ta{width:100%;height:90px;font:12px monospace;border:2px solid #8a5426;border-radius:8px;padding:4px}
.bt-toast{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:#4a2a10;color:#fff;padding:6px 16px;border-radius:16px;font-weight:800;opacity:0;transition:opacity .25s;pointer-events:none;z-index:3}.bt-toast.show{opacity:1}
@media(max-width:820px){.bt-win{width:100vw;height:100vh;border-radius:0;border-width:0}.bt-body{flex-direction:column;overflow:auto;padding:8px}.bt-left{flex:none}.bt-view{flex:none;height:min(42vh,340px)}.bt-right{flex:none}.bt-pane{overflow:visible}.bt-title{font-size:18px}.bt-head{padding:8px}.bt-btn{font-size:13px;padding:4px 8px}.bt-plank{width:40px}}
`;

export function createBuilder(app) {
  // app: { S, play(def), toast(msg), onListChange(), getCurrentN() }
  let def = newDef(), editId = null, hist = [], fut = [], brush = 'red', tab = 'tower', curLayer = 0, solveRes = null, solveTimer = 0, randCounts = {};
  let SC = null, canvas = null, raf = 0, yaw = 0.6, dragging = null;
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const modal = h('div', { id: 'bt-modal' }); document.body.append(modal);
  const toastEl = h('div', { class: 'bt-toast' });
  const say = m => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(() => toastEl.classList.remove('show'), 1800); };
  // ---- 历史 ----
  const snap = () => JSON.stringify({ def, editId });
  function pushHist() { hist.push(snap()); if (hist.length > 120) hist.shift(); fut.length = 0; }
  function mutate(fn) { pushHist(); fn(def); changed(); }
  function undo() { if (!hist.length) return; fut.push(snap()); const o = JSON.parse(hist.pop()); def = o.def; editId = o.editId; changed(); }
  function redo() { if (!fut.length) return; hist.push(snap()); const o = JSON.parse(fut.pop()); def = o.def; editId = o.editId; changed(); }
  function changed() { curLayer = clamp(curLayer, 0, def.layers.length - 1); solveRes = null; renderAll(); updatePreview(); clearTimeout(solveTimer); solveTimer = setTimeout(runSolve, 700); }
  function runSolve() { solveTimer = 0; try { const v = validateCustom(app.S, def); if (v.items.some(i => i.lv === 'err' && /不稳|空的|没有积木/.test(i.t))) { solveRes = { ok: false, skipped: true }; } else if (def.layers.reduce((a, l) => a + l.colors.length, 0) > 60) solveRes = { skipped: true }; else solveRes = solveCustom(app.S, def); } catch (e) { solveRes = { ok: false, err: String(e) }; } renderValidation(); renderFoot(); }
  // ---- 预览 ----
  function previewS() { return { ...app.S, towerY: 0.62, camElev: 24, stumpWidths: '', levelZoom: '', fitTall: 5.6, fitMargin: 0.06 }; }
  function ensureScene() {
    if (SC) return;
    canvas = h('canvas', { width: 560, height: 680 });
    if (window.ResizeObserver) new ResizeObserver(() => { if (modal.classList.contains('open')) updatePreview(); }).observe(modal);
    SC = createScene(canvas); SC.levelNum = 99;
    const pd = e => { dragging = { x: e.clientX, y: e.clientY, yaw0: yaw, moved: false }; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointerdown = pd;
    canvas.onpointermove = e => { if (!dragging) return; const dx = e.clientX - dragging.x; if (Math.abs(dx) > 3) dragging.moved = true; yaw = dragging.yaw0 + dx * 0.012; SC.setYaw(yaw); };
    canvas.onpointerup = e => {
      const d = dragging; dragging = null; if (!d || d.moved || !SC.blocks.length) return;
      const r = canvas.getBoundingClientRect(), id = SC.pick((e.clientX - r.left) / r.width * SC.W, (e.clientY - r.top) / r.height * SC.H, SC.blocks.map(b => b.id));
      if (id >= 0) { const b = SC.blocks[id]; const ly = def.layers[b.layer]; let i = 0; for (let k = 0; k < id; k++) if (SC.blocks[k].layer === b.layer) i++; if (ly && ly.colors[i] !== brush) { curLayer = b.layer; mutate(d2 => { d2.layers[b.layer].colors[i] = brush; }); } }
    };
    canvas.ondblclick = () => { yaw = 0.6; SC.setYaw(yaw); };
  }
  function updatePreview() {
    if (!SC || !modal.classList.contains('open')) return;
    const S2 = previewS(); const blocks = customBlocks(app.S, def);
    { const v = document.getElementById('bt-view'); const w = Math.max(160, Math.round((v ? v.clientWidth : 340) * Math.min(2, window.devicePixelRatio || 1))), hh = Math.max(160, Math.round((v ? v.clientHeight : 520) * Math.min(2, window.devicePixelRatio || 1))); SC.setSize(w, hh); }
    SC.build({ blocks, crates: [] }, S2); SC.present = blocks.map(() => true);
    SC.fit(S2, 1, blocks.length ? Math.max(...blocks.map(b => b.y + b.hgt / 2)) : 1); SC.setYaw(yaw);
    // 高亮当前层
    for (const b of blocks) SC.setOutline(b.id, b.layer === curLayer && tab === 'tower', '#ffd02a');
  }
  function loop() { if (!modal.classList.contains('open')) { raf = 0; return; } if (SC) SC.renderer.render(SC.scene, SC.camera); raf = requestAnimationFrame(loop); }
  // ---- 构件 ----
  const swatch = (c, cls, onclick) => h('button', { class: 'bt-sw ' + (cls || ''), style: `background:${colHex(c)}`, title: colName(c), 'data-c': c, onclick });
  const palette = (sel, onpick, mini) => h('div', { class: 'bt-pal' }, COLOR_KEYS.map(c => swatch(c, (mini ? 'mini ' : '') + (sel === c ? 'sel' : ''), () => onpick(c))));
  const btn = (label, onclick, cls = '', attrs = {}) => h('button', { class: 'bt-btn ' + cls, onclick, ...attrs }, label);
  const tabs = [['tower', '🏗 积木塔'], ['crates', '📦 木箱'], ['params', '⚙ 参数'], ['library', '📁 关卡库']];
  let paneEl, headEl, footEl, valEl;
  function renderHead() {
    headEl.replaceChildren(
      h('div', { class: 'bt-title' }, '🧱 关卡搭建器'),
      h('input', { class: 'bt-name', id: 'bt-name', value: def.name, maxlength: 24, placeholder: '关卡名称', oninput: e => { def.name = e.target.value; } }),
      btn('↶ 撤销', undo, 'small', { id: 'bt-undo', disabled: !hist.length }), btn('↷ 重做', redo, 'small', { id: 'bt-redo', disabled: !fut.length }),
      btn('✕', close, 'red small', { id: 'bt-close', title: '关闭' }));
  }
  function renderFoot() {
    const v = validateCustom(app.S, def), errs = v.items.filter(i => i.lv === 'err').length, warns = v.items.filter(i => i.lv === 'warn').length;
    const sv = solveRes ? (solveRes.skipped ? ['warn', '可解性：已跳过'] : solveRes.ok ? ['ok', `✓ 可解（${solveRes.steps} 步）`] : ['err', '✖ 未找到解']) : ['warn', '可解性：检查中…'];
    footEl.replaceChildren(
      h('div', { class: 'st' }, h('span', { class: 'bt-chip ' + (errs ? 'err' : 'ok'), id: 'bt-st-count' }, errs ? `✖ ${errs} 个问题` : '✓ 数量匹配'), warns ? h('span', { class: 'bt-chip warn' }, `⚠ ${warns} 条提示`) : null, h('span', { class: 'bt-chip ' + sv[0], id: 'bt-st-solve' }, sv[1])),
      btn('💾 保存', save, 'blue', { id: 'bt-save' }), btn('▶ 试玩', playNow, 'green', { id: 'bt-play' }));
  }
  function renderValidation() {
    if (!valEl) return; const v = validateCustom(app.S, def); valEl.replaceChildren();
    for (const i of v.items) valEl.append(h('div', null, h('span', { class: 'bt-chip ' + i.lv }, i.lv === 'err' ? '✖' : '⚠'), ' ' + i.t));
    if (!v.items.length) valEl.append(h('div', null, h('span', { class: 'bt-chip ok' }, '✓'), ' 积木颜色数量与木箱完全匹配，初始塔稳定'));
    if (solveRes && !solveRes.skipped) valEl.append(h('div', null, h('span', { class: 'bt-chip ' + (solveRes.ok ? 'ok' : 'err') }, solveRes.ok ? '✓' : '✖'), solveRes.ok ? ` 可解：求解器找到 ${solveRes.steps} 步通关（${solveRes.ms}ms）` : ' 求解器没找到通关顺序（可能无解，或搜索上限 6 万节点）：试玩仍可进行，但自动通关可能失败'));
    const rows = Object.entries(v.counts).map(([c, o]) => h('tr', null, h('td', null, h('span', { class: 'bt-sw mini', style: `display:inline-block;background:${colHex(c)}` }), ' ' + colName(c)), h('td', null, o.blocks), h('td', null, o.need), h('td', null, o.blocks === o.need ? '✓' : '✖')));
    valEl.append(h('table', { class: 'bt-cnt' }, h('tr', null, h('th', null, '颜色'), h('th', null, '积木'), h('th', null, '木箱需要'), h('th', null, '')), rows, h('tr', null, h('th', null, '合计'), h('th', null, v.total), h('th', null, v.need), h('th', null, v.total === v.need ? '✓' : '✖'))));
  }
  function renderTower() {
    const pane = paneEl; pane.replaceChildren();
    const nBlocks = def.layers.reduce((a, l) => a + l.colors.length, 0);
    pane.append(h('div', { class: 'bt-sub' }, '🎨 画笔（点击积木上色；在左侧 3D 预览里点积木也能上色）'), palette(brush, c => { brush = c; renderTower(); }));
    pane.append(h('div', { class: 'bt-row' },
      btn('＋ 顶部加一层', () => mutate(d => { const top = d.layers[d.layers.length - 1]; d.layers.push({ colors: top ? top.colors.map(() => brush) : [brush, brush, brush], orient: 'auto', twist: 0 }); curLayer = d.layers.length - 1; }), 'green small', { id: 'bt-addlayer' }),
      btn('🎲 随机上色', () => { tab = 'tower'; randomPanel = !randomPanel; renderTower(); }, 'small', { id: 'bt-rand' }),
      btn('📦 按积木配平木箱', () => mutate(d => { d.crates = balanceCrates(d); }), 'small', { id: 'bt-balance' }),
      btn('🧹 清空为画笔色', () => mutate(d => { for (const l of d.layers) l.colors = l.colors.map(() => brush); }), 'small'),
      h('span', { class: 'bt-sub' }, `共 ${def.layers.length} 层 · ${nBlocks} 块`)));
    if (randomPanel) pane.append(randomUI());
    pane.append(h('div', { class: 'bt-row' }, h('span', { class: 'bt-sub' }, '叠法预设'),
      btn('交替', () => mutate(d => { for (const l of d.layers) { l.orient = 'auto'; l.twist = 0; } }), 'small', { id: 'bt-p-alt' }),
      btn('扭转', () => mutate(d => { d.layers.forEach((l, i) => { l.orient = 'auto'; l.twist = [0, 6, -4, 11, -6, 9, -12, 5][i % 8]; }); }), 'small', { id: 'bt-p-twist' }),
      btn('全沿 X', () => mutate(d => { for (const l of d.layers) { l.orient = 'x'; l.twist = 0; } }), 'small'),
      btn('全沿 Z', () => mutate(d => { for (const l of d.layers) { l.orient = 'z'; l.twist = 0; } }), 'small')));
    // 层列表（顶部在上）
    for (let L = def.layers.length - 1; L >= 0; L--) {
      const ly = def.layers[L];
      const row = h('div', { class: 'bt-layer' + (L === curLayer ? ' cur' : ''), 'data-layer': L, onclick: () => { if (curLayer !== L) { curLayer = L; updatePreview(); document.querySelectorAll('.bt-layer').forEach(e => e.classList.toggle('cur', +e.dataset.layer === L)); } } },
        h('span', { class: 'bt-lno' }, `第${L + 1}层`),
        h('div', { class: 'bt-planks' }, ly.colors.map((c, i) => h('button', { class: 'bt-plank', style: `background:${colHex(c)}`, title: '点击涂成画笔色（' + colName(brush) + '）', 'data-i': i, onclick: ev => { ev.stopPropagation(); curLayer = L; if (ly.colors[i] !== brush) mutate(d => { d.layers[L].colors[i] = brush; }); else changed(); } })),
          ly.colors.length < 4 ? btn('＋', ev => { ev.stopPropagation(); mutate(d => { d.layers[L].colors.push(brush); }); }, 'small', { title: '加一块（最多 4）' }) : null,
          ly.colors.length > 1 ? btn('－', ev => { ev.stopPropagation(); mutate(d => { d.layers[L].colors.pop(); }); }, 'small', { title: '去掉最后一块' }) : null),
        h('select', { class: 'bt-sel', title: '朝向', onclick: e => e.stopPropagation(), onchange: e => mutate(d => { d.layers[L].orient = e.target.value; }) }, [['auto', '交替'], ['x', '沿X'], ['z', '沿Z']].map(([v, t]) => h('option', { value: v, selected: ly.orient === v }, t))),
        h('input', { class: 'bt-num', type: 'number', title: '扭转角度（°）', step: 1, min: -45, max: 45, value: ly.twist || 0, onclick: e => e.stopPropagation(), onchange: e => mutate(d => { d.layers[L].twist = clamp(+e.target.value || 0, -45, 45); }) }),
        btn('填充', ev => { ev.stopPropagation(); mutate(d => { d.layers[L].colors = d.layers[L].colors.map(() => brush); }); }, 'small', { title: '整层涂成画笔色' }),
        btn('镜像', ev => { ev.stopPropagation(); mutate(d => { d.layers[L].colors.reverse(); }); }, 'small', { title: '左右翻转颜色顺序' }),
        btn('复制', ev => { ev.stopPropagation(); mutate(d => { d.layers.splice(L + 1, 0, clone(d.layers[L])); curLayer = L + 1; }); }, 'small', { title: '在上方复制一层' }),
        btn('▲', ev => { ev.stopPropagation(); if (L < def.layers.length - 1) mutate(d => { [d.layers[L], d.layers[L + 1]] = [d.layers[L + 1], d.layers[L]]; curLayer = L + 1; }); }, 'small', { title: '上移' }),
        btn('▼', ev => { ev.stopPropagation(); if (L > 0) mutate(d => { [d.layers[L], d.layers[L - 1]] = [d.layers[L - 1], d.layers[L]]; curLayer = L - 1; }); }, 'small', { title: '下移' }),
        btn('🗑', ev => { ev.stopPropagation(); if (def.layers.length > 1) mutate(d => { d.layers.splice(L, 1); }); }, 'red small', { title: '删除这一层' }));
      pane.append(row);
    }
    pane.append(h('div', { class: 'bt-sub' }, '✅ 校验'), valEl = h('div', { class: 'bt-val', id: 'bt-val' }), btn('🔍 检查可解性', () => { clearTimeout(solveTimer); solveRes = null; renderValidation(); setTimeout(runSolve, 20); }, 'small', { id: 'bt-solve' }));
    renderValidation();
  }
  let randomPanel = false;
  function randomUI() {
    const total = def.layers.reduce((a, l) => a + l.colors.length, 0), cols = COLOR_KEYS;
    const need = {}; for (const c of def.crates) need[c] = (need[c] || 0) + def.cap;
    if (!Object.keys(randCounts).length || Object.values(randCounts).reduce((a, b) => a + b, 0) !== total) { randCounts = {}; const used = Object.keys(need).length ? Object.keys(need) : ['red', 'yellow', 'blue']; let left = total; used.forEach((c, i) => { const n = i === used.length - 1 ? left : Math.round(total / used.length); randCounts[c] = n; left -= n; }); if (Object.keys(need).length && Object.keys(need).reduce((a, c) => a + need[c], 0) === total) randCounts = { ...need }; }
    const sum = () => Object.values(randCounts).reduce((a, b) => a + b, 0);
    const box = h('div', { class: 'bt-val', id: 'bt-randbox' }, h('div', { class: 'bt-sub' }, `按颜色数量随机上色（共 ${total} 块，需正好分配完）`),
      h('div', { class: 'bt-row' }, cols.map(c => h('span', { style: 'display:inline-flex;align-items:center;gap:3px' }, h('span', { class: 'bt-sw mini', style: `display:inline-block;background:${colHex(c)}` }), h('input', { class: 'bt-num', type: 'number', min: 0, value: randCounts[c] || 0, 'data-c': c, onchange: e => { randCounts[c] = Math.max(0, +e.target.value | 0); renderTower(); } })))),
      h('div', { class: 'bt-row' }, h('span', { class: 'bt-chip ' + (sum() === total ? 'ok' : 'err') }, `已分配 ${sum()} / ${total}`),
        btn('🎲 随机分配', () => { if (sum() !== total) { say('数量合计要等于积木总数'); return; } mutate(d => { const pool = []; for (const c of cols) for (let i = 0; i < (randCounts[c] || 0); i++) pool.push(c); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } let k = 0; for (const l of d.layers) l.colors = l.colors.map(() => pool[k++]); }); }, 'green small', { id: 'bt-dorand' }),
        btn('用木箱需求', () => { if (Object.values(need).reduce((a, b) => a + b, 0) !== total) { say('木箱容量合计≠积木总数'); return; } randCounts = { ...need }; renderTower(); }, 'small')));
    return box;
  }
  function crateCard(c, i, shown) {
    const card = h('div', { class: 'bt-crate', draggable: true, style: `background:${colHex(c)}`, 'data-i': i, title: '拖动排序；点颜色块切换颜色' },
      h('button', { class: 'x', title: '删除', onclick: e => { e.stopPropagation(); mutate(d => { d.crates.splice(i, 1); }); } }, '×'),
      h('div', null, shown ? `第${i + 1}格` : `#${i + 1}`), h('div', { class: 'pips' }, Array.from({ length: def.cap }, () => h('span', { class: 'pip' }))),
      h('div', null, colName(c)),
      h('div', { class: 'mv' }, h('button', { onclick: e => { e.stopPropagation(); if (i > 0) mutate(d => { [d.crates[i], d.crates[i - 1]] = [d.crates[i - 1], d.crates[i]]; }); } }, '◀'), h('button', { onclick: e => { e.stopPropagation(); if (i < def.crates.length - 1) mutate(d => { [d.crates[i], d.crates[i + 1]] = [d.crates[i + 1], d.crates[i]]; }); } }, '▶')),
      h('select', { class: 'bt-sel', style: 'width:100%;margin-top:3px', onchange: e => mutate(d => { d.crates[i] = e.target.value; }) }, COLOR_KEYS.map(k => h('option', { value: k, selected: k === c }, colName(k)))));
    card.ondragstart = e => { card.classList.add('drag'); e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; };
    card.ondragend = () => card.classList.remove('drag');
    card.ondragover = e => { e.preventDefault(); card.classList.add('over'); };
    card.ondragleave = () => card.classList.remove('over');
    card.ondrop = e => { e.preventDefault(); const from = +e.dataTransfer.getData('text/plain'); if (!(from >= 0) || from === i) return; mutate(d => { const [m] = d.crates.splice(from, 1); d.crates.splice(i, 0, m); }); };
    return card;
  }
  function renderCrates() {
    const pane = paneEl; pane.replaceChildren();
    const vis = Math.min(def.visible, def.crates.length), shown = def.crates.slice(0, vis), queue = def.crates.slice(vis);
    pane.append(h('div', { class: 'bt-sub' }, `📺 当前显示的木箱（同屏 ${def.visible} 个）`), h('div', { class: 'bt-shelf show', id: 'bt-shown' }, shown.map((c, i) => crateCard(c, i, true)), !shown.length ? h('span', null, '（没有木箱）') : null,
      queue.length ? h('div', { class: 'bt-plus', title: '队列里还有 ' + queue.length + ' 个' }, '+' + queue.length) : null));
    pane.append(h('div', { class: 'bt-sub' }, `⏭ 接下来出现的木箱（共 ${queue.length} 个，按从左到右依次补位，可拖动排序）`), h('div', { class: 'bt-shelf', id: 'bt-queue' }, queue.map((c, i) => crateCard(c, i + vis, false)), !queue.length ? h('span', null, '（队列是空的）') : null));
    pane.append(h('div', { class: 'bt-sub' }, '➕ 添加木箱'), h('div', { class: 'bt-row' }, palette(null, c => mutate(d => { d.crates.push(c); })), h('span', null, '点颜色加到队尾')));
    pane.append(h('div', { class: 'bt-row' }, btn('⚖ 按积木自动配平', () => mutate(d => { d.crates = balanceCrates(d); }), 'green small', { id: 'bt-balance2' }), btn('🔀 打乱顺序', () => mutate(d => { d.crates = balanceCrates(d, true); }), 'small', { id: 'bt-shuffle' }), btn('🧹 清空木箱', () => mutate(d => { d.crates = []; }), 'red small')));
    pane.append(h('div', { class: 'bt-sub' }, '✅ 校验'), valEl = h('div', { class: 'bt-val', id: 'bt-val' })); renderValidation();
  }
  function numRow(label, key, min, max, step, fmt) {
    const val = def[key] ?? '', inp = h('input', { class: 'bt-num', type: 'number', min, max, step, value: val, 'data-k': key, onchange: e => { const v = clamp(+e.target.value, min, max); mutate(d => { d[key] = v; if (key === 'cap') d.crates = d.crates.slice(); }); } });
    const rng = h('input', { type: 'range', min, max, step, value: val === '' ? min : val, style: 'flex:1;min-width:100px', oninput: e => { inp.value = e.target.value; }, onchange: e => { const v = +e.target.value; mutate(d => { d[key] = v; }); } });
    return h('div', { class: 'bt-row' }, h('span', { style: 'flex:0 0 150px;font-weight:700' }, label), rng, inp);
  }
  function renderParams() {
    const pane = paneEl; pane.replaceChildren();
    pane.append(h('div', { class: 'bt-sub' }, '📦 木箱 / 托盘'), numRow('每个木箱容量', 'cap', 1, 6, 1), numRow('同屏显示木箱数', 'visible', 1, 6, 1), numRow('托盘格数', 'trayCap', 1, 9, 1));
    pane.append(h('div', { class: 'bt-sub' }, '🎥 镜头 / 积木'), numRow('积木整体缩放', 'scale', 0.5, 1.4, 0.05), numRow('积木厚度系数', 'hgtScale', 0.6, 1.6, 0.05));
    const hasYaw = def.yaw != null;
    pane.append(h('div', { class: 'bt-row' }, h('span', { style: 'flex:0 0 150px;font-weight:700' }, '开局镜头角度'), h('label', null, h('input', { type: 'checkbox', id: 'bt-yawauto', checked: !hasYaw, onchange: e => mutate(d => { d.yaw = e.target.checked ? null : (+app.S.startYaw || 22); }) }), ' 默认'),
      hasYaw ? [h('input', { type: 'range', min: -180, max: 180, step: 1, value: def.yaw, style: 'flex:1', onchange: e => mutate(d => { d.yaw = +e.target.value; }) }), h('input', { class: 'bt-num', type: 'number', value: def.yaw, onchange: e => mutate(d => { d.yaw = clamp(+e.target.value || 0, -180, 180); }) })] : null));
    pane.append(h('div', { class: 'bt-val', style: 'margin-top:8px' }, h('div', null, 'ℹ 本游戏没有步数 / 时间限制：输赢由「托盘塞满」和「塔倒了」决定，所以托盘格数就是你的“步数压力”。'), h('div', null, '修改“每箱容量”后，请到「木箱」页点“按积木自动配平”。')));
  }
  function levelInfo(o) { const n = o.layers.reduce((a, l) => a + l.colors.length, 0); return `${o.layers.length} 层 · ${n} 块 · ${o.crates.length} 箱`; }
  function renderLibrary() {
    const pane = paneEl; pane.replaceChildren();
    pane.append(h('div', { class: 'bt-sub' }, '🗂 我的关卡（保存在本机浏览器，会出现在左侧“选关”里）'));
    if (!CUSTOM.list.length) pane.append(h('div', { class: 'bt-val' }, '还没有保存的关卡：在「积木塔」里搭好后点“💾 保存”。'));
    CUSTOM.list.forEach((o, i) => pane.append(h('div', { class: 'bt-lib', 'data-i': i }, h('b', null, (editId === o.id ? '✎ ' : '') + o.name), h('span', null, levelInfo(o)),
      btn('编辑', () => { def = clone(o); editId = o.id; hist = []; fut = []; tab = 'tower'; changed(); say('已载入：' + o.name); }, 'blue small', { class: 'bt-load' }),
      btn('复制', () => { const c = clone(o); c.name = o.name + ' 副本'; c.id = newId(); CUSTOM.list.push(c); saveCustomList(); app.onListChange(); renderLibrary(); say('已复制'); }, 'small'),
      btn('试玩', () => { app.play(clone(o), 101 + i); close(); }, 'green small'),
      btn('导出', () => download(o.name + '.json', JSON.stringify(o, null, 1)), 'small'),
      btn('删除', () => { if (!confirm('删除“' + o.name + '”？')) return; CUSTOM.list.splice(i, 1); if (editId === o.id) editId = null; saveCustomList(); app.onListChange(); renderLibrary(); }, 'red small', { class: 'bt-del' }))));
    pane.append(h('div', { class: 'bt-sub' }, '🧩 以内置关卡为模板'), h('div', { class: 'bt-row' }, [1, 2, 3, 4, 5].map(n => btn('第 ' + n + ' 关', () => { def = templateFromLevel(app.S, n); editId = null; hist = []; fut = []; tab = 'tower'; changed(); say('已载入第 ' + n + ' 关作为模板'); }, 'small', { class: 'bt-tpl', 'data-n': n })), btn('空白新关卡', () => { def = newDef(); editId = null; hist = []; fut = []; tab = 'tower'; changed(); }, 'green small', { id: 'bt-new' })));
    const ta = h('textarea', { class: 'bt-ta', id: 'bt-json', placeholder: '在这里粘贴关卡 JSON，再点“导入”' });
    pane.append(h('div', { class: 'bt-sub' }, '📤 导入 / 导出 JSON'), ta, h('div', { class: 'bt-row' },
      btn('导入', () => importText(ta.value), 'blue small', { id: 'bt-import' }),
      btn('导出当前到文本框', () => { ta.value = JSON.stringify(def, null, 1); }, 'small', { id: 'bt-exp-ta' }),
      btn('下载当前 .json', () => download(def.name + '.json', JSON.stringify(def, null, 1)), 'small'),
      btn('下载全部 .json', () => download('block-tower-levels.json', JSON.stringify(CUSTOM.list, null, 1)), 'small'),
      h('label', { class: 'bt-btn small' }, '📂 选择文件', h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: e => { const f = e.target.files[0]; if (f) f.text().then(importText); e.target.value = ''; } }))));
  }
  const newId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  function normalize(o) {
    if (!o || !Array.isArray(o.layers) || !o.layers.length) throw new Error('缺少 layers');
    const d = { v: 1, name: String(o.name || '导入的关卡').slice(0, 24), layers: o.layers.slice(0, 40).map(l => ({ colors: (l.colors || []).slice(0, 4).map(c => PALETTE[c] ? c : 'red'), orient: ['x', 'z'].includes(l.orient) ? l.orient : 'auto', twist: clamp(+l.twist || 0, -45, 45) })), crates: (Array.isArray(o.crates) ? o.crates : []).slice(0, 80).map(c => PALETTE[c] ? c : 'red'), cap: clamp(Math.round(o.cap) || 3, 1, 6), visible: clamp(Math.round(o.visible) || 4, 1, 6), trayCap: clamp(Math.round(o.trayCap) || 5, 1, 9), yaw: o.yaw == null || !isFinite(+o.yaw) ? null : clamp(+o.yaw, -180, 180), scale: clamp(+o.scale || 1, 0.5, 1.4), hgtScale: clamp(+o.hgtScale || 1, 0.6, 1.6) };
    if (d.layers.some(l => !l.colors.length)) throw new Error('有空层');
    return d;
  }
  function importText(txt) {
    try { let o = JSON.parse(txt); const arr = Array.isArray(o) ? o : [o]; let n = 0, last = null; for (const x of arr) { const d = normalize(x); d.id = newId(); CUSTOM.list.push(d); last = d; n++; }
      saveCustomList(); app.onListChange(); if (last) { def = clone(last); editId = last.id; hist = []; fut = []; } say(`已导入 ${n} 个关卡`); changed(); tab = 'tower'; renderAll(); return n; }
    catch (e) { say('导入失败：' + e.message); return 0; }
  }
  function download(name, text) { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name.replace(/[\\/:*?"<>|]/g, '_') }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function save() {
    def.name = (document.getElementById('bt-name') || { value: def.name }).value.trim() || '我的关卡';
    const o = clone(def);
    if (editId) { const i = CUSTOM.list.findIndex(x => x.id === editId); if (i >= 0) { o.id = editId; CUSTOM.list[i] = o; } else { o.id = editId; CUSTOM.list.push(o); } }
    else { o.id = newId(); editId = o.id; CUSTOM.list.push(o); }
    def.id = o.id; saveCustomList(); app.onListChange(); say('已保存：' + o.name); renderAll();
  }
  function playNow() { def.name = (document.getElementById('bt-name') || { value: def.name }).value.trim() || def.name; const i = editId ? CUSTOM.list.findIndex(x => x.id === editId) : -1; app.play(clone(def), i >= 0 && JSON.stringify(strip(CUSTOM.list[i])) === JSON.stringify(strip(def)) ? 101 + i : 100); close(); }
  const strip = o => { const c = clone(o); delete c.id; return c; };
  function renderAll() {
    if (!paneEl) return; renderHead(); renderFoot();
    tabBar.replaceChildren(...tabs.map(([k, t]) => h('button', { class: 'bt-tab' + (tab === k ? ' on' : ''), 'data-tab': k, onclick: () => { tab = k; renderAll(); updatePreview(); } }, t)));
    ({ tower: renderTower, crates: renderCrates, params: renderParams, library: renderLibrary })[tab]();
  }
  let tabBar;
  function build() {
    headEl = h('div', { class: 'bt-head' }); footEl = h('div', { class: 'bt-foot' }); paneEl = h('div', { class: 'bt-pane', id: 'bt-pane' }); tabBar = h('div', { class: 'bt-tabs' });
    ensureScene();
    const left = h('div', { class: 'bt-left' }, h('div', { class: 'bt-view', id: 'bt-view' }, canvas, h('div', { class: 'hint' }, '拖动旋转 · 点积木上色 · 双击复位')));
    modal.replaceChildren(h('div', { class: 'bt-win' }, headEl, h('div', { class: 'bt-body' }, left, h('div', { class: 'bt-right' }, tabBar, paneEl)), footEl, toastEl));
  }
  let inited = false;
  function open(opts = {}) {
    if (!inited) { inited = true; if (!opts.def) { try { def = templateFromLevel(app.S, 2); def.name = '我的关卡'; } catch (e) { } } }
    if (!paneEl) build();
    if (opts.def) { def = clone(opts.def); editId = opts.def.id || null; hist = []; fut = []; }
    modal.classList.add('open'); renderAll(); updatePreview(); if (!raf) raf = requestAnimationFrame(loop); clearTimeout(solveTimer); solveTimer = setTimeout(runSolve, 300);
  }
  function close() { modal.classList.remove('open'); }
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (!modal.classList.contains('open')) return; if (e.key === 'Escape') close(); else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); } });
  return { open, close, get def() { return def; }, set def(v) { def = v; }, importText, normalize, newDef, isOpen: () => modal.classList.contains('open'), get editId() { return editId; } };
}

// 内置关卡 → 搭建器关卡
export function templateFromLevel(S, n) {
  const lv = makeLevel(S, n), by = new Map();
  for (const b of lv.blocks) { if (!by.has(b.layer)) by.set(b.layer, []); by.get(b.layer).push(b); }
  const layers = [...by.keys()].sort((a, b) => a - b).map(L => { const bs = by.get(L); const base = L % 2 === 1 ? Math.PI / 2 : 0; let tw = (bs[0].yaw - base) * 180 / Math.PI; tw = Math.round(tw * 10) / 10; return { colors: bs.map(b => b.color), orient: 'auto', twist: Math.abs(tw) < 0.05 ? 0 : tw }; });
  const ks = String(S.blockScales || '').split(',').map(parseFloat), hs = String(S.hgtScales || '').split(',').map(parseFloat), ys = String(S.startYaws || '').split(',').map(parseFloat);
  return { v: 1, name: '第' + n + '关副本', layers, crates: lv.crates.map(c => c.color), cap: lv.opt.cap, visible: lv.opt.vis, trayCap: lv.opt.trayCap, yaw: isFinite(ys[n - 1]) ? ys[n - 1] : null, scale: isFinite(ks[n - 1]) && ks[n - 1] > 0 ? ks[n - 1] : (S.blockScaleDefault || 1), hgtScale: isFinite(hs[n - 1]) && hs[n - 1] > 0 ? hs[n - 1] : 1 };
}
