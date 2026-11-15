// 导出测试：AE 工程包（timeline.json 完整性）+ 3D glb（gltf-validator 无 error）
import { launch, root } from './lib.mjs';
import fs from 'fs'; import { execFileSync } from 'child_process';
import validator from 'gltf-validator';
const { browser, page, errors } = await launch({ wait: 800, url: process.env.URL });
let pass = 0, fail = 0; const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); c ? pass++ : fail++; };
await page.evaluate(() => { __app.setSetting('autoSpeed', 5); __app.setSetting('introMs', 200); __app.setSetting('aeTowerFps', 10); __app.setSetting('aeTowerScale', 0.4); });
await page.evaluate(() => __app.aeStart());
await page.click('#btnAuto');
await page.waitForFunction(() => __app.G.panel === 'win', null, { timeout: 120000 });
await page.evaluate(() => __app.stopAuto(true)); await page.waitForTimeout(500);
// 记录第二关的一小段（验证多关 segs）
await page.evaluate(() => __app.nextLevel()); await page.waitForTimeout(6000);
await page.evaluate(() => __app.stopAuto(true));
const rec = await page.evaluate(() => { const r = __app.AE.rec; return { frames: r.frames, tracks: r.tracks.size, tower: r.tower.length, segs: r.segs.length, sfx: r.sfx.length }; });
check(rec.frames > 100 && rec.tracks > 10 && rec.tower > 3 && rec.segs === 2, `记录器采样 ${JSON.stringify(rec)}`);
// AE
const dlAE = page.waitForEvent('download', { timeout: 120000 });
await page.evaluate(() => { window.__aeP = __app.aeStopAndExport(); });
const d1 = await dlAE; const aePath = '/tmp/ae_export.zip'; await d1.saveAs(aePath);
const outDir = '/tmp/ae_unz'; fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir);
execFileSync('unzip', ['-q', aePath, '-d', outDir]);
const tl = JSON.parse(fs.readFileSync(outDir + '/timeline.json', 'utf8'));
const main = tl.comps.find(c => c.id === 'main');
const missing = tl.assets.filter(a => !fs.existsSync(outDir + '/' + a.file));
check(main && main.layers.length > 10, `AE timeline.json：主合成 ${main && main.layers.length} 层，${tl.assets.length} 个素材，${tl.meta.stats.keys} 个关键帧`);
check(missing.length === 0, `AE 所有素材文件都在包内（缺 ${missing.length}）`);
check(fs.existsSync(outDir + '/build_ae_project.jsx') && fs.readFileSync(outDir + '/build_ae_project.jsx', 'utf8').includes('timeline.json'), 'AE build_ae_project.jsx 存在');
const towerPng = fs.readdirSync(outDir + '/assets/tower').filter(f => f.endsWith('.png')).length;
check(towerPng > 3, `AE 积木塔 PNG 序列 ${towerPng} 张`);
const badLayers = []; for (const c of tl.comps) for (const l of c.layers) { if (l.src.asset && !tl.assets.find(a => a.id === l.src.asset)) badLayers.push(l.name); if (l.src.comp && !tl.comps.find(x => x.id === l.src.comp)) badLayers.push(l.name); if (l.out !== undefined && l.in !== undefined && l.out < l.in) badLayers.push('range:' + l.name); }
check(badLayers.length === 0, `AE 图层引用/时间范围合法 ${badLayers.slice(0, 3)}`);
check(tl.comps.indexOf(main) === tl.comps.length - 1, 'AE 主合成排在预合成之后');
// 3D
const dl3 = page.waitForEvent('download', { timeout: 120000 });
await page.evaluate(() => { window.__3dP = __app.export3DZip(); });
const d2 = await dl3; await d2.saveAs('/tmp/3d_export.zip');
fs.rmSync('/tmp/3d_unz', { recursive: true, force: true }); fs.mkdirSync('/tmp/3d_unz'); execFileSync('unzip', ['-q', '/tmp/3d_export.zip', '-d', '/tmp/3d_unz']);
const files = fs.readdirSync('/tmp/3d_unz');
check(['blocktower_3d.glb', 'timeline3d.json', 'blender_import.py', 'README_3D.md'].every(f => files.includes(f)), `3D 包文件：${files.join(',')}`);
const glb = fs.readFileSync('/tmp/3d_unz/blocktower_3d.glb');
const rep = await validator.validateBytes(new Uint8Array(glb), { maxIssues: 50 });
check(rep.issues.numErrors === 0, `glb gltf-validator：errors=${rep.issues.numErrors} warnings=${rep.issues.numWarnings} (${(glb.length / 1024).toFixed(0)}KB) ${JSON.stringify(rep.issues.messages.filter(m => m.severity === 0).slice(0, 2))}`);
const info = rep.info; check(info.animationCount === 1 && info.totalTriangleCount > 1000, `glb 内容：动画 ${info.animationCount}，三角面 ${info.totalTriangleCount}，节点 ${info.nodeCount ?? '?'}，材质 ${info.materialCount}`);
const j = JSON.parse(fs.readFileSync('/tmp/3d_unz/timeline3d.json', 'utf8'));
check(j.levels.length === 2 && j.stats.blocks === 12 + 18, `3D timeline3d.json 两关 ${JSON.stringify(j.stats)}`);
check(errors.length === 0, 'no console errors ' + errors.slice(0, 3).join('|'));
console.log(`exports: ${pass} passed, ${fail} failed`);
await browser.close(); process.exit(fail ? 1 : 0);
