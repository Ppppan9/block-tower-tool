// 导出 After Effects 工程：显示列表记录器（2D HUD 元素逐帧采样）+ 积木塔预渲染 PNG 序列 + 逐块 3D 位姿记录
// 输出 timeline.json（格式同其它核玩工具）+ build_ae_project.jsx + assets/*.png + audio/*.wav
import { makeZip } from './zip.js';
import JSX_TEXT from './build_ae_project.jsx';
import README_TEXT from './README_AE.md';
import { renderSfxOffline, encodeWav, setSfxHook } from '../audio.js';

const LABEL = { ui: 15, tower: 11, fx: 3, hand: 12, audio: 16, end: 5, bg: 8 };
const r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 10000) / 10000;
const safe = k => String(k).replace(/[^A-Za-z0-9_-]/g, m => '_' + m.charCodeAt(0).toString(16)).slice(0, 80);

// 贪心线性精简：保证被丢弃的点与线性插值的偏差 ≤ tol（逐分量）
function simplify(T, V, n, tol) {
  const m = T.length, keep = [0];
  if (m <= 2) return T.map((_, i) => i);
  let i = 0;
  while (i < m - 1) {
    let best = i + 1;
    for (let j = i + 2; j < m; j++) {
      let ok = true;
      for (let k = i + 1; k < j && ok; k++) {
        const u = (T[k] - T[i]) / (T[j] - T[i]);
        for (let c = 0; c < n; c++) { const a = V[i * n + c], b = V[j * n + c]; if (Math.abs(V[k * n + c] - (a + (b - a) * u)) > tol[c]) { ok = false; break; } }
      }
      if (ok) best = j; else break;
    }
    keep.push(best); i = best;
  }
  return keep;
}
function propOf(T, V, n, tol, conv) { // → AE 属性（常量或 {t,v}）
  const idx = simplify(T, V, n, Array.isArray(tol) ? tol : Array(n).fill(tol));
  const t = idx.map(i => r4(T[i])), v = idx.map(i => { const a = []; for (let c = 0; c < n; c++) a.push(V[i * n + c]); return conv(a); });
  const same = v.every(x => JSON.stringify(x) === JSON.stringify(v[0]));
  return same ? v[0] : { t, v };
}
const keyCount = P => (P && typeof P === 'object' && !Array.isArray(P) && P.t) ? P.t.length : 0;
const toBytes = c => new Promise(res => c.toBlob(b => b.arrayBuffer().then(x => res(new Uint8Array(x))), 'image/png'));

