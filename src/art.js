// 积木塔 · 2D 素材（木箱 / 托盘 / 积木图标 / 顶栏 / 按钮 / 弹窗…）。全部程序绘制，按 key 缓存；AE 导出直接取同一份素材。
import { PALETTE } from './core.js';
import { FONT } from './fonts.js';
export const AS = 2; // 素材超采样
const cache = new Map();
export function clearArt() { cache.clear(); }
export function hexRgb(h) { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function shade(h, k) { const [r, g, b] = hexRgb(h); return k >= 0 ? rgbHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : rgbHex(r * (1 + k), g * (1 + k), b * (1 + k)); }
export function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
export function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// 颜色表（可被设置 / 主题覆盖）
let PAL = {};
export function setPalette(S) {
  PAL = {};
  for (const k of Object.keys(PALETTE)) {
    const base = PALETTE[k], main = S['col_' + k] || base.main;
    PAL[k] = { ...base, main, light: shade(main, 0.3), dark: shade(main, -0.28), sc: shade(main, -0.55), sym: base.sym };
  }
  clearArt();
}
export const pal = k => PAL[k] || PALETTE[k];
setPalette({});

export function mk(w, h, fn, ox = w / 2, oy = h / 2) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * AS); c.height = Math.ceil(h * AS);
  const g = c.getContext('2d'); g.scale(AS, AS); fn(g, w, h);
  return { canvas: c, w, h, ox, oy };
}
function memo(key, fn) { let a = cache.get(key); if (!a) { a = fn(); a.key = key; cache.set(key, a); } return a; }

// ---- 符号 ----
export function drawSym(g, sym, cx, cy, r, o = {}) {
  const fill = o.fill || '#fff', stroke = o.stroke || null, lw = o.lw || r * 0.28;
  g.save(); g.translate(cx, cy); g.fillStyle = fill; g.strokeStyle = stroke || fill; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath();
  if (sym === 'dot') { g.arc(0, 0, r, 0, 7); g.fill(); }
  else if (sym === 'ring') { g.arc(0, 0, r * 0.82, 0, 7); g.stroke(); }
  else if (sym === 'diamond') { g.moveTo(0, -r * 1.15); g.lineTo(r * 0.8, 0); g.lineTo(0, r * 1.15); g.lineTo(-r * 0.8, 0); g.closePath(); g.fill(); }
  else if (sym === 'square') { rr(g, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.22); g.fill(); }
  else if (sym === 'plus') { const t = r * 0.38; g.moveTo(-t, -r); g.lineTo(t, -r); g.lineTo(t, -t); g.lineTo(r, -t); g.lineTo(r, t); g.lineTo(t, t); g.lineTo(t, r); g.lineTo(-t, r); g.lineTo(-t, t); g.lineTo(-r, t); g.lineTo(-r, -t); g.lineTo(-t, -t); g.closePath(); g.fill(); }
  else if (sym === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.46 : r * 1.12; g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath(); g.fill(); }
  g.restore();
}

// ---- 积木图标（箱内 / 托盘内的“方块”：圆角矩形 + 白色符号） ----
export function tileAsset(color) {
  return memo('tile|' + color, () => { const P = pal(color); return mk(46, 70, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.light); gr.addColorStop(0.18, P.main); gr.addColorStop(1, P.dark);
    rr(g, 1, 1, w - 2, h - 2, 8); g.fillStyle = gr; g.fill(); g.lineWidth = 1.5; g.strokeStyle = P.dark; g.stroke();
    g.globalAlpha = 0.35; rr(g, 4, 4, w - 8, h * 0.28, 5); g.fillStyle = '#fff'; g.fill(); g.globalAlpha = 1;
    g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 2; g.shadowOffsetY = 1.2;
    drawSym(g, P.sym, w / 2, h * 0.5, 11, { fill: '#fff', lw: 3.4 });
  }); });
}
// 飞行中的“木条”：3:1 的木纹长条（带端面符号）
export function plankAsset(color) {
  return memo('plank|' + color, () => { const P = pal(color); return mk(180, 60, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.light); gr.addColorStop(0.25, P.main); gr.addColorStop(1, P.dark);
    rr(g, 2, 2, w - 4, h - 4, 12); g.fillStyle = gr; g.fill(); g.lineWidth = 2.5; g.strokeStyle = P.dark; g.stroke();
    g.save(); rr(g, 2, 2, w - 4, h - 4, 12); g.clip(); g.strokeStyle = shade(P.main, -0.18); g.globalAlpha = 0.35; g.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) { const y = 8 + i * 8; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (i % 2 ? 4 : -4), w * 0.6, y + (i % 2 ? -3 : 3), w, y + 1); g.stroke(); } g.restore();
    g.globalAlpha = 1; drawSym(g, P.sym, w - 26, h / 2, 10, { fill: P.sc, lw: 3 });
  }); });
}

