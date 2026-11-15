// 积木塔 · 核玩工具 主程序：2D 画布合成 three.js 渲染 + 2D HUD；自动通关 / 录制 / AE / 3D / H5 试玩导出
import { DEFAULTS, SCHEMA, SETTINGS_VERSION } from './settings.js';
import { THEMES, THEME_KEYS, themeDefaults } from './themes/index.js';
import { loadFonts, FONT } from './fonts.js';
import { initAudio, sfx, resumeAudio, audioTrack, audioState, SFX_NAMES } from './audio.js';
import { createAERecorder } from './ae/recorder.js';
import { export3D } from './export3d/export3d.js';
import { exportH5PlayableFromPage, applyPlayableMode, isPlayableNoHand, applyH5DevicePresetToSettings, markH5DeviceCustomIfSizeEdited, bindEditorDevicePreview } from './h5/index.js';
import { DEFAULT_HAND as __H5_DEFAULT_HAND } from './default_hand.js';
import { makeLevel, newState, cloneState, applyPull, pullOutcome, criticalSet, solve, matchCrate, PALETTE, LEVELS } from './core.js';
import * as ART from './art.js';
import { createScene } from './scene3d.js';
import * as THREE from 'three';

const H5_NO_HAND = isPlayableNoHand();
const LS_KEY = 'blockTowerTool.settings.v1';
let S = loadSettings();
initAudio(() => S);
function loadSettings() {
  try {
    const j = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if ('handImage' in j && (typeof j.handImage !== 'string' || (j.handImage && !/^data:image\/(png|webp|gif|jpe?g);/i.test(j.handImage)))) j.handImage = '';
    return { ...DEFAULTS, ...themeDefaults(DEFAULTS, j.theme), ...j, settingsVersion: SETTINGS_VERSION };
  } catch (e) { return { ...DEFAULTS, ...themeDefaults(DEFAULTS, DEFAULTS.theme) }; }
}
let saveTimer = 0;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = 0; try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { toast('本地保存失败（图片可能过大），请用“导出设置”保存'); } }, 300);
}
window.addEventListener('pagehide', () => { if (!saveTimer) return; clearTimeout(saveTimer); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { } });

// ---------------- DOM / 画布 ----------------
const $ = s => document.querySelector(s);
const canvas = $('#stage');
let ctx = canvas.getContext('2d');
let W = 720, H = 1600, U = 1;
const glCanvas = document.createElement('canvas');
const SC = createScene(glCanvas);
const IMG = {};
function loadImg(key) {
  const src = S[key];
  if (!src) { IMG[key] = null; if (key === 'handImage') { drawHandPreview(); updateCursor(); } return; }
  const im = new Image();
  im.onload = () => { if (S[key] !== src) return; IMG[key] = im; if (key === 'handImage') { drawHandPreview(); updateCursor(); } };
  im.src = src;
}
function handCursorHidden() { return !H5_NO_HAND && !!(S.hideCursor && IMG.handImage && !endCardHidesHand() && (AUTO.running ? HAND.visible : S.manualHand)); }
function updateCursor() { const c = handCursorHidden() ? 'none' : 'pointer'; if (canvas.style.cursor !== c) canvas.style.cursor = c; }
['handImage', 'h5Icon', 'endIcon'].forEach(loadImg);

function setResolution() {
  const [w, h] = String(S.recRes).split('x').map(Number);
  W = w; H = h; U = W / 720;
  canvas.width = W; canvas.height = H; canvas.style.aspectRatio = W + '/' + H;
  SC.setSize(W, H); G && refit(true);
}
// 设计坐标（720×1600）→ 画布：顶部元素贴顶，底部元素贴底，横向按 U 缩放
const tY = y => y * U, bY = y => H - (1600 - y) * U;
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- Tweens ----------------
const tweens = [];
function tween(dur, fn, ease = easeInOut, gen = null) {
  return new Promise(res => tweens.push({ t0: performance.now(), dur: Math.max(1, dur), fn, ease, res, gen }));
}
// 取消所有属于旧 gen 的补间（撤销 / 换关）
function dropTweens() { for (const tw of tweens) tw.res(); tweens.length = 0; }

// ---------------- 对局 ----------------
let G = null;            // 当前关卡视图状态
let LV = null;           // 关卡数据（core）
let ST = null;           // 逻辑状态
const AUTO = { running: false, token: 0 };
const REC = { rec: null, chunks: [], mime: '', t0: 0, auto: false, list: [] };
const HAND = { x: 0, y: 0, press: 0, visible: false, alpha: 0 };
const UI = { yawBase: 0, zoom: 1, introT0: 0, ptrs: new Map(), drag: null };

function levelNumber() { return G ? G.n : clamp(Math.round(S.startLevel), 1, 99); }
function newGame(keepSeed = true, n = null) {
  if (!keepSeed) S.seed = Math.floor(Math.random() * 1e9);
  const num = n ?? (G ? G.n : clamp(Math.round(S.startLevel), 1, 99));
  buildGame(num);
  saveSettings(); if (controls.seed) controls.seed.el.value = S.seed;
}
function buildGame(num) {
  dropTweens(); const gen = (G ? G.gen : 0) + 1;
  ART.setPalette(S);
  LV = makeLevel(S, num); ST = newState(LV);
  SC.build(LV, S); SC.present = ST.present;
  const vis = S.visibleCrates;
  G = {
    n: num, gen, lv: LV, view: { vq: LV.crates.slice(0, vis).map((c, i) => i), crates: new Map(), tray: Array(S.trayCap).fill(-1), trayBusy: Array(S.trayCap).fill(false) },
    flights: [], floaters: [], parts: [], ripples: [], tips: [], crateDone: new Set(), pulling: new Set(), snaps: [], over: null, overT: 0, locked: false, cleared: false, clearT: 0, panel: null, panelT: 0,
    undoLeft: S.undoCount, combo: 0, crateArrivals: 0, shake: null, tut: true, confirmId: -1, trayTipShown: false, fellAt: 0, hintShown: false, rewinding: false, lastPullT: 0,
    fullFlash: [], endShown: false, introT0: performance.now(), wonT: 0, tapped: false, swiped: false, failed: 0,
  };
  for (const cid of G.view.vq) ensureCrate(cid, false);
  UI.yawBase = (() => { const a = String(S.startYaws || '').split(',').map(parseFloat)[(G ? G.n : 1) - 1]; return (isFinite(a) ? a : S.startYaw) * Math.PI / 180; })(); SC.setYaw(UI.yawBase); UI.zoom = 1;
  G.topH = Math.max(...LV.blocks.map(b => b.y + b.hgt / 2));
  refit(true);
  if (S.showHints && LV.def.hint) setTimeout(() => { if (G && G.gen === gen && !G.tapped) showTip(LV.def.hint); }, 500);
  if (S.tutorialHighlight && num === 1 && LV.solution) SC.setOutline(LV.solution[0], true, S.highlightColor);
  G.tutId = S.tutorialHighlight && num === 1 && LV.solution ? LV.solution[0] : -1;
  updateStatus(); updateButtons();
}
function levelZoom() { const z = String(S.levelZoom || '').split(',').map(parseFloat)[G.n - 1]; return isFinite(z) && z > 0 ? z : 1; }
function refit(force) {
  const introK = S.zoomIntro && S.introMs > 0 ? clamp((performance.now() - G.introT0) / S.introMs, 0, 1) : 1;
  const zi = lerp(S.introZoom, 1, easeOut(introK));
  const key = [W, H, UI.zoom.toFixed(3), zi.toFixed(3), G.n, S.camElev, S.camFov, S.fitMargin, S.fitTall, S.levelZoom, S.stumpWidths, S.towerY, S.stumpR, G.gen, (G.colK || 1).toFixed(3)].join('|');
  if (!force && key === G.fitKey) return;
  G.fitKey = key; SC.levelNum = G.n; SC.fit(S, UI.zoom * zi * (G.colK || 1) * levelZoom(), G.topH);
}
function updateStatus() {
  if (!G) return;
  const el = $('#status'); if (!el) return;
  el.textContent = (G.cleared ? '🎉 通关！' : G.over === 'fell' ? '💥 塔倒了' : G.over === 'trayfull' ? '托盘已满' : '') + ` 第 ${G.n} 关 · 已清 ${ST.cleared}/${LV.blocks.length} · 木箱 ${ST.crateQ.length} 个待填 · 托盘 ${ST.tray.filter(x => x >= 0).length}/${S.trayCap} · 承重块 ${critNow().size}`;
}
let critCache = null;
function critNow() { if (!critCache || critCache.key !== ST.moves + ':' + G.gen) critCache = { key: ST.moves + ':' + G.gen, set: criticalSet(LV.blocks, ST.present, S.stabMargin) }; return critCache.set; }