export function createAERecorder(api) {
  let R = null;
  const active = () => !!R;
  const elapsed = () => R ? (performance.now() - R.t0) / 1000 : 0;

  function start() {
    const E = api.env();
    R = { t0: performance.now(), W: E.W, H: E.H, U: E.U, fps: +E.S.aeFps || 30, f: -1, frames: 0, tracks: new Map(), order: [], hand: [], handWH: null, tower: [], towerLast: -999, towerSig: '', towerN: 0, pending: [],
      segs: [], seg: null, sfx: [], events: [], bg: false, dim: [], endBg: [], endCols: null, handImg: null, snaps: [] };
    setSfxHook((name, vol, o, audible) => { if (!R) return; const t = elapsed(); R.events.push([t, name]); if (audible) R.sfx.push({ t, name, vol, delay: (o && o.delay) || 0, dur: o && o.dur }); });
  }
  function stop() {
    setSfxHook(null); const r = R; R = null;
    if (r) { const fi = r.f + 1; r.duration = Math.max(1 / r.fps, fi / r.fps); for (const tr of r.tracks.values()) if (tr.on) { tr.s.push(fi, 0, 0, 1, 1, 0, -1, 1); tr.on = false; } if (r.handOn) { r.hand.push(fi, 0, 0, 0, 1, 1, -1); r.handOn = false; } }
    return r;
  }

  function orderInsert(key, prevKey) {
    if (R.order.includes(key)) return;
    const i = prevKey ? R.order.indexOf(prevKey) : -1;
    R.order.splice(i + 1, 0, key);
  }
  function sample(now, FRAME) {
    const E = api.env(), fi = Math.floor((now - R.t0) / 1000 * R.fps);
    if (fi === R.f) return; R.f = fi; R.frames = fi + 1;
    const seen = new Set(); let prev = null;
    for (const it of FRAME.items) {
      let key;
      if (it.bg) { R.bg = true; key = 'bg'; }
      else if (it.tower) key = 'tower';
      else if (it.dim !== undefined) { key = 'dim'; R.dim.push(fi, it.dim); }
      else if (it.endBg) { key = 'endbg'; R.endBg.push(fi, it.a); R.endCols = it.endBg; }
      else if (it.A) {
        key = it.id + '|' + it.key;
        let tr = R.tracks.get(key);
        if (!tr) { tr = { key, id: it.id, akey: it.key, A: it.A, s: [], lastF: -2 }; R.tracks.set(key, tr); }
        // 图片被同一帧覆盖（同 id 重复）取最后一个
        if (tr.lastF === fi) { tr.s.length -= 8; }
        tr.s.push(fi, it.x, it.y, it.sx, it.sy, it.rot || 0, it.a, it.crop); tr.lastF = fi; tr.on = true;
        tr.ax = it.ax; tr.ay = it.ay;
      } else if (it.img) { key = it.id + '|img'; let tr = R.tracks.get(key); if (!tr) { tr = { key, id: it.id, img: it.img, s: [], lastF: -2 }; R.tracks.set(key, tr); } tr.s.push(fi, it.x, it.y, it.w, it.h, 0, it.a, 1); tr.lastF = fi; tr.on = true; }
      else continue;
      seen.add(key); orderInsert(key, prev); prev = key;
    }
    // 手指
    const hs = api.handState();
    if (hs) { R.hand.push(fi, hs.x, hs.y, hs.rot, hs.sx, hs.sy, hs.alpha); R.handOn = true; if (!R.handWH) R.handWH = [hs.w, hs.h]; R.handImg = E.IMG.handImage; }
    // 积木塔 PNG 序列（姿态/相机变化才取一帧）+ 逐块位姿
    const cam = api.camera(), poses = api.poses(), lvKey = E.G ? E.G.n + '#' + E.G.gen : '';
    if (E.G) {
      if (!R.seg || R.seg.key !== lvKey) { R.seg = { key: lvKey, n: E.G.n, f0: fi, f1: fi, blocks: api.blocksInfo(), poses: [], cam: [] }; R.segs.push(R.seg); }
      R.seg.f1 = fi; R.seg.poses.push([fi, poses]); R.seg.cam.push([fi, cam]);
    }
    const sig = lvKey + '|' + poses.map(p => (p.v ? '1' : '0') + p.p.map(x => Math.round(x * 400)).join(',') + p.q.map(x => Math.round(x * 400)).join(',')).join(';') + '|' + cam.sig;
    const gap = Math.max(1, Math.round(R.fps / (+E.S.aeTowerFps || 15)));
    if (sig !== R.towerSig && fi - R.towerLast >= gap && R.towerN < (+E.S.aeTowerMax || 900)) {
      const sc = +E.S.aeTowerScale || 0.5, c = api.towerShot(sc); R.towerSig = sig; R.towerLast = fi; R.towerN++;
      const ent = { f: fi, bytes: null, w: c.width, h: c.height }; R.tower.push(ent); R.pending.push(toBytes(c).then(b => { ent.bytes = b; }));
    }
    for (const tr of R.tracks.values()) if (tr.on && !seen.has(tr.key)) { tr.s.push(fi, 0, 0, 1, 1, 0, -1, 1); tr.on = false; }
    if (!hs && R.handOn) { R.hand.push(fi, 0, 0, 0, 1, 1, -1); R.handOn = false; }
  }

  // ---- 导出 ----
  async function exportZip(S, rec) {
    const fps = +S.aeFps || rec.fps, D = Math.max(1 / fps, r3(rec.duration)), W = rec.W, H = rec.H;
    let CW = W, CH = H; if (/^\d+x\d+$/.test(S.aeSize)) [CW, CH] = S.aeSize.split('x').map(Number);
    const K = CW / W, zh = S.aeNames !== 'en', N = (a, b) => zh ? a : b;
    const folders = [{ id: 'root', name: N('积木塔_AE导出', 'BlockTower_AE') }, { id: 'ass', name: N('素材', 'Assets'), parent: 'root' }, { id: 'aud', name: N('音频', 'Audio'), parent: 'root' }, { id: 'pre', name: N('预合成', 'Precomps'), parent: 'root' }];
    const assets = [], assetFiles = [], comps = [];
    const addAsset = async (id, file, canvasOrBytes, name, w, h) => {
      const bytes = canvasOrBytes instanceof Uint8Array ? canvasOrBytes : await toBytes(canvasOrBytes);
      assets.push({ id, file, folder: 'ass', w, h, name }); assetFiles.push({ name: file, data: bytes });
    };
    const L = (name, src, o = {}) => ({ name, src, ...o });
    const frameT = f => r4(f / fps);
    const run = (s, stride) => { // 以“采样序列 + 关闭标记（alpha=-1）”切分连续显示段
      const runs = []; let cur = null;
      for (let i = 0; i < s.length; i += stride) {
        const f = s[i], off = s[i + (stride === 8 ? 6 : 6)] < 0;
        if (off) { if (cur) { cur.end = f; cur = null; } continue; }
        if (!cur) { cur = { f0: f, f1: f, end: null, idx: [] }; runs.push(cur); }
        cur.idx.push(i); cur.f1 = f;
      }
      return runs;
    };
    const mainLayers = [], mainMarkers = [];
    // 背景
    if (rec.bg) { const c = document.createElement('canvas'); c.width = W; c.height = H; api.withCtx(c.getContext('2d'), () => api.drawBackground()); await addAsset('bg', 'assets/bg.png', c, N('背景', 'Background'), W, H); mainLayers.push(L(N('背景_天空', 'Background'), { asset: 'bg' }, { label: LABEL.bg, tr: { anchor: [0, 0], position: [0, 0], scale: [K * 100, K * 100] } })); }
    // 积木塔序列（预合成）
    await Promise.all(rec.pending);
    const towerLayer = () => {
      const tl = [], T = rec.tower.filter(e => e.bytes);
      return { T, tl };
    };
    const { T: towers } = towerLayer();
    const towerSlot = rec.order.indexOf('tower');
    const towerLayers = [];
    if (towers.length) {
      const tl = [];
      for (let i = 0; i < towers.length; i++) {
        const e = towers[i]; await addAsset('tw' + i, `assets/tower/tower_${String(i).padStart(5, '0')}.png`, e.bytes, `tower_${i}`, e.w, e.h);
        const inT = i === 0 ? 0 : frameT(e.f), outT = i + 1 < towers.length ? frameT(towers[i + 1].f) : D;
        const tsc = e.w / W;
        tl.push(L(`${N('塔帧 ', 'Tower ')}${String(i).padStart(4, '0')}`, { asset: 'tw' + i }, { in: inT, out: outT, label: LABEL.tower, tr: { anchor: [e.w / 2, e.h / 2], position: [CW / 2, CH / 2], scale: [K / tsc * 100, K / tsc * 100] } }));
      }
      comps.push({ id: 'tower', name: N('积木塔_序列', 'Tower_Sequence'), w: CW, h: CH, duration: D, fps, folder: 'pre', layers: tl });
      towerLayers.push(L(N('积木塔', 'Block tower'), { comp: 'tower' }, { label: LABEL.tower, markers: [[0, N('积木塔预渲染序列（3D→PNG）', 'pre-rendered 3D tower')]] }));
    }
    // 图片轨道：按 order 叠放
    const used = new Map();
    const slotLayers = new Map();
    const dimSolid = (name, arr, color) => {
      const T = [], V = []; for (let i = 0; i < arr.length; i += 2) { T.push(arr[i] / fps); V.push(arr[i + 1] * 100); }
      return { name, T, V, color };
    };
    for (const key of rec.order) {
      if (key === 'tower') { slotLayers.set(key, towerLayers); continue; }
      if (key === 'bg') continue;
      if (key === 'dim' && rec.dim.length) {
        const fr = []; for (let i = 0; i < rec.dim.length; i += 2) fr.push(rec.dim[i], rec.dim[i + 1]);
        const fs = []; for (let i = 0; i < fr.length; i += 2) fs.push(fr[i]);
        const T = [], V = []; fs.forEach((f, i) => { T.push(f / fps); V.push([fr[i * 2 + 1] * 100]); });
        const flatV = V.map(v => v[0]);
        const P = propOf(T, flatV, 1, 0.5, a => a[0]);
        slotLayers.set(key, [L(N('暗幕', 'Dim'), { solid: [8 / 255, 18 / 255, 38 / 255], w: CW, h: CH }, { in: frameT(fs[0]), out: Math.min(D, frameT(fs[fs.length - 1] + 1)), label: LABEL.ui, tr: { opacity: P } })]);
        continue;
      }
      if (key === 'endbg' && rec.endBg.length) {
        const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, rec.endCols[0]); gr.addColorStop(1, rec.endCols[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        await addAsset('endbg', 'assets/end_bg.png', c, N('结束页背景', 'End bg'), W, H);
        const fs = [], V = []; for (let i = 0; i < rec.endBg.length; i += 2) { fs.push(rec.endBg[i]); V.push(rec.endBg[i + 1] * 100); }
        slotLayers.set(key, [L(N('结束页_背景', 'End bg'), { asset: 'endbg' }, { in: frameT(fs[0]), label: LABEL.end, tr: { anchor: [0, 0], position: [0, 0], scale: [K * 100, K * 100], opacity: propOf(fs.map(f => f / fps), V, 1, 0.5, a => a[0]) } })]);
        continue;
      }
      const tr = rec.tracks.get(key); if (!tr) continue;
      let aid = used.get(tr.akey || key);
      const cv = tr.A ? tr.A.canvas : tr.img, cw = cv.width || cv.naturalWidth, ch = cv.height || cv.naturalHeight;
      if (!aid) { aid = 'a' + used.size; used.set(tr.akey || key, aid); await addAsset(aid, `assets/${safe(tr.id)}_${safe(tr.akey || 'img')}.png`, cv instanceof HTMLCanvasElement ? cv : (() => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; c.getContext('2d').drawImage(cv, 0, 0); return c; })(), tr.id, cw, ch); }
      const lays = [];
      const dispW = tr.A ? tr.A.w : cw; // 设计单位宽
      for (const rn of run(tr.s, 8)) {
        const T = [], P = [], Sc = [], Ro = [], Op = [];
        for (const i of rn.idx) {
          const x = tr.s[i + 1], y = tr.s[i + 2], sx = tr.s[i + 3], sy = tr.s[i + 4], rot = tr.s[i + 5], a = tr.s[i + 6], crop = tr.s[i + 7];
          T.push(tr.s[i] / fps);
          const k = tr.A ? dispW / cw : 1, ax = tr.A ? tr.ax : 0.5, ay = tr.A ? tr.ay : 0.5;
          if (tr.A) { P.push(x * K, y * K); Sc.push(sx * k * (crop < 1 ? crop : 1) * 100 * K, sy * k * 100 * K); }
          else { P.push(x * K, y * K); Sc.push(sx / cw * 100 * K, sy / ch * 100 * K); }
          Ro.push(rot * 180 / Math.PI); Op.push(a * 100);
        }
        const cropped = tr.A && tr.s[rn.idx[0] + 7] < 1;
        const ax = tr.A ? tr.ax : 0.5, ay = tr.A ? tr.ay : 0.5;
        // crop<1 的块：锚点放在左边缘，位置补偿
        let anchor = [ax * cw, ay * ch];
        if (cropped) { anchor = [0, ay * ch]; const k = dispW / cw; for (let q = 0; q < T.length; q++) { const i = rn.idx[q]; P[q * 2] += -ax * cw * tr.s[i + 3] * k * K; } }
        const endT = Math.min(D, rn.end != null ? frameT(rn.end) : frameT(rn.f1 + 1));
        lays.push(L(`${tr.id}${lays.length ? ' #' + (lays.length + 1) : ''}`, { asset: aid }, { in: frameT(rn.f0), out: endT, label: tr.id.startsWith('end') ? LABEL.end : LABEL.ui,
          tr: { anchor, position: propOf(T, P, 2, 0.3, a => [r3(a[0]), r3(a[1])]), scale: propOf(T, Sc, 2, 0.3, a => [r3(a[0]), r3(a[1])]), rotation: propOf(T, Ro, 1, 0.2, a => r3(a[0])), opacity: propOf(T, Op, 1, 0.5, a => r3(a[0])) } }));
      }
      slotLayers.set(key, lays);
    }
    for (const key of rec.order) { const l = slotLayers.get(key); if (l) mainLayers.push(...l); }
    // 手指
    if (rec.handImg && rec.hand.length) {
      const hc = document.createElement('canvas'); hc.width = rec.handImg.width; hc.height = rec.handImg.height; hc.getContext('2d').drawImage(rec.handImg, 0, 0);
      await addAsset('hand', 'assets/hand.png', hc, N('手指', 'Hand'), hc.width, hc.height);
      const hw = rec.handWH[0], hh = rec.handWH[1], ax = api.env().S.handAnchorX, ay = api.env().S.handAnchorY;
      for (const rn of run(rec.hand, 7)) {
        const T = [], P = [], Sc = [], Ro = [], Op = [];
        for (const i of rn.idx) { const h = rec.hand; T.push(h[i] / fps); P.push(h[i + 1] * K, h[i + 2] * K); Ro.push(h[i + 3]); Sc.push(h[i + 4] * hw / hc.width * 100 * K, h[i + 5] * hh / hc.height * 100 * K); Op.push(h[i + 6] * 100); }
        mainLayers.push(L(N('手指', 'Hand'), { asset: 'hand' }, { in: frameT(rn.f0), out: Math.min(D, rn.end != null ? frameT(rn.end) : frameT(rn.f1 + 1)), label: LABEL.hand, tr: { anchor: [ax * hc.width, ay * hc.height], position: propOf(T, P, 2, 0.3, a => [r3(a[0]), r3(a[1])]), scale: propOf(T, Sc, 2, 0.3, a => [r3(a[0]), r3(a[1])]), rotation: propOf(T, Ro, 1, 0.2, a => r3(a[0])), opacity: propOf(T, Op, 1, 0.5, a => r3(a[0])) } }));
      }
    }
    // 音频
    const audioFiles = [];
    if (S.aeAudio !== 'none' && rec.sfx.length) {
      try {
        if (S.aeAudio === 'both' || S.aeAudio === 'mixed') {
          const buf = await renderSfxOffline(rec.sfx, D);
          if (buf) { audioFiles.push({ name: 'audio/mix.wav', data: encodeWav(buf) }); assets.push({ id: 'mix', file: 'audio/mix.wav', folder: 'aud', name: 'mix.wav' }); mainLayers.push(L(N('混合音轨', 'Mixed audio'), { asset: 'mix' }, { label: LABEL.audio })); }
        }
        if (S.aeAudio === 'both' || S.aeAudio === 'events') {
          const names = [...new Set(rec.sfx.map(e => e.name))], layers = [];
          for (const nm of names) {
            const first = rec.sfx.find(e => e.name === nm), buf = await renderSfxOffline([{ t: 0, name: nm, vol: 1, dur: first.dur }], 2.2);
            if (!buf) continue; audioFiles.push({ name: `audio/sfx_${nm}.wav`, data: encodeWav(buf) }); assets.push({ id: 'sfx_' + nm, file: `audio/sfx_${nm}.wav`, folder: 'aud', name: `sfx_${nm}.wav` });
          }
          rec.sfx.forEach((e, i) => { const st = r4(e.t + (e.delay || 0)); layers.push(L(`${N('音效', 'SFX')} ${i + 1} ${e.name}`, { asset: 'sfx_' + e.name }, { start: st, in: st, label: LABEL.audio, audioDb: Math.round(20 * Math.log10(Math.max(1e-4, e.vol)) * 10) / 10 })); });
          comps.push({ id: 'sfx', name: N('音效_逐事件', 'SFX events'), w: CW, h: CH, duration: D, fps, folder: 'pre', layers });
          mainLayers.push(L(N('音效_逐事件', 'SFX events'), { comp: 'sfx' }, { label: LABEL.audio }));
        }
      } catch (e) { console.warn('audio export', e); }
    }
    for (const [t, name] of rec.events) mainMarkers.push([r4(t), name]);
    const d = new Date(), p2 = x => String(x).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    comps.push({ id: 'main', name: N('主合成_积木塔', 'Main_BlockTower'), w: CW, h: CH, duration: D, fps, folder: 'root', bg: [0.3, 0.6, 0.85], layers: mainLayers, markers: mainMarkers });
    const stats = { comps: comps.length, layers: 0, keys: 0, perComp: {}, towerFrames: towers.length };
    for (const c of comps) { stats.perComp[c.id] = c.layers.length; stats.layers += c.layers.length; for (const l of c.layers) if (l.tr) for (const k of ['position', 'scale', 'rotation', 'opacity']) { const kc = keyCount(l.tr[k]); if (kc > 1) stats.keys += kc; } }
    // 预合成放前面（jsx 先建所有 comp，再按顺序加图层，被引用的预合成必须先填充）
    comps.sort((a, b) => (a.id === 'main') - (b.id === 'main'));
    const timeline = { meta: { tool: 'block-tower-tool', format: 1, theme: S.theme, created: d.toISOString(), fps, width: CW, height: CH, duration: D, canvas: [W, H], scale: K, sampling: 'reduce', saveAep: S.aeSaveAep !== false, aepName: `blocktower_${stamp}.aep`, newProject: true, stats, note: '图层从下到上排列；时间单位秒；位置/锚点单位像素；缩放为百分比。积木塔为预渲染 PNG 序列（带透明）。' }, folders, assets: assets.map(({ id, file, folder, w, h, name }) => ({ id, file, folder, w, h, name })), comps, mainComp: 'main' };
    const enc = new TextEncoder();
    const files = [{ name: 'build_ae_project.jsx', data: enc.encode(JSX_TEXT) }, { name: 'timeline.json', data: enc.encode(JSON.stringify(timeline)) }, { name: 'README_AE.md', data: enc.encode(README_TEXT) }, ...assetFiles.sort((a, b) => a.name < b.name ? -1 : 1), ...audioFiles];
    return { blob: makeZip(files), name: `blocktower_ae_export_${stamp}.zip`, timeline, stats, files: files.length, fileList: files, snaps: [] };
  }
  return { start, stop, sample, exportZip, active, elapsed, get rec() { return R; } };
}