// ---- 木箱 ----
export const CRATE = { w: 160, h: 130 };
export function crateAsset(color) {
  return memo('crate|' + color, () => { const P = pal(color); return mk(CRATE.w, CRATE.h, (g, w, h) => {
    // 底座深色
    rr(g, 0, 22, w, h - 22, 8); g.fillStyle = P.dark; g.fill();
    // 主体
    const gr = g.createLinearGradient(0, 0, 0, h - 18); gr.addColorStop(0, P.light); gr.addColorStop(0.12, P.main); gr.addColorStop(1, P.main);
    rr(g, 0, 0, w, h - 18, 8); g.fillStyle = gr; g.fill();
    g.lineWidth = 2; g.strokeStyle = shade(P.main, -0.12); g.stroke();
    // 木纹（边框 + 前板：彩漆木板，清晰起伏纹理）
    { let sd = color.length * 7 + 3; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      g.save(); rr(g, 0, 0, w, h - 18, 8); g.clip();
      for (let i = 0; i < 22; i++) { const y = 2 + i * ((h - 20) / 22) + rn() * 3, a1 = (rn() - 0.5) * 7, a2 = (rn() - 0.5) * 7; g.beginPath(); g.moveTo(-4, y); g.bezierCurveTo(w * 0.3, y + a1, w * 0.65, y + a2, w + 4, y + (a1 - a2) * 0.3); g.strokeStyle = rn() < 0.55 ? 'rgba(255,255,255,0.20)' : shade(P.dark, -0.1) + '55'; g.lineWidth = 0.8 + rn() * 1.8; g.stroke(); }
      g.restore();
      g.save(); g.beginPath(); g.rect(0, h - 56, w, 38); g.clip();
      for (let i = 0; i < 7; i++) { const y = h - 54 + i * 5.5 + rn() * 2; g.beginPath(); g.moveTo(-4, y); g.bezierCurveTo(w * 0.3, y - 2.5, w * 0.6, y + 2.5, w + 4, y - 1); g.strokeStyle = rn() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)'; g.lineWidth = 1 + rn() * 1.4; g.stroke(); }
      g.restore(); }
    // 前下沿浅色板
    g.globalAlpha = 0.5; g.fillStyle = P.light; g.fillRect(0, h - 56, w, 3); g.globalAlpha = 1;
    // 内窗（深色）
    const inner = mix(mix(P.main, '#2b1a0e', 0.55), '#000000', 0.25);
    rr(g, 7, 11, w - 14, 78, 5); g.fillStyle = mix(mix(P.dark, '#2b1a0e', 0.5), '#000', 0.35); g.fill();
    rr(g, 9, 13, w - 18, 74, 4); g.fillStyle = inner; g.fill();
    const sw = (w - 18) / 3;
    for (let i = 0; i < 3; i++) {
      const x = 9 + i * sw;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + sw - 1.5, 13, 3, 74);
      g.globalAlpha = 0.75; drawSym(g, P.sym, x + sw / 2, 50, 7.6, { fill: mix(P.main, '#8a5a2a', 0.25), lw: 2.6 }); g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,245,225,0.10)'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
  }); });
}
export const CRATE_SLOT = (i) => ({ x: 9 + (CRATE.w - 18) / 6 + i * (CRATE.w - 18) / 3, y: 13 + 37 }); // 槽位中心（素材内坐标，相对左上）

// ---- 托盘 ----
export const TRAY = { w: 308, h: 118 };
export function trayAsset(n = 5) {
  return memo('tray|' + n, () => mk(TRAY.w, TRAY.h, (g, w, h) => {
    rr(g, 0, 0, w, h, 6); g.fillStyle = '#e0ab6e'; g.fill();
    const gr = g.createLinearGradient(0, 0, 0, h - 36); gr.addColorStop(0, '#fcd596'); gr.addColorStop(1, '#f4c27e');
    rr(g, 0, 0, w, h - 18, 6); g.fillStyle = gr; g.fill();
    g.fillStyle = '#fbd9a0'; g.fillRect(0, h - 40, w, h - (h - 40) - 18);
    g.fillStyle = '#e9b673'; g.fillRect(0, h - 40, w, 3);
    g.save(); g.globalAlpha = 0.18; g.strokeStyle = '#a8683a'; g.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { const y = h - 32 + i * 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y - 2, w * 0.6, y + 2, w, y); g.stroke(); } g.restore();
    const sw = (w - 14) / n;
    for (let i = 0; i < n; i++) {
      const x = 8 + i * sw + 3;
      rr(g, x, 9, sw - 6, h - 58, 5); g.fillStyle = '#71563a'; g.fill();
      rr(g, x + 1.5, 12, sw - 9, h - 62, 4); g.fillStyle = '#7d5f40'; g.fill();
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + 1.5, 12, sw - 9, 5);
    }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(3, 3, w - 6, 2.5);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(70,35,0,0.12)'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
  }));
}
export const TRAY_SLOT = (i, n = 5) => { const sw = (TRAY.w - 14) / n; return { x: 8 + i * sw + sw / 2, y: 9 + (TRAY.h - 58) / 2 + 1, w: sw - 8, h: TRAY.h - 62 }; };

