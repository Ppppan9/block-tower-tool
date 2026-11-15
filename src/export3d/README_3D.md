# 积木塔 · 3D 动画导出（glTF 2.0）

- `blocktower_3d.glb`：树桩 + 每块积木（独立网格、木纹贴图）+ 相机 + 灯光 + 动画 `BlockTowerPlay`
  - 每块积木有 位置 / 旋转 / 缩放（缩放 0 = 已被取走，STEP 插值）关键帧，逐帧来自游戏里的真实刚体物理（含倒塌）。
  - `Tower` 节点的旋转 = 滑动转塔；`Camera` 的位置/朝向 = 缩放/开场推近。
  - 每一关一个 `Level_n_k` 节点，按时间显隐。
- `timeline3d.json`：帧率、总时长、每关起止时间、音效事件时间表。
- `audio/mix.wav`：音效混合音轨（可选）。
- `blender_import.py`：Blender 中运行，设置帧率/帧范围/分辨率并加载音轨。
- 单位：1 = 一个积木格；Y 向上。木箱 / 托盘 / HUD 等 2D 元素不在 3D 包里（见 AE 导出）。
- 不含 FBX：glTF 可直接导入 Blender / Unity / Unreal / Cinema4D / Maya（插件）；需要 FBX 请用 Blender 导入后再导出。
