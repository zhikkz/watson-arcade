// 全局常量
export let W = 640;            // 内部分辨率的宽：随屏幕宽高比在 640~800 之间变化（手机上铺满屏幕）
export const H = 360;          // 内部分辨率的高：固定
export const UI_W = 640;       // 菜单界面的设计宽度（居中摆放）
export function setViewWidth(w) { W = w; }

// 画面与设备状态（由 main.js 维护）
export const VIEW = {
  rot: false,      // 竖屏手机上把整个画面旋转 90°，强制横屏游玩
  scale: 1,        // 1 个游戏像素 = 多少 CSS 像素
  touch: false,    // 是否为触屏设备（显示虚拟按键）
};
export const TILE = 24;
export const STEP = 1 / 60;    // 固定逻辑步长
export const GRAVITY = 1500;
export const MAX_FALL = 620;

// 瓦片碰撞类型
export const T_EMPTY = 0;
export const T_SOLID = 1;
export const T_PLAT = 2;       // 单向平台
export const T_SPIKE = 3;      // 地刺（不阻挡，接触受伤）
export const T_ICE = 4;        // 冰面（实心、打滑）
export const T_ACID = 5;       // 液体伤害区（熔渣 / 冷却液）
export const T_PHASE = 6;      // 叠加态平台（周期性存在的单向平台）

// 房间格子（含边框）
export const CELL_W = 26;
export const CELL_H = 15;

export const COLORS = {
  white: '#ffffff', ink: '#14101a', dim: '#9aa0b4', gold: '#ffd24a', data: '#62e6ff',
  hp: '#e5484d', hpBack: '#3a1620', heal: '#6ee06e', warn: '#ff5a4a', crit: '#ffe14a',
  burn: '#ff8a3a', freeze: '#8fdcff', shock: '#fff36a', rad: '#9dff5a',
  rare: ['#c8ccd6', '#6ee06e', '#62a8ff', '#c77dff', '#ffb13a'],
};