// ---- 文字（带描边） ----
export function textAsset(str, o = {}) {
  const size = o.size || 40, fill = o.fill || '#fff', stroke = o.stroke === undefined ? '#3a210f' : o.stroke, sw = o.sw ?? size * 0.16, shadow = o.shadow ?? true;
  const key = ['text', str, size, fill, stroke, sw, shadow, o.grad || ''].join('|');
  return memo(key, () => {
    const m = document.createElement('canvas').getContext('2d'); m.font = `800 ${size}px ${FONT}`;
    const tw = Math.ceil(m.measureText(str).width + sw * 2 + 8), th = Math.ceil(size * 1.5 + sw * 2 + 6);
    return mk(tw, th, (g, w, h) => {
      g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const cy = h / 2 + size * 0.06;
      if (shadow) { g.fillStyle = 'rgba(0,0,0,.28)'; if (stroke && sw) { g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = sw * 2; g.strokeText(str, w / 2, cy + size * 0.07); } g.fillText(str, w / 2, cy + size * 0.07); }
      if (stroke && sw) { g.strokeStyle = stroke; g.lineWidth = sw * 2; g.strokeText(str, w / 2, cy); }
      if (o.grad) { const gr = g.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.5); gr.addColorStop(0, o.grad[0]); gr.addColorStop(1, o.grad[1]); g.fillStyle = gr; } else g.fillStyle = fill;
      g.fillText(str, w / 2, cy);
    });
  });
}

