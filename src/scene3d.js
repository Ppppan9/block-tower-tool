// 积木塔 · three.js 场景：树桩 + 积木 + 灯光 + 相机；cannon-es 只负责“倒塌”动画（是否倒塌由 core.js 静力判定，确定性）
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'cannon-es';
import { pal, drawSym, shade, mix, rr } from './art.js';
import { DIM } from './core.js';

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };

export function woodSideCanvas(key, S, seed = 1) {
  const P = pal(key), c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), rnd = mulberry(seed * 977 + key.length * 31);
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, shade(P.main, 0.08)); gr.addColorStop(1, shade(P.main, -0.06)); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.lineCap = 'round';
  // 木纹：长而起伏的亮/暗纹（参考视频里彩色积木上清晰可见的白色旋涡纹）
  for (let i = 0; i < 26; i++) {
    const y = 2 + i * 5 + rnd() * 4, a1 = (rnd() - 0.5) * 16, a2 = (rnd() - 0.5) * 16, lw = 0.7 + rnd() * 2.6, light = rnd() < 0.62; g.beginPath();
    g.moveTo(-5, y); g.bezierCurveTo(60, y + a1, 150, y + a2, 261, y + (a1 - a2) * 0.4);
    g.strokeStyle = light ? `rgba(255,255,255,${0.2 * S.grain + 0.03})` : `rgba(0,0,0,${0.16 * S.grain + 0.02})`; g.lineWidth = lw; g.stroke();
  }
  // 大块年轮晕纹
  for (let i = 0; i < 3; i++) { const cx = 20 + rnd() * 220, cy = 18 + rnd() * 90; for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(cx, cy, 14 * k + rnd() * 6, 3.4 * k + rnd() * 2, (rnd() - 0.5) * 0.15, 0, 7); g.strokeStyle = `rgba(255,255,255,${0.15 * S.grain * (1 - k * 0.15)})`; g.lineWidth = 1 + rnd(); g.stroke(); } }
  // 木节
  if (S.grain > 0.15) for (let i = 0; i < 2; i++) { const x = 30 + rnd() * 200, y = 20 + rnd() * 90; g.strokeStyle = `rgba(0,0,0,${0.12 * S.grain})`; g.lineWidth = 1.4; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(x, y, 5 * k + 4, 2.2 * k + 1.5, 0, 0, 7); g.stroke(); } }
  // 边缘压暗（上下沿）
  const eg = g.createLinearGradient(0, 0, 0, 128); eg.addColorStop(0, `rgba(0,0,0,${S.edgeShade * 0.2})`); eg.addColorStop(0.08, 'rgba(0,0,0,0)'); eg.addColorStop(0.92, 'rgba(0,0,0,0)'); eg.addColorStop(1, `rgba(0,0,0,${S.edgeShade * 0.5})`); g.fillStyle = eg; g.fillRect(0, 0, 256, 128);
  return c;
}
export function woodEndCanvas(key, S) {
  const P = pal(key), c = document.createElement('canvas'); c.width = 160; c.height = 104; const g = c.getContext('2d');
  g.fillStyle = shade(P.main, 0.1); g.fillRect(0, 0, 160, 104);
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1.5; for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(80, 54, 18 * k, 12 * k, 0, 0, 7); g.stroke(); }
  const d = S.symbolDepth;
  g.save(); g.translate(0, 2.2); drawSym(g, P.sym, 80, 52, 24, { fill: `rgba(255,255,255,${0.35 * d})`, lw: 8 }); g.restore();
  drawSym(g, P.sym, 80, 52, 24, { fill: shade(P.main, -0.45 * (0.4 + d)), lw: 8 });
  const eg = g.createLinearGradient(0, 0, 0, 104); eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, `rgba(0,0,0,${S.edgeShade * 0.5})`); g.fillStyle = eg; g.fillRect(0, 0, 160, 104);
  return c;
}
function stumpTopCanvas(S) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), rnd = mulberry(7);
  const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, shade(S.stumpTop, 0.12)); gr.addColorStop(0.8, S.stumpTop); gr.addColorStop(1, S.stumpRing); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.lineWidth = 2.5; for (let r = 24; r < 250; r += 14 + rnd() * 10) { g.beginPath(); for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, rr2 = r * (1 + 0.04 * Math.sin(t * 3 + r) + 0.02 * Math.sin(t * 7 + r * 2)); g.lineTo(256 + Math.cos(t) * rr2, 256 + Math.sin(t) * rr2); } g.closePath(); g.strokeStyle = `rgba(${150 + rnd() * 30},${100 + rnd() * 30},60,${0.26 + rnd() * 0.16})`; g.stroke(); }
  if (S.stumpCracks) { g.strokeStyle = 'rgba(90,60,40,.55)'; g.lineWidth = 2; for (const a of [0.12, 1.75]) { g.beginPath(); g.moveTo(256 - Math.cos(a) * 250, 256 - Math.sin(a) * 250); g.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); g.stroke(); } }
  return c;
}

