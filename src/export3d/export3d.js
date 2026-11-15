// 导出 3D 动画：glTF 2.0 (.glb) —— 树桩 + 每块积木（真实 3D 网格 + 木纹贴图）+ 相机，逐帧位姿动画（含倒塌物理轨迹）
// 复用 AE 记录器采到的 rec.segs（每关一段：每帧每块的位置/旋转/可见 + 相机）。
// 坐标：glTF Y 轴向上，1 单位 = 1 个积木格（宽 0.98 / 长 3 / 高 0.62）。
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { makeZip } from '../ae/zip.js';
import { renderSfxOffline, encodeWav } from '../audio.js';
import PY_TEXT from './blender_import.py';
import README_TEXT from './README_3D.md';

const r5 = x => Math.round(x * 1e5) / 1e5;
function reduceKeys(times, vals, n) {
  const T = [], V = [], same = (i, j) => { for (let k = 0; k < n; k++) if (Math.abs(vals[i * n + k] - vals[j * n + k]) > 1e-6) return false; return true; };
  const m = times.length;
  for (let i = 0; i < m; i++) { if (i > 0 && i < m - 1 && same(i, i - 1) && same(i, i + 1)) continue; T.push(times[i]); for (let k = 0; k < n; k++) V.push(vals[i * n + k]); }
  return { T, V };
}

export async function export3D({ S, rec, api }) {
  const D = Math.max(0.1, rec.duration), fps = rec.fps, W = rec.W, H = rec.H;
  const root = new THREE.Scene(); root.name = 'blocktower_scene';
  const tracks = [], stats = { levels: 0, blocks: 0, tracks: 0, frames: rec.frames };
  const add = (node, prop, times, vals, n, interp) => {
    let { T, V } = reduceKeys(times, vals, n);
    if (T.length === 1) { T.push(Math.max(D, T[0] + 1 / fps)); for (let k = 0; k < n; k++) V.push(V[k]); }
    const Tr = prop === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    tracks.push(new Tr(node.name + '.' + prop, T, V, interp)); stats.tracks++;
  };
  const LIN = THREE.InterpolateLinear, STEP = THREE.InterpolateDiscrete;
  // 灯光
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.name = 'Sun'; const la = S.lightAngle * Math.PI / 180; sun.position.set(Math.sin(la) * 9, 14, Math.cos(la) * 9 + 3); sun.target.position.set(0, 2, 0); root.add(sun, sun.target);
  // 塔（绕 Y 旋转的枢轴）
  const pivot = new THREE.Group(); pivot.name = 'Tower'; root.add(pivot);
  const stump = api.stumpClone(); stump.name = 'Stump'; pivot.add(stump);
  const segTimes = [];
  rec.segs.forEach((seg, si) => {
    stats.levels++;
    const grp = new THREE.Group(); grp.name = `Level_${seg.n}_${si + 1}`; pivot.add(grp);
    const meshes = seg.blocks.map(b => { const m = api.makeBlock(b, S); m.name = `L${seg.n}_${si + 1}_Block_${b.id}`; grp.add(m); stats.blocks++; return m; });
    const t0 = seg.f0 / fps, t1 = (seg.f1 + 1) / fps;
    // 关卡显隐（STEP 缩放）
    const vt = [0], vv = [seg.f0 > 0 ? 0 : 1, seg.f0 > 0 ? 0 : 1, seg.f0 > 0 ? 0 : 1];
    if (seg.f0 > 0) { vt.push(r5(t0)); vv.push(1, 1, 1); }
    vt.push(r5(t1)); vv.push(0, 0, 0);
    if (vt.length > 1 && vt[0] === vt[1]) { vt.shift(); vv.splice(0, 3); }
    add(grp, 'scale', vt, vv, 3, STEP);
    const ts = seg.poses.map(e => r5(e[0] / fps));
    meshes.forEach((m, bi) => {
      const P = [], Q = [], Sc = []; let anyHidden = false;
      for (const [f, ps] of seg.poses) { const o = ps[bi]; P.push(...o.p); Q.push(...o.q); const k = o.v ? 1 : 0; if (!k) anyHidden = true; Sc.push(k, k, k); }
      add(m, 'position', ts, P, 3, LIN); add(m, 'quaternion', ts, Q, 4, LIN); if (anyHidden) add(m, 'scale', ts, Sc, 3, STEP);
      m.position.set(...seg.poses[0][1][bi].p); m.quaternion.set(...seg.poses[0][1][bi].q);
    });
  });
  // 塔旋转（滑动转塔）
  const allCam = []; for (const seg of rec.segs) for (const [f, c] of seg.cam) allCam.push([f, c]);
  allCam.sort((a, b) => a[0] - b[0]);
  const cam = new THREE.PerspectiveCamera(allCam.length ? allCam[0][1].fov : S.camFov, W / H, 0.1, 200); cam.name = 'Camera'; root.add(cam);
  if (allCam.length) {
    const ts = allCam.map(e => r5(e[0] / fps));
    // 欧拉解缠：yaw 本身是连续弧度
    add(pivot, 'quaternion', ts, allCam.flatMap(([f, c]) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw).toArray()), 4, LIN);
    add(cam, 'position', ts, allCam.flatMap(([f, c]) => c.p), 3, LIN);
    add(cam, 'quaternion', ts, allCam.flatMap(([f, c]) => c.q), 4, LIN);
    cam.position.set(...allCam[0][1].p); cam.quaternion.set(...allCam[0][1].q);
  }
  const clip = new THREE.AnimationClip('BlockTowerPlay', D, tracks);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, animations: [clip], onlyVisible: false, trs: true });
  const enc = new TextEncoder(), d = new Date(), p2 = x => String(x).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  const out = [
    { name: 'blocktower_3d.glb', data: new Uint8Array(glb) },
    { name: 'timeline3d.json', data: enc.encode(JSON.stringify({ tool: 'block-tower-tool', fps, duration: D, width: W, height: H, levels: rec.segs.map(s => ({ level: s.n, from: s.f0 / fps, to: (s.f1 + 1) / fps, blocks: s.blocks.length })), events: rec.events, stats })) },
    { name: 'blender_import.py', data: enc.encode(PY_TEXT) },
    { name: 'README_3D.md', data: enc.encode(README_TEXT) },
  ];
  if (rec.sfx.length && S.aeAudio !== 'none') { try { const buf = await renderSfxOffline(rec.sfx, D); if (buf) out.push({ name: 'audio/mix.wav', data: encodeWav(buf) }); } catch (e) { console.warn(e); } }
  return { blob: makeZip(out), name: `blocktower_3d_export_${stamp}.zip`, stats, duration: D, fps, glbSize: glb.byteLength, fileList: out };
}
