// 内置字体（离线）：Baloo 2 ExtraBold（拉丁子集），SIL OFL 1.1 —— 与参考视频的圆润粗体风格一致
import baloo from './fonts/baloo800.woff';
export const FONT = '"BT Baloo","Baloo 2","Arial Rounded MT Bold","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",Arial,sans-serif';
export function loadFonts() {
  if (typeof FontFace === 'undefined') return Promise.resolve();
  const f = new FontFace('BT Baloo', `url(${baloo})`, { weight: '800' }); document.fonts.add(f);
  return f.load().catch(e => console.warn('font', e));
}
