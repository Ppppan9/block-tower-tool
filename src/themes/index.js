// 主题注册表：一个主题 = 默认设置覆盖（defaults）。woodtown = 参考视频外观（DEFAULTS 本身）
export const THEMES = {
  woodtown: { id: 'woodtown', name: '木头小镇', defaults: {} },
  dusk: { id: 'dusk', name: '黄昏', defaults: {
    bgTop: '#3b3f8c', bgMid: '#d46b8a', bgBottom: '#ffd29a', bgGlow: 0.18, hudColor: '#2c1a3a', barColor: '#ffb43a', gearColor: '#ffb43a', stumpTop: '#e8c7a0', stumpBark: '#a9603f', stumpBarkDark: '#7a3f2b',
    col_red: '#e8445a', col_yellow: '#ffd24a', col_blue: '#4a7de2', col_green: '#58c878', col_orange: '#ff8a3a', col_purple: '#8a58d6', lightAngle: 110, lightIntensity: 1.15, ambient: 0.6 } },
  candy: { id: 'candy', name: '糖果', defaults: {
    bgTop: '#ffb6d9', bgMid: '#ffdff0', bgBottom: '#fff6fb', bgGlow: 0.3, hudColor: '#8a3a64', barColor: '#ff6fb1', gearColor: '#ff8cc6', stumpTop: '#fff0dc', stumpRing: '#f3c9a8', stumpBark: '#f0a0b8', stumpBarkDark: '#d0708f',
    col_red: '#ff5c8a', col_yellow: '#ffe45c', col_blue: '#5cb8ff', col_green: '#6fe0a0', col_orange: '#ffa65c', col_purple: '#b27cff', blockGloss: 0.5 } },
};
export const THEME_KEYS = [...new Set([...Object.keys(THEMES.dusk.defaults), ...Object.keys(THEMES.candy.defaults), 'stumpRing', 'bgGlow'])];
export function themeDefaults(DEFAULTS, id) {
  const base = {}; for (const k of THEME_KEYS) base[k] = DEFAULTS[k];
  return { ...base, ...((THEMES[id] || THEMES.woodtown).defaults) };
}
