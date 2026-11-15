// 音效：全部用 WebAudio 实时合成（无外部文件/请求）。主输出同时接到扬声器和一个 MediaStreamDestination，
// 录制时把这条音轨混进 MediaRecorder 的流里。
let AC = null, master = null, recDest = null, getS = () => ({});
export function initAudio(getSettings) {
  getS = getSettings;
  const unlock = () => { ensure(); if (AC && AC.state !== 'running') AC.resume().catch(() => {}); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
}
function ensure() {
  if (AC) return AC;
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return null;
  AC = new Ctx();
  master = AC.createGain(); master.gain.value = 1;
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;
  master.connect(comp); comp.connect(AC.destination);
  recDest = AC.createMediaStreamDestination(); comp.connect(recDest);
  return AC;
}
export function resumeAudio() { ensure(); return AC && AC.state !== 'running' ? AC.resume().catch(() => {}) : Promise.resolve(); }
export function audioTrack() { ensure(); return recDest ? recDest.stream.getAudioTracks()[0] : null; }
export function audioState() { return AC ? AC.state : 'none'; }
import { SFX_SAMPLES } from './sfx_data.js';
const sampleCache = {};
function samplePCM(name) {
  if (sampleCache[name] !== undefined) return sampleCache[name];
  const b64 = SFX_SAMPLES[name]; if (!b64) return (sampleCache[name] = null);
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i);
  const dv = new DataView(u.buffer); let p = 12, sr = 22050, data = null;
  while (p + 8 <= u.length) { const id = String.fromCharCode(u[p], u[p + 1], u[p + 2], u[p + 3]), sz = dv.getUint32(p + 4, true); if (id === 'fmt ') sr = dv.getUint32(p + 12, true); if (id === 'data') { const n = Math.min(sz, u.length - p - 8) >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = dv.getInt16(p + 8 + i * 2, true) / 32768; data = f; break; } p += 8 + sz + (sz & 1); }
  return (sampleCache[name] = data ? { sr, data } : null);
}
function playSample(out, name, t) {
  const s = samplePCM(name); if (!s) return false;
  const buf = AC.createBuffer(1, s.data.length, s.sr); buf.copyToChannel(s.data, 0);
  const src = AC.createBufferSource(); src.buffer = buf; src.connect(out); src.start(t); return true;
}
export const SFX_SAMPLE_NAMES = Object.keys(SFX_SAMPLES);
let noiseBuf = null;
function noise() {
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}
function env(g, t, a, peak, d, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
function tone(out, type, f0, f1, t, a, d, peak) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  env(g, t, a, peak, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.05);
}
function burstNoise(out, t, dur, peak, type, f, q = 1, f1) {
  const n = noise(), bp = AC.createBiquadFilter(), g = AC.createGain(); bp.type = type; bp.frequency.setValueAtTime(f, t); if (f1) bp.frequency.exponentialRampToValueAtTime(f1, t + dur); bp.Q.value = q;
  env(g, t, Math.min(0.004, dur * 0.2), peak, dur); n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + dur + 0.05);
}
const woodHit = (out, t, f = 420, peak = 0.5, dur = 0.12) => { burstNoise(out, t, 0.03, peak * 0.8, 'bandpass', f * 4, 1.5); tone(out, 'triangle', f * 1.6, f, t, 0.001, dur, peak); tone(out, 'sine', f * 0.5, f * 0.35, t, 0.002, dur * 1.2, peak * 0.7); };
const SYNTH = {
  // 点击：短促木头“嗒”
  Tap(out, t) { woodHit(out, t, 520, 0.28, 0.06); },
  // 拔出：木头摩擦滑动 + 末端轻“嗒”
  Pull(out, t) { burstNoise(out, t, 0.22, 0.34, 'bandpass', 900, 0.9, 2200); burstNoise(out, t + 0.02, 0.18, 0.18, 'highpass', 3000, 0.6); woodHit(out, t + 0.2, 380, 0.22, 0.08); },
  // 入槽（托盘）：圆润的“啵嗒”
  Land(out, t) { woodHit(out, t, 300, 0.45, 0.14); tone(out, 'sine', 700, 1000, t + 0.01, 0.003, 0.09, 0.22); },
  // 入箱：更清脆的“咚”+ 亮点
  Crate(out, t) { woodHit(out, t, 360, 0.5, 0.12); tone(out, 'triangle', 1318.5, 1318.5, t + 0.03, 0.004, 0.28, 0.22); tone(out, 'sine', 1975.5, 1975.5, t + 0.05, 0.004, 0.22, 0.1); },
  // 满箱：爆开声 + 上行琶音
  Full(out, t) { burstNoise(out, t, 0.25, 0.4, 'bandpass', 3500, 0.7, 1500); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(out, 'triangle', f, f, t + 0.04 + i * 0.065, 0.004, 0.32, 0.3); tone(out, 'sine', f * 2, f * 2, t + 0.04 + i * 0.065, 0.004, 0.2, 0.08); }); },
  // 赞美词：上扬的“哇”
  Combo(out, t) { tone(out, 'sawtooth', 330, 880, t, 0.01, 0.22, 0.12); tone(out, 'triangle', 660, 1760, t, 0.01, 0.25, 0.2); burstNoise(out, t + 0.05, 0.3, 0.1, 'bandpass', 6000, 1.2); },
  // 倒塌：低频轰鸣 + 一连串木头撞击
  Fall(out, t) { burstNoise(out, t, 0.9, 0.35, 'lowpass', 400, 0.7); tone(out, 'sine', 120, 45, t, 0.01, 0.8, 0.5); for (let i = 0; i < 14; i++) woodHit(out, t + 0.06 + i * 0.075 + (i % 3) * 0.02, 250 + (i * 97) % 380, 0.3 - i * 0.012, 0.1); },
  // 通关：号角式小奏
  Win(out, t) { [[523.25, 0], [659.25, 0.1], [783.99, 0.2], [1046.5, 0.32], [1318.5, 0.5]].forEach(([f, dt]) => { tone(out, 'sawtooth', f, f, t + dt, 0.01, 0.35, 0.16); tone(out, 'triangle', f, f, t + dt, 0.01, 0.45, 0.22); }); for (let i = 0; i < 10; i++) { const f = 2000 + Math.random() * 3000; tone(out, 'sine', f, f, t + 0.3 + i * 0.06, 0.003, 0.25, 0.07); } },
  // 撤销：倒带“嗖”
  Undo(out, t) { tone(out, 'sawtooth', 900, 200, t, 0.005, 0.5, 0.1); burstNoise(out, t, 0.55, 0.22, 'bandpass', 3000, 0.8, 400); tone(out, 'sine', 400, 800, t + 0.5, 0.004, 0.18, 0.2); },
  // 提示：两声低“嘟”
  Warn(out, t) { tone(out, 'triangle', 330, 330, t, 0.004, 0.1, 0.3); tone(out, 'triangle', 262, 262, t + 0.11, 0.004, 0.14, 0.3); },
  // 托盘满：失败“嘟——”
  Tray(out, t) { tone(out, 'sawtooth', 220, 110, t, 0.01, 0.5, 0.18); tone(out, 'triangle', 196, 98, t + 0.05, 0.01, 0.5, 0.25); },
};
export const SFX_NAMES = Object.keys(SYNTH);
export function sfx(name, opt = {}) {
  const S = getS();
  const vol = (S.sfxVolume ?? 0.7) * (S['sfx' + name + 'Vol'] ?? 1) * (opt.vol ?? 1);
  const audible = !(S.sfxMute || S['sfx' + name] === false) && vol > 0.001;
  if (sfxHook) try { sfxHook(name, vol, opt, audible); } catch (e) { console.warn(e); }
  if (!audible) return;
  if (!ensure() || AC.state !== 'running') return;
  const g = AC.createGain(); g.gain.value = vol; g.connect(master);
  try { const tt = AC.currentTime + 0.005 + (opt.delay || 0); if (!(S.sfxSource !== 'synth' && playSample(g, name, tt))) SYNTH[name](g, tt, opt.dur); } catch (e) { console.warn(e); }
  setTimeout(() => g.disconnect(), 3000);
}

