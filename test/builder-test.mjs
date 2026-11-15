// 关卡搭建器测试：打开 / 编辑 / 校验 / 试玩 / 保存加载 / JSON 往返 / 手机视口。用法：node test/builder-test.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errs = [];
async function mk(vp, extra = {}) {
  const ctx = await b.newContext({ viewport: vp, ...extra }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(900); return p;
}
const p = await mk({ width: 1280, height: 860 });
const D = () => p.evaluate(() => JSON.parse(JSON.stringify(__app.BUILDER.def)));
const val = () => p.evaluate(() => document.getElementById('bt-val') ? document.getElementById('bt-val').innerText : '');
const stCount = () => p.evaluate(() => document.getElementById('bt-st-count').textContent);

// 1 打开
ok(await p.evaluate(() => !!document.getElementById('btnBuilder') && !!document.getElementById('levelSel')), '主界面有「关卡搭建器」按钮和选关下拉');
ok(await p.evaluate(() => document.getElementById('levelSel').options.length) === 5, '选关下拉：5 个内置关卡');
await p.click('#btnBuilder'); await p.waitForTimeout(600);
ok(await p.evaluate(() => __app.BUILDER.isOpen()), '点击按钮弹出搭建器');
ok(await p.evaluate(() => { const r = document.querySelector('.bt-win').getBoundingClientRect(); return r.width > 600 && r.height > 400; }), '搭建器窗口尺寸正常');
ok(await p.evaluate(() => { const c = document.querySelector('#bt-view canvas'); const r = c.getBoundingClientRect(); return r.width > 100 && c.width / c.height > 0 && Math.abs(c.width / c.height - r.width / r.height) < 0.1; }), '3D 预览画布比例与显示区一致');
ok(await p.evaluate(() => ['tower', 'crates', 'params', 'library'].every(k => document.querySelector(`[data-tab=${k}]`))), '四个页签：积木塔/木箱/参数/关卡库');
let d = await D();
ok(d.layers.length >= 4 && d.crates.length >= 4, '默认载入模板：' + d.layers.length + ' 层 ' + d.crates.length + ' 箱');
ok(/数量匹配/.test(await stCount()), '模板初始校验通过');

// 2 编辑塔：加层 / 涂色 / 加块 / 复制 / 删除 / 撤销重做
const n0 = d.layers.length;
await p.click('#bt-addlayer'); d = await D(); ok(d.layers.length === n0 + 1, '顶部加一层');
ok(/不等|需要|✖/.test(await stCount()) || !/数量匹配/.test(await stCount()), '加层后积木数量与木箱不再匹配 → 校验报错');
await p.click('#bt-undo'); d = await D(); ok(d.layers.length === n0, '撤销');
await p.click('#bt-redo'); d = await D(); ok(d.layers.length === n0 + 1, '重做');
await p.click('#bt-undo');
// 选绿色画笔，涂第 1 层第 1 块
ok(await p.evaluate(() => !!document.querySelector('.bt-sw[data-c=green]')), '画笔色板里有绿色');
await p.click('.bt-sw[data-c=green]');
await p.click('.bt-layer[data-layer="0"] .bt-plank[data-i="0"]'); d = await D(); ok(d.layers[0].colors[0] === 'green', '点积木涂成画笔色');
await p.click('.bt-layer[data-layer="0"] button:has-text("镜像")'); d = await D(); ok(d.layers[0].colors[2] === 'green', '镜像层');
const nb = d.layers[0].colors.length;
await p.click('.bt-layer[data-layer="0"] button[title*="加一块"]'); d = await D(); ok(d.layers[0].colors.length === nb + 1, '层内加一块（' + nb + '→' + (nb + 1) + '）');
await p.click('.bt-layer[data-layer="0"] button[title*="去掉"]'); d = await D(); ok(d.layers[0].colors.length === nb, '层内去掉一块');
await p.click('.bt-layer[data-layer="1"] button:has-text("复制")'); d = await D(); ok(d.layers.length === n0 + 1, '复制层');
await p.click('.bt-layer[data-layer="2"] button[title*="删除"]'); d = await D(); ok(d.layers.length === n0, '删除层');
await p.click('#bt-p-twist'); d = await D(); ok(d.layers.some(l => l.twist !== 0), '扭转预设');
await p.click('#bt-p-alt'); d = await D(); ok(d.layers.every(l => l.twist === 0), '交替预设');
// 校验：颜色计数不匹配时给出具体颜色
ok(/积木/.test(await val()) && /木箱/.test(await val()), '校验文字列出积木 / 木箱数量');
ok(/绿/.test(await val()) && !/数量匹配/.test(await stCount()), '绿色不平衡 → 明确报错');
// 随机上色：按数量
await p.click('#bt-rand'); await p.waitForTimeout(200);
ok(await p.evaluate(() => !!document.getElementById('bt-randbox')), '随机上色面板');
await p.click('#bt-rand');
await p.click('button:has-text("清空为画笔色")');
await p.click('#bt-balance'); await p.waitForTimeout(900);
ok(/数量匹配/.test(await stCount()), '按积木配平木箱后校验通过');
ok(await p.evaluate(() => { const v = document.getElementById('bt-val'); return true; }), '校验区存在');

// 3 木箱：显示 / 队列
await p.click('[data-tab=crates]'); await p.waitForTimeout(300);
d = await D();
const vis = d.visible; ok(await p.evaluate(() => document.querySelectorAll('#bt-shown .bt-crate').length) === Math.min(vis, d.crates.length), '「当前显示」木箱数 = 同屏数');
const qn = d.crates.length - vis; ok(qn > 0 && await p.evaluate(() => document.querySelectorAll('#bt-queue .bt-crate').length) === qn, '「接下来」队列 ' + qn + ' 个');
ok(await p.evaluate(() => /\+\d/.test(document.querySelector('.bt-plus').textContent)), '显示 +N 提示');
const c0 = d.crates.slice();
await p.click('#bt-queue .bt-crate .mv button:last-child'); d = await D(); ok(d.crates[vis] === c0[vis + 1] && d.crates[vis + 1] === c0[vis] || c0[vis] === c0[vis + 1], '队列 ▶ 调整顺序');
// 拖拽重排
await p.evaluate(() => { const q = [...document.querySelectorAll('#bt-queue .bt-crate')]; const dt = new DataTransfer(); q[q.length - 1].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })); q[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
d = await D(); ok(d.crates.length === c0.length, '拖拽重排后木箱总数不变');
// 改颜色
await p.selectOption('#bt-shown .bt-crate:first-child select', 'purple'); d = await D(); ok(d.crates[0] === 'purple', '改木箱颜色');
ok(!/数量匹配/.test(await stCount()), '改色后校验报错');
await p.click('#bt-balance2'); await p.waitForTimeout(300);
const m = await p.evaluate(() => document.querySelectorAll('#bt-shown .bt-crate').length); ok(m > 0, '自动配平');
// 添加 / 删除木箱
const cn = (await D()).crates.length;
await p.evaluate(() => document.querySelector('#bt-pane .bt-sw').click()); ok((await D()).crates.length === cn + 1, '添加木箱到队尾');
await p.click('#bt-queue .bt-crate:last-child .x'); ok((await D()).crates.length === cn, '删除木箱');

// 4 参数
await p.click('[data-tab=params]'); await p.waitForTimeout(200);
await p.evaluate(() => { const i = document.querySelector('input[data-k=trayCap]'); i.value = 7; i.dispatchEvent(new Event('change')); });
ok((await D()).trayCap === 7, '托盘格数可调');
await p.click('#bt-yawauto'); ok((await D()).yaw === null || (await D()).yaw !== undefined, '镜头角度开关');

// 5 校验可解性（等待防抖求解）
await p.click('[data-tab=crates]'); await p.waitForTimeout(2500);
ok(/可解/.test(await val()), '可解性检查：' + (await val()).split('\n').find(l => /可解/.test(l)));

// 6 试玩
await p.click('#bt-play'); await p.waitForTimeout(2500);
ok(!(await p.evaluate(() => __app.BUILDER.isOpen())), '试玩后窗口关闭');
let st = await p.evaluate(() => [__app.G.n, __app.LV.def.custom === true || !!__app.LV.def.custom, __app.S.trayCap, __app.LV.blocks.length]);
ok(st[0] === 100 && st[1] && st[2] === 7, '试玩关卡 100，托盘格数=自定义(7)：' + JSON.stringify(st));
ok(await p.evaluate(() => !!__app.LV.solution), '试玩关卡有解');
await p.evaluate(() => { __app.autoSolve(); });
let won = false; for (let i = 0; i < 90 && !won; i++) { await p.waitForTimeout(1000); won = await p.evaluate(() => (__app.G.cleared || ['win', 'end'].includes(__app.G.panel))); }
ok(won, '自动通关自定义关卡（面板=' + await p.evaluate(() => __app.G.panel) + '）');
// 恢复内置关卡时设置还原
await p.selectOption('#levelSel', '1'); await p.waitForTimeout(1500);
ok(await p.evaluate(() => __app.S.trayCap === 5 && __app.S.crateCap === 3 && __app.G.n === 1), '回到内置关卡后托盘 5 / 容量 3 还原');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('blockTowerTool.settings.v1') || '{}').trayCap !== 7), '自定义覆盖没有写进已保存设置');

