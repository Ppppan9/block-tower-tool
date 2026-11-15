import { DEFAULT_HAND } from './default_hand.js';
import { h5DeviceSelectOptions } from './h5/index.js';
// 所有可调参数：默认值 + 面板分组描述
// kind: 'regen' 重新生成关卡 | 'mesh' 重建 3D 模型(保留进度) | 'art' 重绘 2D 素材 | 'res' 改变画布分辨率 | 无=实时生效
export const SETTINGS_VERSION = 1;
export const DEFAULTS = {
  theme: 'woodtown', themeStore: {}, settingsVersion: SETTINGS_VERSION,
  // 关卡 / 玩法
  startLevel: 1, seed: 20261115, customLevel: false, customLayers: 8, customPer: 3, customStyle: 'jenga', customColors: 'red,yellow,blue', customCrates: '',
  crateCap: 3, trayCap: 5, visibleCrates: 4, stabMargin: 0.035, warnMode: 'pull', showHints: true, tutorialHighlight: true,
  undoUnlock: 3, undoCount: 1, failFreeUndo: true, winPanel: true, autoNext: true, endAfterLevels: 5, failOnTrayFull: true, trayWarnLeft: 1,
  comboWords: 'Great!,Awesome!,Amazing!', comboEvery: 2, showPlusOne: true,
  // 积木外观
  blockLen: 3, blockWid: 0.98, blockHgt: 0.56, hgtScales: '1.04,1.0,0.98,0.95,0.92', blockRadius: 0.07, grain: 0.95, symbolDepth: 0.55, edgeShade: 0.2, blockGloss: 0.04,
  col_red: '#ef4a55', col_yellow: '#f3dc4a', col_blue: '#4a8fe2', col_green: '#5fd45a', col_orange: '#f59a3a', col_purple: '#7c4fd6',
  highlightColor: '#ffe14d', ghostAlpha: 0.7,
  // 树桩 / 场景
  stumpR: 2.5, stumpTop: '#fff1cb', stumpRing: '#f5c994', stumpBark: '#fdb47f', stumpBarkDark: '#c4926c', stumpCracks: true, mushroom: true, sprout: true,
  bgTop: '#4fb7ef', bgMid: '#9dd7f6', bgBottom: '#e4f5fd', bgGlow: 0.25, shadowStrength: 0.38, shadowSoft: 3, lightIntensity: 0.8, ambient: 2.3, exposure: 1.28, lightAngle: 40,
  // 镜头
  camElev: 24, camFov: 22, fitMargin: 0.045, fitTall: 4.9, levelZoom: '1,1,1,1,1', stumpWidths: '0.9,0.9,0.8,1.05,0.62', blockScales: '1.0,1.0,0.95,0.7,0.85', blockScaleDefault: 0.75, towerY: 0.72, zoomMin: 0.6, zoomMax: 2.2, rotateSpeed: 0.8, idleSpin: 0, startYaw: 22, startYaws: '160,94,160,8,-15', zoomIntro: true, introZoom: 1.55, introMs: 1100,
  // 界面
  hudColor: '#4c2a10', barColor: '#5ad34a', gearColor: '#f6a02c', crateScale4: 0.78, crateSlideMs: 380, tipMs: 3200, hudShow: true, showTray: true, showBoosters: true,
  winTitle: 'Level Complete!', winButton: 'Next Level', failTitle: 'Tower Fell!', failText: 'Take back the last pull. Free this time!', failButton: 'Play On - Free', trayTitle: 'Tray Full!', trayText: 'No room left on the tray.',
  // 动画
  pullSlide: 0.95, pullMs: 250, flyMs: 380, pullSfxDelay: 0.15, crateSfxLead: 125, flyArc: 0.2, flyScale: 1.0, crateFullMs: 520, popScale: 1.18, rewindMs: 850, collapseGraceMs: 2300, popupMs: 1400, shakeOnFall: 6,
  // 物理（倒塌动画）
  gravity: 24, friction: 0.55, restitution: 0.05, collapseKick: 0.7, collapseZoom: 0.52, linDamp: 0.05, angDamp: 0.1,
  // 粒子
  confettiCount: 70, debrisCount: 14, dustPuffs: 4, particleSize: 1, particleGravity: 1, confettiOnCrate: true, confettiOnWin: true,
  // 音效
  sfxMute: false, sfxVolume: 0.8, sfxSource: 'ref',
  sfxPull: true, sfxPullVol: 1, sfxLand: true, sfxLandVol: 1, sfxCrate: true, sfxCrateVol: 1, sfxFull: true, sfxFullVol: 1, sfxCombo: true, sfxComboVol: 1, sfxFall: true, sfxFallVol: 1,
  sfxWin: true, sfxWinVol: 1, sfxUndo: true, sfxUndoVol: 1, sfxWarn: true, sfxWarnVol: 1, sfxTray: true, sfxTrayVol: 1, sfxTap: true, sfxTapVol: 1,
  // 手指 / 自动通关
  autoSpeed: 1, moveMin: 380, moveMax: 700, delayMin: 220, delayMax: 520, thinkChance: 0.12, thinkMax: 900, jitter: 6, curve: 0.12,
  autoFailLevels: '', autoPrefer: 'safe',
  handSize: 0.42, handAnchorX: 0.22039473684210525, handAnchorY: 0.03667763157894737, handRotation: 6, handFlip: false, handImage: DEFAULT_HAND,
  pressDepth: 0.08, pressEnabled: true, tapRipple: false, rippleColor: '#ffe14d', rippleSize: 0.09, rippleWidth: 4, rippleDuration: 450, manualHand: true, hideCursor: true,
  // 录制
  recRes: '720x1600', recFps: 30, recFormat: 'auto', recBitrate: 8, autoRec: false, autoStop: true, tailSec: 2.5,
  // 导出 AE 工程
  aeWithRec: true, aeFps: 30, aeSize: 'canvas', aeSampling: 'reduce', aeNames: 'zh', aeAudio: 'both', aeSaveAep: true, aeTowerFps: 15, aeTowerScale: 0.5, aeTowerMax: 900, aeParticles: 'layers',
  // 导出 3D
  export3dFps: 30, export3dHand: true, export3dParticles: true,
  // 导出 H5 试玩广告
  h5Format: 'applovin,facebook,google,mintegral,moloco,tiktok,unity,generic', h5Orientation: '1', h5Device: 'adaptive', h5DeviceW: 390, h5DeviceH: 844,
  h5CtaText: '立即下载', h5StoreUrl: 'https://play.google.com/store/apps/details?id=com.example.game', h5GameName: '积木塔', h5Icon: '', h5MaxMb: 5, h5AutoPlay: false,
  // 结束页
  endCard: true, endCardHand: false, endDelay: 900, endTitle: 'Wood Town', endButton: '立即下载', endBg1: '#5cbaf0', endBg2: '#e4f5fd', endBtnColor: '#3cc23c', endTitleColor: '#ffd54a', endIcon: '',
};