export function createScene(glCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.5, 200);
  const amb = new THREE.HemisphereLight(0xffffff, 0xbfa88a, 0.75); scene.add(amb);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 12, bottom: -6, near: 1, far: 60 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
  const tower = new THREE.Group(); scene.add(tower);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.3 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.12; ground.receiveShadow = true; scene.add(ground);
  const API = { renderer, scene, camera, tower, meshes: [], blocks: [], propsGroup: null, yaw: 0, zoom: 1, W: 720, H: 1600, view: { towerY: 0.68 }, fitD: 20, S: null };
  const raycaster = new THREE.Raycaster();
  let stumpGroup = null, blockGroup = new THREE.Group(); tower.add(blockGroup);
  const texCache = new Map(), matCache = new Map(); let geoCache = new Map();

  API.applyLights = S => {
    renderer.toneMapping = THREE.LinearToneMapping; renderer.toneMappingExposure = S.exposure || 1; amb.intensity = S.ambient; sun.intensity = S.lightIntensity * 1.6;
    const a = S.lightAngle * Math.PI / 180; sun.position.set(Math.sin(a) * 9, 14, Math.cos(a) * 9 + 3); sun.target.position.set(0, 2, 0);
    sun.shadow.radius = S.shadowSoft; ground.material.opacity = S.shadowStrength * 0.8;
    sun.shadow.needsUpdate = true;
  };
  API.clearCaches = () => { for (const t of texCache.values()) t.dispose(); texCache.clear(); for (const m of matCache.values()) m.forEach(x => x.dispose()); matCache.clear(); geoCache.clear(); };
  function mats(key, S) {
    const k = key + '|' + S.grain + '|' + S.symbolDepth + '|' + S.edgeShade + '|' + S.blockGloss + '|' + pal(key).main;
    let m = matCache.get(k); if (m) return m;
    const side = tex(woodSideCanvas(key, S, 3)), top = tex(woodSideCanvas(key, S, 11)), end = tex(woodEndCanvas(key, S));
    const mk = map => new THREE.MeshStandardMaterial({ map, roughness: 0.78 - S.blockGloss * 0.45, metalness: 0 });
    const endM = mk(end), sideM = mk(side), topM = mk(top);
    m = [endM, endM, topM, topM, sideM, sideM]; matCache.set(k, m); return m;
  }
  function geo(b, S) {
    const k = [b.len, b.wid, b.hgt, S.blockRadius].join(','); let g = geoCache.get(k);
    if (!g) { g = new RoundedBoxGeometry(b.len, b.hgt, b.wid, 3, Math.min(S.blockRadius, b.hgt / 2 - 0.01, b.wid / 2 - 0.01)); geoCache.set(k, g); }
    return g;
  }
  // 整体构建（关卡切换 / 外观变化）
  API.build = function (lv, S) {
    API.S = S; API.lv = lv; API.clearCaches(); API.stopCollapse();
    while (blockGroup.children.length) blockGroup.remove(blockGroup.children[0]);
    API.meshes = []; API.blocks = lv.blocks;
    for (const b of lv.blocks) {
      const g = geo(b, S), m = new THREE.Mesh(g, mats(b.color, S).slice()); m.castShadow = true; m.receiveShadow = true; m.userData.id = b.id;
      const ol = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(S.highlightColor), side: THREE.BackSide })); ol.scale.set(1.035, 1.12, 1.07); ol.visible = false; ol.name = 'outline'; m.add(ol);
      m.position.set(b.x, b.y, b.z); m.rotation.set(0, b.yaw, 0); blockGroup.add(m); API.meshes[b.id] = m;
    }
    API.buildStump(S);
    API.applyLights(S);
  };
  API.buildStump = function (S) {
    if (stumpGroup) { tower.remove(stumpGroup); stumpGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    const R = S.stumpR; stumpGroup = new THREE.Group(); tower.add(stumpGroup);
    // 侧壁：lathe + 随机波动
    const prof = [[R - 0.18, 0.0], [R - 0.02, -0.04], [R + 0.03, -0.12], [R + 0.03, -0.3], [R + 0.08, -0.46], [R + 0.22, -0.6], [R + 0.3, -0.66]].map(p => new THREE.Vector2(p[0], p[1]));
    const lg = new THREE.LatheGeometry(prof, 72), pos = lg.attributes.position, col = new Float32Array(pos.count * 3), c1 = new THREE.Color(S.stumpBark), c2 = new THREE.Color(S.stumpBarkDark), c0 = new THREE.Color(S.stumpTop);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), w = 1 + 0.035 * Math.sin(a * 3 + 1) + 0.022 * Math.sin(a * 5 + 2) + 0.012 * Math.sin(a * 9);
      pos.setXYZ(i, x * w, y, z * w);
      const t = Math.min(1, Math.max(0, -y / 0.66)), cc = y > -0.06 ? c0.clone() : c1.clone().lerp(c2, Math.pow(t, 0.8));
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    lg.setAttribute('color', new THREE.BufferAttribute(col, 3)); lg.computeVertexNormals();
    const side = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); side.receiveShadow = true; stumpGroup.add(side);
    const topG = new THREE.CircleGeometry(R - 0.16, 72); topG.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topG, new THREE.MeshStandardMaterial({ map: tex(stumpTopCanvas(S)), roughness: 0.85 })); top.position.y = 0.003; top.receiveShadow = true; stumpGroup.add(top);
    if (S.mushroom) {
      const m = new THREE.Group(), st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0xfff1de })); st.position.y = 0.1; m.add(st);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8423a })); cap.position.y = 0.2; m.add(cap);
      for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); const a = i * 1.3, r = 0.1 + (i % 2) * 0.06; sp.position.set(Math.cos(a) * r, 0.2 + Math.sqrt(Math.max(0.01, 0.04 - r * r * 0.5)) * 0.9 + 0.03, Math.sin(a) * r); sp.lookAt(sp.position.clone().multiplyScalar(2)); m.add(sp); }
      m.position.set(-R * 0.92, -0.25, R * 0.52); m.scale.setScalar(1.5); m.castShadow = true; stumpGroup.add(m);
    }
    if (S.sprout) {
      const lf = new THREE.MeshStandardMaterial({ color: 0x5fbf4a, side: THREE.DoubleSide }), sp = new THREE.Group();
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), lf); l.scale.set(1.6, 0.8, 1); l.position.set(s * 0.14, 0.05, 0); l.rotation.set(-1.0, 0, s * 0.5); sp.add(l); }
      sp.position.set(R * 0.28, -0.42, R * 1.0); sp.rotation.x = 0.35; stumpGroup.add(sp);
    }
  };
  API.setSize = (w, h) => { API.W = w; API.H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  // 相机：绕塔固定方位，俯仰 camElev；distance 由取景 + 缩放决定；塔底投影到画面 towerY
  API.towerTop = () => { let m = 0; for (const b of API.blocks) if (API.present ? API.present[b.id] : true) m = Math.max(m, b.y + b.hgt / 2); return m; };
  API.fit = function (S, zoomK = 1, topH = null) {
    const W = API.W, H = API.H, el = S.camElev * Math.PI / 180;
    camera.fov = S.camFov; camera.aspect = W / H;
    const th = topH ?? (API.blocks.length ? Math.max(...API.blocks.map(b => b.y + b.hgt / 2)) : 3);
    const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    const tgt = new THREE.Vector3(0, 0.0, 0);
    const probe = d => {
      camera.position.copy(dir).multiplyScalar(d).add(tgt); camera.lookAt(tgt); camera.clearViewOffset(); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const sy = (S.towerY - 0.5) * H; camera.setViewOffset(W, H, 0, -sy, W, H); camera.updateProjectionMatrix();
      const pj = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; };
      let minX = 1e9, maxX = -1e9; const R = S.stumpR + 0.3;
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, p = pj(Math.cos(a) * R, -0.9, Math.sin(a) * R); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); }
      const top = pj(0, th, 0)[1];
      return { w: maxX - minX, top };
    };
    // 取景：树桩总宽 ≤ min(1-2·margin, fitTall/塔高)·W（高塔相机拉远，对应参考视频 L5），且塔顶不压到 HUD（≥0.38H）
    const sw = String(S.stumpWidths || '').split(',').map(parseFloat)[(API.levelNum || 1) - 1], wMax = isFinite(sw) && sw > 0 ? sw : Math.min(1 - 2 * S.fitMargin, S.fitTall / Math.max(1, th));
    let lo = 6, hi = 90;
    for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2, p = probe(mid); if (p.w > W * wMax || p.top < H * 0.3) lo = mid; else hi = mid; }
    API.fitD = hi; const d = hi / (zoomK || 1);
    probe(d); API.zoomD = d;
  };
  API.project = (v3) => { const v = v3.clone().project(camera); return { x: (v.x * 0.5 + 0.5) * API.W, y: (-v.y * 0.5 + 0.5) * API.H, z: v.z }; };
  API.worldPos = id => { const m = API.meshes[id]; const v = new THREE.Vector3(); m.getWorldPosition(v); return v; };
  API.blockScreen = id => { // 中心 + 长轴端点 + 宽度（屏幕 px）
    const m = API.meshes[id], b = API.blocks[id]; m.updateWorldMatrix(true, false);
    const L = b.len / 2, Wd = b.wid / 2;
    const P = (x, y, z) => API.project(new THREE.Vector3(x, y, z).applyMatrix4(m.matrixWorld));
    const c = P(0, 0, 0), e1 = P(L, 0, 0), e2 = P(-L, 0, 0), s1 = P(0, 0, Wd), s2 = P(0, 0, -Wd), t = P(0, b.hgt / 2, 0), u = P(0, -b.hgt / 2, 0);
    return { x: c.x, y: c.y, e1, e2, len: Math.hypot(e1.x - e2.x, e1.y - e2.y), wid: Math.max(Math.hypot(s1.x - s2.x, s1.y - s2.y), Math.hypot(t.x - u.x, t.y - u.y)), ang: Math.atan2(e1.y - e2.y, e1.x - e2.x) };
  };
  API.pick = (px, py, ids) => {
    raycaster.setFromCamera(new THREE.Vector2(px / API.W * 2 - 1, -(py / API.H * 2 - 1)), camera);
    const objs = ids.map(i => API.meshes[i]).filter(m => m && m.visible);
    const hits = raycaster.intersectObjects(objs, false);
    return hits.length ? hits[0].object.userData.id : -1;
  };
  API.setYaw = y => { API.yaw = y; tower.rotation.y = y; };
  API.setOutline = (id, on, color) => { const m = API.meshes[id]; if (!m) return; const o = m.getObjectByName('outline'); if (o) { o.visible = !!on; if (color) o.material.color.set(color); } };
  API.setGhost = (id, a) => {
    const m = API.meshes[id]; if (!m) return; const base = mats(API.blocks[id].color, API.S);
    if (a >= 0.999) { m.material = base.slice(); m.castShadow = true; return; }
    m.material = base.map(x => { const c = x.clone(); c.transparent = true; c.opacity = a; return c; });
  };
  API.setGhostAlpha = (id, a) => { const m = API.meshes[id]; if (!m) return; for (const x of Array.isArray(m.material) ? m.material : [m.material]) if (x.transparent) x.opacity = Math.max(0, a); m.visible = a > 0.01 || m.visible; };
  API.setBasePose = id => { const b = API.blocks[id], m = API.meshes[id]; m.position.set(b.x, b.y, b.z); m.quaternion.setFromEuler(new THREE.Euler(0, b.yaw, 0)); m.scale.set(1, 1, 1); };
  API.makeBlock = (b, S) => { const m = new THREE.Mesh(geo(b, S), mats(b.color, S).slice()); m.name = 'Block_' + b.id; m.castShadow = true; return m; };
  API.stumpClone = () => stumpGroup ? stumpGroup.clone(true) : new THREE.Group();
  API.cameraState = () => {
    camera.updateMatrixWorld(); const eye = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const c = new THREE.Vector3(0, 0, 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld); // 画面中心射线（含 viewOffset）
    const m = new THREE.Matrix4().lookAt(eye, c, new THREE.Vector3(0, 1, 0)), q = new THREE.Quaternion().setFromRotationMatrix(m);
    const f = n => Math.round(n * 1e4) / 1e4;
    return { p: eye.toArray(), q: q.toArray(), fov: camera.fov, aspect: camera.aspect, yaw: API.yaw, sig: [eye.x, eye.y, eye.z, q.x, q.y, API.yaw].map(v => Math.round(v * 300)).join(',') };
  };
  API.poses = () => API.meshes.map(m => ({ p: m.position.toArray(), q: m.quaternion.toArray(), v: m.visible }));

  // ---- 倒塌（cannon-es） ----
  let world = null, bodies = new Map(), cTime = 0;
  API.collapse = null;
  API.startCollapse = function (ids, S, seed = 1, opt = {}) {
    API.stopCollapse();
    world = new CANNON.World({ gravity: new CANNON.Vec3(0, -S.gravity, 0) }); world.allowSleep = true; world.solver.iterations = 18;
    const mat = new CANNON.Material('wood'); world.defaultContactMaterial = new CANNON.ContactMaterial(mat, mat, { friction: 0.1, restitution: S.restitution }); fric = S.friction;
    const stump = new CANNON.Body({ mass: 0, material: mat }); stump.addShape(new CANNON.Cylinder(S.stumpR - 0.05, S.stumpR - 0.05, 1.1, 28)); stump.position.set(0, -0.55, 0); world.addBody(stump);
    const gnd = new CANNON.Body({ mass: 0, material: mat }); gnd.addShape(new CANNON.Plane()); gnd.quaternion.setFromEuler(-Math.PI / 2, 0, 0); gnd.position.set(0, -1.1, 0); world.addBody(gnd);
    { const WR = S.stumpR + (S.collapseWall ?? 1.9), nW = 16; for (let i = 0; i < nW; i++) { const ang = i / nW * Math.PI * 2, wall = new CANNON.Body({ mass: 0, material: mat }); wall.addShape(new CANNON.Box(new CANNON.Vec3(0.3, 4, WR * Math.PI / nW * 1.08))); wall.position.set(Math.cos(ang) * (WR + 0.3), 2.5, Math.sin(ang) * (WR + 0.3)); wall.quaternion.setFromEuler(0, -ang, 0); world.addBody(wall); } }
    const rnd = mulberry(seed * 31 + 7); bodies = new Map(); cTime = 0; acc = 0; burst = { done: false, r: mulberry(seed * 77 + 5) };
    // 倒塌强度：塔越高越猛烈（参考视频 L2 轻微扭塌、L3 塌成一堆、L5 整塔炸开）
    let yMin = 1e9, yMax = -1e9; for (const id of ids) { const b = API.blocks[id]; yMin = Math.min(yMin, b.y); yMax = Math.max(yMax, b.y + b.hgt / 2); }
    const floors = Math.max(1, (yMax - yMin) / (API.blocks[ids[0]] ? API.blocks[ids[0]].hgt : 0.8)), viol = Math.max(2.1, Math.min(2.5, 0.7 + (ids.length - 6) * 0.09)) * (opt.violence ?? 1);
    const lr = Math.hypot(...(opt.pulledXZ || [0, 0])) || 0, ang = lr > 0.05 ? Math.atan2(opt.pulledXZ[1], opt.pulledXZ[0]) : rnd() * 6.28, lx = Math.cos(ang), lz = Math.sin(ang);
    const py = opt.pulledY ?? -1e9, pxz = opt.pulledXZ || [0, 0], k = S.collapseKick * viol, twist = (rnd() < 0.5 ? -1 : 1);
    for (const id of ids) {
      const b = API.blocks[id], m = API.meshes[id];
      const body = new CANNON.Body({ mass: b.len * b.wid * b.hgt, material: mat, linearDamping: S.linDamp, angularDamping: S.angDamp, allowSleep: true, sleepSpeedLimit: 0.15, sleepTimeLimit: 0.6 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(b.len / 2, b.hgt / 2, b.wid / 2)));
      body.position.set(m.position.x, m.position.y, m.position.z); body.quaternion.set(m.quaternion.x, m.quaternion.y, m.quaternion.z, m.quaternion.w);
      const h = Math.max(0, Math.min(1, (m.position.y - yMin) / Math.max(0.01, yMax - yMin))), above = m.position.y >= py - 0.05 ? 1 : 0.9;
      const rx = m.position.x, rz = m.position.z, rl = Math.hypot(rx, rz) || 1, hh = (0.85 + 0.15 * Math.pow(h, 0.8)) * above;
      // 倾倒方向（被拔块一侧）+ 向外推 + 绕轴扭转 + 随机扰动：越高越猛
      const ca = Math.atan2(rz, rx) + (rl < 0.35 ? rnd() * 6.28 : 0), cx = rl < 0.35 ? Math.cos(ca) : rx / rl, cz = rl < 0.35 ? Math.sin(ca) : rz / rl;
      const lean = k * 9.0 * (0.35 + 0.65 * h) * above, rad = k * 2.2 * hh, bias = S.collapseBias ?? 0.3, ra = rnd() * 6.283, lx2 = lx * bias + (cx * 0.5 + Math.cos(ra) * 0.8) * (1 - bias), lz2 = lz * bias + (cz * 0.5 + Math.sin(ra) * 0.8) * (1 - bias), rnd2 = () => (rnd() - 0.5) * 2;
      body.velocity.set(lx2 * lean + cx * rad + rnd2() * k * 1.3 * hh - twist * rz * 0.5 * k * hh, (rnd() - 0.1) * k * 3.2 * hh, lz2 * lean + cz * rad + rnd2() * k * 1.0 * hh + twist * rx * 0.5 * k * hh);
      body.angularVelocity.set(rnd2() * k * 5 * hh + lz * k * 2.4 * hh, rnd2() * k * 3 * hh + twist * k * 1.2 * hh, rnd2() * k * 5 * hh - lx * k * 2.4 * hh);
      world.addBody(body); bodies.set(id, body);
    }
    API.collapse = { ids: ids.slice(), t: 0, violence: viol };
  };
  let acc = 0, fric = 0.5, burst = { done: false, r: Math.random };
  // 固定步长（与帧率无关）：1/120 s，最多 40 步/次
  API.stepPhysics = function (dt) {
    if (!world) return;
    acc += Math.min(dt, 0.25); let n = 0; const h = 1 / 120;
    if (!burst.done && cTime >= 0.6 && API.collapse && API.collapse.violence > 1.5) { burst.done = true; const B = (Math.min(1, (API.collapse.violence - 1.5) / 1.1) * 5.5 + 3.2) * 0.6; for (const body of bodies.values()) { const r = Math.hypot(body.position.x, body.position.z) || 1; body.velocity.x += body.position.x / r * B * (0.5 + burst.r()) + (burst.r() - 0.5) * B; body.velocity.z += body.position.z / r * B * (0.5 + burst.r()) + (burst.r() - 0.5) * B; body.velocity.y += burst.r() * B * 0.9; body.angularVelocity.x += (burst.r() - 0.5) * B * 3; body.angularVelocity.z += (burst.r() - 0.5) * B * 3; body.wakeUp(); } }
    while (acc >= h && n < 40) { if (cTime > 1.3) world.defaultContactMaterial.friction = fric; world.step(h); acc -= h; n++; cTime += h; }
    if (acc >= h) acc = 0;
    for (const [id, body] of bodies) { const m = API.meshes[id]; m.position.set(body.position.x, body.position.y, body.position.z); m.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w); }
    API.collapse.t = cTime;
  };
  API.bodyInfo = () => [...bodies.entries()].map(([id, b]) => ({ id, y: +b.position.y.toFixed(2), v: +b.velocity.length().toFixed(2), s: b.sleepState, m: +b.mass.toFixed(2) }));
  API.collapseSettled = () => { if (!world) return true; for (const b of bodies.values()) if (b.sleepState !== CANNON.Body.SLEEPING && (b.velocity.lengthSquared() > 0.04 || b.angularVelocity.lengthSquared() > 0.04)) return false; return true; };
  let rw = null;
  API.rewindStart = ids => { rw = ids.map(id => { const m = API.meshes[id], b = API.blocks[id]; return { id, p0: m.position.clone(), q0: m.quaternion.clone(), p1: new THREE.Vector3(b.x, b.y, b.z), q1: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, b.yaw, 0)) }; }); };
  API.rewindStep = k => { if (!rw) return; for (const r of rw) { const m = API.meshes[r.id]; m.position.lerpVectors(r.p0, r.p1, k); m.quaternion.slerpQuaternions(r.q0, r.q1, k); } if (k >= 1) rw = null; };
  API.stopCollapse = () => { world = null; bodies = new Map(); API.collapse = null; };
  return API;
}