// —— 导出 AE 工程用 ——
let sfxHook = null;
export function setSfxHook(fn) { sfxHook = fn; }
// 用 OfflineAudioContext 离线合成：events = [{t, name, vol, delay, dur}]，返回 AudioBuffer（单声道）
export async function renderSfxOffline(events, duration, sampleRate = 44100) {
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Off) return null;
  const len = Math.max(1, Math.ceil((duration + 0.05) * sampleRate));
  const off = new Off(1, len, sampleRate);
  const saveAC = AC, saveNoise = noiseBuf;
  AC = off; noiseBuf = null;
  try {
    const comp = off.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; comp.connect(off.destination);
    for (const e of events) {
      const g = off.createGain(); g.gain.value = e.vol; g.connect(comp);
      try { const tt = e.t + 0.005 + (e.delay || 0); if (!(getS().sfxSource !== 'synth' && playSample(g, e.name, tt))) SYNTH[e.name](g, tt, e.dur); } catch (err) { console.warn(err); }
    }
  } finally { AC = saveAC; noiseBuf = saveNoise; }
  return off.startRendering();
}
export function encodeWav(buf) {
  const ch = 1, sr = buf.sampleRate, d = buf.getChannelData(0), n = d.length;
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, d[i])); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Uint8Array(out.buffer);
}