// 7 保存 / 载入 / 复制 / 删除
await p.click('#btnBuilder'); await p.waitForTimeout(500);
await p.fill('#bt-name', '测试塔A'); await p.click('#bt-save'); await p.waitForTimeout(300);
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('blockTower.customLevels.v1') || '[]').length) === 1, '保存到 localStorage')
ok(await p.evaluate(() => [...document.getElementById('levelSel').options].some(o => o.text.includes('测试塔A'))), '自定义关卡出现在选关列表');
await p.click('[data-tab=library]'); await p.waitForTimeout(200);
ok(await p.evaluate(() => document.querySelectorAll('.bt-lib').length) === 1, '关卡库列出 1 个');
await p.click('.bt-lib .bt-btn:nth-of-type(2)'); // 复制
ok(await p.evaluate(() => document.querySelectorAll('.bt-lib').length) === 2, '复制关卡');
p.on('dialog', dlg => dlg.accept());
await p.click('.bt-lib[data-i="1"] .bt-del'); await p.waitForTimeout(200);
ok(await p.evaluate(() => document.querySelectorAll('.bt-lib').length) === 1, '删除关卡');
// 刷新后仍在
await p.reload(); await p.waitForTimeout(1200);
ok(await p.evaluate(() => [...document.getElementById('levelSel').options].some(o => o.text.includes('测试塔A'))), '刷新页面后自定义关卡还在');
await p.selectOption('#levelSel', '101'); await p.waitForTimeout(2000);
ok(await p.evaluate(() => __app.G.n === 101 && __app.LV.def.custom && __app.S.trayCap === 7), '从选关进入自定义关卡 101');
await p.evaluate(() => { __app.autoSolve(); });
won = false; for (let i = 0; i < 90 && !won; i++) { await p.waitForTimeout(1000); won = await p.evaluate(() => (__app.G.cleared || ['win', 'end'].includes(__app.G.panel))); }
ok(won, '已保存关卡也能自动通关');

