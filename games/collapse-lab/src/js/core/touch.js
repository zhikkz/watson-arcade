// 触屏操作：虚拟摇杆与按键都画在游戏画面里（由 HUD 绘制），这里负责布局、命中判定和多点触控状态。
//
// 布局（横屏）：
//   左下角是移动摇杆（左右移动，向下 = 下跳 / 下砸的方向键）。两种模式，在「设置 → 摇杆位置」里切换：
//     固定（默认）：底座始终在左下角不动，只有中间的圆钮跟着手指；左半屏任意位置按下都按「相对底座的方向」算
//     跟随手指：按在哪里底座就出现在哪里，手指拖出范围时底座会跟着挪
//   右下角一组圆形按键：主手 / 跳 / 滚 / 副手 / 技能 / 保温杯，可互动时再多一个「互动」
//   小地图左边是暂停键；点右上角小地图 = 展开整张地图（再点任意位置收起）
import { W, H } from './config.js';
import { touchSet, touchClear } from './input.js';

// rx / by：圆心到屏幕右边、底边的距离（游戏像素）
const BUTTONS = [
  { id: 'atk1', act: 'atk1', rx: 42, by: 42, r: 27, color: '#ff6b5e' },
  { id: 'jump', act: 'jump', rx: 104, by: 34, r: 23, color: '#62e6ff' },
  { id: 'roll', act: 'roll', rx: 36, by: 104, r: 21, color: '#7be07b' },
  { id: 'atk2', act: 'atk2', rx: 92, by: 90, r: 21, color: '#ffd24a' },
  { id: 'skill', act: 'skill', rx: 156, by: 40, r: 20, color: '#c98bff' },
  { id: 'heal', act: 'heal', rx: 88, by: 142, r: 16, color: '#e8ecf4' },
  { id: 'interact', act: 'interact', rx: 34, by: 156, r: 18, color: '#ffe9a0', contextual: true },
  { id: 'pause', act: 'pause', rx: 124, top: 19, r: 11, color: '#9aa0b4' },
];
for (const b of BUTTONS) b.pid = null;

const STICK_R = 30;

function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* 不支持就算了 */ }
}

export const touch = {
  buttons: BUTTONS,
  stick: { pid: null, ox: 0, oy: 0, dx: 0, dy: 0 },
  stickR: STICK_R,
  fixed: true,             // 摇杆位置固定（由 Game 按设置同步）
  showInteract: false,     // 由 HUD 每帧更新：当前是否有可互动的东西
  mapOpen: false,          // 点小地图展开的大地图

  /** 按键圆心（随视口宽度变化） */
  pos(b) { return { x: b.left !== undefined ? b.left : W - b.rx, y: b.top !== undefined ? b.top : H - b.by }; },

  /** 摇杆的固定位置（也是「跟随手指」模式下没按时的显示位置） */
  home() { return { x: 82, y: H - 78 }; },

  /** 小地图区域（与 HUD 保持一致） */
  miniRect() { return { x: W - 104, y: 8, w: 96, h: 54 }; },

  /** 按下：返回是否被触控层消费 */
  down(pid, x, y) {
    if (this.mapOpen) { this.mapOpen = false; return true; }
    // 1) 按键：取命中范围内最近的一个
    let best = null, bd = 1e9;
    for (const b of BUTTONS) {
      if (b.pid !== null) continue;
      if (b.contextual && !this.showInteract) continue;
      const p = this.pos(b);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d <= b.r + 8 && d < bd) { bd = d; best = b; }
    }
    if (best) {
      best.pid = pid;
      touchSet(best.act, true);
      vibrate(best.id === 'atk1' || best.id === 'jump' ? 6 : 4);
      return true;
    }
    // 2) 小地图
    const m = this.miniRect();
    if (x >= m.x - 6 && x <= m.x + m.w + 6 && y >= m.y - 6 && y <= m.y + m.h + 6) { this.mapOpen = true; return true; }
    // 3) 左半屏：浮动摇杆
    const s = this.stick;
    if (s.pid === null && x < W * 0.46 && y > 34) {
      s.pid = pid;
      if (this.fixed) { const h = this.home(); s.ox = h.x; s.oy = h.y; } else { s.ox = Math.max(STICK_R + 6, x); s.oy = Math.min(H - STICK_R - 6, Math.max(STICK_R + 40, y)); }
      this.move(pid, x, y);
      return true;
    }
    return false;
  },

  move(pid, x, y) {
    const s = this.stick;
    if (s.pid !== pid) return;
    let dx = x - s.ox, dy = y - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      if (!this.fixed) {
        // 跟随手指模式：手指拖出范围时，底座跟着手指走一点，避免「够不着」
        const over = d - STICK_R;
        s.ox += dx / d * over * 0.5; s.oy += dy / d * over * 0.5;
        dx = x - s.ox; dy = y - s.oy;
      }
      // 圆钮不超出底座（固定模式下底座不动，只取方向）
      const d2 = Math.hypot(dx, dy);
      if (d2 > STICK_R) { dx *= STICK_R / d2; dy *= STICK_R / d2; }
    }
    s.dx = dx; s.dy = dy;
    this.applyStick();
  },

  applyStick() {
    const s = this.stick;
    const on = s.pid !== null;
    touchSet('left', on && s.dx < -8);
    touchSet('right', on && s.dx > 8);
    // 「下」需要明显朝下推，免得斜着跑的时候误触下跳 / 下砸
    touchSet('down', on && s.dy > 16 && s.dy > Math.abs(s.dx) * 1.1);
  },

  up(pid) {
    for (const b of BUTTONS) if (b.pid === pid) { b.pid = null; touchSet(b.act, false); }
    const s = this.stick;
    if (s.pid === pid) { s.pid = null; s.dx = s.dy = 0; this.applyStick(); }
  },

  /** 进入菜单 / 失焦时：松开所有虚拟按键 */
  reset() {
    for (const b of BUTTONS) b.pid = null;
    this.stick.pid = null; this.stick.dx = this.stick.dy = 0;
    this.mapOpen = false;
    touchClear();
  },

  get busy() { return this.stick.pid !== null || BUTTONS.some((b) => b.pid !== null); },
};