// ---------------- 提示气泡 / 飘字 / 粒子 ----------------
function showTip(text, ms = S.tipMs, small = false) {
  if (!S.showHints || !G) return; G.tips = G.tips.filter(t => t.text !== text); G.tips.push({ text, t0: performance.now(), dur: ms, small });
}
function floater(text, x, y, o = {}) { G.floaters.push({ text, x, y, t0: performance.now(), dur: o.dur ?? S.popupMs, vy: o.vy ?? -40, size: o.size ?? 40, fill: o.fill, stroke: o.stroke, grad: o.grad, pop: o.pop ?? true, id: 'fl' + (++floaterId) }); }
let floaterId = 0, partId = 0;
function spawnConfetti(x, y, n, spread = 1, up = 1) {
  const cols = ['#ff5252', '#ffd740', '#4fc3f7', '#69f0ae', '#ff80ab', '#b388ff', '#ffab40'];
  for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0) , sp = rand(260, 900) * spread; G.parts.push({ id: 'p' + (++partId), kind: 'conf', col: cols[i % cols.length], x, y, vx: Math.cos(a) * sp * 0.7, vy: Math.sin(a) * sp * up - rand(0, 300), rot: rand(0, 6), vr: rand(-12, 12), t0: performance.now(), life: rand(1100, 2200), size: rand(0.8, 1.4) * S.particleSize, g: 1500 * S.particleGravity, sy: 1 }); }
}
function rainConfetti(n) {
  const cols = ['#ff5252', '#ffd740', '#4fc3f7', '#69f0ae', '#ff80ab', '#b388ff', '#ffab40'];
  for (let i = 0; i < n; i++) G.parts.push({ id: 'p' + (++partId), kind: 'conf', col: cols[i % cols.length], x: rand(0, W), y: -rand(0, H * 0.3), vx: rand(-80, 80), vy: rand(200, 600), rot: rand(0, 6), vr: rand(-10, 10), t0: performance.now() + rand(0, 500), life: rand(2200, 3600), size: rand(0.8, 1.5) * S.particleSize, g: 120 * S.particleGravity });
}
function spawnDebris(x, y, color, n) {
  const P = ART.pal(color);
  for (let i = 0; i < n; i++) { const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), sp = rand(120, 520); G.parts.push({ id: 'p' + (++partId), kind: 'chip', col: i % 3 ? P.main : P.light, x: x + rand(-20, 20) * U, y: y + rand(-10, 10) * U, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rand(0, 6), vr: rand(-14, 14), t0: performance.now(), life: rand(500, 1000), size: rand(0.7, 1.5) * S.particleSize, g: 1700 * S.particleGravity }); }
  for (let i = 0; i < S.dustPuffs; i++) G.parts.push({ id: 'p' + (++partId), kind: 'puff', x: x + rand(-30, 30) * U, y: y + rand(-14, 14) * U, vx: rand(-60, 60), vy: rand(-50, -10), rot: 0, vr: 0, t0: performance.now(), life: rand(420, 700), size: rand(0.8, 1.6) * U, g: 0, grow: 1.3 });
}
// 粒子状态（给绘制与 AE 记录共用）
function partState(p, now) {
  const t = (now - p.t0) / 1000; if (t < 0) return null; const life = p.life / 1000; if (t > life) return null;
  const x = p.x + p.vx * t, y = p.y + p.vy * t + 0.5 * p.g * t * t;
  const k = t / life;
  if (p.kind === 'puff') return { x, y, rot: 0, sx: p.size * (1 + k * (p.grow || 1)), sy: p.size * (1 + k * (p.grow || 1)), a: (1 - k) * 0.7 };
  return { x, y, rot: p.rot + p.vr * t, sx: p.size * U * (p.kind === 'conf' ? Math.abs(Math.cos(t * 9 + p.rot)) * 0.8 + 0.2 : 1) , sy: p.size * U, a: k > 0.75 ? (1 - k) / 0.25 : 1 };
}

// ---------------- 显示列表（绘制即记录，AE 导出复用） ----------------
let FRAME = { items: [], tower: -1 };
function put(id, A, x, y, o = {}) {
  const sx = (o.sx ?? 1) * U, sy = (o.sy ?? o.sx ?? 1) * U, a = o.a ?? 1; if (a <= 0.002) return;
  const ax = o.ax ?? 0.5, ay = o.ay ?? 0.5, crop = o.crop ?? 1, rot = o.rot || 0;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); if (rot) ctx.rotate(rot);
  const dw = A.w * sx, dh = A.h * sy;
  if (crop < 1) ctx.drawImage(A.canvas, 0, 0, A.canvas.width * crop, A.canvas.height, -ax * dw, -ay * dh, dw * crop, dh);
  else ctx.drawImage(A.canvas, -ax * dw, -ay * dh, dw, dh);
  ctx.restore();
  FRAME.items.push({ id, key: A.key, A, x, y, sx, sy, rot, a, ax, ay, crop });
}
// 记录用：不绘制（由别处绘制的元素）
function putSilent(id, A, x, y, o = {}) { const old = ctx.globalAlpha; ctx.save(); ctx.globalAlpha = 0; put(id, A, x, y, { ...o, a: o.a ?? 1 }); ctx.restore(); FRAME.items[FRAME.items.length - 1].a = o.a ?? 1; }

// ---------------- 木箱视图 ----------------
function crateSlot(i) {
  const s = i < 3 ? 1 : S.crateScale4, left = i < 3 ? 33 + 177 * i : 687 - ART.CRATE.w * s;
  return { x: (left + ART.CRATE.w * s / 2) * U, y: tY(352 - ART.CRATE.h * s / 2), s };
}
function ensureCrate(cid, enter = true) {
  let v = G.view.crates.get(cid); if (v) return v;
  const idx = Math.max(0, G.view.vq.indexOf(cid)), t = crateSlot(idx);
  v = { cid, color: LV.crates[cid].color, x: enter ? W + ART.CRATE.w * U : t.x, y: t.y, s: t.s, items: [], pulse: 0, pulseT0: 0, leaving: false, a: 1, lt0: 0, born: performance.now() };
  G.view.crates.set(cid, v); return v;
}
function crateTarget(v) { const idx = G.view.vq.indexOf(v.cid); return crateSlot(idx < 0 ? G.view.vq.length : idx); }
function crateSlotPos(v, j, tgt = false) { // 第 j 槽位中心（画布 px）
  const c = tgt ? crateTarget(v) : { x: v.x, y: v.y, s: v.s }, sl = ART.CRATE_SLOT(j), s = c.s * (v.pulse || 1);
  return { x: c.x + (sl.x - ART.CRATE.w / 2) * s * U, y: c.y + (sl.y - ART.CRATE.h / 2) * s * U, s };
}
const TRAY_POS = () => ({ x: 360 * U, y: tY(375 + ART.TRAY.h / 2) });
function traySlotPos(i) { const t = TRAY_POS(), sl = ART.TRAY_SLOT(i, S.trayCap); return { x: t.x + (sl.x - ART.TRAY.w / 2) * U, y: t.y + (sl.y - ART.TRAY.h / 2) * U, w: sl.w, h: sl.h }; }

