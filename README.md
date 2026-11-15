# 积木塔 · 核玩工具

在线体验：https://ppppan9.github.io/block-tower-tool/

一个纯前端、**离线可用**的「积木塔」（3D 木块抽拔 + 木箱收集）广告玩法复刻工具：three.js 3D 木块塔、刚体物理倒塌、木箱队列、5 格托盘、手指自动通关、录屏、AE / 3D / H5 试玩导出，以及覆盖全部玩法与外观参数的控制面板（设置保存到 localStorage，可导入 / 导出 JSON）。

## 打开方式
解压后双击 `index.html`（Chrome / Edge），无需服务器和联网，所有代码、字体、贴图都内联在 `index.html` 里。

## 玩法（按参考视频逐帧复刻）
- 点一块木块 → 抽出并弧线飞（缩小成 2D 小图标）**直接进匹配颜色/符号的可见木箱**；没有可匹配的木箱才进托盘最左空格。
- 木箱队列（4 个，每个 3 格）装满后弹跳 + 彩带，队列左滑补入新木箱；托盘里的块若匹配新出现的木箱会飞进去。
- 抽出承重块可能让塔倒塌（"Tower Fell!"），可「撤销」回退；托盘满且无匹配 = 失败。滑动旋转塔，双指/滚轮缩放。
- HUD：等级条（进度 n/总数）、齿轮、底部道具（撤销）。弹窗：+N、连击词（Good/Great/…）、提示气泡、Level Complete。
- 关卡：L1 12 块、L2 18、L3 30、L4 24（扭转层）、L5 39；之后按规则生成。每关由求解器保证可解。

## 使用
- **▶ 自动通关**：用 DFS 求解器 + 手指（`src/default_hand.js`，上传 PNG 即替换）自动完成 5 关，必要时滑动转塔找可点面。**不会自动开始录制**。
- **⏺ 录制**：录制画布（MP4 / WebM，含音效）。
- **导出 AE 工程**：zip（`timeline.json` + `build_ae_project.jsx` + 素材 + 音频；积木塔为预渲染透明 PNG 序列）。
- **导出 3D 动画**：zip（glTF `.glb`：树桩 + 每块积木逐帧位姿 + 相机 + Blender 脚本 + 音频）。
- **导出 H5 试玩**：8 渠道（AppLovin / Facebook / Google / Mintegral / Moloco / TikTok / Unity / Generic），机型预设 / 自适应，试玩包不带手指。
- 主题：木屋小镇（默认）/ 暮色 / 糖果。

## 开发
```
npm install
npm run build      # → index.html（单文件）
npm run test:all   # 逻辑 / 规则 / 导出 / H5 / 光标 测试（Playwright + google-chrome）
npm run compare    # 生成与参考视频的对照图 → ../out/blocks-compare-*.png
```
结构：`src/core.js`（关卡生成 / 稳定性 / 求解器 / 规则）、`src/scene3d.js`（three.js 场景 + cannon-es 倒塌）、`src/art.js`（2D 素材）、`src/main.js`（HUD / 动画 / 输入 / 自动通关 / 面板 / 导出）。

## 与参考视频的差异
见发布说明；HUD 小图标和熊猫吉祥物为程序绘制近似，音效为 WebAudio 合成。