// ---- 顶栏 ----
export const HUD = { pillX: 28, pillY: 122, pillW: 568, pillH: 53, trackX: 245, trackW: 333, iconX: 55, iconY: 150, gearX: 654, gearY: 148 };
export function pillAsset(S) {
  return memo('pill|' + (S.hudColor || ''), () => mk(HUD.pillW, HUD.pillH + 6, (g, w, h) => {
    const c = S.hudColor || '#4c2a10';
    rr(g, 0, 0, w, HUD.pillH, 26); g.fillStyle = shade(c, 0.28); g.fill();
    rr(g, 1.5, 1.5, w - 3, HUD.pillH - 3, 25); g.fillStyle = c; g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; rr(g, 6, 3, w - 12, 10, 5); g.fill();
    rr(g, HUD.trackX - HUD.pillX, 8, HUD.trackW, HUD.pillH - 16, 15); g.fillStyle = shade(c, -0.3); g.fill();
    rr(g, HUD.trackX - HUD.pillX, 8, HUD.trackW, HUD.pillH - 16, 15); g.lineWidth = 1.5; g.strokeStyle = shade(c, 0.12); g.stroke();
  }, HUD.pillW / 2, HUD.pillH / 2));
}
export function barFillAsset(S) {
  return memo('bar|' + (S.barColor || ''), () => mk(HUD.trackW - 6, HUD.pillH - 22, (g, w, h) => {
    const c = S.barColor || '#5ad34a';
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, shade(c, 0.35)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.2));
    rr(g, 0, 0, w, h, h / 2); g.fillStyle = gr; g.fill();
  }));
}
export function stumpIconAsset() {
  return memo('stumpIcon', () => mk(70, 76, (g, w, h) => {
    // 树桩
    g.fillStyle = '#b8743f'; g.beginPath(); g.ellipse(35, 58, 28, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#d18b52'; g.fillRect(8, 44, 54, 16); g.beginPath(); g.ellipse(35, 44, 27, 11, 0, 0, 7); g.fill();
    g.fillStyle = '#f1d3a4'; g.beginPath(); g.ellipse(35, 42, 24, 9, 0, 0, 7); g.fill();
    g.strokeStyle = '#d6a96c'; g.lineWidth = 1; g.beginPath(); g.ellipse(35, 42, 14, 5, 0, 0, 7); g.stroke();
    // 积木
    const cols = ['#4a8fe2', '#5fd45a', '#f3dc4a', '#ef4a55'];
    cols.forEach((c, i) => { g.save(); g.translate(35 + (i % 2 ? 4 : -3), 36 - i * 8); g.rotate((i % 2 ? 0.1 : -0.12)); rr(g, -22, -6, 44, 12, 3); g.fillStyle = c; g.fill(); g.lineWidth = 1.2; g.strokeStyle = shade(c, -0.4); g.stroke(); g.restore(); });
  }));
}
export function gearAsset(S) {
  return memo('gear|' + (S.gearColor || ''), () => mk(70, 70, (g, w, h) => {
    const c = S.gearColor || '#f6a02c', cx = 35, cy = 35;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a0 = i * Math.PI / 4 - 0.2, a1 = i * Math.PI / 4 + 0.2, R1 = 32, R0 = 24;
      g.lineTo(cx + Math.cos(a0 - 0.12) * R0, cy + Math.sin(a0 - 0.12) * R0); g.lineTo(cx + Math.cos(a0) * R1, cy + Math.sin(a0) * R1); g.lineTo(cx + Math.cos(a1) * R1, cy + Math.sin(a1) * R1); g.lineTo(cx + Math.cos(a1 + 0.12) * R0, cy + Math.sin(a1 + 0.12) * R0); }
    g.closePath(); g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = '#8a4a14'; g.stroke(); g.fillStyle = c; g.fill();
    g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.fillStyle = '#8a4a14'; g.fill(); g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fillStyle = '#5db6f0'; g.fill();
    g.globalAlpha = 0.4; g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 6, cy - 10, 7, Math.PI, Math.PI * 1.6); g.lineTo(cx, cy - 8); g.fill();
  }));
}
export function badgeAsset(str) {
  return memo('badge|' + str, () => { const w = Math.max(42, 22 + str.length * 14); return mk(w, 36, (g, w, h) => {
    rr(g, 0, 0, w, h, 18); g.fillStyle = '#3a2112'; g.fill(); rr(g, 1.5, 1.5, w - 3, h - 3, 17); g.fillStyle = '#5a3520'; g.fill();
    g.font = `800 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(str, w / 2, h / 2 + 2);
  }); });
}

// ---- 底部按钮 ----
export const BTN = { w: 90, h: 92 };
function lockIcon(g, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.lineWidth = 6; g.strokeStyle = '#6a6a72'; g.lineCap = 'round'; g.beginPath(); g.arc(0, -8, 11, Math.PI, 0); g.lineTo(11, -2); g.moveTo(-11, -8); g.lineTo(-11, -2); g.stroke();
  g.lineWidth = 3; g.strokeStyle = '#d8d8de'; g.beginPath(); g.arc(0, -8, 11, Math.PI, 0); g.stroke();
  rr(g, -15, -4, 30, 24, 6); g.fillStyle = '#ffc928'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#5a3a10'; g.stroke();
  g.fillStyle = '#4a2f10'; g.beginPath(); g.arc(0, 7, 3.5, 0, 7); g.fill(); g.fillRect(-1.5, 8, 3, 7);
  g.restore();
}
export function boosterAsset(kind, S) {
  return memo('booster|' + kind, () => mk(BTN.w + 12, BTN.h + 12, (g, w, h) => {
    const x0 = 6, y0 = 4, und = kind === 'undo';
    rr(g, x0, y0 + 7, BTN.w, BTN.h - 2, 20); g.fillStyle = und ? '#b9a584' : '#8a7a68'; g.fill();
    rr(g, x0, y0, BTN.w, BTN.h - 6, 20); g.fillStyle = '#3a1f10'; g.fill();
    rr(g, x0 + 4.5, y0 + 4.5, BTN.w - 9, BTN.h - 15, 16); g.fillStyle = und ? '#fff6e2' : '#ddd6c8'; g.fill();
    g.fillStyle = und ? '#f3e2c0' : '#c9c1b2'; rr(g, x0 + 4.5, y0 + BTN.h * 0.62, BTN.w - 9, BTN.h * 0.28 - 6, 12); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; rr(g, x0 + 10, y0 + 8, BTN.w - 20, 8, 4); g.fill();
    const cx = x0 + BTN.w / 2, cy = y0 + (BTN.h - 6) / 2;
    if (und) {
      g.save(); g.translate(cx, cy + 2); g.scale(0.42, 0.42); g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-62, -6); g.lineTo(-18, -52); g.lineTo(-18, -26); g.bezierCurveTo(46, -34, 80, 6, 52, 40); g.bezierCurveTo(36, 58, 4, 60, -16, 52); g.lineTo(-10, 28); g.bezierCurveTo(8, 34, 28, 30, 30, 14); g.bezierCurveTo(32, -4, 8, -8, -18, 0); g.lineTo(-18, 22); g.closePath();
      g.lineWidth = 18; g.strokeStyle = '#1b3b6b'; g.stroke(); g.fillStyle = '#58b2f0'; g.fill(); g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(-70, -60, 150, 26); g.restore(); g.restore();
    } else {
      // 锁下的灰色功能图标（四种）：网格+、锤子、扳手、方块+
      g.save(); g.globalAlpha = 0.5; g.fillStyle = '#9a9aa2'; g.strokeStyle = '#8a8a92'; g.lineWidth = 4; g.lineJoin = 'round'; g.lineCap = 'round';
      const i = +String(kind).replace('lock', '') || 0;
      if (i === 0) { rr(g, cx - 22, cy - 22, 44, 44, 8); g.fill(); g.fillStyle = '#c5c5cb'; g.fillRect(cx + 8, cy - 26, 4, 14); g.fillRect(cx + 3, cy - 21, 14, 4); }
      else if (i === 1) { g.beginPath(); g.moveTo(cx - 22, cy + 18); g.lineTo(cx + 6, cy - 10); g.stroke(); rr(g, cx - 2, cy - 26, 30, 16, 5); g.fill(); }
      else if (i === 2) { g.beginPath(); g.moveTo(cx - 24, cy + 20); g.lineTo(cx + 10, cy - 14); g.lineWidth = 9; g.stroke(); g.beginPath(); g.arc(cx + 16, cy - 20, 11, 0, 7); g.fill(); }
      else { rr(g, cx - 22, cy - 20, 44, 40, 8); g.fill(); g.fillStyle = '#d0d0d6'; g.fillRect(cx + 10, cy - 24, 4, 14); g.fillRect(cx + 5, cy - 19, 14, 4); }
      g.restore(); lockIcon(g, cx, cy + 4, 1.0);
    }
  }));
}
export function countBadgeAsset(n) {
  return memo('cb|' + n, () => mk(34, 34, (g, w, h) => {
    g.beginPath(); g.arc(17, 17, 15, 0, 7); g.fillStyle = '#e03a3a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    g.font = `800 20px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(n), 17, 19);
  }));
}
export function resetCamAsset() {
  return memo('resetcam', () => mk(70, 70, (g, w, h) => {
    rr(g, 3, 3, 64, 64, 16); g.fillStyle = '#3d2314'; g.fill(); rr(g, 6, 6, 58, 54, 13); g.fillStyle = '#efe9dd'; g.fill();
    g.strokeStyle = '#a0522d'; g.lineWidth = 5; g.lineCap = 'round';
    for (const [a, b, c, d] of [[18, 28, 18, 18], [18, 18, 28, 18], [52, 28, 52, 18], [52, 18, 42, 18], [18, 40, 18, 50], [18, 50, 28, 50], [52, 40, 52, 50], [52, 50, 42, 50]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
    g.beginPath(); g.moveTo(24, 24); g.lineTo(46, 44); g.moveTo(46, 24); g.lineTo(24, 44); g.stroke();
  }));
}

// ---- 提示气泡 ----
export function tipAsset(str) {
  return memo('tip|' + str, () => {
    const m = document.createElement('canvas').getContext('2d'); m.font = `800 24px ${FONT}`;
    const tw = Math.ceil(m.measureText(str).width) + 56, th = 52;
    return mk(tw, th + 6, (g, w, h) => {
      rr(g, 0, 4, w, th, 26); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
      rr(g, 0, 0, w, th, 26); g.fillStyle = '#4a2c18'; g.fill(); rr(g, 3, 3, w - 6, th - 6, 23); g.fillStyle = '#fbf3e1'; g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; rr(g, 12, 5, w - 24, 8, 4); g.fill();
      g.font = `800 24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5a3a22'; g.fillText(str, w / 2, th / 2 + 2);
    });
  });
}
export function smallTipAsset(str) {
  return memo('stip|' + str, () => {
    const m = document.createElement('canvas').getContext('2d'); m.font = `800 18px ${FONT}`;
    const tw = Math.ceil(m.measureText(str).width) + 34, th = 34;
    return mk(tw, th + 4, (g, w, h) => {
      rr(g, 0, 0, th * 0 + w, th, 17); g.fillStyle = '#4a2c18'; g.fill(); rr(g, 2.5, 2.5, w - 5, th - 5, 15); g.fillStyle = '#fbf3e1'; g.fill();
      g.font = `800 18px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5a3a22'; g.fillText(str, w / 2, th / 2 + 1.5);
    });
  });
}

// ---- 熊吉祥物（结算面板） ----
export function bearAsset() {
  return memo('bear', () => mk(150, 130, (g, w, h) => {
    const brown = '#a8622e', dark = '#5a2d12', light = '#f2c999';
    g.lineWidth = 4; g.strokeStyle = dark; g.lineJoin = 'round';
    for (const x of [28, 122]) { g.beginPath(); g.arc(x, 30, 17, 0, 7); g.fillStyle = brown; g.fill(); g.stroke(); g.beginPath(); g.arc(x, 30, 8, 0, 7); g.fillStyle = light; g.fill(); }
    g.beginPath(); g.ellipse(75, 70, 52, 46, 0, 0, 7); g.fillStyle = brown; g.fill(); g.stroke();
    g.beginPath(); g.ellipse(75, 84, 24, 18, 0, 0, 7); g.fillStyle = light; g.fill();
    g.fillStyle = dark; for (const x of [55, 95]) { g.beginPath(); g.ellipse(x, 62, 6, 8, 0, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; for (const x of [57, 97]) { g.beginPath(); g.arc(x, 59, 2.4, 0, 7); g.fill(); }
    g.beginPath(); g.ellipse(75, 76, 8, 6, 0, 0, 7); g.fillStyle = dark; g.fill();
    g.strokeStyle = dark; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(75, 82); g.lineTo(75, 88); g.moveTo(64, 91); g.quadraticCurveTo(75, 100, 86, 91); g.stroke();
    // 欢呼的爪
    for (const s of [-1, 1]) { g.save(); g.translate(75 + s * 58, 62); g.rotate(s * -0.4); g.beginPath(); g.ellipse(0, -8, 13, 22, 0, 0, 7); g.fillStyle = brown; g.fill(); g.strokeStyle = dark; g.lineWidth = 4; g.stroke(); g.restore(); }
  }));
}

// ---- 结算面板 ----
export const PANEL = { w: 670, h: 860, hFail: 690 };
export function beaverAsset() {
  return memo('beaver', () => mk(300, 270, (g, w, h) => {
    const brown = '#b8651f', mid = '#d4813a', dark = '#4d250d', cream = '#fbe3b8', over = '#4b2f22';
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 6; g.strokeStyle = dark;
    const ell = (x, y, rx, ry, fill, rot = 0, st = true) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fillStyle = fill; g.fill(); if (st) g.stroke(); };
    // 尾巴（右下）
    ell(232, 232, 38, 20, '#7a3d16', -0.5);
    // 手臂（举起欢呼）
    for (const s of [-1, 1]) { g.save(); g.translate(150 + s * 62, 168); g.rotate(s * 0.55); ell(0, -34, 20, 46, brown); ell(0, -74, 21, 20, mid); g.restore(); }
    // 身体 + 背带裤
    ell(150, 198, 66, 66, brown); g.save(); g.beginPath(); g.ellipse(150, 198, 66, 66, 0, 0, 7); g.clip(); g.fillStyle = over; g.fillRect(70, 205, 160, 80); g.restore(); ell(150, 198, 66, 66, 'rgba(0,0,0,0)');
    g.fillStyle = over; g.fillRect(100, 150, 12, 64); g.fillRect(188, 150, 12, 64); ell(106, 212, 7, 7, '#f1c24b', 0, false); ell(194, 212, 7, 7, '#f1c24b', 0, false);
    ell(150, 205, 34, 44, '#6b4333', 0, false);
    // 头
    ell(150, 108, 82, 66, brown);
    for (const s of [-1, 1]) { ell(150 + s * 62, 48, 22, 22, brown); ell(150 + s * 62, 50, 11, 11, '#f0a9a0', 0, false); }
    ell(150, 134, 52, 38, cream);
    // 眼睛（开心眯眼）
    g.lineWidth = 6; for (const s of [-1, 1]) { g.beginPath(); g.arc(150 + s * 36, 104, 13, Math.PI * 1.12, Math.PI * 1.88); g.stroke(); }
    ell(150, 118, 17, 12, dark, 0, false); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(145, 114, 5, 3, 0, 0, 7); g.fill();
    // 张嘴 + 门牙
    g.lineWidth = 5; g.beginPath(); g.moveTo(118, 138); g.quadraticCurveTo(150, 196, 182, 138); g.quadraticCurveTo(150, 146, 118, 138); g.fillStyle = '#7a1f19'; g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.lineWidth = 3.5; for (const s of [-1, 1]) { rr(g, 150 + (s < 0 ? -15 : 1), 141, 14, 19, 4); g.fill(); g.stroke(); }
    g.fillStyle = '#e0626a'; g.beginPath(); g.ellipse(150, 170, 16, 8, 0, 0, 7); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = 'rgba(240,120,110,.5)'; g.beginPath(); g.ellipse(150 + s * 62, 130, 11, 7, 0, 0, 7); g.fill(); }
  }));
}
function starPath(g, cx, cy, ro, ri, rot = 0) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + rot + k * Math.PI / 5, r = k % 2 ? ri : ro; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); }
function drawStar(g, cx, cy, r, rot = 0) { starPath(g, cx, cy, r, r * 0.46, rot); g.fillStyle = '#ffc928'; g.strokeStyle = '#a5610f'; g.lineWidth = Math.max(2.5, r * 0.12); g.lineJoin = 'round'; g.fill(); g.stroke(); starPath(g, cx, cy - r * 0.04, r * 0.62, r * 0.28, rot); g.fillStyle = '#ffe36b'; g.fill(); }
function drawCoin(g, cx, cy, r) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = '#f0b421'; g.fill(); g.lineWidth = Math.max(2.5, r * 0.12); g.strokeStyle = '#8a5200'; g.stroke(); g.beginPath(); g.arc(cx, cy, r * 0.68, 0, 7); g.strokeStyle = '#c47d0e'; g.lineWidth = Math.max(2, r * 0.1); g.stroke(); g.beginPath(); g.arc(cx, cy, r * 0.42, 0, 7); g.fillStyle = '#ffd04d'; g.fill(); g.stroke(); }
function heart(g, cx, cy, r) { g.beginPath(); g.moveTo(cx, cy + r * 0.9); g.bezierCurveTo(cx - r * 1.6, cy - r * 0.1, cx - r * 0.9, cy - r * 1.3, cx, cy - r * 0.4); g.bezierCurveTo(cx + r * 0.9, cy - r * 1.3, cx + r * 1.6, cy - r * 0.1, cx, cy + r * 0.9); g.fillStyle = '#e8303c'; g.strokeStyle = '#7a1018'; g.lineWidth = 4; g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(cx - r * 0.5, cy - r * 0.35, r * 0.25, r * 0.15, -0.6, 0, 7); g.fill(); }
// 弹窗时顶部的资源条（体力 / 星星 / 金币），参考视频 Tower Fell / Level Complete
export function currencyAsset(win, stars, coins) {
  return memo(['cur', win, stars, coins].join('|'), () => mk(640, 70, (g, w, h) => {
    const pill = (x, wd, txt, icon) => { rr(g, x, 14, wd, 42, 21); g.fillStyle = '#5b3217'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#2d170a'; g.stroke(); g.font = `800 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(txt, x + wd / 2 + 16, 36); icon(); };
    pill(30, 130, 'Full', () => { heart(g, 40, 34, 18); g.font = `800 24px ${FONT}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('5', 40, 34); });
    let x = 190;
    if (win) { pill(x, 120, String(stars), () => drawStar(g, x + 6, 34, 26)); x += 160; }
    pill(x, 150, String(coins), () => drawCoin(g, x + 8, 34, 25));
  }));
}
function panelFrame(g, w, h, hdrCol, hdrDark, title, tcol, size) {
  rr(g, 0, 0, w, h, 34); g.fillStyle = '#5a2c0e'; g.fill();
  rr(g, 5, 5, w - 10, h - 10, 30); g.fillStyle = '#e9a75f'; g.fill();
  g.fillStyle = '#d98f45'; g.fillRect(5, h - 24, w - 10, 14);
  rr(g, 5, 5, w - 10, h - 20, 30); g.save(); g.clip(); g.restore();
  rr(g, 20, 20, w - 40, h - 52, 22); g.fillStyle = '#fff3dc'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7a4a1e'; g.stroke();
  // 标题条
  g.save(); rr(g, 5, 5, w - 10, h - 10, 30); g.clip(); g.fillStyle = hdrCol; g.fillRect(0, 0, w, 104); g.fillStyle = hdrDark; g.fillRect(0, 98, w, 8); g.restore();
  g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = tcol; g.strokeText(title, w / 2, 56); g.fillStyle = '#fff'; g.fillText(title, w / 2, 56);
}
function bigButton(g, w, y, h, txt, size) {
  rr(g, 48, y + 8, w - 96, h, 26); g.fillStyle = '#2d5a1d'; g.fill(); rr(g, 48, y, w - 96, h, 26); g.fillStyle = '#5ebd3e'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#2d5a1d'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, 64, y + 8, 56, 12, 6); g.fill();
  g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = '#2d5a1d'; g.strokeText(txt, w / 2, y + h / 2 + 2); g.fillStyle = '#fff'; g.fillText(txt, w / 2, y + h / 2 + 2);
}
export function winPanelAsset(S, level, stars, coins) {
  return memo(['win', level, stars, coins, S.winTitle, S.winButton].join('|'), () => mk(PANEL.w, PANEL.h, (g, w, h) => {
    panelFrame(g, w, h, '#5bb93c', '#3a8a26', S.winTitle || 'Level Complete!', '#27561a', 58);
    g.font = `800 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#4a2a10'; g.strokeText('Level ' + level, w / 2, 168); g.fillStyle = '#fff'; g.fillText('Level ' + level, w / 2, 168);
    const b = beaverAsset(); g.drawImage(b.canvas, w / 2 - 150, 205, 300, 270);
    for (let i = 0; i < 2; i++) {
      const x = 96 + i * 252, y = 490; rr(g, x, y, 226, 206, 24); g.fillStyle = '#f3e1bf'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#dcc79e'; g.stroke();
      if (i === 0) { drawStar(g, x + 113, y + 80, 54); drawStar(g, x + 46, y + 92, 29, -0.2); drawStar(g, x + 180, y + 92, 29, 0.2); drawStar(g, x + 76, y + 36, 21, -0.3); }
      else { for (const [dx, dy, r] of [[-50, 120, 30], [10, 130, 30], [62, 112, 28], [-20, 96, 30], [36, 84, 28], [-42, 68, 28], [8, 56, 30], [60, 50, 26]]) drawCoin(g, x + 113 + dx, y + 40 + dy * 0.62, r * 0.92); }
      g.font = `800 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#6a4326'; g.fillText(i === 0 ? '+' + stars : '+' + coins, x + 113, y + 176);
    }
    bigButton(g, w, h - 142, 100, S.winButton || 'Next Level', 52);
  }));
}
export function failPanelAsset(S, kind) {
  return memo(['fail', kind, S.failTitle, S.failButton, S.trayTitle].join('|'), () => mk(PANEL.w, PANEL.hFail, (g, w, h) => {
    const title = kind === 'tray' ? (S.trayTitle || 'Tray Full!') : (S.failTitle || 'Tower Fell!');
    panelFrame(g, w, h, '#ee5a47', '#c2402f', title, '#6a160d', 54);
    rr(g, w / 2 - 110, 136, 220, 220, 24); g.fillStyle = '#f3e3c3'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#dcc79e'; g.stroke();
    g.save(); g.translate(w / 2, 246); g.lineJoin = 'round'; g.lineCap = 'round';
    const arrow = () => { g.beginPath(); g.moveTo(-62, -6); g.lineTo(-18, -52); g.lineTo(-18, -26); g.bezierCurveTo(46, -34, 80, 6, 52, 40); g.bezierCurveTo(36, 58, 4, 60, -16, 52); g.lineTo(-10, 28); g.bezierCurveTo(8, 34, 28, 30, 30, 14); g.bezierCurveTo(32, -4, 8, -8, -18, 0); g.lineTo(-18, 22); g.closePath(); };
    arrow(); g.lineWidth = 16; g.strokeStyle = '#1b3b6b'; g.stroke(); g.fillStyle = '#58b2f0'; g.fill(); g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-70, -60, 150, 26); g.restore(); g.restore();
    g.font = `800 28px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5a3a1e'; g.fillText(kind === 'tray' ? (S.trayText || 'No room left on the tray.') : (S.failText || 'Take back the last pull. Free this time!'), w / 2, 396);
    bigButton(g, w, h - 170, 104, S.failButton || 'Play On - Free', 46);
  }));
}
// 小粒子
export function confettiAsset(col) { return memo('conf|' + col, () => mk(14, 8, (g, w, h) => { rr(g, 0, 0, w, h, 1.5); g.fillStyle = col; g.fill(); })); }
export function chipAsset(col) { return memo('chip|' + col, () => mk(14, 14, (g, w, h) => { g.beginPath(); g.moveTo(2, 1); g.lineTo(12, 3); g.lineTo(13, 12); g.lineTo(3, 13); g.closePath(); g.fillStyle = col; g.fill(); })); }
export function puffAsset() { return memo('puff', () => mk(60, 60, (g, w, h) => { const gr = g.createRadialGradient(30, 30, 2, 30, 30, 28); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 60, 60); })); }
export function sparkAsset() { return memo('spark', () => mk(30, 30, (g, w, h) => { g.translate(15, 15); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 3 : 14; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); })); }
// 背景：天空渐变（+ 云层）
export function drawSky(g, W, H, S) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, S.bgTop); gr.addColorStop(0.5, S.bgMid); gr.addColorStop(1, S.bgBottom);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (S.bgGlow > 0) { const r = g.createRadialGradient(W * 0.5, H * 0.72, 10, W * 0.5, H * 0.72, W * 0.95); r.addColorStop(0, `rgba(255,255,255,${S.bgGlow})`); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); }
}