// ---------------- 绘制：背景 / 顶栏 / 木箱 / 托盘 / 按钮 ----------------
let skyCanvas = null, skyKey = '';
function drawBackground() {
  const key = [W, H, S.bgTop, S.bgMid, S.bgBottom, S.bgGlow].join('|');
  if (key !== skyKey) { skyCanvas = document.createElement('canvas'); skyCanvas.width = W; skyCanvas.height = H; ART.drawSky(skyCanvas.getContext('2d'), W, H, S); skyKey = key; }
  ctx.drawImage(skyCanvas, 0, 0);
}
function visShown() { return G.shown || 0; }
function drawHud(now) {
  if (!S.hudShow) return;
  const total = LV.blocks.length, shown = visShown();
  const pill = ART.pillAsset(S); put('hud_pill', pill, (ART.HUD.pillX + ART.HUD.pillW / 2) * U, tY(ART.HUD.pillY + ART.HUD.pillH / 2));
  put('hud_icon', ART.stumpIconAsset(), 55 * U, tY(150));
  const lv = ART.textAsset('Level ' + G.n, { size: 34, stroke: '#2a1408', sw: 3.5, shadow: false });
  put('hud_level', lv, 112 * U, tY(148), { ax: 0 });
  const track = ART.HUD, fillW = track.trackW - 6; const prog = total ? shown / total : 0;
  if (shown > 0) {
    const bar = ART.barFillAsset(S), w = Math.max(bar.h, fillW * prog), crop = clamp(w / bar.w, 0.001, 1);
    put('hud_bar', bar, (track.trackX + 3) * U, tY(148), { ax: 0, crop });
  }
  const cnt = ART.textAsset(`${shown}/${total}`, { size: 26, stroke: '#2a1408', sw: 3, shadow: false });
  put('hud_count', cnt, (track.trackX + track.trackW / 2) * U, tY(148));
  put('hud_gear', ART.gearAsset(S), track.gearX * U, tY(track.gearY));
}
function drawCrates(now) {
  const dt = Math.min(0.1, (now - (G.lastDraw || now)) / 1000);
  const kfollow = S.crateSlideMs > 0 ? 1 - Math.exp(-dt * 7 / (S.crateSlideMs / 1000)) : 1;
  const remaining = LV.crates.length - (G.fullCount || 0);
  const list = [];
  G.view.vq.forEach((cid, i) => { if (G.crateDone.has(cid)) return; const v = ensureCrate(cid, true); const t = crateTarget(v); v.x += (t.x - v.x) * kfollow; v.y += (t.y - v.y) * kfollow; v.s += (t.s - v.s) * kfollow; list.push([v, i]); });
  for (const v of G.view.crates.values()) if (v.leaving) list.push([v, -1]);
  for (const [v, i] of list) {
    let pulse = 1;
    if (v.pulseT0) { const k = (now - v.pulseT0) / S.crateFullMs; if (k < 1) pulse = 1 + (S.popScale - 1) * Math.sin(Math.min(1, k * 1.4) * Math.PI); else { v.pulseT0 = 0; } }
    v.pulse = pulse;
    let a = 1, yo = 0;
    if (v.leaving) { const k = clamp((now - v.lt0) / 260, 0, 1); a = 1 - k; yo = -60 * U * easeIn(k); if (k >= 1) { G.view.crates.delete(v.cid); continue; } }
    const A = ART.crateAsset(v.color), s = v.s * pulse;
    put('crate_' + v.cid, A, v.x, v.y + yo, { sx: s, a });
    for (let j = 0; j < v.items.length; j++) {
      if (v.items[j] == null) continue;
      const sp = crateSlotPos(v, j), tile = ART.tileAsset(LV.blocks[v.items[j]].color), tk = v.itemT ? clamp((now - (v.itemT[j] || 0)) / 180, 0, 1) : 1;
      put(`crate_${v.cid}_item${j}`, tile, sp.x, sp.y + yo, { sx: 0.86 * s * (0.6 + 0.4 * easeBack(tk)), a });
    }
    if (i === 3 && remaining - S.visibleCrates > 0 && !v.leaving) { const bd = ART.badgeAsset('+' + (remaining - S.visibleCrates)); put('crate_badge', bd, v.x + (ART.CRATE.w * 0.5 * v.s - 4) * U, v.y - (ART.CRATE.h * 0.5 * v.s + 4) * U + 10 * U); }
  }
}
function drawTray(now) {
  if (!S.showTray) return;
  const t = TRAY_POS(); put('tray', ART.trayAsset(S.trayCap), t.x, t.y);
  for (let i = 0; i < S.trayCap; i++) {
    const id = G.view.tray[i]; if (id == null || id < 0 || !LV.blocks[id]) continue;
    const sp = traySlotPos(i), tk = clamp((now - (G.view.trayT ? G.view.trayT[i] || 0 : 0)) / 200, 0, 1);
    put('tray_item' + i, ART.tileAsset(LV.blocks[id].color), sp.x, sp.y, { sx: 0.95 * (0.7 + 0.3 * easeBack(tk)) });
  }
  const left = S.trayCap - G.view.tray.filter(x => x >= 0).length;
  if (S.trayWarnLeft > 0 && left === S.trayWarnLeft && !G.over && G.view.tray.some(x => x >= 0)) {
    const slot = G.view.tray.findIndex(x => x < 0), sp = traySlotPos(slot);
    put('tray_warn', ART.textAsset(left + ' left!', { size: 24, fill: '#ffe14d', stroke: '#4a2a10', sw: 3, shadow: false }), sp.x, t.y + (ART.TRAY.h / 2 + 22) * U, { a: 0.7 + 0.3 * Math.sin(now / 160) });
  }
}
function boosterLayout() {
  const y = bY(1478 + 49), res = [];
  if (G.n < S.undoUnlock) { for (let i = 0; i < 4; i++) res.push({ k: 'lock' + i, x: (141 + 45 + i * 116) * U, y }); }
  else { res.push({ k: 'undo', x: (32 + 45) * U, y }); for (let i = 0; i < 4; i++) res.push({ k: 'lock' + i, x: (246 + 45 + i * 116.7) * U, y }); }
  return res;
}
function drawBoosters(now) {
  if (!S.showBoosters) return;
  for (const b of boosterLayout()) {
    const A = ART.boosterAsset(b.k, S);
    const press = b.k === 'undo' && UI.undoPress && now - UI.undoPress < 140 ? 0.92 : 1;
    put('booster_' + b.k, A, b.x, b.y, { sx: press });
    if (b.k === 'undo' && G.undoLeft > 0) put('booster_undo_cnt', ART.countBadgeAsset(G.undoLeft), b.x + 38 * U, b.y - 40 * U);
  }
  if (G.topH > 5.5) put('btn_resetcam', ART.resetCamAsset(), 676 * U, bY(1395));
}
function drawTips(now) {
  G.tips = G.tips.filter(t => now - t.t0 < t.dur + 300);
  const t = G.tips[G.tips.length - 1]; if (!t) return;
  const el = now - t.t0, a = Math.min(1, el / 180) * Math.min(1, (t.dur + 300 - el) / 300);
  const A = t.small ? ART.smallTipAsset(t.text) : ART.tipAsset(t.text);
  put('tip', A, 360 * U, tY(528), { a, sx: 0.9 + 0.1 * easeBack(Math.min(1, el / 220)) });
}
function drawFloaters(now) {
  G.floaters = G.floaters.filter(f => now - f.t0 < f.dur);
  for (const f of G.floaters) {
    const k = (now - f.t0) / f.dur, A = ART.textAsset(f.text, { size: f.size, fill: f.fill || '#fff', stroke: f.stroke ?? '#2a1408', grad: f.grad });
    const s = f.pop ? 0.6 + 0.4 * easeBack(Math.min(1, k * 4)) : 1;
    put(f.id, A, f.x, f.y + f.vy * U * k, { sx: s, a: k > 0.7 ? (1 - k) / 0.3 : 1 });
  }
}
function drawParts(now) {
  G.parts = G.parts.filter(p => now - p.t0 < p.life);
  for (const p of G.parts) {
    const q = partState(p, now); if (!q) continue;
    const A = p.kind === 'puff' ? ART.puffAsset() : p.kind === 'conf' ? ART.confettiAsset(p.col) : ART.chipAsset(p.col);
    put(p.id, A, q.x, q.y, { sx: q.sx / U, sy: q.sy / U, rot: q.rot, a: q.a });
  }
}
function drawFlights(now) {
  for (let i = G.flights.length - 1; i >= 0; i--) {
    const f = G.flights[i], k = clamp((now - f.t0) / f.dur, 0, 1), e = easeInOut(k), to = f.toFn();
    const dx = to.x - f.from.x, dy = to.y - f.from.y, dist = Math.hypot(dx, dy) || 1;
    let x = lerp(f.from.x, to.x, e), y = lerp(f.from.y, to.y, e);
    const arc = Math.sin(Math.PI * k) * S.flyArc * dist; x += -dy / dist * arc * (dx > 0 ? -1 : 1) * 0.6; y += -Math.abs(dx / dist) * arc * 0.6 - arc * 0.4;
    const w = lerp(f.from.w, to.w, easeOut(k)), h = lerp(f.from.h, to.h, easeOut(k)), big = 1 + (S.flyScale - 1) * Math.sin(Math.PI * k);
    const morph = clamp((k - 0.25) / 0.55, 0, 1), rot = lerp(f.from.rot, 0, easeOut(k));
    const pl = ART.plankAsset(f.color), tl = ART.tileAsset(f.color);
    put('fly_p' + f.id, pl, x, y, { sx: w * big / (pl.w * U), sy: h * big / (pl.h * U), rot, a: 1 - morph });
    put('fly_t' + f.id, tl, x, y, { sx: (to.tw ?? 40) * big / tl.w, sy: (to.th ?? 62) * big / tl.h, rot: rot * (1 - morph), a: morph });
    if (k >= 1) { G.flights.splice(i, 1); f.res(); }
  }
}
function flight(from, toFn, color, dur = S.flyMs) {
  return new Promise(res => G.flights.push({ id: ++floaterId, t0: performance.now(), dur, from, toFn, color, res }));
}
function drawPanelOverlay(now) {
  if (!G.panel) return;
  const el = now - G.panelT, k = easeOut(Math.min(1, el / 300));
  if (G.panel === 'end') return;
  ctx.save(); ctx.fillStyle = `rgba(8,18,38,${0.78 * k})`; ctx.fillRect(0, 0, W, H); ctx.restore(); FRAME.items.push({ id: 'dim', dim: 0.78 * k });
  const P = panelRect(), A = G.panel === 'win' ? ART.winPanelAsset(S, G.n, 1, 40) : ART.failPanelAsset(S, G.panel === 'tray' ? 'tray' : 'fell');
  if (G.panel === 'win') { ctx.save(); ctx.globalAlpha = 0.16 * k; ctx.fillStyle = '#fff'; const cx = W / 2, cy = P.y - P.h * 0.32, R = H; for (let i = 0; i < 9; i++) { const a0 = -Math.PI / 2 + (i - 4.5) * 0.30 + now / 9000, a1 = a0 + 0.13; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); ctx.closePath(); ctx.fill(); } ctx.restore(); }
  put('cur', ART.currencyAsset(G.panel === 'win', G.panel === 'win' ? 0 : 1, G.panel === 'win' ? 0 : 80), W / 2, 112 * U, { a: k });
  put('panel', A, P.x, P.y, { sx: 0.6 + 0.4 * easeBack(Math.min(1, el / 380)), a: k });
}
function panelRect() { const win = G.panel === 'win', A = win ? ART.PANEL.h : ART.PANEL.hFail, cy = H * (win ? 0.585 : 0.56), w = ART.PANEL.w * U, h = A * U; return { x: W / 2, y: cy, w, h, bx: W / 2, by: cy + h / 2 - (win ? 98 : 118) * U, bw: (ART.PANEL.w - 96) * U, bh: 104 * U }; }
function endButtonRect() { return { x: W / 2, y: H * 0.69, w: W * 0.62, h: H * 0.082 }; }
function endCardState(now) {
  if (G.panel !== 'end') return null; const el = now - G.panelT; return { el, a: Math.min(1, el / 450), icon: 0.85 + 0.15 * easeBack(Math.min(1, el / 500)), pul: 1 + 0.04 * Math.sin(el / 160) };
}
function endCardHidesHand(now = performance.now()) { return !!(S.endCard && !S.endCardHand && G && G.panel === 'end'); }
function drawEndCard(now) {
  const q = endCardState(now); if (!q) return;
  ctx.save(); ctx.globalAlpha = q.a;
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, S.endBg1); gr.addColorStop(1, S.endBg2); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();
  FRAME.items.push({ id: 'end_bg', endBg: [S.endBg1, S.endBg2], a: q.a });
  const ic = IMG.endIcon || IMG.h5Icon, sz = W * 0.34 * q.icon;
  if (ic) { ctx.save(); ctx.globalAlpha = q.a; ctx.drawImage(ic, W / 2 - sz / 2, H * 0.28 - sz / 2, sz, sz); ctx.restore(); }
  else put('end_icon', ART.stumpIconAsset(), W / 2, H * 0.3, { sx: 3.2 * q.icon, a: q.a });
  put('end_title', ART.textAsset(S.endTitle, { size: 84, fill: S.endTitleColor, stroke: '#3a210f', sw: 10 }), W / 2, H * 0.46, { a: q.a });
  const b = endButtonRect();
  const A = ART.mk(Math.round(b.w / U), Math.round(b.h / U), (g, w, h) => { ART.rr(g, 0, 8, w, h - 8, 28); g.fillStyle = ART.shade(S.endBtnColor, -0.35); g.fill(); ART.rr(g, 0, 0, w, h - 8, 28); g.fillStyle = S.endBtnColor; g.fill(); g.fillStyle = 'rgba(255,255,255,.28)'; ART.rr(g, 10, 6, w - 20, (h - 8) * 0.34, 14); g.fill(); g.font = `800 ${Math.round(h * 0.42)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.lineJoin = 'round'; g.strokeStyle = '#1f5a1d'; g.strokeText(S.endButton, w / 2, h * 0.46); g.fillStyle = '#fff'; g.fillText(S.endButton, w / 2, h * 0.46); });
  A.key = 'endbtn|' + S.endButton + '|' + S.endBtnColor + '|' + Math.round(b.w); put('end_btn', A, b.x, b.y, { sx: q.pul, a: q.a });
}

// ---------------- 拔出 / 飞行 / 规则动画 ----------------
const COMBO_STYLE = [{ grad: ['#6fd0ff', '#2f8ee8'], stroke: '#14285e' }, { grad: ['#ffc34a', '#ff7a1a'], stroke: '#5a2a0a' }, { grad: ['#ff8ad8', '#e0409f'], stroke: '#5a1040' }];
function comboWord() {
  const words = String(S.comboWords).split(',').map(x => x.trim()).filter(Boolean); if (!words.length) return;
  const i = (G.combo++) % words.length; const st = COMBO_STYLE[i % COMBO_STYLE.length];
  floater(words[i], W / 2, tY(545), { size: 62, grad: st.grad, stroke: st.stroke, dur: S.popupMs, vy: -26 }); sfx('Combo');
}
function snapshot() { return { st: cloneState(ST), shown: G.shown || 0, full: G.fullCount || 0, undoLeft: G.undoLeft, combo: G.combo, arrivals: G.crateArrivals }; }
function fromPlank(bs) { let r = bs.ang; if (r > Math.PI / 2) r -= Math.PI; if (r < -Math.PI / 2) r += Math.PI; return { x: bs.x, y: bs.y, w: bs.len, h: bs.wid, rot: r }; }

async function pullAnim(id, gen, frac = 1) {
  const m = SC.meshes[id], b = LV.blocks[id];
  SC.setOutline(id, false); SC.setGhost(id, S.ghostAlpha); sfx('Pull', { delay: S.pullSfxDelay });
  const bs0 = SC.blockScreen(id), sign = bs0.e1.y >= bs0.e2.y ? 1 : -1;
  const dx = Math.cos(b.yaw) * sign, dz = -Math.sin(b.yaw) * sign, slide = S.pullSlide * b.len;
  G.pulling.add(id); spawnDebris(bs0.x, bs0.y, b.color, S.debrisCount);
  await tween(S.pullMs * frac, k => { m.position.set(b.x + dx * slide * k, b.y + 0.02 * Math.sin(k * Math.PI), b.z + dz * slide * k); }, easeOut);
  return gen === G.gen ? SC.blockScreen(id) : null;
}
// 木箱队列补位：只补“还没装满、也不在场”的下一个木箱（按队列顺序）；全部装满后不再补
function refillCrates() {
  while (G.view.vq.length < S.visibleCrates) {
    const cid = LV.crates.findIndex((c, i) => !G.crateDone.has(i) && !G.view.vq.includes(i) && !(G.view.crates.get(i) && G.view.crates.get(i).leaving));
    if (cid < 0) break; G.view.vq.push(cid); ensureCrate(cid, true);
  }
}
function arriveCrate(ev, quiet = false) {
  const v = ensureCrate(ev.cid), b = LV.blocks[ev.b];
  if (!G.view.vq.includes(ev.cid) && !G.crateDone.has(ev.cid)) G.view.vq.push(ev.cid);
  v.items[ev.slot] = ev.b; (v.itemT = v.itemT || [])[ev.slot] = performance.now(); G.shown = (G.shown || 0) + 1; G.crateArrivals++;
  if (!ev.preSfx) sfx('Crate'); if (S.showPlusOne) { const sp = crateSlotPos(v, ev.slot); floater('+1', sp.x + 14 * U, sp.y - 30 * U, { size: 34, dur: 800, vy: -50 }); }
  updateStatus();
  if (!quiet && G.crateArrivals % Math.max(1, S.comboEvery) === 0) comboWord();
}
async function waitFor(cond, ms = 2500, gen = G.gen) { const t0 = performance.now(); while (!cond() && performance.now() - t0 < ms && gen === G.gen) await sleep(30); }
async function playEvents(id, ev, gen) {
  const g0 = G; g0.evBusy = (g0.evBusy || 0) + 1;
  try { await playEvents0(id, ev, gen); } finally { g0.evBusy--; }
}
async function playEvents0(id, ev, gen) {
  const bs = await pullAnim(id, gen); if (!bs || gen !== G.gen) return;
  const m = SC.meshes[id]; m.visible = false; SC.setGhost(id, 1); G.pulling.delete(id);
  const b = LV.blocks[id], from = fromPlank(bs);
  const main = ev[0];
  if (main && main.t === 'crate') {
    const v = ensureCrate(main.cid); if (!G.view.vq.includes(main.cid) && !G.crateDone.has(main.cid)) G.view.vq.push(main.cid);
    main.preSfx = true; setTimeout(() => { if (gen === G.gen) sfx('Crate'); }, Math.max(0, S.flyMs - S.crateSfxLead));
    await flight(from, () => { const p = crateSlotPos(v, main.slot, false); return { x: p.x, y: p.y, w: 46 * 0.86 * p.s * U * 1.0, h: 70 * 0.86 * p.s * U, tw: 46 * 0.86 * p.s * U, th: 70 * 0.86 * p.s * U }; }, b.color);
    if (gen !== G.gen) return; arriveCrate(main);
  } else if (main && main.t === 'tray') {
    await flight(from, () => { const p = traySlotPos(main.slot); return { x: p.x, y: p.y, w: 44 * U, h: 66 * U, tw: 44 * U, th: 66 * U }; }, b.color);
    if (gen !== G.gen) return; G.view.tray[main.slot] = id; (G.view.trayT = G.view.trayT || [])[main.slot] = performance.now(); sfx('Land');
    if (!G.trayTipShown) { G.trayTipShown = true; showTip('No crate yet: it waits on the tray', S.tipMs, true); }
  } else if (main && main.t === 'trayfull') {
    await sleep(200); if (gen !== G.gen) return; failTrayFull(); return;
  }
  let fulls = 0;
  for (const e of ev.slice(1)) {
    if (gen !== G.gen) return;
    if (e.t === 'full') {
      const v = G.view.crates.get(e.cid); if (!v) continue;
      await waitFor(() => v.items.filter(x => x != null).length >= LV.opt.cap, 2500, gen); if (gen !== G.gen) return;
      fulls++; v.pulseT0 = performance.now(); sfx('Full');
      if (S.confettiOnCrate) spawnConfetti(v.x, v.y, Math.round(S.confettiCount * 0.5), 0.7);
      floater(fulls > 1 ? fulls + ' Crates Full!' : 'Crate Full!', v.x, v.y - 60 * U, { size: 30, fill: '#ffd02a', stroke: '#4a2a10', dur: 1100, vy: -40 });
      await sleep(S.crateFullMs * 0.65); if (gen !== G.gen) return;
      v.leaving = true; v.lt0 = performance.now(); G.view.vq = G.view.vq.filter(c => c !== e.cid); G.fullCount = (G.fullCount || 0) + 1;
      G.crateDone.add(e.cid); refillCrates();
    } else if (e.t === 't2c') {
      await waitFor(() => G.view.tray[e.from] === e.b, 2500, gen); if (gen !== G.gen) return;
      const v = ensureCrate(e.cid); if (!G.view.vq.includes(e.cid) && !G.crateDone.has(e.cid)) { G.view.vq.push(e.cid); }
      G.view.tray[e.from] = -1; const bb = LV.blocks[e.b], sp0 = traySlotPos(e.from);
      await flight({ x: sp0.x, y: sp0.y, w: 44 * U, h: 66 * U, rot: 0 }, () => { const p = crateSlotPos(v, e.slot); return { x: p.x, y: p.y, w: 46 * 0.86 * p.s * U, h: 70 * 0.86 * p.s * U, tw: 46 * 0.86 * p.s * U, th: 70 * 0.86 * p.s * U }; }, bb.color, S.flyMs * 0.8);
      if (gen !== G.gen) return; arriveCrate(e, true);
    } else if (e.t === 'win') { await sleep(350); if (gen !== G.gen) return; onWin(); }
    else if (e.t === 'trayfull') { await sleep(250); if (gen !== G.gen) return; failTrayFull(); }
  }
}
function pickTipFor(critical) { return G.n <= 2 ? 'This plank holds the tower: pick another!' : 'This plank holds the tower!'; }
// 点击积木（手动 / 自动共用）
function tapBlock(id, fromAuto = false) {
  if (!G || G.over || G.panel || G.rewinding) return false;
  if (!ST.present[id] || G.pulling.has(id)) return false;
  G.tapped = true; sfx('Tap');
  if (G.tutId >= 0) { SC.setOutline(G.tutId, false); G.tutId = -1; }
  G.tips = G.tips.filter(t => !/Pull a plank|Swipe/.test(t.text));
  const out = pullOutcome(LV, ST, id, S.stabMargin), critical = !out.ok;
  if (critical && S.warnMode !== 'off') {
    sfx('Warn'); showTip(pickTipFor(true), S.tipMs, G.n > 2);
    if (S.warnMode === 'block') { SC.setOutline(id, true, '#ff5a4a'); setTimeout(() => SC.setOutline(id, false), 600); return false; }
    if (S.warnMode === 'confirm' && G.confirmId !== id) { G.confirmId = id; SC.setOutline(id, true, '#ff5a4a'); setTimeout(() => { SC.setOutline(id, false); }, 1800); return false; }
  }
  G.confirmId = -1;
  G.snaps.push(snapshot()); if (G.snaps.length > 40) G.snaps.shift();
  const gen = G.gen;
  if (critical) { topple(id, gen); return true; }
  const ev = applyPull(LV, ST, id); critCache = null; updateStatus();
  G.lastPullT = performance.now();
  playEvents(id, ev, gen).catch(e => console.error(e));
  return true;
}
async function topple(id, gen) {
  ST.over = 'fell'; G.over = 'fell'; G.overT = performance.now(); updateStatus();
  const ids = LV.blocks.filter(b => ST.present[b.id] && b.id !== id).map(b => b.id);
  const m = SC.meshes[id]; SC.setOutline(id, false);
  sfx('Fall'); G.shake = { t0: performance.now(), amp: S.shakeOnFall };
  await pullAnim(id, gen, 0.55); if (gen !== G.gen) return;
  SC.setGhost(id, S.ghostAlpha); // 被拔块半透明留在原地（参考视频：被拔块变幽灵）
  const pb = LV.blocks[id], pm = SC.meshes[id];
  SC.startCollapse(ids, S, ST.moves + G.n, { pulledY: pb.y, pulledXZ: [pb.x, pb.z] });
  G.pulling.delete(id);
  G.collapseT0 = performance.now(); G.ghostId = id;
  await sleep(S.collapseGraceMs); if (gen !== G.gen) return;
  G.panel = 'fail'; G.panelT = performance.now(); sfx('Warn'); updateStatus();
}
function failTrayFull() {
  if (!S.failOnTrayFull || G.panel) return; G.over = 'trayfull'; G.overT = performance.now(); G.panel = 'tray'; G.panelT = performance.now(); sfx('Tray'); updateStatus();
}
function onWin() {
  if (G.cleared) return; G.cleared = true;
  for (const cid of G.view.vq.slice()) { const v = G.view.crates.get(cid); if (v && !v.leaving) { v.leaving = true; v.lt0 = performance.now(); } G.crateDone.add(cid); } G.view.vq = []; G.clearT = performance.now(); sfx('Win'); updateStatus();
  floater('Level Complete!', W / 2, tY(760), { size: 74, grad: ['#fff2a0', '#ffb81c'], stroke: '#5a2a0a', dur: 2600, vy: -20 });
  if (S.confettiOnWin) rainConfetti(Math.round(S.confettiCount * 1.6));
  const gen = G.gen, last = S.endAfterLevels > 0 && G.n >= S.endAfterLevels && S.endCard;
  setTimeout(() => {
    if (!G || G.gen !== gen) return;
    if (last) { G.panel = 'end'; G.panelT = performance.now(); G.endShown = true; sfx('Win'); }
    else if (S.winPanel) { G.panel = 'win'; G.panelT = performance.now(); }
    else nextLevel();
    updateStatus();
  }, last ? S.endDelay + 1500 : 1700);
  if (REC.rec && S.autoStop && (REC.auto || AUTO.running)) {
    const wait = (last ? S.endDelay + 1500 + 2600 / Math.max(0.5, S.autoSpeed) : 1700 + 800) + S.tailSec * 1000; const rr = REC.rec;
    setTimeout(() => { if (REC.rec === rr) stopRecording(); }, wait);
  }
}
function nextLevel() { buildGame(G.n + 1); }
// 撤销 / 回放
async function undoTo(snap, free = false) {
  if (!snap || G.rewinding) return;
  const gen = G.gen + 1; G.gen = gen; dropTweens(); G.rewinding = true;
  const hadCollapse = !!SC.collapse; const ids = LV.blocks.filter(b => SC.meshes[b.id].visible || (SC.meshes[b.id].position.y < -0.01)).map(b => b.id);
  if (hadCollapse) SC.rewindStart(LV.blocks.map(b => b.id)); SC.stopCollapse();
  ST = cloneState(snap.st); ST.over = null; SC.present = ST.present; critCache = null;
  G.flights = []; G.floaters = []; G.parts = []; G.pulling.clear(); G.over = null; G.panel = null; G.cleared = false; G.confirmId = -1; G.tips = [];
  G.shown = snap.shown; G.fullCount = snap.full; G.crateArrivals = snap.arrivals; G.combo = snap.combo;
  if (!free && G.undoLeft > 0) G.undoLeft--;
  // 重建木箱 / 托盘视图
  G.view.crates.clear(); G.view.vq = ST.crateQ.slice(0, S.visibleCrates).map(c => c.cid); { const q = new Set(ST.crateQ.map(c => c.cid)); G.crateDone = new Set(LV.crates.map((c, i) => i).filter(i => !q.has(i))); }
  for (const c of ST.crateQ.slice(0, S.visibleCrates)) { const v = ensureCrate(c.cid, false); v.items = (c.items || []).slice(); }
  G.view.tray = ST.tray.slice();
  for (const b of LV.blocks) { const m = SC.meshes[b.id]; SC.setOutline(b.id, false); SC.setGhost(b.id, 1); m.visible = ST.present[b.id]; if (!hadCollapse) SC.setBasePose(b.id); }
  sfx('Undo'); showTip('Rewind!', 1400, true); updateStatus();
  if (hadCollapse) await tween(S.rewindMs, k => SC.rewindStep(k), easeInOut);
  for (const b of LV.blocks) if (ST.present[b.id]) SC.setBasePose(b.id);
  G.rewinding = false; G.gen = gen; G.ghostId = -1;
}
function doUndo() {
  if (!G || G.rewinding || G.panel === 'win' || G.panel === 'end') return false;
  const snap = G.snaps.pop(); if (!snap) return false;
  if (G.undoLeft <= 0 && !G.over) { G.snaps.push(snap); return false; }
  undoTo(snap, !!G.over && S.failFreeUndo); return true;
}
function restartLevel() { buildGame(G.n); }

// ---------------- 手指 / 自动通关 ----------------
function resetHand() { HAND.x = W * 0.82; HAND.y = H * 1.15; HAND.press = 0; }
function handMoveTo(x, y, dur) {
  const fx = HAND.x, fy = HAND.y, dx = x - fx, dy = y - fy, dist = Math.hypot(dx, dy) || 1;
  const bend = (Math.random() < 0.5 ? -1 : 1) * S.curve * dist * rand(0.4, 1);
  const cx = (fx + x) / 2 - dy / dist * bend, cy = (fy + y) / 2 + dx / dist * bend;
  return tween(dur, k => { const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; HAND.x = a * fx + b * cx + c * x; HAND.y = a * fy + b * cy + c * y; }, easeInOut);
}
function addRipple(x, y) { if (G && S.tapRipple) G.ripples.push({ x, y, t0: performance.now() }); }
async function handPress(onDown, spd = 1) {
  await tween(90 / spd, k => { HAND.press = k; }, easeOut);
  addRipple(HAND.x, HAND.y);
  const r = onDown && onDown();
  await tween(130 / spd, k => { HAND.press = 1 - k; }, easeOut);
  return r;
}
function handState() {
  if (H5_NO_HAND) return null;
  if (!IMG.handImage || HAND.alpha <= 0.01) return null;
  if (endCardHidesHand()) return null;
  const im = IMG.handImage, w = W * S.handSize, h = w * im.height / im.width, p = HAND.press * S.pressDepth;
  return { x: HAND.x, y: HAND.y + p * h * 0.15, rot: S.handRotation, sx: (S.handFlip ? -1 : 1) * (1 - p * 0.5), sy: 1 - p * 0.6, alpha: HAND.alpha, press: HAND.press, w, h };
}
function drawHand(asset = null) {
  if (H5_NO_HAND) return; const q = asset || handState(); if (!q) return; const im = IMG.handImage;
  const ax = S.handAnchorX * q.w, ay = S.handAnchorY * q.h;
  ctx.save(); ctx.globalAlpha = q.alpha; ctx.translate(q.x, q.y); ctx.rotate(q.rot * Math.PI / 180); ctx.scale(q.sx, q.sy);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18 * U; ctx.shadowOffsetX = 8 * U * (1 - q.press); ctx.shadowOffsetY = 10 * U * (1 - q.press);
  ctx.drawImage(im, -ax, -ay, q.w, q.h); ctx.restore();
}
function stopAuto(silent) { AUTO.token++; if (AUTO.running) { AUTO.running = false; if (!silent) toast('已停止自动通关'); } updateButtons(); }
// 找到点中某块的屏幕点（必要时转动塔）
function clickPointFor(id) {
  const b = LV.blocks[id], m = SC.meshes[id]; m.updateWorldMatrix(true, false);
  const pts = [[0, b.hgt / 2, 0], [b.len * 0.3, b.hgt / 2, 0], [-b.len * 0.3, b.hgt / 2, 0], [b.len / 2, 0, 0], [-b.len / 2, 0, 0], [0, 0, b.wid / 2], [0, 0, -b.wid / 2], [b.len * 0.38, b.hgt / 2, 0], [-b.len * 0.38, b.hgt / 2, 0]];
  const ids = LV.blocks.filter(x => ST.present[x.id] && !G.pulling.has(x.id)).map(x => x.id);
  for (const p of pts) {
    const q = p.slice(); q[0] *= 0.94; q[2] *= 0.8;
    const sp = SC.project(new THREE.Vector3(q[0], q[1] + (q[1] ? 0.02 : 0), q[2]).applyMatrix4(m.matrixWorld));
    if (sp.x < 8 || sp.x > W - 8 || sp.y < H * 0.3 || sp.y > H * 0.93) continue;
    if (SC.pick(sp.x, sp.y, ids) === id) return { x: sp.x, y: sp.y };
  }
  return null;
}
function bestYawFor(id) {
  const ids = LV.blocks.filter(x => ST.present[x.id]).map(x => x.id), y0 = SC.yaw; let best = null;
  const saved = SC.yaw;
  for (let k = 0; k < 24; k++) {
    for (const sgn of k ? [1, -1] : [1]) {
      const yaw = y0 + sgn * k * Math.PI / 12; SC.setYaw(yaw); SC.tower.updateMatrixWorld(true);
      const p = clickPointFor(id); if (p) { SC.setYaw(saved); return { yaw, p }; }
    }
  }
  SC.setYaw(saved); return best;
}
async function autoSolve() {
  if (AUTO.running) { stopAuto(); return; }
  if (!G) return;
  const tok = ++AUTO.token; AUTO.running = true; updateButtons();
  const alive = () => tok === AUTO.token && AUTO.running;
  const spd = S.autoSpeed, failLv = String(S.autoFailLevels || '').split(',').map(x => +x.trim()).filter(Boolean);
  if (S.autoRec && !REC.rec) startRecording(true);
  HAND.visible = true; if (HAND.y > H) resetHand();
  let failDone = new Set();
  const settle = async () => { // 等动画空闲
    for (let i = 0; i < 400 && alive(); i++) { if (!G.flights.length && !G.pulling.size && !G.rewinding) break; await sleep(30); }
  };
  await sleep(Math.max(300, S.zoomIntro ? S.introMs * 0.6 : 0) / spd);
  while (alive()) {
    if (G.panel === 'win') { // 点 Next Level
      await sleep(rand(500, 900) / spd); if (!alive()) break;
      if (S.autoNext) { const P = panelRect(); await handMoveTo(P.bx, P.by, rand(S.moveMin, S.moveMax) / spd); if (!alive()) break; await handPress(() => { if (G.panel === 'win') nextLevel(); }, spd); await sleep(900 / spd); continue; }
      else break;
    }
    if (G.panel === 'end' || (G.cleared && !G.panel && !S.winPanel)) { if (G.panel === 'end' && S.endCardHand) { const b = endButtonRect(); await handMoveTo(b.x, b.y, 600 / spd); await handPress(null, spd); } break; }
    if (G.panel === 'fail' || G.panel === 'tray') {
      await sleep(700 / spd); if (!alive()) break; const P = panelRect(); await handMoveTo(P.bx, P.by, rand(S.moveMin, S.moveMax) / spd); if (!alive()) break;
      await handPress(() => { if (!doUndo()) restartLevel(); }, spd); await sleep(S.rewindMs + 500); continue;
    }
    if (G.over || G.rewinding || G.cleared) { await sleep(100); continue; }
    await settle(); if (!alive()) break;
    if (ST.present.every(x => !x)) { await sleep(150); continue; }
    // 计划：当前状态求解
    let plan = solve(LV, 60000, ST, S.autoPrefer, ST.moves + 1);
    if (!plan || !plan.length) { toast('当前局面无解（手动操作造成），请重新开始'); break; }
    let id = plan[0], forceFail = false;
    if (failLv.includes(G.n) && !failDone.has(G.n) && ST.cleared >= LV.blocks.length * 0.45) {
      const crit = [...critNow()].filter(x => ST.present[x]);
      if (crit.length) { id = crit[0]; forceFail = true; failDone.add(G.n); }
    }
    // 目标不可点：转塔
    let cp = clickPointFor(id);
    if (!cp) {
      const by = bestYawFor(id);
      if (by) {
        const y0 = SC.yaw, dyaw = by.yaw - y0; const sx = W * 0.5 + (dyaw > 0 ? -1 : 1) * W * 0.2, sy = H * 0.82;
        await handMoveTo(sx, sy, rand(S.moveMin, S.moveMax) / spd * 0.7); if (!alive()) break;
        await handPress(null, spd * 1.4); HAND.press = 1;
        await Promise.all([tween(Math.min(900, 280 + Math.abs(dyaw) * 300) / spd, k => { SC.setYaw(y0 + dyaw * k); UI.yawBase = SC.yaw; HAND.x = sx + (dyaw > 0 ? 1 : -1) * W * 0.4 * k; }, easeInOut)]);
        HAND.press = 0; if (!alive()) break; cp = clickPointFor(id);
      }
    }
    if (!cp) { SC.setOutline(id, false); const alt = plan.find(x => clickPointFor(x)); if (alt === undefined) { await sleep(100); stopAuto(true); toast('找不到可点击的积木'); break; } id = alt; cp = clickPointFor(id); }
    const jit = S.jitter * U;
    const tx = cp.x + rand(-jit, jit) * 0.3, ty = cp.y + rand(-jit, jit) * 0.3;
    await handMoveTo(tx, ty, rand(S.moveMin, S.moveMax) / spd); if (!alive()) break;
    if (Math.random() < S.thinkChance) await sleep(rand(100, S.thinkMax) / spd); if (!alive()) break;
    // 目标可能因动画期间变化而不可点：再确认
    const ok = await handPress(() => { const pid = SC.pick(HAND.x, HAND.y, LV.blocks.filter(x => ST.present[x.id] && !G.pulling.has(x.id)).map(x => x.id)); return tapBlock(pid >= 0 ? pid : id, true); }, spd);
    if (forceFail) { await sleep(300); }
    await sleep(rand(S.delayMin, S.delayMax) / spd);
  }
  if (AUTO.token === tok) { AUTO.running = false; updateButtons(); }
}

// ---------------- 输入 ----------------
function canvasPoint(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
function hitRect(p, x, y, w, h) { return Math.abs(p.x - x) <= w / 2 && Math.abs(p.y - y) <= h / 2; }
function handleClick(p) {
  if (!G) return;
  if (G.panel === 'end') { const b = endButtonRect(); if (hitRect(p, b.x, b.y, b.w, b.h) || true) triggerCTA(); return; }
  if (G.panel === 'win') { const P = panelRect(); if (hitRect(p, P.bx, P.by, P.bw, P.bh * 1.2)) nextLevel(); return; }
  if (G.panel === 'fail' || G.panel === 'tray') { const P = panelRect(); if (hitRect(p, P.bx, P.by, P.bw, P.bh * 1.2)) { if (S.failFreeUndo) doUndo(); else restartLevel(); } return; }
  for (const b of boosterLayout()) if (b.k === 'undo' && hitRect(p, b.x, b.y, 96 * U, 100 * U)) { UI.undoPress = performance.now(); sfx('Tap'); doUndo(); return; }
  if (G.topH > 5.5 && hitRect(p, 676 * U, bY(1395), 80 * U, 80 * U)) { UI.zoom = 1; refit(); return; }
  if (G.over || G.rewinding) return;
  const ids = LV.blocks.filter(b => ST.present[b.id] && !G.pulling.has(b.id)).map(b => b.id);
  const id = SC.pick(p.x, p.y, ids);
  if (id >= 0) tapBlock(id);
}
function triggerCTA() { try { if (H5_NO_HAND) { if (typeof window.openAppStore === 'function') window.openAppStore(); else if (window.__h5Cta) window.__h5Cta(); } } catch (e) { } }
canvas.addEventListener('pointermove', e => {
  const p = canvasPoint(e);
  if (UI.ptrs.has(e.pointerId)) {
    const o = UI.ptrs.get(e.pointerId), dx = p.x - o.lx, dy = p.y - o.ly; o.lx = p.x; o.ly = p.y; o.moved += Math.abs(dx) + Math.abs(dy);
    if (UI.ptrs.size === 2) {
      const [a, b] = [...UI.ptrs.values()], d = Math.hypot(a.lx - b.lx, a.ly - b.ly); if (UI.pinch0) { UI.zoom = clamp(UI.pinch0.z * d / UI.pinch0.d, S.zoomMin, S.zoomMax); refit(); }
    } else if (o.moved > 10 * U && !o.onUI && !AUTO.running) { G.swiped = true; G.tips = G.tips.filter(t => !/Swipe/.test(t.text)); SC.setYaw(SC.yaw + dx * 0.0085 * S.rotateSpeed * (720 / W) * U); UI.yawBase = SC.yaw; }
  }
  if (AUTO.running || !S.manualHand) return;
  HAND.x = p.x; HAND.y = p.y; HAND.visible = true; if (S.hideCursor) HAND.alpha = 1;
});
canvas.addEventListener('pointerleave', () => { if (!AUTO.running) HAND.visible = false; });
canvas.addEventListener('pointerdown', e => {
  if (AUTO.running) return;
  const p = canvasPoint(e); resumeAudio();
  try { canvas.setPointerCapture(e.pointerId); } catch (er) { }
  UI.ptrs.set(e.pointerId, { lx: p.x, ly: p.y, sx: p.x, sy: p.y, moved: 0, t0: performance.now() });
  if (UI.ptrs.size === 2) { const [a, b] = [...UI.ptrs.values()]; UI.pinch0 = { d: Math.hypot(a.lx - b.lx, a.ly - b.ly) || 1, z: UI.zoom }; for (const o of UI.ptrs.values()) o.moved = 1e6; }
  if (S.manualHand) { HAND.x = p.x; HAND.y = p.y; HAND.visible = true; if (S.hideCursor) HAND.alpha = 1; tween(90, k => { HAND.press = k; }, easeOut).then(() => tween(130, k => { HAND.press = 1 - k; }, easeOut)); }
  else addRipple(p.x, p.y);
});
function endPtr(e) {
  const o = UI.ptrs.get(e.pointerId); if (!o) return; UI.ptrs.delete(e.pointerId); if (UI.ptrs.size < 2) UI.pinch0 = null;
  if (e.type === 'pointerup' && o.moved < 12 * U && !AUTO.running) handleClick(canvasPoint(e));
}
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); if (!G) return; UI.zoom = clamp(UI.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), S.zoomMin, S.zoomMax); refit(); }, { passive: false });

// ---------------- 主循环 ----------------
let lastFrame = performance.now();
function frame() {
  try { frameBody(); } catch (e) { if (!frame.err) { frame.err = 1; console.error('frame error', e); } }
  requestAnimationFrame(frame);
}
function frameBody() {
  const now = performance.now(), dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; const k = Math.min(1, (now - tw.t0) / tw.dur); tw.fn(tw.ease(k), k); if (k >= 1) { tweens.splice(i, 1); tw.res(); } }
  FRAME = { items: [], tower: -1 };
  if (G) {
    if (SC.collapse) {
      SC.stepPhysics(dt);
      const ck = clamp((now - (G.collapseT0 || now)) / 700, 0, 1); G.colK = lerp(1, S.collapseZoom, easeOut(ck));
      if (G.ghostId >= 0) SC.setGhostAlpha && SC.setGhostAlpha(G.ghostId, S.ghostAlpha * (1 - clamp((now - G.collapseT0) / 900, 0, 1)));
    } else if (G.colK && G.colK !== 1) G.colK += (1 - G.colK) * Math.min(1, dt * 5);
    if (S.idleSpin && !UI.ptrs.size && !G.over && !AUTO.running) { SC.setYaw(SC.yaw + S.idleSpin * Math.PI / 180 * dt); }
    refit();
    G.lastDraw = G.lastDraw || now;
  }
  updateCursor();
  if (endCardHidesHand(now)) { HAND.visible = false; HAND.alpha = 0; } else HAND.alpha += ((HAND.visible ? 1 : 0) - HAND.alpha) * Math.min(1, dt * 12);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(); FRAME.items.push({ id: 'bg', bg: true });
  if (G) {
    if (G.shake) { const k = (now - G.shake.t0) / 260; if (k >= 1) G.shake = null; else { const a = G.shake.amp * U * (1 - k); ctx.setTransform(1, 0, 0, 1, Math.sin(k * 70) * a, Math.cos(k * 53) * a * 0.6); } }
    SC.renderer.render(SC.scene, SC.camera);
    ctx.drawImage(glCanvas, 0, 0, W, H); FRAME.tower = FRAME.items.length; FRAME.items.push({ id: 'tower', tower: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!G.panel || G.panel !== 'end') {
      if (!(G.panel === 'win' || G.panel === 'fail' || G.panel === 'tray')) drawHud(now); drawCrates(now); drawTray(now); drawBoosters(now);
      drawTips(now); drawParts(now); drawFlights(now); drawFloaters(now);
      drawPanelOverlay(now);
    }
    drawEndCard(now);
    G.lastDraw = now;
    // 点击波纹
    G.ripples = G.ripples.filter(r => now - r.t0 < S.rippleDuration);
    for (const r of G.ripples) { const k = (now - r.t0) / S.rippleDuration; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = S.rippleColor; ctx.lineWidth = S.rippleWidth * U; ctx.beginPath(); ctx.arc(r.x, r.y, W * S.rippleSize * (0.3 + 0.7 * k), 0, 7); ctx.stroke(); ctx.restore(); }
  }
  drawHand();
  if (REC.rec) updateRecTime();
  if (AE.active()) { AE.sample(now, FRAME); updateAEButtons(); }
}

// ---------------- 录制 ----------------
function pickMime(audio = false) {
  const mp4 = [...(audio ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus'] : []), 'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
  const webm = [...(audio ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'] : []), 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const order = S.recFormat === 'webm' ? webm.concat(mp4) : S.recFormat === 'mp4' ? mp4.concat(webm) : mp4.concat(webm);
  return order.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
function startRecording(auto = false) {
  if (REC.rec) return;
  if (!window.MediaRecorder || !canvas.captureStream) { toast('当前浏览器不支持录制'); return; }
  const stream = canvas.captureStream(+S.recFps); resumeAudio();
  const at = audioTrack(); if (at) stream.addTrack(at);
  const mime = pickMime(!!at); let rec;
  try { rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: Math.round(S.recBitrate * 1e6), audioBitsPerSecond: 128000 }); }
  catch (e) { toast('录制启动失败：' + e.message); return; }
  REC.rec = rec; REC.chunks = []; REC.mime = rec.mimeType || mime; REC.t0 = performance.now(); REC.auto = auto;
  REC.ae = false; if (S.aeWithRec && !AE.active()) { aeStart(); REC.ae = true; }
  rec.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  rec.onstop = () => {
    const type = REC.mime || 'video/webm', blob = new Blob(REC.chunks, { type }), ext = type.includes('mp4') ? 'mp4' : 'webm';
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const name = `blocktower_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${W}x${H}.${ext}`;
    const url = URL.createObjectURL(blob); REC.list.unshift({ name, url, size: blob.size }); window.__lastRecording = { name, url, size: blob.size, type };
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    REC.rec = null; renderRecList(); updateButtons();
    if (REC.ae && AE.active()) { REC.ae = false; aeStopAndExport(); }
    toast(`录制完成：${name}（${(blob.size / 1048576).toFixed(1)} MB）`);
  };
  rec.start(250); updateButtons(); toast('开始录制（' + (REC.mime || 'default') + '）');
}
function stopRecording() { if (REC.rec && REC.rec.state !== 'inactive') REC.rec.stop(); }

// ---------------- 面板 ----------------
const panelBody = $('#panelBody'), controls = {};
let regenTimer = 0;
function scheduleRegen() { clearTimeout(regenTimer); regenTimer = setTimeout(() => newGame(true), 180); }
function themeDiff(id) { const d = themeDefaults(DEFAULTS, id), o = {}; for (const k of THEME_KEYS) if (JSON.stringify(S[k]) !== JSON.stringify(d[k])) o[k] = S[k]; return o; }
function setTheme(id) {
  if (!THEMES[id]) id = 'woodtown'; const old = S.theme || 'woodtown';
  if (id !== old) { S.themeStore = { ...(S.themeStore || {}), [old]: themeDiff(old) }; Object.assign(S, themeDefaults(DEFAULTS, id), S.themeStore[id] || {}); S.theme = id; }
  refreshTheme();
}
function resetTheme() { Object.assign(S, themeDefaults(DEFAULTS, S.theme)); S.themeStore = { ...(S.themeStore || {}) }; delete S.themeStore[S.theme]; refreshTheme(); toast('已恢复「' + THEMES[S.theme].name + '」主题默认外观'); }
function refreshTheme() { ART.setPalette(S); if (G) { SC.build(LV, S); SC.present = ST.present; syncBlocksVisual(); refit(true); } saveSettings(); syncPanel(); }
function syncBlocksVisual() { for (const b of LV.blocks) { const m = SC.meshes[b.id]; m.visible = ST.present[b.id] && !G.pulling.has(b.id) || (G.over === 'fell' && ST.present[b.id]); } }
function onSetting(item, v) {
  if (item.k === 'theme') { setTheme(v); return; }
  if (item.k === 'h5Device') { S.h5Device = v; applyH5DevicePresetToSettings(S); saveSettings(); syncPanel(); try { if (window.__h5EditorDeviceFit) window.__h5EditorDeviceFit(); } catch (e) { } return; }
  if (item.k === 'h5DeviceW' || item.k === 'h5DeviceH') { S[item.k] = v; markH5DeviceCustomIfSizeEdited(S); saveSettings(); syncPanel(); try { if (window.__h5EditorDeviceFit) window.__h5EditorDeviceFit(); } catch (e) { } return; }
  S[item.k] = v; saveSettings();
  if (item.type === 'file') loadImg(item.k);
  if (item.kind === 'regen') scheduleRegen();
  else if (item.kind === 'mesh') { if (G) { SC.build(LV, S); SC.present = ST.present; syncBlocksVisual(); refit(true); } }
  else if (item.kind === 'art') { ART.setPalette(S); if (G && /^col_/.test(item.k)) { SC.build(LV, S); syncBlocksVisual(); } }
  else if (item.kind === 'res') { if (REC.rec) { toast('录制中不能修改分辨率'); return; } setResolution(); newGame(true); }
  else { if (G && ['camElev', 'camFov', 'fitMargin', 'fitTall', 'towerY'].includes(item.k)) refit(true); if (['lightIntensity'].includes(item.k) && G) SC.applyLights(S); }
  if (item.k.startsWith('hand')) drawHandPreview();
  if (item.k === 'manualHand' || item.k === 'hideCursor') updateCursor();
}
function fmt(v, step) { return step && step < 1 ? (+v).toFixed(String(step).split('.')[1].length) : v; }
function buildPanel() {
  panelBody.innerHTML = '';
  for (const grp of SCHEMA) {
    const det = document.createElement('details'); if (grp.open) det.open = true;
    const sum = document.createElement('summary'); sum.textContent = grp.group; det.appendChild(sum);
    for (const it of grp.items) {
      const row = document.createElement('div'); row.className = 'row';
      const lab = document.createElement('label'); lab.textContent = it.label; row.appendChild(lab);
      let el, val;
      if (it.type === 'range') {
        el = document.createElement('input'); el.type = 'range'; el.min = it.min; el.max = it.max; el.step = it.step;
        val = document.createElement('input'); val.type = 'number'; val.className = 'val'; val.step = it.step;
        el.oninput = () => { val.value = fmt(el.value, it.step); onSetting(it, +el.value); };
        val.onchange = () => { el.value = val.value; onSetting(it, +val.value); };
        row.appendChild(el); row.appendChild(val);
      } else if (it.type === 'number') {
        el = document.createElement('input'); el.type = 'number'; el.onchange = () => onSetting(it, +el.value); row.appendChild(el);
        if (it.k === 'seed') { const b = document.createElement('button'); b.textContent = '随机'; b.onclick = () => newGame(false); row.appendChild(b); }
      } else if (it.type === 'color') { el = document.createElement('input'); el.type = 'color'; el.oninput = () => onSetting(it, el.value); row.appendChild(el); }
      else if (it.type === 'checkbox') { el = document.createElement('input'); el.type = 'checkbox'; el.onchange = () => onSetting(it, el.checked); row.appendChild(el); }
      else if (it.type === 'switch') {
        el = document.createElement('input'); el.type = 'checkbox'; el.className = 'switch-input';
        const wrap = document.createElement('label'); wrap.className = 'switch'; const slider = document.createElement('span'); slider.className = 'slider'; wrap.appendChild(el); wrap.appendChild(slider);
        el.onchange = () => onSetting(it, el.checked); row.appendChild(wrap);
      } else if (it.type === 'select') {
        el = document.createElement('select'); it.options.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; el.appendChild(o); });
        el.onchange = () => onSetting(it, it.num ? +el.value : el.value); row.appendChild(el);
      } else if (it.type === 'text') { el = document.createElement('input'); el.type = 'text'; if (it.placeholder) el.placeholder = it.placeholder; el.onchange = () => onSetting(it, el.value); row.appendChild(el); }
      else if (it.type === 'textarea') { el = document.createElement('textarea'); el.rows = 2; el.oninput = () => onSetting(it, el.value); row.appendChild(el); }
      else if (it.type === 'button') {
        el = document.createElement('button'); el.textContent = it.text || '▶ 试听'; if (it.action) el.id = 'btn_' + it.action;
        el.onclick = it.action ? () => BUTTON_ACTIONS[it.action]() : () => { resumeAudio().then(() => SFX_NAMES.forEach((n, i) => setTimeout(() => sfx(n), i * 700))); };
        row.appendChild(el);
      } else if (it.type === 'file') {
        el = document.createElement('input'); el.type = 'file'; el.accept = 'image/*';
        el.onchange = () => { const f = el.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => onSetting(it, fr.result); fr.readAsDataURL(f); };
        const clr = document.createElement('button'); clr.textContent = it.k === 'handImage' ? '清除已上传手指' : '清除'; if (it.k === 'handImage') clr.id = 'btnClearHand'; clr.onclick = () => { el.value = ''; onSetting(it, ''); };
        row.appendChild(el); row.appendChild(clr);
      }
      row.classList.add('t-' + it.type); controls[it.k] = { it, el, val }; det.appendChild(row);
      if (it.k === 'handImage') { const pr = document.createElement('div'); pr.className = 'row handprev'; pr.innerHTML = '<label>手指预览（点击图片设置指尖锚点）</label><canvas id="handPrev" width="150" height="190"></canvas>'; det.appendChild(pr); }
    }
    if (grp.group.startsWith('导出 H5')) det.insertAdjacentHTML('beforeend', '<div class="tip">预览与导出均按所选机型/自定义尺寸；选「自适应」才是全机型 contain/letterbox。指定机型时设计画幅锁定为该分辨率。</div>');
    panelBody.appendChild(det);
  }
  syncPanel();
  const hp = $('#handPrev');
  hp.addEventListener('click', e => {
    const im = IMG.handImage; if (!im) return; const r = hp.getBoundingClientRect(), box = handPrevBox();
    const x = (e.clientX - r.left) * hp.width / r.width, y = (e.clientY - r.top) * hp.height / r.height;
    S.handAnchorX = clamp((x - box.x) / box.w, 0, 1); S.handAnchorY = clamp((y - box.y) / box.h, 0, 1); saveSettings(); syncPanel(); drawHandPreview();
  });
}
function handPrevBox() { const hp = $('#handPrev'), im = IMG.handImage; const k = Math.min(hp.width / im.width, hp.height / im.height); return { x: (hp.width - im.width * k) / 2, y: (hp.height - im.height * k) / 2, w: im.width * k, h: im.height * k }; }
function drawHandPreview() {
  const hp = $('#handPrev'); if (!hp) return; const c = hp.getContext('2d'); c.clearRect(0, 0, hp.width, hp.height); c.fillStyle = '#333'; c.fillRect(0, 0, hp.width, hp.height);
  if (!IMG.handImage) { c.fillStyle = '#999'; c.font = '13px sans-serif'; c.textAlign = 'center'; c.fillText('未上传手指图片', hp.width / 2, hp.height / 2 - 10); c.fillText('（不显示手指）', hp.width / 2, hp.height / 2 + 10); return; }
  const b = handPrevBox(); c.drawImage(IMG.handImage, b.x, b.y, b.w, b.h);
  const x = b.x + S.handAnchorX * b.w, y = b.y + S.handAnchorY * b.h; c.strokeStyle = '#0f0'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + 8, y); c.moveTo(x, y - 8); c.lineTo(x, y + 8); c.stroke(); c.beginPath(); c.arc(x, y, 5, 0, 7); c.stroke();
}
function syncPanel() {
  for (const k in controls) { const { it, el, val } = controls[k]; const v = S[k]; if (it.type === 'checkbox' || it.type === 'switch') el.checked = !!v; else if (it.type === 'file' || it.type === 'button') { } else el.value = v; if (val) val.value = fmt(v, it.step); }
}
function updateButtons() {
  $('#btnAuto').textContent = AUTO.running ? '⏹ 停止自动通关' : '▶ 自动通关'; $('#btnAuto').classList.toggle('on', AUTO.running);
  $('#btnRec').textContent = REC.rec ? '⏹ 停止录制' : '⏺ 开始录制'; $('#btnRec').classList.toggle('on', !!REC.rec);
}
function updateRecTime() { $('#recInfo').textContent = `录制中 ${((performance.now() - REC.t0) / 1000).toFixed(1)}s · ${REC.mime.split(';')[0]} · ${W}×${H}@${S.recFps}`; }
function renderRecList() {
  const box = $('#recList'); box.innerHTML = ''; $('#recInfo').textContent = REC.list.length ? '' : '尚无录制';
  REC.list.forEach(r => { const a = document.createElement('a'); a.href = r.url; a.download = r.name; a.textContent = `⬇ ${r.name} (${(r.size / 1048576).toFixed(1)}MB)`; box.appendChild(a); });
}
let toastTimer = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
$('#btnNew').onclick = () => newGame(true, G ? G.n : null);
$('#btnSeed').onclick = () => newGame(false, G ? G.n : null);
$('#btnAuto').onclick = () => { resumeAudio(); autoSolve(); };
$('#btnRec').onclick = () => REC.rec ? stopRecording() : startRecording(false);
$('#btnShot').onclick = () => canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'blocktower_screenshot.png'; a.click(); });
$('#btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify({ app: 'block-tower-tool', version: SETTINGS_VERSION, settings: S }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blocktower-settings.json'; a.click();
};
function importJSON(txt) { const j0 = JSON.parse(txt), j = j0 && j0.settings ? j0.settings : j0; if ('handImage' in j && j.handImage && !/^data:image\//.test(j.handImage)) j.handImage = ''; S = { ...DEFAULTS, ...themeDefaults(DEFAULTS, j.theme), ...j }; applyAll(); }
$('#btnImport').onclick = () => $('#importFile').click();
$('#importFile').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(txt => { try { importJSON(txt); toast('设置已导入'); } catch (err) { toast('导入失败：' + err.message); } }); e.target.value = ''; };
$('#btnReset').onclick = () => { if (!confirm('确定恢复全部默认设置？')) return; S = { ...DEFAULTS, ...themeDefaults(DEFAULTS, S.theme), theme: S.theme, themeStore: {} }; applyAll(); toast('已恢复默认'); };
function applyAll() { ART.setPalette(S); saveSettings(); syncPanel(); ['handImage', 'h5Icon', 'endIcon'].forEach(loadImg); setResolution(); newGame(true, null); }

// ---------------- 导出 AE / 3D / H5 ----------------
const AE = createAERecorder({
  env: () => ({ S, G, W, H, U, IMG }),
  handState,
  withCtx(c2d, fn) { const old = ctx; ctx = c2d; try { fn(); } finally { ctx = old; } },
  drawBackground: () => { const o = FRAME; FRAME = { items: [], tower: -1 }; try { drawBackground(); } finally { FRAME = o; } },
  towerShot(sc) { const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc); c.getContext('2d').drawImage(glCanvas, 0, 0, c.width, c.height); return c; },
  poses: () => SC.poses(), camera: () => SC.cameraState(),
  blocksInfo: () => LV.blocks.map(b => ({ id: b.id, len: b.len, wid: b.wid, hgt: b.hgt, color: b.color })),
  endButtonRect,
});
let aeLastRec = null;
function aeStart() { AE.start(); updateAEButtons(); toast('开始记录 AE 时间轴'); }
async function aeStopAndExport() {
  const rec = AE.stop(); updateAEButtons();
  if (!rec || !rec.frames) { toast('没有记录到内容'); return null; }
  aeLastRec = rec; return aeExport(rec);
}
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); return url; }
async function aeExport(rec = aeLastRec) {
  if (!rec) { toast('请先记录一段（自动通关或手动游玩）'); return null; }
  toast('正在生成 AE 工程包…');
  try {
    const r = await AE.exportZip(S, rec), url = downloadBlob(r.blob, r.name);
    window.__lastAEExport = { name: r.name, url, size: r.blob.size, stats: r.stats, snaps: r.snaps };
    toast(`AE 工程已导出：${r.name}（${(r.blob.size / 1048576).toFixed(1)} MB，${r.stats.layers} 个图层）`);
    return window.__lastAEExport;
  } catch (e) { console.error(e); toast('导出失败：' + e.message); return null; }
}
async function export3DZip(rec = aeLastRec) {
  if (!rec) { toast('请先用“开始记录”记录一段（自动通关或手动游玩）'); return null; }
  toast('正在生成 3D 动画包（glTF）…');
  try {
    const r = await export3D({ S, rec, api: SC }), url = downloadBlob(r.blob, r.name);
    window.__last3DExport = { name: r.name, url, size: r.blob.size, stats: r.stats, duration: r.duration, fps: r.fps, glbSize: r.glbSize };
    toast(`3D 动画已导出：${r.name}（${(r.blob.size / 1048576).toFixed(1)} MB，${r.stats.blocks} 块）`);
    return window.__last3DExport;
  } catch (e) { console.error(e); toast('3D 导出失败：' + e.message); return null; }
}
async function exportH5Zip() {
  try { return await exportH5PlayableFromPage({ toolId: 'block-tower-tool', S, stripDataUrls: [__H5_DEFAULT_HAND], status: m => toast(m), toast }); }
  catch (e) { console.error(e); toast('H5 导出失败：' + e.message); return null; }
}
const BUTTON_ACTIONS = { export3d: () => export3DZip(), exportH5: () => exportH5Zip(), aeToggle: () => AE.active() ? aeStopAndExport() : aeStart(), aeExport: () => aeExport(), resetTheme: () => resetTheme() };
function updateAEButtons() {
  const b = document.getElementById('btn_aeToggle'); if (!b) return;
  b.textContent = AE.active() ? `■ 停止并导出（${AE.elapsed().toFixed(1)}s）` : '● 开始记录'; b.classList.toggle('on', AE.active());
}

window.__app = {
  setTheme, resetTheme, THEMES, get theme() { return S.theme; }, AE, aeStart, aeStopAndExport, aeExport, export3DZip, exportH5Zip, get aeLastRec() { return aeLastRec; },
  get S() { return S; }, get G() { return G; }, get LV() { return LV; }, get ST() { return ST; }, get HAND() { return HAND; }, get AUTO() { return AUTO; }, get REC() { return REC; }, SC, THREE,
  setSetting(k, v) { const it = SCHEMA.flatMap(g => g.items).find(i => i.k === k); if (it) { onSetting(it, v); syncPanel(); } else S[k] = v; },
  newGame, autoSolve, stopAuto, startRecording, stopRecording, tapBlock, clickPointFor, importJSON, audioState, sfx, resumeAudio, handleClick, doUndo, nextLevel, restartLevel, handState, endCardState, endCardHidesHand, endButtonRect, panelRect, boosterLayout, critNow, toast,
  core: { LEVELS, applyPull, pullOutcome, criticalSet, solve, newState, matchCrate },
  get tweenCount() { return tweens.length; }, get pulling() { return G ? [...G.pulling] : []; },
  idle: () => !!G && !G.evBusy && !G.flights.length && !G.pulling.size && !G.rewinding && !tweens.length,
};
const __h5 = applyPlayableMode({
  applySettings: ps => { Object.assign(S, ps); },
  autoPlay: () => { try { autoSolve(); } catch (e) { } },
  state: () => { try { return G ? JSON.stringify([G.n, ST.present.map(x => +x), ST.tray, ST.crateQ.map(c => c.fill && c.fill.length), G.over, G.panel]) : ''; } catch (e) { return ''; } },
  isEnded: () => { try { return !!(G && (G.panel === 'end' || G.panel === 'win' || G.panel === 'fail' || G.panel === 'tray')); } catch (e) { return false; } },
  onResize: () => { },
});
if (__h5) { try { const panel = document.getElementById('panel'); if (panel) panel.style.display = 'none'; } catch (e) { } }
if (!__h5) bindEditorDevicePreview(() => S);
buildPanel(); drawHandPreview(); setResolution(); resetHand(); newGame(true); renderRecList(); updateButtons();
requestAnimationFrame(frame);
loadFonts().then(() => { window.__fontsReady = true; ART.clearArt(); if (G) { G.fitKey = null; } });