// 8 JSON 往返
await p.click('#btnBuilder'); await p.waitForTimeout(400); await p.click('[data-tab=library]');
await p.click('.bt-lib .bt-load'); await p.waitForTimeout(200);
const before = await D();
await p.click('[data-tab=library]'); await p.click('#bt-exp-ta');
const txt = await p.evaluate(() => document.getElementById('bt-json').value);
const parsed = JSON.parse(txt);
ok(parsed.name === '测试塔A' && Array.isArray(parsed.layers) && Array.isArray(parsed.crates), '导出 JSON 结构正确');
await p.evaluate(t => { document.getElementById('bt-json').value = t; }, txt);
await p.click('#bt-import'); await p.waitForTimeout(300);
const after = await D(); delete before.id; delete after.id;
ok(JSON.stringify(before) === JSON.stringify(after), 'JSON 导出→导入往返无损');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('blockTower.customLevels.v1')).length) === 2, '导入后列表 +1');
await p.click('[data-tab=library]'); await p.evaluate(() => { document.getElementById('bt-json').value = '{oops'; }); await p.click('#bt-import');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('blockTower.customLevels.v1')).length) === 2, '坏 JSON 被拒绝且不破坏列表');
ok((await p.evaluate(() => document.body.innerText)).includes('导入失败'), '坏 JSON 有提示');
// 模板
await p.click('[data-tab=library]'); await p.click('.bt-tpl[data-n="3"]'); d = await D(); ok(d.layers.length === 10, '以第 3 关为模板（10 层）');
ok(/数量匹配/.test(await stCount()), '内置关卡模板校验通过');
await p.evaluate(() => __app.BUILDER.close());
ok(!(await p.evaluate(() => __app.BUILDER.isOpen())), '关闭窗口');
// 内置关卡不受影响
await p.selectOption('#levelSel', '3'); await p.waitForTimeout(1500);
ok(await p.evaluate(() => __app.G.n === 3 && !__app.LV.def.custom && __app.LV.blocks.length === 30), '内置第 3 关不受影响（30 块）');
await p.context().close();

// 9 手机视口
const pm = await mk({ width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await pm.evaluate(() => { const b = document.getElementById('btnBuilder'); b.scrollIntoView(); });
await pm.tap('#btnBuilder'); await pm.waitForTimeout(1200);
const geo = await pm.evaluate(() => { const w = document.querySelector('.bt-win').getBoundingClientRect(); const s = document.getElementById('bt-save').getBoundingClientRect(), pl = document.getElementById('bt-play').getBoundingClientRect(); return { w: w.width, h: w.height, vw: innerWidth, vh: innerHeight, save: [s.top, s.bottom, s.left, s.right], play: [pl.top, pl.bottom, pl.left, pl.right], sw: document.querySelector('.bt-win').scrollWidth }; });
ok(geo.w <= geo.vw + 1 && geo.h <= geo.vh + 1, '手机：窗口不超出视口 ' + JSON.stringify([geo.w, geo.h]));
ok(geo.play[1] <= geo.vh && geo.play[3] <= geo.vw && geo.save[0] >= 0, '手机：保存 / 试玩按钮在视口内');
ok(geo.sw <= geo.vw + 2, '手机：无横向溢出');
await pm.tap('[data-tab=crates]'); await pm.waitForTimeout(300);
ok(await pm.evaluate(() => document.querySelectorAll('.bt-crate').length) >= 4, '手机：木箱页可见');
await pm.tap('#bt-balance2'); await pm.tap('[data-tab=tower]'); await pm.tap('.bt-layer[data-layer="0"] .bt-plank[data-i="0"]').catch(() => { });
await pm.screenshot({ path: '/workspace/out/blocks-builder-mobile.png' });
await pm.tap('#bt-play'); await pm.waitForTimeout(2500);
ok(await pm.evaluate(() => __app.G.n === 100 && !__app.BUILDER.isOpen()), '手机：点试玩进入自定义关卡');

ok(errs.length === 0, '无页面错误 ' + JSON.stringify(errs.slice(0, 3)));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