const C = (k, label, extra = {}) => ({ k, label, type: 'color', ...extra });
const R = (k, label, min, max, step, extra = {}) => ({ k, label, type: 'range', min, max, step, ...extra });
const B = (k, label, extra = {}) => ({ k, label, type: 'checkbox', ...extra });
const SW = (k, label, extra = {}) => ({ k, label, type: 'switch', ...extra });
const T = (k, label, extra = {}) => ({ k, label, type: 'text', ...extra });
const S = (k, label, options, extra = {}) => ({ k, label, type: 'select', options, ...extra });
const F = (k, label, extra = {}) => ({ k, label, type: 'file', ...extra });

export const SCHEMA = [
  { group: '主题', open: true, items: [
    S('theme', '界面主题', [['woodtown', '木头小镇（参考视频，默认）'], ['dusk', '黄昏'], ['candy', '糖果']]),
    { k: '_resetTheme', label: '恢复当前主题默认外观', type: 'button', text: '↺ 恢复主题外观', action: 'resetTheme' },
  ]},
  { group: '关卡 / 玩法规则', open: true, items: [
    R('startLevel', '起始关卡(1~5，视频 5 关)', 1, 5, 1, { kind: 'regen' }),
    { k: 'seed', label: '随机种子（决定颜色排布）', type: 'number', kind: 'regen' },
    B('customLevel', '使用自定义塔（忽略 5 个预设关）', { kind: 'regen' }),
    R('customLayers', '自定义：层数', 2, 20, 1, { kind: 'regen' }),
    R('customPer', '自定义：每层块数(3 或 4)', 3, 4, 1, { kind: 'regen' }),
    S('customStyle', '自定义：叠法', [['jenga', '叠叠乐（奇偶层垂直）'], ['twist', '扭转交错（第4关）']], { kind: 'regen' }),
    T('customColors', '自定义：颜色(逗号分隔 red,yellow,blue,green,orange,purple)', { kind: 'regen' }),
    T('customCrates', '自定义：木箱顺序(留空=按颜色轮流)', { kind: 'regen', placeholder: '如 red,blue,blue,red,green,red' }),
    R('crateCap', '每个木箱容量', 2, 4, 1, { kind: 'regen' }),
    R('trayCap', '托盘格数(视频 5)', 3, 8, 1, { kind: 'regen' }),
    R('visibleCrates', '可见木箱数(视频 4)', 2, 5, 1, { kind: 'regen' }),
    R('stabMargin', '稳定性余量（越大越容易倒）', 0, 0.2, 0.005, { kind: 'regen' }),
    S('warnMode', '拔承重块时', [['pull', '提示后照常拔出（视频）'], ['confirm', '提示并要求再点一次确认'], ['block', '提示且不让拔'], ['off', '不提示']]),
    B('showHints', '显示教学提示气泡（各关提示语）'),
    B('tutorialHighlight', '第 1 关高亮第一个可拔积木（黄框）'),
    R('undoUnlock', '撤销按钮解锁关卡(视频 3)', 1, 6, 1),
    R('undoCount', '撤销次数', 0, 9, 1),
    B('failFreeUndo', '倒塌后免费撤销（Play On - Free）'),
    B('failOnTrayFull', '托盘满且无可入箱时判失败'),
    R('trayWarnLeft', '托盘剩几格时提示 “1 left!”', 0, 3, 1),
    B('winPanel', '通关后弹结算面板（Level Complete 面板）'),
    B('autoNext', '自动通关时自动点 Next Level'),
    R('endAfterLevels', '通关第几关后显示结束页(0=不显示)', 0, 9, 1),
    T('comboWords', '连击赞美词（逗号分隔）'),
    R('comboEvery', '每隔几次入箱出一次赞美词', 1, 6, 1),
    B('showPlusOne', '入箱显示 +1'),
  ]},
  { group: '积木外观', items: [
    R('blockLen', '积木长度', 2, 4, 0.05, { kind: 'regen' }),
    R('blockWid', '积木宽度', 0.5, 1.1, 0.01, { kind: 'regen' }),
    R('blockHgt', '积木厚度(基准)', 0.3, 1, 0.01, { kind: 'regen' }), T('hgtScales', '各关积木厚度系数（逗号分隔）', { kind: 'regen' }), T('levelZoom', '各关镜头缩放（逗号分隔，>1 拉近）'), T('stumpWidths', '各关树桩占画面宽度比例（逗号分隔；空=自动取景）'), T('blockScales', '各关积木整体缩放（逗号分隔，第 n 关取第 n 项）', { kind: 'regen' }), R('blockScaleDefault', '其余关卡积木缩放', 0.4, 1.2, 0.01, { kind: 'regen' }),
    R('blockRadius', '圆角', 0, 0.2, 0.005, { kind: 'mesh' }),
    R('grain', '木纹强度', 0, 1, 0.05, { kind: 'mesh' }),
    R('symbolDepth', '端面符号深浅', 0, 1, 0.05, { kind: 'mesh' }),
    R('edgeShade', '边缘压暗', 0, 0.6, 0.02, { kind: 'mesh' }),
    R('blockGloss', '高光', 0, 1, 0.05, { kind: 'mesh' }),
    C('col_red', '红色（圆点）', { kind: 'art' }), C('col_yellow', '黄色（圆环）', { kind: 'art' }), C('col_blue', '蓝色（菱形）', { kind: 'art' }),
    C('col_green', '绿色（方块）', { kind: 'art' }), C('col_orange', '橙色（十字）', { kind: 'art' }), C('col_purple', '紫色（星）', { kind: 'art' }),
    C('highlightColor', '高亮描边颜色', { kind: 'mesh' }),
    R('ghostAlpha', '被拔出时半透明度', 0.2, 1, 0.05),
  ]},
  { group: '树桩 / 场景', items: [
    R('stumpR', '树桩半径', 1.8, 4.5, 0.05, { kind: 'mesh' }),
    C('stumpTop', '树桩顶面颜色', { kind: 'mesh' }), C('stumpRing', '年轮颜色', { kind: 'mesh' }), C('stumpBark', '树皮颜色', { kind: 'mesh' }), C('stumpBarkDark', '树皮暗部', { kind: 'mesh' }),
    B('stumpCracks', '树桩裂纹线', { kind: 'mesh' }), B('mushroom', '小蘑菇', { kind: 'mesh' }), B('sprout', '嫩芽', { kind: 'mesh' }),
    C('bgTop', '天空颜色（顶）'), C('bgMid', '天空颜色（中）'), C('bgBottom', '天空颜色（底）'), R('bgGlow', '底部光晕', 0, 0.8, 0.01),
    R('shadowStrength', '投影强度', 0, 1, 0.01, { kind: 'mesh' }), R('shadowSoft', '投影柔和度', 0, 8, 0.5, { kind: 'mesh' }),
    R('lightIntensity', '主光强度', 0.3, 2.2, 0.05, { kind: 'mesh' }), R('ambient', '环境光', 0.2, 3, 0.05, { kind: 'mesh' }), R('exposure', '整体曝光', 0.6, 1.8, 0.01, { kind: 'mesh' }), R('lightAngle', '主光方位角', -180, 180, 5, { kind: 'mesh' }),
  ]},
  { group: '镜头 / 操作', items: [
    R('camElev', '俯视角度(度)', 10, 70, 1), R('camFov', '视场角', 10, 50, 1), R('fitMargin', '树桩最大宽度边距', 0, 0.3, 0.01), R('fitTall', '高塔取景：树桩宽度×塔高 ≤ 此值', 2, 9, 0.1), R('towerY', '塔底在画面中的纵向位置', 0.5, 0.9, 0.01),
    R('zoomMin', '最小缩放', 0.3, 1, 0.05), R('zoomMax', '最大缩放', 1, 4, 0.05), R('rotateSpeed', '滑动旋转灵敏度', 0.2, 2, 0.05), R('idleSpin', '空闲自转(度/秒)', 0, 40, 1),
    R('startYaw', '初始旋转角(度)', -180, 180, 1), T('startYaws', '各关初始旋转角（逗号分隔，空项用上面的值）'),
    B('zoomIntro', '关卡开始时镜头由近拉远'), R('introZoom', '开场拉远起始倍数', 1, 3, 0.05), R('introMs', '开场拉远时长(ms)', 0, 3000, 50),
  ]},
  { group: '界面 / 弹窗', items: [
    B('hudShow', '显示顶栏'), B('showTray', '显示托盘'), B('showBoosters', '显示底部道具栏'),
    C('hudColor', '顶栏颜色', { kind: 'art' }), C('barColor', '进度条颜色', { kind: 'art' }), C('gearColor', '齿轮颜色', { kind: 'art' }),
    R('crateScale4', '第 4 个木箱缩放', 0.5, 1, 0.01), R('crateSlideMs', '木箱队列滑动时长(ms)', 0, 1500, 10), R('tipMs', '提示气泡停留(ms)', 500, 8000, 100),
    T('winTitle', '通关面板标题', { kind: 'art' }), T('winButton', '通关面板按钮', { kind: 'art' }), T('failTitle', '倒塌面板标题', { kind: 'art' }), T('failText', '倒塌面板说明', { kind: 'art' }), T('failButton', '倒塌面板按钮', { kind: 'art' }),
    T('trayTitle', '托盘满标题', { kind: 'art' }), T('trayText', '托盘满说明', { kind: 'art' }),
  ]},
  { group: '动画', items: [
    R('pullSlide', '拔出滑动距离(积木长度比例)', 0.2, 1.4, 0.05), R('pullMs', '拔出时长(ms)', 60, 800, 10), R('pullSfxDelay', '“拔出”音效相对点击延迟(s，参考视频 0.15)', 0, 0.5, 0.01), R('crateSfxLead', '“入箱”音效提前量(ms，使撞击声对齐落箱)', 0, 300, 5), R('flyMs', '飞行时长(ms，视频≈300)', 100, 1200, 10), R('flyArc', '飞行弧度', 0, 0.8, 0.01), R('flyScale', '飞行最大放大', 0.6, 2, 0.05),
    R('crateFullMs', '木箱满箱脉冲时长(ms)', 100, 1500, 10), R('popScale', '满箱脉冲放大', 1, 1.6, 0.01), R('rewindMs', '撤销回放时长(ms)', 100, 2500, 50),
    R('collapseGraceMs', '倒塌多久后弹失败面板(ms)', 500, 6000, 100), R('popupMs', '赞美词/飘字停留(ms)', 300, 3000, 50), R('shakeOnFall', '倒塌时屏幕震动(px)', 0, 30, 1),
  ]},
  { group: '物理（倒塌动画 / cannon-es）', items: [
    R('gravity', '重力', 5, 60, 1), R('friction', '摩擦', 0.1, 1, 0.01), R('restitution', '弹性', 0, 0.6, 0.01), R('collapseKick', '倒塌初始扰动', 0, 2, 0.05), R('collapseZoom', '倒塌时镜头拉远系数(<1 拉远)', 0.4, 1, 0.01), R('linDamp', '线性阻尼', 0, 0.5, 0.01), R('angDamp', '角阻尼', 0, 0.8, 0.01),
  ]},
  { group: '粒子', items: [
    R('confettiCount', '彩带数量', 0, 200, 1), R('debrisCount', '拔出碎屑数量', 0, 60, 1), R('dustPuffs', '灰尘团数量', 0, 12, 1), R('particleSize', '粒子大小倍数', 0.3, 3, 0.05), R('particleGravity', '粒子重力倍数', 0.2, 3, 0.05),
    B('confettiOnCrate', '满箱撒彩带'), B('confettiOnWin', '通关撒彩带'),
  ]},
  { group: '音效', items: [
    B('sfxMute', '静音'), S('sfxSource', '音效来源', [['ref', '参考视频音轨片段（点击/拔出/入箱/通关）+ 合成补全'], ['synth', '全部合成']]), R('sfxVolume', '总音量', 0, 1.5, 0.01),
    B('sfxTap', '点击'), R('sfxTapVol', '点击 音量', 0, 2, 0.01), B('sfxPull', '拔出'), R('sfxPullVol', '拔出 音量', 0, 2, 0.01), B('sfxLand', '入槽'), R('sfxLandVol', '入槽 音量', 0, 2, 0.01),
    B('sfxCrate', '入箱'), R('sfxCrateVol', '入箱 音量', 0, 2, 0.01), B('sfxFull', '满箱'), R('sfxFullVol', '满箱 音量', 0, 2, 0.01), B('sfxCombo', '赞美词'), R('sfxComboVol', '赞美词 音量', 0, 2, 0.01),
    B('sfxFall', '倒塌'), R('sfxFallVol', '倒塌 音量', 0, 2, 0.01), B('sfxWin', '通关'), R('sfxWinVol', '通关 音量', 0, 2, 0.01), B('sfxUndo', '撤销'), R('sfxUndoVol', '撤销 音量', 0, 2, 0.01),
    B('sfxWarn', '提示'), R('sfxWarnVol', '提示 音量', 0, 2, 0.01), B('sfxTray', '托盘满'), R('sfxTrayVol', '托盘满 音量', 0, 2, 0.01),
    { k: '_sfxTest', label: '试听全部音效', type: 'button' },
  ]},
  { group: '手指 / 自动通关', open: true, items: [
    R('autoSpeed', '整体速度倍率', 0.25, 6, 0.05), R('moveMin', '移动耗时最小(ms)', 50, 2000, 10), R('moveMax', '移动耗时最大(ms)', 50, 3000, 10),
    R('delayMin', '点击间隔最小(ms)', 0, 2000, 10), R('delayMax', '点击间隔最大(ms)', 0, 4000, 10), R('thinkChance', '“思考停顿”概率', 0, 0.6, 0.01), R('thinkMax', '思考停顿最长(ms)', 0, 4000, 50),
    R('jitter', '落点随机抖动(px)', 0, 40, 1), R('curve', '移动路径弯曲度', 0, 0.6, 0.01),
    T('autoFailLevels', '演示“倒塌→免费撤销”的关卡(如 3,5；留空=不演示)', { placeholder: '如 3,5' }),
    S('autoPrefer', '自动选块偏好', [['safe', '求解器最短安全路线'], ['top', '尽量先拿高处'], ['random', '随机安全块']]),
    R('handSize', '手指大小(画面宽比例)', 0.1, 0.9, 0.01), R('handAnchorX', '指尖锚点 X(0~1)', 0, 1, 0.005), R('handAnchorY', '指尖锚点 Y(0~1)', 0, 1, 0.005),
    R('handRotation', '手指旋转(度)', -60, 60, 1), B('handFlip', '手指水平翻转'),
    F('handImage', '上传手指图片(透明PNG，不上传则不显示手指)'),
    R('pressDepth', '按压幅度', 0, 0.3, 0.01), B('pressEnabled', '点击按下效果'),
    B('tapRipple', '点击处显示波纹圈（参考视频没有）'), C('rippleColor', '点击波纹颜色'), R('rippleSize', '波纹大小', 0.02, 0.3, 0.005), R('rippleWidth', '波纹线宽', 1, 16, 0.5), R('rippleDuration', '波纹时长(ms)', 100, 1500, 10),
    B('manualHand', '手动游玩时手指跟随鼠标(需上传手指)'), B('hideCursor', '手指出现时隐藏鼠标'),
  ]},
  { group: '录制', open: true, items: [
    S('recRes', '输出分辨率', [['360x800', '360×800'], ['540x1200', '540×1200'], ['720x1600', '720×1600（视频）'], ['1080x2400', '1080×2400']], { kind: 'res' }),
    S('recFps', '帧率', [[24, '24'], [30, '30'], [60, '60']], { num: true }),
    S('recFormat', '格式', [['auto', '自动(优先 MP4)'], ['mp4', 'MP4'], ['webm', 'WebM']]),
    R('recBitrate', '码率(Mbps)', 1, 30, 0.5),
    B('autoRec', '自动通关开始时自动录制（默认关）'), B('autoStop', '自动通关通关后停止录制并下载（仅在正在录制时）'), R('tailSec', '通关后继续录制(秒)', 0, 10, 0.1),
  ]},
  { group: '导出 AE 工程', open: true, items: [
    { k: '_aeToggle', label: '记录 AE 时间轴（自动通关/手动游玩都可）', type: 'button', action: 'aeToggle', text: '● 开始记录' },
    { k: '_aeExport', label: '重新导出上一次记录', type: 'button', action: 'aeExport', text: '⬇ 导出 ZIP' },
    B('aeWithRec', '录制视频时同步记录，停止录制后自动导出'),
    S('aeFps', 'AE 合成帧率', [[24, '24'], [25, '25'], [30, '30'], [60, '60']], { num: true }),
    S('aeSize', 'AE 合成尺寸', [['canvas', '同画布分辨率'], ['720x1600', '720×1600'], ['1080x2400', '1080×2400']]),
    S('aeSampling', '关键帧方式', [['reduce', '精简关键帧（线性插值，误差 <0.3px）'], ['bake', '逐帧烘焙（每帧一个关键帧）']]),
    R('aeTowerFps', '积木塔预渲染序列帧率', 5, 30, 1), R('aeTowerScale', '积木塔序列缩放(内存/体积)', 0.25, 1, 0.05), R('aeTowerMax', '积木塔序列最多帧数', 60, 3000, 30),
    S('aeParticles', '彩带/碎屑粒子', [['layers', '每个粒子一层'], ['off', '不导出粒子']]),
    S('aeNames', '图层命名', [['zh', '中文'], ['en', 'English']]),
    S('aeAudio', '音频', [['both', '混合音轨 + 逐事件音效层'], ['mixed', '仅混合音轨'], ['events', '仅逐事件音效层'], ['none', '不导出音频']]),
    B('aeSaveAep', '脚本跑完后提示另存为 .aep'),
  ]},
  { group: '导出 3D 动画（UE5 / C4D / Blender）', open: true, items: [
    { k: '_export3d', label: '用上一次 AE 记录生成 glTF 场景（逐块 3D 位姿动画）+ Blender 脚本 + 音频', type: 'button', action: 'export3d', text: '导出 3D 动画 (glTF/FBX/Blender)' },
    S('export3dFps', '3D 动画帧率', [[24, '24'], [25, '25'], [30, '30'], [60, '60']], { num: true }),
    B('export3dParticles', '包含彩带/碎屑粒子（烘焙成带贴图的小平面）'),
    B('export3dHand', '包含手指（贴图平面；结束页是否显示仍按“结束页显示手指”）'),
  ]},
  { group: '导出 H5 试玩广告', open: true, items: [
    { k: '_exportH5', label: '导出当前设置为自包含 H5 试玩（无编辑器面板，仅游戏+CTA）', type: 'button', action: 'exportH5', text: '⬇ 导出 H5 试玩 ZIP' },
    S('h5Format', '渠道格式', [['applovin,facebook,google,mintegral,moloco,tiktok,unity,generic', '全部（AppLovin+Facebook+Google+Mintegral+Moloco+TikTok+Unity+Generic）'], ['tiktok,generic', 'TikTok + Generic'], ['applovin', '仅 AppLovin（MRAID）'], ['facebook', '仅 Facebook/Meta（≤2MB）'], ['google', '仅 Google Ads'], ['mintegral', '仅 Mintegral'], ['moloco', '仅 Moloco'], ['tiktok', '仅 TikTok/Pangle'], ['unity', '仅 Unity Ads（MRAID）'], ['generic', '仅 Generic 离线']]),
    S('h5Orientation', '试玩方向', [['0', '双端 (0)'], ['1', '竖屏 (1)'], ['2', '横屏 (2)']]),
    S('h5Device', '预览机型', h5DeviceSelectOptions()),
    R('h5DeviceW', '预览宽度(px)', 240, 1440, 1), R('h5DeviceH', '预览高度(px)', 400, 2560, 1),
    T('h5CtaText', 'CTA 按钮文案'), T('h5StoreUrl', '应用商店 / 落地页 URL'), T('h5GameName', '游戏名（可选）'), F('h5Icon', '应用图标（可选，透明PNG）'),
    R('h5MaxMb', '体积告警阈值(MB)', 1, 20, 0.5), B('h5AutoPlay', '打开试玩后自动通关演示'),
  ]},
  { group: '结束页(End Card)', items: [
    B('endCard', '显示结束页'), SW('endCardHand', '结束页显示手指（自动通关点按钮）'), R('endDelay', '通关后出现延迟(ms)', 0, 5000, 50),
    T('endTitle', '标题'), T('endButton', '按钮文字'), C('endBg1', '背景色(上)'), C('endBg2', '背景色(下)'), C('endBtnColor', '按钮颜色'), C('endTitleColor', '标题颜色'), F('endIcon', '应用图标图片'),
  ]},
];
